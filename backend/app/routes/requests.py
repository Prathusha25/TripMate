from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.schemas.request import TravelRequestCreate, TravelRequestResponse
from app.repositories.request import RequestRepository
from app.repositories.trip import TripRepository
from app.repositories.user import UserRepository
from app.repositories.connection import ConnectionRepository
from app.routes.auth import get_current_user
from app.services.matching_service import MatchingService
from app.services.ml_service import MLService
from app.config.db import get_database
from bson import ObjectId

matching_service = MatchingService()
ml_service = MLService()

router = APIRouter(tags=["Requests"])

request_repo = RequestRepository()
trip_repo = TripRepository()
user_repo = UserRepository()
connection_repo = ConnectionRepository()

async def resolve_request_details(req: dict) -> dict:
    """Helper to nest sender, receiver, and trip details into request object."""
    # Ensure backward compatible fields exist
    if "sender_id" not in req and "requester_id" in req:
        req["sender_id"] = req["requester_id"]
    if "receiver_id" not in req and "trip_owner_id" in req:
        req["receiver_id"] = req["trip_owner_id"]
    if "requester_id" not in req and "sender_id" in req:
        req["requester_id"] = req["sender_id"]
    if "trip_owner_id" not in req and "receiver_id" in req:
        req["trip_owner_id"] = req["receiver_id"]

    sender = await user_repo.get_by_id(req["sender_id"])
    receiver = await user_repo.get_by_id(req["receiver_id"])
    trip = await trip_repo.get_by_id(req["trip_id"]) if req.get("trip_id") else None
    
    sender_mini = {
        "id": sender["id"],
        "name": sender["name"],
        "profile_photo": sender.get("profile_photo"),
        "bio": sender.get("bio"),
        "interests": sender.get("interests", []),
        "travel_style": sender.get("travel_style", [])
    } if sender else None

    receiver_mini = {
        "id": receiver["id"],
        "name": receiver["name"],
        "profile_photo": receiver.get("profile_photo"),
        "bio": receiver.get("bio"),
        "interests": receiver.get("interests", []),
        "travel_style": receiver.get("travel_style", [])
    } if receiver else None

    trip_mini = {
        "id": trip["id"],
        "destination": trip["destination"],
        "start_date": trip["start_date"],
        "end_date": trip["end_date"],
        "approximate_budget": trip["approximate_budget"],
        "description": trip.get("description")
    } if trip else None

    req["sender"] = sender_mini
    req["receiver"] = receiver_mini
    req["trip"] = trip_mini
    return req

# ==========================================
# OLD /requests ENDPOINTS (BACKWARD COMPATIBLE)
# ==========================================

@router.post("/requests", response_model=TravelRequestResponse, status_code=status.HTTP_201_CREATED)
async def send_travel_request(
    request_data: TravelRequestCreate,
    current_user: dict = Depends(get_current_user),
    req_r: RequestRepository = Depends(),
    trip_r: TripRepository = Depends(),
    user_r: UserRepository = Depends()
):
    """Send a travel buddy request (Option 2) or a trip join request (Option 1) to another user."""
    if request_data.receiver_id == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a travel buddy request to yourself"
        )
        
    receiver = await user_r.get_by_id(request_data.receiver_id)
    if not receiver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receiver user not found"
        )
        
    req_type = request_data.request_type or "trip_join"
    
    if req_type == "buddy_request":
        # Check duplicate travel buddy request
        existing = await req_r.get_by_sender_receiver_type(
            sender_id=current_user["id"],
            receiver_id=request_data.receiver_id,
            request_type="buddy_request"
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A pending or accepted travel buddy request already exists between you"
            )
        trip = None
        if request_data.trip_id:
            trip = await trip_r.get_by_id(request_data.trip_id)
    else:
        # Defaults to trip_join request
        if not request_data.trip_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="trip_id is required for trip join requests"
            )
        trip = await trip_r.get_by_id(request_data.trip_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip not found"
            )
        existing = await req_r.get_by_sender_receiver_trip(
            sender_id=current_user["id"],
            receiver_id=request_data.receiver_id,
            trip_id=request_data.trip_id
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A pending or accepted request already exists for this trip"
            )

    new_req = await req_r.create_request(
        sender_id=current_user["id"],
        receiver_id=request_data.receiver_id,
        trip_id=request_data.trip_id,
        request_type=req_type
    )
    
    try:
        feats = matching_service.calculate_features(trip, current_user, None, receiver)
        await ml_service.log_interaction(
            sender_id=current_user["id"],
            receiver_id=request_data.receiver_id,
            trip_id=request_data.trip_id or "buddy_request",
            features=feats,
            status="pending",
            label=1
        )
        
        from app.services.notification_service import NotificationService
        if req_type == "buddy_request":
            title = "New Travel Buddy Request"
            message = f"{current_user['name']} wants to connect as a travel buddy."
            if trip:
                message += f" (Matching trip to {trip['destination']})"
        else:
            title = "New Join Request"
            message = f"{current_user['name']} wants to join your trip to {trip['destination']}."
            
        await NotificationService.create_notification(
            user_id=request_data.receiver_id,
            type_="request_received",
            title=title,
            message=message,
            link="/requests"
        )
    except Exception as e:
        print(f"Error handling request creation effects: {e}")

    return await resolve_request_details(new_req)

