from datetime import datetime
from typing import Optional, List, Dict
from bson import ObjectId, errors
from app.config.db import get_database
from app.utils.db_helpers import serialize_doc, serialize_docs

class AIPlanDraftRepository:
    def __init__(self):
        pass

    @property
    def collection(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Database not initialized")
        return db.ai_plan_drafts

    async def get_by_id(self, plan_id: str) -> Optional[dict]:
        try:
            obj_id = ObjectId(plan_id)
        except (errors.InvalidId, TypeError):
            return None
        plan = await self.collection.find_one({"_id": obj_id})
        return serialize_doc(plan)

    async def get_user_drafts(self, user_id: str) -> List[dict]:
        cursor = self.collection.find({"user_id": user_id})
        drafts = await cursor.to_list(length=100)
        return serialize_docs(drafts)

    async def save_draft(self, user_id: str, plan_data: dict) -> dict:
        doc = {
            "user_id": user_id,
            "destination": plan_data["destination"],
            "start_date": plan_data["start_date"],
            "end_date": plan_data["end_date"],
            "budget": plan_data["budget"],
            "interests": plan_data["interests"],
            "travel_style": plan_data["travel_style"],
            "activities": plan_data.get("activities", []),
            "number_of_travelers": plan_data.get("number_of_travelers", 1),
            "selected_places": plan_data.get("selected_places", []),
            "itinerary": plan_data.get("itinerary"),
            "packing_checklist": plan_data.get("packing_checklist"),
            "outfit_recommendations": plan_data.get("outfit_recommendations", []),
            "hotels": plan_data.get("hotels", []),
            "restaurants": plan_data.get("restaurants", []),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        res = await self.collection.insert_one(doc)
        doc["_id"] = res.inserted_id
        return serialize_doc(doc)

    async def update_draft(self, plan_id: str, user_id: str, plan_data: dict) -> Optional[dict]:
        try:
            obj_id = ObjectId(plan_id)
        except (errors.InvalidId, TypeError):
            return None

        update_doc = {
            "destination": plan_data["destination"],
            "start_date": plan_data["start_date"],
            "end_date": plan_data["end_date"],
            "budget": plan_data["budget"],
            "interests": plan_data["interests"],
            "travel_style": plan_data["travel_style"],
            "activities": plan_data.get("activities", []),
            "number_of_travelers": plan_data.get("number_of_travelers", 1),
            "selected_places": plan_data.get("selected_places", []),
            "itinerary": plan_data.get("itinerary"),
            "packing_checklist": plan_data.get("packing_checklist"),
            "outfit_recommendations": plan_data.get("outfit_recommendations", []),
            "hotels": plan_data.get("hotels", []),
            "restaurants": plan_data.get("restaurants", []),
            "updated_at": datetime.utcnow()
        }
        res = await self.collection.update_one(
            {"_id": obj_id, "user_id": user_id},
            {"$set": update_doc}
        )
        if res.matched_count == 0:
            return None
        return await self.get_by_id(plan_id)

    async def delete_draft(self, plan_id: str, user_id: str) -> bool:
        try:
            obj_id = ObjectId(plan_id)
        except (errors.InvalidId, TypeError):
            return False
        res = await self.collection.delete_one({"_id": obj_id, "user_id": user_id})
        return res.deleted_count > 0
