from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.schemas.connection import ConnectionResponse
from app.repositories.connection import ConnectionRepository
from app.repositories.user import UserRepository
from app.repositories.trip import TripRepository
from app.routes.auth import get_current_user

router = APIRouter(prefix="/connections", tags=["Connections"])

user_repo = UserRepository()
trip_repo = TripRepository()

async def resolve_connection(conn: dict, current_user_id: str) -> dict:
    """Nests the buddy profile and shared trip info into the connection record."""
    buddy_id = conn["user2_id"] if conn["user1_id"] == current_user_id else conn["user1_id"]
    buddy = await user_repo.get_by_id(buddy_id)
    trip = await trip_repo.get_by_id(conn["trip_id"])
    
    buddy_mini = {
        "id": buddy["id"] if buddy else buddy_id,
        "name": buddy["name"] if buddy else "Unknown User",
        "profile_photo": buddy.get("profile_photo") if buddy else None,
        "bio": buddy.get("bio") if buddy else None,
        "interests": buddy.get("interests", []) if buddy else [],
        "travel_style": buddy.get("travel_style", []) if buddy else []
    }
    
    trip_mini = {
        "id": trip["id"] if trip else conn["trip_id"],
        "destination": trip["destination"] if trip else "Unknown Destination",
        "start_date": trip["start_date"] if trip else None,
        "end_date": trip["end_date"] if trip else None,
        "approximate_budget": trip["approximate_budget"] if trip else 0.0,
        "description": trip.get("description") if trip else None
    }
    
    conn["buddy"] = buddy_mini
    conn["shared_trip"] = trip_mini
    return conn

@router.get("", response_model=List[ConnectionResponse])
async def get_connections(
    current_user: dict = Depends(get_current_user),
    conn_r: ConnectionRepository = Depends()
):
    """Retrieve all mutual connections for the current user."""
    connections = await conn_r.get_user_connections(user_id=current_user["id"])
    resolved = [await resolve_connection(c, current_user["id"]) for c in connections]
    return resolved

@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_connection(
    connection_id: str,
    current_user: dict = Depends(get_current_user),
    conn_r: ConnectionRepository = Depends()
):
    """Remove a connection between the current user and a travel buddy."""
    # Find connection details first to log the unmatch interaction
    conn = await conn_r.get_by_id(connection_id)
    if conn:
        try:
            from app.services.ml_service import MLService
            from app.services.matching_service import MatchingService
            
            ml_service = MLService()
            matching_service = MatchingService()
            
            buddy_id = conn["user2_id"] if conn["user1_id"] == current_user["id"] else conn["user1_id"]
            buddy_user = await user_repo.get_by_id(buddy_id)
            trip_obj = await trip_repo.get_by_id(conn["trip_id"])
            
            feats = matching_service.calculate_features(trip_obj, current_user, None, buddy_user)
            await ml_service.log_interaction(
                sender_id=conn["user1_id"],
                receiver_id=conn["user2_id"],
                trip_id=conn["trip_id"],
                features=feats,
                status="unmatched",
                label=0
            )
        except Exception as e:
            print(f"Error logging unmatch interaction: {e}")

    deleted = await conn_r.delete_connection(connection_id=connection_id, user_id=current_user["id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to remove connection (either not found or you are not authorized)"
        )
    return None
