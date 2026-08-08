from datetime import datetime, date
from typing import Optional, List
from bson import ObjectId
from bson.errors import InvalidId
from app.config.db import get_database
from app.utils.db_helpers import serialize_doc, serialize_docs

class TripRepository:
    def __init__(self):
        pass

    @property
    def collection(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Database not initialized")
        return db.trips

    async def get_by_id(self, trip_id: str) -> Optional[dict]:
        """Fetch trip by string ID."""
        try:
            obj_id = ObjectId(trip_id)
        except InvalidId:
            return None
        
        trip = await self.collection.find_one({"_id": obj_id})
        return serialize_doc(trip)

    async def get_user_trips(self, user_id: str) -> List[dict]:
        """Get all trips created by a user."""
        cursor = self.collection.find({"user_id": user_id}).sort("start_date", 1)
        trips = await cursor.to_list(length=100)
        return serialize_docs(trips)

    async def create_trip(self, user_id: str, trip_data: dict) -> dict:
        """Create a new trip."""
        new_trip = dict(trip_data)
        new_trip["user_id"] = user_id
        new_trip["members"] = [user_id]
        new_trip["created_at"] = datetime.utcnow()
        
        # Convert date to datetime (PyMongo does not serialize python date natively)
        for key in ["start_date", "end_date"]:
            val = new_trip.get(key)
            if val is not None and isinstance(val, date) and not isinstance(val, datetime):
                new_trip[key] = datetime.combine(val, datetime.min.time())
        
        result = await self.collection.insert_one(new_trip)
        new_trip["_id"] = result.inserted_id
        return serialize_doc(new_trip)

    async def update_trip(self, trip_id: str, user_id: str, update_data: dict) -> Optional[dict]:
        """Update a trip's details, verifying ownership."""
        try:
            obj_id = ObjectId(trip_id)
        except InvalidId:
            return None

        # Clean updates
        clean_update = {k: v for k, v in update_data.items() if v is not None}
        if not clean_update:
            return await self.get_by_id(trip_id)

        # Convert date to datetime (PyMongo does not serialize python date natively)
        for key in ["start_date", "end_date"]:
            val = clean_update.get(key)
            if val is not None and isinstance(val, date) and not isinstance(val, datetime):
                clean_update[key] = datetime.combine(val, datetime.min.time())

        result = await self.collection.update_one(
            {"_id": obj_id, "user_id": user_id},
            {"$set": clean_update}
        )
        if result.modified_count == 0:
            # Verify if it exists
            trip = await self.get_by_id(trip_id)
            if not trip or trip["user_id"] != user_id:
                return None
        
        return await self.get_by_id(trip_id)

    async def delete_trip(self, trip_id: str, user_id: str) -> bool:
        """Delete a trip, verifying ownership."""
        try:
            obj_id = ObjectId(trip_id)
        except InvalidId:
            return False

        result = await self.collection.delete_one({"_id": obj_id, "user_id": user_id})
        return result.deleted_count > 0

    async def get_active_trips_excluding_user(self, user_id: str) -> List[dict]:
        """Get all trips that do not belong to the given user."""
        # Find future or ongoing trips of other users
        # For simplicity in Phase 1, get all trips of other users
        cursor = self.collection.find({"user_id": {"$ne": user_id}}).sort("created_at", -1)
        trips = await cursor.to_list(length=100)
        return serialize_docs(trips)
