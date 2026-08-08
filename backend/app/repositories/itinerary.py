from datetime import datetime
from typing import Optional
from bson import ObjectId
from app.config.db import get_database
from app.utils.db_helpers import serialize_doc
from app.models.itinerary import AIItineraryModel

class ItineraryRepository:
    def __init__(self):
        pass

    @property
    def collection(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Database not initialized")
        return db[AIItineraryModel.COLLECTION_NAME]

    async def get_by_trip_id(self, trip_id: str, user_id: str) -> Optional[dict]:
        """Fetch saved AI plan by trip ID and verify user ownership."""
        plan = await self.collection.find_one({"trip_id": trip_id, "user_id": user_id})
        return serialize_doc(plan) if plan else None

    async def save_plan(self, trip_id: str, user_id: str, plan_data: dict) -> dict:
        """Create or replace the AI travel plan for a trip."""
        now = datetime.utcnow()
        existing = await self.collection.find_one({"trip_id": trip_id, "user_id": user_id})
        
        plan_doc = dict(plan_data)
        plan_doc["trip_id"] = trip_id
        plan_doc["user_id"] = user_id
        plan_doc["updated_at"] = now

        if existing:
            # Maintain existing packing items checked status if they match new checklist items
            # Otherwise overwrite
            existing_items = {item["name"]: item for item in existing.get("packing_checklist", [])}
            new_checklist = []
            for item in plan_doc.get("packing_checklist", []):
                # If item name exists in previous checklist, preserve packed state
                if item["name"] in existing_items:
                    item["is_packed"] = existing_items[item["name"]].get("is_packed", False)
                new_checklist.append(item)
            plan_doc["packing_checklist"] = new_checklist

            await self.collection.update_one(
                {"_id": existing["_id"]},
                {"$set": plan_doc}
            )
            plan_doc["_id"] = existing["_id"]
            plan_doc["created_at"] = existing.get("created_at", now)
        else:
            plan_doc["created_at"] = now
            result = await self.collection.insert_one(plan_doc)
            plan_doc["_id"] = result.inserted_id

        return serialize_doc(plan_doc)

    async def update_packing_checklist(self, trip_id: str, user_id: str, items: list) -> Optional[dict]:
        """Update the entire packing checklist array."""
        result = await self.collection.update_one(
            {"trip_id": trip_id, "user_id": user_id},
            {
                "$set": {
                    "packing_checklist": items,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return await self.get_by_trip_id(trip_id, user_id)

    async def add_packing_item(self, trip_id: str, user_id: str, item: dict) -> Optional[dict]:
        """Push a new custom packing item into the array."""
        result = await self.collection.update_one(
            {"trip_id": trip_id, "user_id": user_id},
            {
                "$push": {"packing_checklist": item},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        return await self.get_by_trip_id(trip_id, user_id)

    async def update_packing_item(self, trip_id: str, user_id: str, item_id: str, update_fields: dict) -> Optional[dict]:
        """Update a specific packing item matching item_id within the array."""
        # Setup set dictionary for positional operator $
        set_dict = {}
        for key, value in update_fields.items():
            set_dict[f"packing_checklist.$.{key}"] = value
        set_dict["updated_at"] = datetime.utcnow()

        result = await self.collection.update_one(
            {"trip_id": trip_id, "user_id": user_id, "packing_checklist.id": item_id},
            {"$set": set_dict}
        )
        return await self.get_by_trip_id(trip_id, user_id)

    async def delete_packing_item(self, trip_id: str, user_id: str, item_id: str) -> Optional[dict]:
        """Pull (remove) a specific packing item from the array."""
        result = await self.collection.update_one(
            {"trip_id": trip_id, "user_id": user_id},
            {
                "$pull": {"packing_checklist": {"id": item_id}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        return await self.get_by_trip_id(trip_id, user_id)
