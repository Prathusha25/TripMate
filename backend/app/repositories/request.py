from datetime import datetime
from typing import Optional, List
from bson import ObjectId
from bson.errors import InvalidId
from app.config.db import get_database
from app.utils.db_helpers import serialize_doc, serialize_docs

class RequestRepository:
    def __init__(self):
        pass

    @property
    def collection(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Database not initialized")
        return db.travel_requests

    async def get_by_id(self, request_id: str) -> Optional[dict]:
        """Fetch request by ID."""
        try:
            obj_id = ObjectId(request_id)
        except InvalidId:
            return None
        
        request = await self.collection.find_one({"_id": obj_id})
        return serialize_doc(request)

    async def get_by_sender_receiver_trip(self, sender_id: str, receiver_id: str, trip_id: str) -> Optional[dict]:
        """Check for existing request to prevent duplicates."""
        request = await self.collection.find_one({
            "trip_id": trip_id,
            "$or": [
                {"sender_id": sender_id, "receiver_id": receiver_id},
                {"requester_id": sender_id, "trip_owner_id": receiver_id}
            ],
            "status": {"$in": ["pending", "accepted"]}
        })
        return serialize_doc(request)

    async def get_by_sender_receiver_type(self, sender_id: str, receiver_id: str, request_type: str) -> Optional[dict]:
        """Check for existing request of specific type to prevent duplicates."""
        request = await self.collection.find_one({
            "request_type": request_type,
            "$or": [
                {"sender_id": sender_id, "receiver_id": receiver_id},
                {"requester_id": sender_id, "trip_owner_id": receiver_id}
            ],
            "status": {"$in": ["pending", "accepted"]}
        })
        return serialize_doc(request)

    async def create_request(self, sender_id: str, receiver_id: str, trip_id: Optional[str] = None, request_type: str = "trip_join") -> dict:
        """Create a new travel buddy request."""
        new_request = {
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "requester_id": sender_id,
            "trip_owner_id": receiver_id,
            "trip_id": trip_id,
            "request_type": request_type,  # "trip_join" or "buddy_request"
            "status": "pending",  # pending, accepted, rejected, cancelled
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        result = await self.collection.insert_one(new_request)
        new_request["_id"] = result.inserted_id
        return serialize_doc(new_request)

    async def update_status(self, request_id: str, user_id: str, status: str, allowed_roles: List[str]) -> Optional[dict]:
        """Update request status (accept/reject/cancel), verifying user role."""
        try:
            obj_id = ObjectId(request_id)
        except InvalidId:
            return None

        # Fetch first to verify user access
        request = await self.collection.find_one({"_id": obj_id})
        if not request:
            return None

        # Check role permissions:
        is_sender = (request.get("sender_id") == user_id) or (request.get("requester_id") == user_id)
        is_receiver = (request.get("receiver_id") == user_id) or (request.get("trip_owner_id") == user_id)

        if "sender" in allowed_roles and not is_sender:
            return None
        if "receiver" in allowed_roles and not is_receiver:
            return None
        if "sender" not in allowed_roles and "receiver" not in allowed_roles:
            if not (is_sender or is_receiver):
                return None

        await self.collection.update_one(
            {"_id": obj_id},
            {"$set": {"status": status, "updated_at": datetime.utcnow()}}
        )
        
        # If accepted and is trip_join request, add requester to trip members
        if status == "accepted" and request.get("request_type", "trip_join") == "trip_join" and request.get("trip_id"):
            db = get_database()
            if db is not None:
                await db.trips.update_one(
                    {"_id": ObjectId(request["trip_id"])},
                    {"$addToSet": {"members": request.get("requester_id") or request["sender_id"]}}
                )

        request["status"] = status
        request["updated_at"] = datetime.utcnow()
        return serialize_doc(request)

    async def get_incoming(self, user_id: str) -> List[dict]:
        """Get all pending requests sent to this user."""
        cursor = self.collection.find({
            "$or": [
                {"receiver_id": user_id},
                {"trip_owner_id": user_id}
            ],
            "status": "pending"
        }).sort("created_at", -1)
        requests = await cursor.to_list(length=100)
        return serialize_docs(requests)

    async def get_sent(self, user_id: str) -> List[dict]:
        """Get all active requests sent by this user."""
        cursor = self.collection.find({
            "$or": [
                {"sender_id": user_id},
                {"requester_id": user_id}
            ],
            "status": {"$in": ["pending", "accepted", "rejected"]}
        }).sort("created_at", -1)
        requests = await cursor.to_list(length=100)
        return serialize_docs(requests)
