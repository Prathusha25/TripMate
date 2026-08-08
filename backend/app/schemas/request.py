from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime

class TravelRequestCreate(BaseModel):
    trip_id: Optional[str] = None
    receiver_id: str
    request_type: Optional[str] = "trip_join"

class UserMini(BaseModel):
    id: str
    name: str
    profile_photo: Optional[str] = None
    bio: Optional[str] = None
    interests: List[str] = []
    travel_style: List[str] = []

class TripMini(BaseModel):
    id: str
    destination: str
    start_date: date
    end_date: date
    approximate_budget: float
    description: Optional[str] = None

class TravelRequestResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    trip_id: Optional[str] = None
    request_type: str = "trip_join"
    status: str  # pending, accepted, rejected, cancelled
    created_at: datetime
    trip_owner_id: Optional[str] = None
    requester_id: Optional[str] = None
    updated_at: Optional[datetime] = None
    sender: Optional[UserMini] = None
    receiver: Optional[UserMini] = None
    trip: Optional[TripMini] = None

    class Config:
        from_attributes = True
