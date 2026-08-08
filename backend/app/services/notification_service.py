import uuid
from datetime import datetime
from app.config.db import get_database

class NotificationService:
    @staticmethod
    async def create_notification(user_id: str, type_: str, title: str, message: str, link: str = None) -> dict:
        """Create and persist a user notification in MongoDB."""
        db = get_database()
        if db is None:
            return {}

        notification = {
            "id": "not_" + str(uuid.uuid4())[:8],
            "user_id": user_id,
            "type": type_,
            "title": title,
            "message": message,
            "link": link,
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        
        try:
            await db.notifications.insert_one(notification)
        except Exception as e:
            print(f"Error persisting notification: {e}")
            
        notification.pop("_id", None)
        return notification
