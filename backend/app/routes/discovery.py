from fastapi import APIRouter, Depends
from typing import List
from app.repositories.trip import TripRepository
from app.repositories.user import UserRepository
from app.routes.auth import get_current_user
from app.services.matching_service import MatchingService
from app.config.db import get_database
from app.utils.db_helpers import serialize_docs

router = APIRouter(prefix="/travel-buddies", tags=["Discovery"])

matching_service = MatchingService()

@router.get("", response_model=List[dict])
async def get_travel_buddies(
    current_user: dict = Depends(get_current_user),
    trip_repo: TripRepository = Depends(),
    user_repo: UserRepository = Depends()
):
    """
    Discover other travelers (Option 2).
    Calculates compatibility scores against the current user's profile and trips,
    returning a sorted list of travelers.
    """
    # Fetch blocks to filter out blocked users
    db = get_database()
    if db is None:
        raise RuntimeError("Database not initialized")
        
    blocked_cursor = db.blocks.find({"blocker_id": current_user["id"]})
    blocked_docs = await blocked_cursor.to_list(length=100)
    blocked_ids = {b["blocked_id"] for b in blocked_docs}
    
    blocking_cursor = db.blocks.find({"blocked_id": current_user["id"]})
    blocking_docs = await blocking_cursor.to_list(length=100)
    blocking_ids = {b["blocker_id"] for b in blocking_docs}
    
    exclude_ids = blocked_ids | blocking_ids

    # Fetch all other users
    from bson import ObjectId
    user_cursor = db.users.find({"_id": {"$ne": ObjectId(current_user["id"])}})
    other_users = await user_cursor.to_list(length=100)
    other_users = serialize_docs(other_users)
    
    # Fetch current user's trips to match against
    my_trips = await trip_repo.get_user_trips(user_id=current_user["id"])
    
    discovery_list = []
    for other_user in other_users:
        other_user_id = other_user["id"]
        if other_user_id in exclude_ids:
            continue
            
        other_user_mini = {
            "id": other_user_id,
            "name": other_user["name"],
            "profile_photo": other_user.get("profile_photo"),
            "bio": other_user.get("bio"),
            "home_city": other_user.get("home_city"),
            "interests": other_user.get("interests", []),
            "travel_style": other_user.get("travel_style", [])
        }

        # Fetch other user's active trips
        other_user_trips = await trip_repo.get_user_trips(user_id=other_user_id)
        
        # Calculate compatibility: match all trips and profiles, select the highest score
        best_score = 0.0
        best_metadata = {
            "tier": "Possible Match",
            "reasons": [],
            "method": "Rule-Based Compatibility"
        }
        best_trip = None
        
        if my_trips and other_user_trips:
            for my_trip in my_trips:
                for o_trip in other_user_trips:
                    score, metadata = matching_service.calculate_score(
                        tripA=my_trip,
                        userA=current_user,
                        tripB=o_trip,
                        userB=other_user
                    )
                    if score >= best_score:
                        best_score = score
                        best_metadata = metadata
                        best_trip = o_trip
        elif my_trips:
            for my_trip in my_trips:
                score, metadata = matching_service.calculate_score(
                    tripA=my_trip,
                    userA=current_user,
                    tripB=None,
                    userB=other_user
                )
                if score >= best_score:
                    best_score = score
                    best_metadata = metadata
                    best_trip = None
        elif other_user_trips:
            for o_trip in other_user_trips:
                score, metadata = matching_service.calculate_score(
                    tripA=None,
                    userA=current_user,
                    tripB=o_trip,
                    userB=other_user
                )
                if score >= best_score:
                    best_score = score
                    best_metadata = metadata
                    best_trip = o_trip
        else:
            # Fallback to Profile-Only matching (cold start)
            best_score, best_metadata = matching_service.calculate_score(
                tripA=None,
                userA=current_user,
                tripB=None,
                userB=other_user
            )
            
        # Format display card attributes
        dest = best_trip["destination"] if best_trip else (other_user.get("home_city") or "Anywhere")
        start_date = best_trip["start_date"] if best_trip else None
        end_date = best_trip["end_date"] if best_trip else None
        budget = best_trip["approximate_budget"] if best_trip else (300.0 if other_user.get("budget_preference") == "Budget" else 800.0)
        desc = best_trip.get("description") if best_trip else (other_user.get("bio") or "Looking for travel plans")
        num_travelers = best_trip.get("number_of_travelers", 1) if best_trip else 1
        
        card = {
            "id": other_user_id,  # Target Traveler user ID
            "destination": dest,
            "start_date": start_date,
            "end_date": end_date,
            "approximate_budget": budget,
            "travel_interests": other_user.get("interests", []),
            "preferred_travel_style": other_user.get("travel_style", []),
            "number_of_travelers": num_travelers,
            "description": desc,
            "user": other_user_mini,
            "compatibility": f"{int(best_score)}% Match",
            "match_score": best_score,
            "match_tier": best_metadata.get("tier", "Possible Match"),
            "match_reasons": best_metadata.get("reasons", []),
            "match_method": best_metadata.get("method", "Rule-Based"),
            "trip_id": best_trip["id"] if best_trip else None
        }
        discovery_list.append(card)
        
    # Sort discovery list by match score descending (Best Match -> Low Match)
    discovery_list.sort(key=lambda x: x["match_score"], reverse=True)
    return discovery_list
