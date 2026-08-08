from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.schemas.message import MessageCreate, MessageResponse
from app.repositories.message import MessageRepository
from app.repositories.connection import ConnectionRepository
from app.routes.auth import get_current_user

router = APIRouter(prefix="/connections", tags=["Messages"])

@router.get("/{connection_id}/messages", response_model=List[MessageResponse])
async def get_connection_messages(
    connection_id: str,
    current_user: dict = Depends(get_current_user),
    message_repo: MessageRepository = Depends(),
    conn_repo: ConnectionRepository = Depends()
):
    """Retrieve all chat messages for a specific connection. Access restricted to connection participants."""
    # Verify connection exists and user is a participant
    conn = await conn_repo.get_by_id(connection_id)
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    if conn["user1_id"] != current_user["id"] and conn["user2_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: you are not a participant in this connection"
        )

    return await message_repo.get_messages(connection_id=connection_id)

import re

BANNED_WORDS = ["scam", "spam", "abuse", "kill", "weapons", "drugs", "cheat"]

def censor_content(text: str) -> str:
    censored = text
    for word in BANNED_WORDS:
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        censored = pattern.sub("*" * len(word), censored)
    return censored

@router.post("/{connection_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_connection_message(
    connection_id: str,
    message_data: MessageCreate,
    current_user: dict = Depends(get_current_user),
    message_repo: MessageRepository = Depends(),
    conn_repo: ConnectionRepository = Depends()
):
    """Send a direct message to a connection buddy. Access restricted to connection participants."""
    # Verify connection exists and user is a participant
    conn = await conn_repo.get_by_id(connection_id)
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    if conn["user1_id"] != current_user["id"] and conn["user2_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: you are not a participant in this connection"
        )

    # Determine receiver ID
    receiver_id = conn["user2_id"] if conn["user1_id"] == current_user["id"] else conn["user1_id"]

    censored_text = censor_content(message_data.content)

    new_msg = await message_repo.create_message(
        connection_id=connection_id,
        sender_id=current_user["id"],
        receiver_id=receiver_id,
        content=censored_text
    )

    # Send Notification to receiver
    try:
        from app.services.notification_service import NotificationService
        await NotificationService.create_notification(
            user_id=receiver_id,
            type_="new_message",
            title="New Private Message",
            message=f"{current_user['name']}: {censored_text[:50]}...",
            link=f"/chat/{connection_id}"
        )
    except Exception as e:
        print(f"Error creating message notification: {e}")

    return new_msg
