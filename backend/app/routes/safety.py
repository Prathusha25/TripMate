import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from app.routes.auth import get_current_user
from app.config.db import get_database
from bson import ObjectId
from bson.errors import InvalidId

router = APIRouter(prefix="/safety", tags=["Safety"])

# Pydantic schemas
class ReportCreate(BaseModel):
    reported_id: str = Field(..., description="ID of user or content being reported")
    type: str = Field(..., description="'user' or 'content'")
    reason: str = Field(..., min_length=3, max_length=200, description="Reason for reporting")
    details: Optional[str] = Field(None, max_length=1000)

class BlockCreate(BaseModel):
    blocked_id: str = Field(..., description="ID of the user to block")

@router.post("/report", status_code=status.HTTP_201_CREATED)
async def report_content_or_user(
    report_data: ReportCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Report inappropriate content or a specific traveler profile."""
    # Prevent self-reporting
    if report_data.reported_id == current_user["id"]:
         raise HTTPException(
             status_code=status.HTTP_400_BAD_REQUEST,
             detail="You cannot report yourself"
         )
         
    new_report = {
        "id": "rep_" + str(uuid.uuid4())[:8],
        "reporter_id": current_user["id"],
        "reported_id": report_data.reported_id,
        "type": report_data.type,
        "reason": report_data.reason,
        "details": report_data.details,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    await db.reports.insert_one(new_report)
    
    # Remove MongoDB '_id' before returning
    new_report.pop("_id", None)
    return {
        "status": "success",
        "message": "Report submitted successfully. Our safety moderators will review it shortly.",
        "report": new_report
    }

@router.post("/block", status_code=status.HTTP_201_CREATED)
async def block_user(
    block_data: BlockCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Block a user. Prevents them from appearing in discovery searches and sending chat messages."""
    if block_data.blocked_id == current_user["id"]:
         raise HTTPException(
             status_code=status.HTTP_400_BAD_REQUEST,
             detail="You cannot block yourself"
         )
         
    # Check if block relationship already exists
    existing = await db.blocks.find_one({
        "blocker_id": current_user["id"],
        "blocked_id": block_data.blocked_id
    })
    
    if existing:
        return {"status": "success", "message": "User is already blocked"}
        
    new_block = {
        "id": "blk_" + str(uuid.uuid4())[:8],
        "blocker_id": current_user["id"],
        "blocked_id": block_data.blocked_id,
        "created_at": datetime.utcnow()
    }
    
    await db.blocks.insert_one(new_block)
    
    # Break any active connections/requests between the two users
    await db.connections.delete_many({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": block_data.blocked_id},
            {"user1_id": block_data.blocked_id, "user2_id": current_user["id"]}
        ]
    })
    
    await db.requests.delete_many({
        "$or": [
            {"sender_id": current_user["id"], "receiver_id": block_data.blocked_id},
            {"sender_id": block_data.blocked_id, "receiver_id": current_user["id"]}
        ]
    })

    return {
        "status": "success",
        "message": "User blocked successfully. Existing connections and requests have been removed."
    }

@router.get("/blocks", response_model=List[dict])
async def get_blocked_users(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """List users blocked by the logged-in user."""
    cursor = db.blocks.find({"blocker_id": current_user["id"]})
    blocks = await cursor.to_list(length=100)
    
    results = []
    for b in blocks:
        user_obj_id = None
        try:
            user_obj_id = ObjectId(b["blocked_id"])
        except Exception:
            pass
        user = await db.users.find_one({"_id": user_obj_id}) if user_obj_id else None
        if user:
            results.append({
                "block_id": b["id"],
                "user_id": user["id"],
                "name": user["name"],
                "profile_photo": user.get("profile_photo"),
                "blocked_at": b["created_at"].isoformat()
            })
    return results

@router.delete("/blocks/{blocked_id}")
async def unblock_user(
    blocked_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Unblock a user."""
    res = await db.blocks.delete_many({
        "blocker_id": current_user["id"],
        "blocked_id": blocked_id
    })
    
    if res.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block relationship not found"
        )
        
    return {
        "status": "success",
        "message": "User unblocked successfully."
    }
