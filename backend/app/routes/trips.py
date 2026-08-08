from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.schemas.trip import TripCreate, TripUpdate, TripResponse
from app.repositories.trip import TripRepository
from app.routes.auth import get_current_user

router = APIRouter(prefix="/trips", tags=["Trips"])

@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(
    trip_data: TripCreate,
    current_user: dict = Depends(get_current_user),
    trip_repo: TripRepository = Depends()
):
    """Create a new travel trip."""
    from app.services.weather import WeatherService
    
    coords = await WeatherService.get_coordinates(trip_data.destination)
    if not coords:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to find this destination. Please check the location name."
        )
    
    lat, lon, fullname, timezone = coords
    
    trip_dict = trip_data.model_dump()
    trip_dict["destination"] = fullname
    trip_dict["latitude"] = lat
    trip_dict["longitude"] = lon
    trip_dict["timezone"] = timezone
    
    trip = await trip_repo.create_trip(
        user_id=current_user["id"],
        trip_data=trip_dict
    )
    return trip

@router.get("", response_model=List[TripResponse])
async def get_my_trips(
    current_user: dict = Depends(get_current_user),
    trip_repo: TripRepository = Depends()
):
    """Retrieve all trips created by the current user."""
    return await trip_repo.get_user_trips(user_id=current_user["id"])

@router.get("/public", response_model=List[TripResponse])
async def get_public_trips(
    current_user: dict = Depends(get_current_user),
    trip_repo: TripRepository = Depends()
):
    """Retrieve all trips created by other users (public discoverable trips)."""
    trips = await trip_repo.get_active_trips_excluding_user(user_id=current_user["id"])
    
    # Fetch current user's trips to match against
    my_trips = await trip_repo.get_user_trips(user_id=current_user["id"])
    
    from app.services.matching_service import MatchingService
    matching_service = MatchingService()
    
    from app.config.db import get_database
    from bson import ObjectId
    db = get_database()
    if db is not None:
        for trip in trips:
            owner = await db.users.find_one({"_id": ObjectId(trip["user_id"])})
            if owner:
                trip["owner_name"] = owner.get("name")
                trip["owner_profile_photo"] = owner.get("profile_photo")
                trip["owner_bio"] = owner.get("bio")
                
                # Calculate compatibility score for this trip
                best_score = 0.0
                best_metadata = None
                
                if my_trips:
                    for my_trip in my_trips:
                        score, metadata = matching_service.calculate_score(
                            tripA=my_trip,
                            userA=current_user,
                            tripB=trip,
                            userB=owner
                        )
                        if score >= best_score:
                            best_score = score
                            best_metadata = metadata
                else:
                    best_score, best_metadata = matching_service.calculate_score(
                        tripA=None,
                        userA=current_user,
                        tripB=trip,
                        userB=owner
                    )
                
                trip["compatibility"] = f"{int(best_score)}% Match"
                trip["match_score"] = best_score
                trip["match_tier"] = best_metadata.get("tier", "Possible Match") if best_metadata else "Possible Match"
                trip["match_reasons"] = best_metadata.get("reasons", []) if best_metadata else []
                trip["match_method"] = best_metadata.get("method", "Rule-Based") if best_metadata else "Rule-Based"
                
    # Sort trips by match_score descending
    trips.sort(key=lambda x: x.get("match_score", 0.0), reverse=True)
    return trips

@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip_details(
    trip_id: str,
    current_user: dict = Depends(get_current_user),
    trip_repo: TripRepository = Depends()
):
    """Fetch details of a specific trip."""
    trip = await trip_repo.get_by_id(trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )
    
    # Resolve owner profile information
    from app.config.db import get_database
    from bson import ObjectId
    db = get_database()
    if db is not None:
        owner = await db.users.find_one({"_id": ObjectId(trip["user_id"])})
        if owner:
            trip["owner_name"] = owner.get("name")
            trip["owner_profile_photo"] = owner.get("profile_photo")
            trip["owner_bio"] = owner.get("bio")
            
        # Resolve members profiles
        members_list = []
        member_ids = trip.get("members", [])
        if member_ids:
            obj_ids = []
            str_ids = []
            for m_id in member_ids:
                try:
                    obj_ids.append(ObjectId(m_id))
                except Exception:
                    pass
                str_ids.append(str(m_id))
                
            cursor = db.users.find({
                "$or": [
                    {"_id": {"$in": obj_ids}},
                    {"id": {"$in": str_ids}}
                ]
            })
            users_docs = await cursor.to_list(length=100)
            for u in users_docs:
                members_list.append({
                    "id": str(u["_id"]),
                    "name": u["name"],
                    "profile_photo": u.get("profile_photo"),
                    "bio": u.get("bio"),
                    "interests": u.get("interests", []),
                    "travel_style": u.get("travel_style", [])
                })
        trip["members_profiles"] = members_list
            
    return trip

@router.put("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: str,
    trip_data: TripUpdate,
    current_user: dict = Depends(get_current_user),
    trip_repo: TripRepository = Depends()
):
    """Update trip details. Only the trip owner can perform this operation."""
    # Verify trip exists and belongs to current user
    trip = await trip_repo.get_by_id(trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )
    if trip["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not own this trip"
        )

    trip_dict = trip_data.model_dump(exclude_unset=True)
    if "destination" in trip_dict and trip_dict["destination"]:
        from app.services.weather import WeatherService
        coords = await WeatherService.get_coordinates(trip_dict["destination"])
        if not coords:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to find this destination. Please check the location name."
            )
        lat, lon, fullname, timezone = coords
        trip_dict["destination"] = fullname
        trip_dict["latitude"] = lat
        trip_dict["longitude"] = lon
        trip_dict["timezone"] = timezone

    updated_trip = await trip_repo.update_trip(
        trip_id=trip_id,
        user_id=current_user["id"],
        update_data=trip_dict
    )
    if not updated_trip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update trip"
        )

    # Notify connected buddies about the trip update
    try:
        from app.config.db import get_database
        from app.services.notification_service import NotificationService
        db = get_database()
        if db is not None:
            cursor = db.connections.find({"trip_id": trip_id})
            connections = await cursor.to_list(length=100)
            for conn in connections:
                buddy_id = conn["user2_id"] if conn["user1_id"] == current_user["id"] else conn["user1_id"]
                await NotificationService.create_notification(
                    user_id=buddy_id,
                    type_="trip_update",
                    title="Trip Details Updated",
                    message=f"{current_user['name']} updated details for the trip to {updated_trip['destination']}.",
                    link=f"/trips/{trip_id}"
                )
    except Exception as e:
        print(f"Error sending trip update notifications: {e}")

    return updated_trip

@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: str,
    current_user: dict = Depends(get_current_user),
    trip_repo: TripRepository = Depends()
):
    """Delete a trip. Only the trip owner can perform this operation."""
    trip = await trip_repo.get_by_id(trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )
    if trip["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not own this trip"
        )

    deleted = await trip_repo.delete_trip(trip_id=trip_id, user_id=current_user["id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to delete trip"
        )
    return None
