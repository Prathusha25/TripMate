from datetime import datetime
from typing import Optional, List, Dict
from bson import ObjectId
from app.config.db import get_database
from app.utils.db_helpers import serialize_doc, serialize_docs

class AIPlanRepository:
    def __init__(self):
        pass

    @property
    def collection(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Database not initialized")
        return db.ai_plans

    @property
    def chat_collection(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Database not initialized")
        return db.ai_chat_messages

    async def get_plan(self, trip_id: str) -> Optional[dict]:
        """Fetch the saved AI Plan for a trip."""
        plan = await self.collection.find_one({"trip_id": trip_id})
        return serialize_doc(plan)

    async def save_plan(self, trip_id: str, plan_data: dict) -> dict:
        """
        Saves or overwrites the generated plan in database, 
        transforming the checklist into a structured list with check flags.
        """
        # Format the packing checklist to track checked states
        raw_checklist = plan_data.get("packing_checklist", {})
        formatted_checklist = {}
        
        # Ensure categories are lowercased for index consistency
        standard_categories = ["clothing", "weather", "personal_care", "electronics", "documents", "activity_specific", "emergency_essentials"]
        
        for category in standard_categories:
            # Match case-insensitively from raw OpenAI output
            matching_key = next((k for k in raw_checklist.keys() if k.lower().replace("_", "").replace("-", "") == category.lower().replace("_", "")), category)
            items = raw_checklist.get(matching_key, [])
            
            formatted_checklist[category] = []
            for it in items:
                if isinstance(it, str):
                    formatted_checklist[category].append({"item": it, "checked": False})
                elif isinstance(it, dict) and "item" in it:
                    formatted_checklist[category].append({
                        "item": it["item"],
                        "checked": it.get("checked", False)
                    })

        plan_document = {
            "trip_id": trip_id,
            "places": plan_data.get("places", []),
            "visiting_times_explanation": plan_data.get("visiting_times_explanation", {}),
            "itinerary": plan_data.get("itinerary", []),
            "outfit_recommendations": plan_data.get("outfit_recommendations", []),
            "packing_checklist": formatted_checklist,
            "created_at": datetime.utcnow()
        }

        # Upsert: overwrite if trip already has a plan
        await self.collection.update_one(
            {"trip_id": trip_id},
            {"$set": plan_document},
            upsert=True
        )
        return serialize_doc(plan_document)

    async def update_checklist_item(
        self, 
        trip_id: str, 
        category: str, 
        item_name: str, 
        checked: Optional[bool], 
        action: str
    ) -> Optional[dict]:
        """
        Mutates the packing checklist in database (check/uncheck/add/remove).
        """
        plan = await self.collection.find_one({"trip_id": trip_id})
        if not plan:
            return None

        checklist = plan.get("packing_checklist", {})
        
        # Normalize category
        cat_key = category.lower()
        if cat_key not in checklist:
            checklist[cat_key] = []
            
        category_list = checklist[cat_key]

        if action == "toggle":
            for it in category_list:
                if it["item"].lower() == item_name.lower():
                    it["checked"] = checked if checked is not None else (not it["checked"])
                    break
        elif action == "add":
            # Add custom item if it doesn't already exist
            exists = any(it["item"].lower() == item_name.lower() for it in category_list)
            if not exists:
                category_list.append({"item": item_name, "checked": False})
        elif action == "remove":
            # Filter out the item
            category_list = [it for it in category_list if it["item"].lower() != item_name.lower()]

        checklist[cat_key] = category_list
        
        await self.collection.update_one(
            {"trip_id": trip_id},
            {"$set": {"packing_checklist": checklist}}
        )
        plan["packing_checklist"] = checklist
        return serialize_doc(plan)

    async def save_chat_message(self, trip_id: str, user_id: str, content: str, is_ai: bool) -> dict:
        """Saves a message in the user-assistant trip chat log."""
        new_msg = {
            "trip_id": trip_id,
            "user_id": user_id,
            "content": content,
            "is_ai": is_ai,
            "timestamp": datetime.utcnow()
        }
        result = await self.chat_collection.insert_one(new_msg)
        new_msg["_id"] = result.inserted_id
        return serialize_doc(new_msg)

    async def get_chat_history(self, trip_id: str) -> List[dict]:
        """Retrieve chat logs for the trip, sorted chronologically."""
        cursor = self.chat_collection.find({"trip_id": trip_id}).sort("timestamp", 1)
        messages = await cursor.to_list(length=100)
        return serialize_docs(messages)
