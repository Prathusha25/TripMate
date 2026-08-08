from datetime import datetime
from typing import Optional
from bson import ObjectId
from bson.errors import InvalidId
from app.config.db import get_database
from app.utils.db_helpers import serialize_doc

class UserRepository:
    def __init__(self):
        # Database instance will be resolved dynamically at runtime
        pass

    @property
    def collection(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Database not initialized")
        return db.users

    async def get_by_id(self, user_id: str) -> Optional[dict]:
        """Fetch user by string ID."""
        try:
            obj_id = ObjectId(user_id)
        except InvalidId:
            return None
        
        user = await self.collection.find_one({"_id": obj_id})
        return serialize_doc(user)

    async def get_by_email(self, email: str) -> Optional[dict]:
        """Fetch user by email (case-insensitive)."""
        user = await self.collection.find_one({"email": email.lower()})
        return serialize_doc(user)

    async def create_user(self, name: str, email: str, hashed_password: str, verification_code: Optional[str] = None, verification_expiry: Optional[datetime] = None) -> dict:
        """Create a new user with empty profile fields."""
        new_user = {
            "name": name,
            "email": email.lower(),
            "hashed_password": hashed_password,
            "profile_photo": None,
            "bio": None,
            "home_city": None,
            "interests": [],
            "travel_style": [],
            "budget_preference": None,
            "is_verified": False if verification_code else True,
            "verification_code": verification_code,
            "verification_expiry": verification_expiry,
            "created_at": datetime.utcnow()
        }
        result = await self.collection.insert_one(new_user)
        new_user["_id"] = result.inserted_id
        return serialize_doc(new_user)

    async def set_verification_code(self, email: str, code: str, expiry: datetime) -> bool:
        """Set a verification code for an existing user."""
        res = await self.collection.update_one(
            {"email": email.lower()},
            {"$set": {"verification_code": code, "verification_expiry": expiry}}
        )
        return res.modified_count > 0

    async def verify_user(self, email: str) -> bool:
        """Set user status to verified and clear verification fields."""
        res = await self.collection.update_one(
            {"email": email.lower()},
            {"$set": {"is_verified": True}, "$unset": {"verification_code": "", "verification_expiry": ""}}
        )
        return res.modified_count > 0

    async def update_profile(self, user_id: str, update_data: dict) -> Optional[dict]:
        """Update profile fields for a user."""
        try:
            obj_id = ObjectId(user_id)
        except InvalidId:
            return None

        # Clean out None values to prevent overwriting with nulls unless explicit
        clean_update = {k: v for k, v in update_data.items() if v is not None}
        
        if not clean_update:
            return await self.get_by_id(user_id)

        await self.collection.update_one(
            {"_id": obj_id},
            {"$set": clean_update}
        )
        return await self.get_by_id(user_id)
