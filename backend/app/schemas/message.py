from pydantic import BaseModel, Field
from datetime import datetime

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000, description="Message content cannot be empty")

class MessageResponse(BaseModel):
    id: str
    connection_id: str
    sender_id: str
    receiver_id: str
    content: str
    timestamp: datetime
    is_read: bool = False

    class Config:
        from_attributes = True