@router.get("/requests/incoming", response_model=List[TravelRequestResponse])
async def get_incoming_requests(
    current_user: dict = Depends(get_current_user),
    req_r: RequestRepository = Depends()
):
    """Get all incoming travel requests for the current user."""
    incoming = await req_r.get_incoming(user_id=current_user["id"])
    resolved = [await resolve_request_details(r) for r in incoming]
    return resolved

@router.get("/requests/sent", response_model=List[TravelRequestResponse])
async def get_sent_requests(
    current_user: dict = Depends(get_current_user),
    req_r: RequestRepository = Depends()
):
    """Get all sent travel requests from the current user."""
    sent = await req_r.get_sent(user_id=current_user["id"])
    resolved = [await resolve_request_details(r) for r in sent]
    return resolved

@router.put("/requests/{request_id}/accept", response_model=TravelRequestResponse)
async def accept_travel_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    req_r: RequestRepository = Depends(),
    conn_r: ConnectionRepository = Depends()
):
    """Accept an incoming travel request and establish a mutual connection."""
    updated_req = await req_r.update_status(
        request_id=request_id,
        user_id=current_user["id"],
        status="accepted",
        allowed_roles=["receiver"]
    )
    if not updated_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to accept request (either not found or you are not authorized)"
        )
        
    await conn_r.create_connection(
        sender_id=updated_req["sender_id"],
        receiver_id=updated_req["receiver_id"],
        trip_id=updated_req["trip_id"]
    )

    try:
        sender_user = await user_repo.get_by_id(updated_req["sender_id"])
        receiver_user = await user_repo.get_by_id(updated_req["receiver_id"])
        trip_obj = await trip_repo.get_by_id(updated_req["trip_id"]) if updated_req.get("trip_id") else None
        
        feats = matching_service.calculate_features(trip_obj, sender_user, None, receiver_user)
        await ml_service.log_interaction(
            sender_id=updated_req["sender_id"],
            receiver_id=updated_req["receiver_id"],
            trip_id=updated_req["trip_id"] or "buddy_request",
            features=feats,
            status="accepted",
            label=1
        )
        
        from app.services.notification_service import NotificationService
        
        if updated_req.get("request_type") == "buddy_request":
            title = "Buddy Request Accepted"
            message = f"{current_user['name']} accepted your travel buddy request!"
            conn_message = f"You are now connected with {sender_user['name']} as travel buddies."
        else:
            dest = trip_obj['destination'] if trip_obj else "your travel plan"
            title = "Travel Request Accepted"
            message = f"{current_user['name']} accepted your request to join their trip to {dest}!"
            conn_message = f"You are now connected with {sender_user['name']} for the trip to {dest}."

        await NotificationService.create_notification(
            user_id=updated_req["sender_id"],
            type_="request_accepted",
            title=title,
            message=message,
            link="/connections"
        )
        await NotificationService.create_notification(
            user_id=current_user["id"],
            type_="new_connection",
            title="New Connection Established",
            message=conn_message,
            link="/connections"
        )
    except Exception as e:
        print(f"Error updating accepted match interaction & notifications: {e}")
    
    return await resolve_request_details(updated_req)

