from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import List, Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=50)

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters long")
    confirm_password: str = Field(..., min_length=6)

    @model_validator(mode='after')
    def verify_passwords_match(self) -> 'UserCreate':
        if self.password != self.confirm_password:
            raise ValueError("passwords do not match")
        return self

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    profile_photo: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=500)
    home_city: Optional[str] = Field(None, max_length=100)
    interests: Optional[List[str]] = Field(default_factory=list)
    travel_style: Optional[List[str]] = Field(default_factory=list)
    budget_preference: Optional[str] = None

class UserResponse(UserBase):
    id: str
    profile_photo: Optional[str] = None
    bio: Optional[str] = None
    home_city: Optional[str] = None
    interests: List[str] = []
    travel_style: List[str] = []
    budget_preference: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    status: Optional[str] = None
    email: Optional[str] = None

class TokenData(BaseModel):
    user_id: Optional[str] = None
