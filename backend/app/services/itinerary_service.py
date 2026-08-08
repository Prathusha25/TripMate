import uuid
from typing import Optional, Dict, Any
from app.repositories.trip import TripRepository
from app.repositories.itinerary import ItineraryRepository
from app.services.weather_service import WeatherService
from app.services.ai_service import AIService

class ItineraryService:
    def __init__(self):
        self.trip_repo = TripRepository()
        self.itinerary_repo = ItineraryRepository()
        self.weather_service = WeatherService()
        self.ai_service = AIService()

    async def get_plan(self, trip_id: str, user_id: str) -> Optional[dict]:
        """Retrieve the saved AI plan for a trip."""
        return await self.itinerary_repo.get_by_trip_id(trip_id, user_id)

    async def generate_and_save_plan(self, trip_id: str, user_id: str) -> dict:
        """Fetch trip and weather, generate AI plan, and save to repository."""
        # 1. Fetch trip and verify ownership
        trip = await self.trip_repo.get_by_id(trip_id)
        if not trip:
            raise ValueError("Trip not found")
        if trip["user_id"] != user_id:
            raise PermissionError("User does not own this trip")

        # 2. Get real weather forecast
        weather_data = await self.weather_service.get_forecast(trip["destination"])

        # 3. Call OpenAI to generate plan
        ai_plan = await self.ai_service.generate_plan(trip, weather_data)

        # 4. Post-process packing checklist with unique IDs
        processed_checklist = []
        raw_checklist = ai_plan.get("packing_checklist", [])
        for idx, item in enumerate(raw_checklist):
            processed_checklist.append({
                "id": f"item_{idx + 1}_{str(uuid.uuid4())[:8]}",
                "name": item.get("name", "Unknown Item"),
                "category": item.get("category", "General"),
                "quantity": int(item.get("quantity", 1)),
                "is_packed": False
            })
        ai_plan["packing_checklist"] = processed_checklist

        # 5. Save to MongoDB
        saved = await self.itinerary_repo.save_plan(trip_id, user_id, ai_plan)
        return saved
