from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime

class ChecklistItemUpdate(BaseModel):
    category: str = Field(..., description="Checklist category, e.g., clothing, electronics")
    item: str = Field(..., description="The name of the item to mutate")
    checked: Optional[bool] = Field(None, description="New check status if toggling")
    action: str = Field(..., description="Action to perform: 'toggle', 'add', or 'remove'")

class AIChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000, description="Chat content cannot be empty")

class AIChatMessageResponse(BaseModel):
    id: str
    trip_id: str
    user_id: str
    content: str
    timestamp: datetime
    is_ai: bool

    class Config:
        from_attributes = True

class AIPlanResponse(BaseModel):
    trip_id: str
    places: List[Dict]
    visiting_times_explanation: Dict
    itinerary: List[Dict]
    outfit_recommendations: List[str]
    packing_checklist: Dict[str, List[Dict]]
    created_at: datetime

    class Config:
        from_attributes = True
