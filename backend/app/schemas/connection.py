from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .request import UserMini, TripMini

class ConnectionResponse(BaseModel):
    id: str
    user1_id: str
    user2_id: str
    trip_id: str
    created_at: datetime
    buddy: UserMini
    shared_trip: TripMini

    class Config:
        from_attributes = True
