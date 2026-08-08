from typing import Optional
from app.config.db import get_database
from app.utils.db_helpers import serialize_doc

class PlannerOptionsRepository:
    def __init__(self):
        pass

    @property
    def collection(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Database not initialized")
        return db.planner_options

    async def get_options(self) -> dict:
        """
        Retrieves the travel configuration options (interests, styles, budgets, activities).
        Seeds default values if none exist yet in MongoDB.
        """
        options = await self.collection.find_one({"_id": "current_options"})
        if not options:
            default_options = {
                "_id": "current_options",
                "interests": [
                    "Nature", "Photography", "Food", "Adventure", "Shopping",
                    "History", "Culture", "Nightlife", "Relaxation"
                ],
                "travel_styles": [
                    "Budget", "Relaxed", "Adventure", "Luxury", "Balanced",
                    "Backpacking", "Family"
                ],
                "budgets": [
                    "Budget", "Balanced", "Luxury"
                ],
                "activities": [
                    "Hiking", "Sightseeing", "Museum visiting", "Beach walk",
                    "Shopping", "Dining", "Spa & Wellness", "Night clubs",
                    "Guided tours", "Photography walk"
                ]
            }
            await self.collection.insert_one(default_options)
            return default_options
        return options

    async def update_options(self, options_data: dict) -> dict:
        """
        Overwrites or configures dynamic options.
        """
        update_doc = {
            "interests": options_data.get("interests", []),
            "travel_styles": options_data.get("travel_styles", []),
            "budgets": options_data.get("budgets", []),
            "activities": options_data.get("activities", [])
        }
        await self.collection.update_one(
            {"_id": "current_options"},
            {"$set": update_doc},
            upsert=True
        )
        return await self.get_options()