@router.put("/requests/{request_id}/reject", response_model=TravelRequestResponse)
async def reject_travel_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    req_r: RequestRepository = Depends()
):
    """Reject an incoming travel request."""
    updated_req = await req_r.update_status(
        request_id=request_id,
        user_id=current_user["id"],
        status="rejected",
        allowed_roles=["receiver"]
    )
    if not updated_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to reject request (either not found or you are not authorized)"
        )

    try:
        sender_user = await user_repo.get_by_id(updated_req["sender_id"])
        receiver_user = await user_repo.get_by_id(updated_req["receiver_id"])
        trip_obj = await trip_repo.get_by_id(updated_req["trip_id"]) if updated_req.get("trip_id") else None
        
        feats = matching_service.calculate_features(trip_obj, sender_user, None, receiver_user)
        await ml_service.log_interaction(
            sender_id=updated_req["sender_id"],
            receiver_id=updated_req["receiver_id"],
            trip_id=updated_req["trip_id"] or "buddy_request",
            features=feats,
            status="rejected",
            label=0
        )
        
        from app.services.notification_service import NotificationService
        
        if updated_req.get("request_type") == "buddy_request":
            title = "Buddy Request Declined"
            message = f"{current_user['name']} declined your travel buddy request."
        else:
            dest = trip_obj['destination'] if trip_obj else "their travel plan"
            title = "Travel Request Declined"
            message = f"{current_user['name']} declined your request to join their trip to {dest}."

        await NotificationService.create_notification(
            user_id=updated_req["sender_id"],
            type_="request_rejected",
            title=title,
            message=message,
            link="/requests"
        )
    except Exception as e:
        print(f"Error updating rejected match interaction & notifications: {e}")

    return await resolve_request_details(updated_req)

@router.delete("/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_travel_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    req_r: RequestRepository = Depends()
):
    """Cancel a sent travel request."""
    updated_req = await req_r.update_status(
        request_id=request_id,
        user_id=current_user["id"],
        status="cancelled",
        allowed_roles=["sender"]
    )
    if not updated_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to cancel request (either not found or you are not the sender)"
        )

    try:
        sender_user = await user_repo.get_by_id(updated_req["sender_id"])
        receiver_user = await user_repo.get_by_id(updated_req["receiver_id"])
        trip_obj = await trip_repo.get_by_id(updated_req["trip_id"]) if updated_req.get("trip_id") else None
        
        feats = matching_service.calculate_features(trip_obj, sender_user, None, receiver_user)
        await ml_service.log_interaction(
            sender_id=updated_req["sender_id"],
            receiver_id=updated_req["receiver_id"],
            trip_id=updated_req["trip_id"] or "buddy_request",
            features=feats,
            status="cancelled",
            label=0
        )
    except Exception as e:
        print(f"Error logging cancelled match interaction: {e}")

    return None

# ==========================================
# NEW /trip-join-requests & /trips JOIN ENDPOINTS
# ==========================================

