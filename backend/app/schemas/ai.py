from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime

class PackingItem(BaseModel):
    id: str = Field(..., description="Unique item ID")
    name: str = Field(..., description="Item name")
    category: str = Field(..., description="Category (Clothing, Weather, Personal Care, etc.)")
    quantity: int = Field(1, description="Quantity")
    is_packed: bool = Field(False, description="Packed status")

class PackingItemCreate(BaseModel):
    name: str = Field(..., description="Item name")
    category: str = Field(..., description="Category")
    quantity: int = Field(1, description="Quantity")

class PackingItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    is_packed: Optional[bool] = None

class PackingChecklistUpdate(BaseModel):
    items: List[PackingItem]

class ItineraryActivity(BaseModel):
    activity_name: str
    description: str
    why_matches: str
    suggested_duration: str
    time_of_day: str
    activity_type: str

class ItineraryDay(BaseModel):
    day_number: int
    morning: ItineraryActivity
    afternoon: ItineraryActivity
    evening: ItineraryActivity

class OutfitRecommendation(BaseModel):
    category: str  # Everyday, Outdoor, Rainy Weather, Evening, Activity-specific
    items: List[str]
    advice: str

class PlaceRecommendation(BaseModel):
    place_name: str
    description: str
    why_matches: str
    suggested_duration: str
    recommended_visiting_period: str
    activity_type: str

class ItineraryPlanResponse(BaseModel):
    id: Optional[str] = None
    trip_id: str
    user_id: str
    destination: str
    days: List[ItineraryDay]
    recommendations: List[PlaceRecommendation]
    outfit_recommendations: List[OutfitRecommendation]
    packing_checklist: List[PackingItem]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AIPlanRequest(BaseModel):
    regenerate: bool = False

class AIChatRequest(BaseModel):
    message: str

class AIChatResponse(BaseModel):
    reply: str
    timestamp: datetime
