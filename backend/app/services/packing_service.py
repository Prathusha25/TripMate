import uuid
from typing import Optional, List, Dict, Any
from app.repositories.itinerary import ItineraryRepository

class PackingService:
    def __init__(self):
        self.itinerary_repo = ItineraryRepository()

    async def get_checklist(self, trip_id: str, user_id: str) -> Optional[List[Dict[str, Any]]]:
        """Fetch the packing checklist array for a trip."""
        plan = await self.itinerary_repo.get_by_trip_id(trip_id, user_id)
        if plan:
            return plan.get("packing_checklist", [])
        return None

    async def update_checklist(self, trip_id: str, user_id: str, items: List[Dict[str, Any]]) -> Optional[dict]:
        """Overwrites the entire checklist array."""
        return await self.itinerary_repo.update_packing_checklist(trip_id, user_id, items)

    async def add_item(self, trip_id: str, user_id: str, item_data: Dict[str, Any]) -> Optional[dict]:
        """Add a single custom item to the checklist."""
        item = {
            "id": f"item_custom_{str(uuid.uuid4())[:8]}",
            "name": item_data.get("name", "Custom Item"),
            "category": item_data.get("category", "General"),
            "quantity": int(item_data.get("quantity", 1)),
            "is_packed": False
        }
        return await self.itinerary_repo.add_packing_item(trip_id, user_id, item)

    async def update_item(self, trip_id: str, user_id: str, item_id: str, update_fields: Dict[str, Any]) -> Optional[dict]:
        """Update properties (is_packed, quantity, etc.) of a single item."""
        # Clean update fields
        allowed_keys = {"name", "category", "quantity", "is_packed"}
        clean_update = {k: v for k, v in update_fields.items() if k in allowed_keys}
        
        return await self.itinerary_repo.update_packing_item(trip_id, user_id, item_id, clean_update)

    async def delete_item(self, trip_id: str, user_id: str, item_id: str) -> Optional[dict]:
        """Delete an item from the checklist."""
        return await self.itinerary_repo.delete_packing_item(trip_id, user_id, item_id)