@router.post("/trips/{trip_id}/join-request", response_model=TravelRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_trip_join_request(
    trip_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database),
    trip_r: TripRepository = Depends(),
    req_r: RequestRepository = Depends()
):
    """Request to join a specific trip."""
    trip = await trip_r.get_by_id(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    trip_owner_id = trip["user_id"]
    requester_id = current_user["id"]
    
    if requester_id == trip_owner_id:
        raise HTTPException(status_code=400, detail="You cannot join your own trip")
        
    visibility = trip.get("visibility", "Open to travel buddy requests")
    if visibility == "Private":
        raise HTTPException(status_code=403, detail="This trip is private and cannot be joined")
        
    existing_pending = await db.travel_requests.find_one({
        "trip_id": trip_id,
        "requester_id": requester_id,
        "status": "pending"
    })
    if existing_pending:
        raise HTTPException(status_code=400, detail="You already have a pending request for this trip")
        
    members = trip.get("members", [])
    if requester_id in members:
        raise HTTPException(status_code=400, detail="You are already a member of this trip")
        
    max_spots = max(2, trip.get("number_of_travelers", 5))
    if len(members) >= max_spots:
        raise HTTPException(status_code=400, detail="This trip is already full")

    new_req = await req_r.create_request(
        sender_id=requester_id,
        receiver_id=trip_owner_id,
        trip_id=trip_id
    )
    
    try:
        from app.services.notification_service import NotificationService
        await NotificationService.create_notification(
            user_id=trip_owner_id,
            type_="request_received",
            title="New Join Request",
            message=f"{current_user['name']} wants to join your trip to {trip['destination']}.",
            link="/requests"
        )
    except Exception as e:
        print(f"Error creating notification: {e}")
        
    return await resolve_request_details(new_req)

@router.patch("/trip-join-requests/{request_id}/accept", response_model=TravelRequestResponse)
async def accept_join_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database),
    req_r: RequestRepository = Depends(),
    conn_r: ConnectionRepository = Depends()
):
    """Accept a request to join your trip."""
    updated_req = await req_r.update_status(
        request_id=request_id,
        user_id=current_user["id"],
        status="accepted",
        allowed_roles=["receiver"]
    )
    if not updated_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to accept request (either not found or you are not authorized)"
        )
        
    await conn_r.create_connection(
        sender_id=updated_req["sender_id"],
        receiver_id=updated_req["receiver_id"],
        trip_id=updated_req["trip_id"]
    )
    
    try:
        from app.services.notification_service import NotificationService
        trip = await db.trips.find_one({"_id": ObjectId(updated_req["trip_id"])})
        dest = trip["destination"] if trip else "Goa"
        await NotificationService.create_notification(
            user_id=updated_req["requester_id"],
            type_="request_accepted",
            title="Trip Request Accepted",
            message=f"{current_user['name']} accepted your request to join the {dest} trip!",
            link="/connections"
        )
    except Exception as e:
        print(f"Error creating notification: {e}")
        
    return await resolve_request_details(updated_req)

@router.patch("/trip-join-requests/{request_id}/reject", response_model=TravelRequestResponse)
async def reject_join_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database),
    req_r: RequestRepository = Depends()
):
    """Reject a request to join your trip."""
    updated_req = await req_r.update_status(
        request_id=request_id,
        user_id=current_user["id"],
        status="rejected",
        allowed_roles=["receiver"]
    )
    if not updated_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to reject request (either not found or you are not authorized)"
        )
    
    try:
        from app.services.notification_service import NotificationService
        trip = await db.trips.find_one({"_id": ObjectId(updated_req["trip_id"])})
        dest = trip["destination"] if trip else "Goa"
        await NotificationService.create_notification(
            user_id=updated_req["requester_id"],
            type_="request_rejected",
            title="Trip Request Declined",
            message=f"{current_user['name']} declined your request to join the {dest} trip.",
            link="/requests"
        )
    except Exception as e:
        print(f"Error creating notification: {e}")
        
    return await resolve_request_details(updated_req)

@router.patch("/trip-join-requests/{request_id}/cancel", response_model=TravelRequestResponse)
async def cancel_join_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    req_r: RequestRepository = Depends()
):
    """Cancel a pending join request."""
    updated_req = await req_r.update_status(
        request_id=request_id,
        user_id=current_user["id"],
        status="cancelled",
        allowed_roles=["sender"]
    )
    if not updated_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to cancel request (either not found or you are not authorized)"
        )
        
    return await resolve_request_details(updated_req)

@router.get("/trip-join-requests/incoming", response_model=List[TravelRequestResponse])
async def get_incoming_join_requests(
    current_user: dict = Depends(get_current_user),
    req_r: RequestRepository = Depends()
):
    """Retrieve all incoming join requests for trips owned by current user."""
    incoming = await req_r.get_incoming(user_id=current_user["id"])
    resolved = [await resolve_request_details(r) for r in incoming]
    return resolved

@router.get("/trip-join-requests/sent", response_model=List[TravelRequestResponse])
async def get_sent_join_requests(
    current_user: dict = Depends(get_current_user),
    req_r: RequestRepository = Depends()
):
    """Retrieve all join requests sent by the current user."""
    sent = await req_r.get_sent(user_id=current_user["id"])
    resolved = [await resolve_request_details(r) for r in sent]
    return resolved
