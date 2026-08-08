from datetime import datetime
from typing import List
from bson import ObjectId
from bson.errors import InvalidId
from app.config.db import get_database
from app.utils.db_helpers import serialize_doc, serialize_docs

class MessageRepository:
    def __init__(self):
        pass

    @property
    def collection(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Database not initialized")
        return db.messages

    async def create_message(self, connection_id: str, sender_id: str, receiver_id: str, content: str) -> dict:
        """Create and store a direct chat message."""
        new_msg = {
            "connection_id": connection_id,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "content": content,
            "timestamp": datetime.utcnow(),
            "is_read": False
        }
        result = await self.collection.insert_one(new_msg)
        new_msg["_id"] = result.inserted_id
        return serialize_doc(new_msg)

    async def get_messages(self, connection_id: str) -> List[dict]:
        """Fetch all messages for a connection, ordered by timestamp ascending."""
        cursor = self.collection.find({"connection_id": connection_id}).sort("timestamp", 1)
        messages = await cursor.to_list(length=500)  # limit for practical reasons
        return serialize_docs(messages)
