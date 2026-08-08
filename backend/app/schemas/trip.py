from pydantic import BaseModel, Field, model_validator
from typing import List, Optional
from datetime import date, datetime

class TripBase(BaseModel):
    destination: str = Field(..., min_length=1, description="Destination is required")
    start_date: date = Field(..., description="Start date is required")
    end_date: date = Field(..., description="End date is required")
    approximate_budget: float = Field(..., gt=0, description="Budget must be greater than 0")
    travel_interests: List[str] = Field(default_factory=list)
    preferred_travel_style: List[str] = Field(default_factory=list)
    number_of_travelers: int = Field(..., ge=1, description="Number of travelers must be at least 1")
    description: Optional[str] = Field(None, max_length=1000)
    priorities: Optional[dict] = Field(default_factory=dict)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None

    @model_validator(mode='after')
    def verify_dates(self) -> 'TripBase':
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("end date cannot be before start date")
        return self

class TripCreate(TripBase):
    pass

class TripUpdate(BaseModel):
    destination: Optional[str] = Field(None, min_length=1)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    approximate_budget: Optional[float] = Field(None, gt=0)
    travel_interests: Optional[List[str]] = None
    preferred_travel_style: Optional[List[str]] = None
    number_of_travelers: Optional[int] = Field(None, ge=1)
    description: Optional[str] = Field(None, max_length=1000)
    priorities: Optional[dict] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None

    @model_validator(mode='after')
    def verify_dates(self) -> 'TripUpdate':
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("end date cannot be before start date")
        return self

class TripResponse(TripBase):
    id: str
    user_id: str
    created_at: datetime
    members: List[str] = Field(default_factory=list)
    owner_name: Optional[str] = None
    owner_profile_photo: Optional[str] = None
    owner_bio: Optional[str] = None
    members_profiles: List[dict] = Field(default_factory=list)
    compatibility: Optional[str] = None
    match_score: Optional[float] = None
    match_tier: Optional[str] = None
    match_reasons: Optional[List[str]] = None
    match_method: Optional[str] = None

    class Config:
        from_attributes = True
