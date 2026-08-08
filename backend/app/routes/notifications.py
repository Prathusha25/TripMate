from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.routes.auth import get_current_user
from app.config.db import get_database
from datetime import datetime

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[dict])
async def get_my_notifications(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve all notifications for the current authenticated user."""
    cursor = db.notifications.find({"user_id": current_user["id"]}).sort("created_at", -1)
    notifications = await cursor.to_list(length=100)
    
    # Serialize datetime objects
    results = []
    for n in notifications:
        n.pop("_id", None)
        n["created_at"] = n["created_at"].isoformat()
        results.append(n)
    return results

@router.put("/{notification_id}/read", response_model=dict)
async def mark_notification_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Mark a specific notification as read."""
    res = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success", "message": "Notification marked as read."}

@router.put("/read-all", response_model=dict)
async def mark_all_notifications_as_read(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Mark all notifications for the current user as read."""
    await db.notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"status": "success", "message": "All notifications marked as read."}

@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete a specific notification."""
    res = await db.notifications.delete_one({"id": notification_id, "user_id": current_user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
