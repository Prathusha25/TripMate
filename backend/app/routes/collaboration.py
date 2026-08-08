import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from bson import ObjectId
from bson.errors import InvalidId
from app.routes.auth import get_current_user
from app.config.db import get_database

router = APIRouter(prefix="/trips", tags=["Collaboration"])

# Pydantic schemas
class NoteCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)

class PlaceSuggest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

async def verify_collab_access(trip_id: str, current_user: dict, db) -> dict:
    """Helper to verify if logged-in user is authorized to collaborate on a trip."""
    try:
        obj_id = ObjectId(trip_id)
    except InvalidId:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )
    trip = await db.trips.find_one({"_id": obj_id})
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )
        
    # Authorized if trip creator
    # Serialize trip to ensure user_id comparison works as expected
    from app.utils.db_helpers import serialize_doc
    serialized_trip = serialize_doc(trip)
    if serialized_trip["user_id"] == current_user["id"]:
        return serialized_trip
        
    # Authorized if mutually connected to this trip
    conn = await db.connections.find_one({
        "trip_id": trip_id,
        "$or": [
            {"user1_id": current_user["id"]},
            {"user2_id": current_user["id"]}
        ]
    })
    
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this trip's collaborative space"
        )
        
    return serialized_trip

@router.get("/{trip_id}/collaboration", response_model=dict)
async def get_collaboration_space(
    trip_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve shared notes, suggestions, and saved bookmarks for a trip."""
    await verify_collab_access(trip_id, current_user, db)
    
    collab = await db.collaborations.find_one({"trip_id": trip_id})
    if not collab:
        # Create empty collaboration workspace
        collab = {
            "id": "col_" + str(uuid.uuid4())[:8],
            "trip_id": trip_id,
            "notes": [],
            "suggested_places": [],
            "saved_places": [],
            "created_at": datetime.utcnow()
        }
        await db.collaborations.insert_one(collab)
        
    collab.pop("_id", None)
    return collab

@router.post("/{trip_id}/collaboration/notes", status_code=status.HTTP_201_CREATED)
async def add_shared_note(
    trip_id: str,
    note_in: NoteCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Add a shared note to the trip collaboration workspace."""
    await verify_collab_access(trip_id, current_user, db)
    
    new_note = {
        "id": "nte_" + str(uuid.uuid4())[:8],
        "author_id": current_user["id"],
        "author_name": current_user["name"],
        "content": note_in.content,
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db.collaborations.update_one(
        {"trip_id": trip_id},
        {"$push": {"notes": new_note}},
        upsert=True
    )
    
    return new_note

@router.delete("/{trip_id}/collaboration/notes/{note_id}")
async def delete_shared_note(
    trip_id: str,
    note_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete a shared note from the trip collaboration workspace."""
    await verify_collab_access(trip_id, current_user, db)
    
    # Get note to verify authorship or if traveler is trip creator
    collab = await db.collaborations.find_one({"trip_id": trip_id})
    if not collab:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    note = next((n for n in collab.get("notes", []) if n["id"] == note_id), None)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    trip = await db.trips.find_one({"_id": ObjectId(trip_id)})
    # Note author OR trip creator can delete notes
    if note["author_id"] != current_user["id"] and trip["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this note"
        )
        
    await db.collaborations.update_one(
        {"trip_id": trip_id},
        {"$pull": {"notes": {"id": note_id}}}
    )
    
    return {"status": "success", "message": "Note deleted successfully."}

@router.post("/{trip_id}/collaboration/places", status_code=status.HTTP_201_CREATED)
async def suggest_place(
    trip_id: str,
    place_in: PlaceSuggest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Suggest a place to visit in the collaborative trip itinerary."""
    await verify_collab_access(trip_id, current_user, db)
    
    new_suggestion = {
        "id": "sug_" + str(uuid.uuid4())[:8],
        "name": place_in.name,
        "description": place_in.description,
        "suggested_by_id": current_user["id"],
        "suggested_by_name": current_user["name"],
        "status": "pending",
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db.collaborations.update_one(
        {"trip_id": trip_id},
        {"$push": {"suggested_places": new_suggestion}},
        upsert=True
    )
    
    return new_suggestion

@router.put("/{trip_id}/collaboration/places/{place_id}/status")
async def update_suggested_place_status(
    trip_id: str,
    place_id: str,
    action: str, # "approved" or "rejected"
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Accept or decline suggested places. Only the trip creator can approve suggestions."""
    trip = await verify_collab_access(trip_id, current_user, db)
    
    if trip["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the trip creator can change suggestion approval states"
        )
        
    if action not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approved' or 'rejected'")
        
    # Update status inside array
    res = await db.collaborations.update_one(
        {"trip_id": trip_id, "suggested_places.id": place_id},
        {"$set": {"suggested_places.$.status": action}}
    )
    
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Suggested place not found")
        
    # If approved, automatically bookmark it to saved places list
    if action == "approved":
        collab = await db.collaborations.find_one({"trip_id": trip_id})
        sug = next((s for s in collab.get("suggested_places", []) if s["id"] == place_id), None)
        if sug:
            saved_place = {
                "id": "sav_" + str(uuid.uuid4())[:8],
                "name": sug["name"],
                "description": sug["description"],
                "saved_by_name": sug["suggested_by_name"]
            }
            await db.collaborations.update_one(
                {"trip_id": trip_id},
                {"$push": {"saved_places": saved_place}}
            )
            
    return {"status": "success", "message": f"Place suggestion {action} successfully."}

@router.post("/{trip_id}/collaboration/saved-places", status_code=status.HTTP_201_CREATED)
async def bookmark_place(
    trip_id: str,
    place_in: PlaceSuggest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Bookmark / Save a place recommended by AI or manual search."""
    await verify_collab_access(trip_id, current_user, db)
    
    new_bookmark = {
        "id": "sav_" + str(uuid.uuid4())[:8],
        "name": place_in.name,
        "description": place_in.description,
        "saved_by_name": current_user["name"]
    }
    
    await db.collaborations.update_one(
        {"trip_id": trip_id},
        {"$push": {"saved_places": new_bookmark}},
        upsert=True
    )
    
    return new_bookmark

@router.delete("/{trip_id}/collaboration/saved-places/{place_id}")
async def delete_bookmarked_place(
    trip_id: str,
    place_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Remove a bookmarked place from saved places list."""
    await verify_collab_access(trip_id, current_user, db)
    
    await db.collaborations.update_one(
        {"trip_id": trip_id},
        {"$pull": {"saved_places": {"id": place_id}}}
    )
    
    return {"status": "success", "message": "Saved place bookmark removed."}

# ==========================================
# GROUP MEMBERS & GROUP CHAT ENDPOINTS
# ==========================================

class GroupMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)

@router.get("/{trip_id}/collaboration/members", response_model=List[dict])
async def get_group_members(
    trip_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve all group members (organizer + accepted connections) for this trip."""
    trip = await verify_collab_access(trip_id, current_user, db)
    
    # Get organizer profile
    organizer = await db.users.find_one({"id": trip["user_id"]})
    members = []
    if organizer:
        members.append({
            "id": organizer["id"],
            "name": organizer["name"],
            "profile_photo": organizer.get("profile_photo"),
            "role": "Organizer",
            "interests": organizer.get("interests", []),
            "travel_style": organizer.get("travel_style", [])
        })
        
    # Get all connected users for this trip
    cursor = db.connections.find({"trip_id": trip_id})
    conns = await cursor.to_list(length=100)
    
    buddy_ids = set()
    for c in conns:
        buddy_id = c["user2_id"] if c["user1_id"] == trip["user_id"] else c["user1_id"]
        buddy_ids.add(buddy_id)
        
    for b_id in buddy_ids:
        # Fetch buddy user profile
        buddy_profile = await db.users.find_one({"id": b_id})
        if buddy_profile:
            members.append({
                "id": buddy_profile["id"],
                "name": buddy_profile["name"],
                "profile_photo": buddy_profile.get("profile_photo"),
                "role": "Member",
                "interests": buddy_profile.get("interests", []),
                "travel_style": buddy_profile.get("travel_style", [])
            })
            
    return members

@router.get("/{trip_id}/collaboration/messages", response_model=List[dict])
async def get_group_messages(
    trip_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve group chat messages for this trip."""
    await verify_collab_access(trip_id, current_user, db)
    
    collab = await db.collaborations.find_one({"trip_id": trip_id})
    if not collab or "messages" not in collab:
        return []
        
    return collab.get("messages", [])

@router.post("/{trip_id}/collaboration/messages", response_model=dict, status_code=status.HTTP_201_CREATED)
async def post_group_message(
    trip_id: str,
    msg_in: GroupMessageCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Post a message inside the group chat of the trip."""
    trip = await verify_collab_access(trip_id, current_user, db)
    
    from app.routes.messages import censor_content
    censored_content = censor_content(msg_in.content)
    
    new_message = {
        "id": "gmsg_" + str(uuid.uuid4())[:8],
        "sender_id": current_user["id"],
        "sender_name": current_user["name"],
        "sender_photo": current_user.get("profile_photo"),
        "content": censored_content,
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db.collaborations.update_one(
        {"trip_id": trip_id},
        {"$push": {"messages": new_message}},
        upsert=True
    )
    
    # Notify all other members of the group chat
    try:
        from app.services.notification_service import NotificationService
        # Get all buddies
        cursor = db.connections.find({"trip_id": trip_id})
        conns = await cursor.to_list(length=100)
        
        notify_users = {trip["user_id"]} # start with owner
        for c in conns:
            notify_users.add(c["user1_id"])
            notify_users.add(c["user2_id"])
            
        # Exclude sender
        notify_users.discard(current_user["id"])
        
        for u_id in notify_users:
            await NotificationService.create_notification(
                user_id=u_id,
                type_="new_group_message",
                title=f"New Group Message in {trip['destination']}",
                message=f"{current_user['name']}: {censored_content[:50]}...",
                link=f"/trips/{trip_id}/collaboration"
            )
    except Exception as e:
        print(f"Error creating group message notifications: {e}")
        
    return new_message
