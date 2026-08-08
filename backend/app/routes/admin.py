from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from bson import ObjectId
from bson.errors import InvalidId
from app.routes.auth import get_current_user
from app.config.db import get_database

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])

def verify_admin_role(current_user: dict):
    """Enforces that only administrators can access endpoints."""
    email_lower = current_user["email"].lower()
    role_lower = current_user.get("role", "traveler").lower()
    if email_lower != "admin@tripmate.com" and role_lower != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform administrators can access this moderation interface"
        )

@router.get("/stats", response_model=dict)
async def get_system_stats(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Fetch global dashboard stats representing system metrics & popular destinations."""
    verify_admin_role(current_user)
    
    users_cnt = await db.users.count_documents({})
    trips_cnt = await db.trips.count_documents({})
    conn_cnt = await db.connections.count_documents({})
    req_cnt = await db.requests.count_documents({})
    group_trips_cnt = await db.trips.count_documents({"number_of_travelers": {"$gt": 1}})
    
    # Simple aggregation of popular destinations
    pipeline = [
        {"$group": {"_id": "$destination", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    cursor = db.trips.aggregate(pipeline)
    popular_destinations = await cursor.to_list(length=5)
    
    # Format popular list
    dest_list = [{"destination": d["_id"], "count": d["count"]} for d in popular_destinations if d["_id"]]
    
    # Fallback mock popular list if db is empty
    if not dest_list:
        dest_list = [
            {"destination": "Goa, India", "count": 12},
            {"destination": "Manali, India", "count": 8},
            {"destination": "Paris, France", "count": 5}
        ]

    rep_users_cnt = await db.reports.count_documents({"type": "user", "status": "pending"})
    rep_content_cnt = await db.reports.count_documents({"type": "content", "status": "pending"})
    
    return {
        "users_count": users_cnt,
        "trips_count": trips_cnt,
        "connections_count": conn_cnt,
        "requests_count": req_cnt,
        "group_trips_count": group_trips_cnt,
        "popular_destinations": dest_list,
        "reported_users_count": rep_users_cnt,
        "reported_content_count": rep_content_cnt
    }

@router.get("/reports", response_model=List[dict])
async def get_reported_items(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve all submitted reports for moderation review."""
    verify_admin_role(current_user)
    
    cursor = db.reports.find({}).sort("created_at", -1)
    reports = await cursor.to_list(length=200)
    
    results = []
    for r in reports:
        reporter_obj_id = None
        try:
            reporter_obj_id = ObjectId(r["reporter_id"])
        except Exception:
            pass
        reporter = await db.users.find_one({"_id": reporter_obj_id}) if reporter_obj_id else None
        
        reported_profile = None
        if r["type"] == "user":
            reported_obj_id = None
            try:
                reported_obj_id = ObjectId(r["reported_id"])
            except Exception:
                pass
            reported_profile = await db.users.find_one({"_id": reported_obj_id}) if reported_obj_id else None
            
        results.append({
            "id": r["id"],
            "reporter_name": reporter["name"] if reporter else "Unknown User",
            "reporter_email": reporter["email"] if reporter else "N/A",
            "reported_id": r["reported_id"],
            "reported_name": reported_profile["name"] if reported_profile else "Content/User ID: " + r["reported_id"],
            "type": r["type"],
            "reason": r["reason"],
            "details": r.get("details"),
            "status": r["status"],
            "created_at": r["created_at"].isoformat()
        })
    return results

@router.put("/reports/{report_id}/resolve")
async def resolve_report(
    report_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Mark a user/content report as resolved."""
    verify_admin_role(current_user)
    
    res = await db.reports.update_one(
        {"id": report_id},
        {"$set": {"status": "resolved"}}
    )
    
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
        
    return {"status": "success", "message": "Report resolved successfully."}

@router.put("/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    suspend: bool = True,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Suspend or unsuspend a user account."""
    verify_admin_role(current_user)
    
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot suspend your own account")
        
    try:
        obj_id = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="User not found")
        
    res = await db.users.update_one(
        {"_id": obj_id},
        {"$set": {"is_suspended": suspend}}
    )
    
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    status_label = "suspended" if suspend else "unsuspended"
    return {"status": "success", "message": f"User account has been {status_label} successfully."}

@router.delete("/trips/{trip_id}")
async def delete_inappropriate_trip(
    trip_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Remove inappropriate trip description from search results."""
    verify_admin_role(current_user)
    
    try:
        obj_id = ObjectId(trip_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    res = await db.trips.delete_one({"_id": obj_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    # Also delete collaborations and AI plans associated with this trip
    await db.collaborations.delete_many({"trip_id": trip_id})
    await db.ai_plans.delete_many({"trip_id": trip_id})
    await db.requests.delete_many({"trip_id": trip_id})
    await db.connections.delete_many({"trip_id": trip_id})
    
    return {"status": "success", "message": "Trip content deleted from platform."}
