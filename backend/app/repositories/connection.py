from datetime import datetime
from typing import Optional, List
from bson import ObjectId
from bson.errors import InvalidId
from app.config.db import get_database
from app.utils.db_helpers import serialize_doc, serialize_docs

class ConnectionRepository:
    def __init__(self):
        pass

    @property
    def collection(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Database not initialized")
        return db.connections

    async def get_by_id(self, connection_id: str) -> Optional[dict]:
        """Fetch connection by string ID."""
        try:
            obj_id = ObjectId(connection_id)
        except InvalidId:
            return None
        
        connection = await self.collection.find_one({"_id": obj_id})
        return serialize_doc(connection)

    async def get_user_connections(self, user_id: str) -> List[dict]:
        """Get all active connections for a user (either user1 or user2)."""
        cursor = self.collection.find({
            "$or": [
                {"user1_id": user_id},
                {"user2_id": user_id}
            ]
        }).sort("created_at", -1)
        connections = await cursor.to_list(length=100)
        return serialize_docs(connections)

    async def create_connection(self, sender_id: str, receiver_id: str, trip_id: Optional[str] = None) -> dict:
        """Create a new mutual connection, sorting IDs for consistency."""
        user1_id, user2_id = sorted([sender_id, receiver_id])
        
        # Check if already exists
        existing = await self.collection.find_one({
            "user1_id": user1_id,
            "user2_id": user2_id
        })
        if existing:
            return serialize_doc(existing)
            
        new_conn = {
            "user1_id": user1_id,
            "user2_id": user2_id,
            "trip_id": trip_id,
            "created_at": datetime.utcnow()
        }
        result = await self.collection.insert_one(new_conn)
        new_conn["_id"] = result.inserted_id
        return serialize_doc(new_conn)

    async def delete_connection(self, connection_id: str, user_id: str) -> bool:
        """Delete a connection, validating that the user is a participant."""
        try:
            obj_id = ObjectId(connection_id)
        except InvalidId:
            return False

        # Verify participant
        conn = await self.collection.find_one({"_id": obj_id})
        if not conn:
            return False

        if conn["user1_id"] != user_id and conn["user2_id"] != user_id:
            return False

        result = await self.collection.delete_one({"_id": obj_id})
        return result.deleted_count > 0

    async def is_connected(self, user1_id: str, user2_id: str) -> Optional[dict]:
        """Check if two users are mutually connected."""
        u1, u2 = sorted([user1_id, user2_id])
        conn = await self.collection.find_one({
            "user1_id": u1,
            "user2_id": u2
        })
        return serialize_doc(conn)
