from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Optional, Any
from datetime import datetime, date
from pydantic import BaseModel

def parse_date(d):
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, date):
        return d
    d_str = str(d).split(" ")[0].split("T")[0]
    return datetime.strptime(d_str, "%Y-%m-%d").date()

from app.schemas.ai_plan import ChecklistItemUpdate, AIChatMessageCreate, AIChatMessageResponse, AIPlanResponse
from app.repositories.trip import TripRepository
from app.repositories.ai_plan import AIPlanRepository
from app.services.weather import WeatherService
from app.services.ai_assistant import AIAssistantService
from app.routes.auth import get_current_user

router = APIRouter(prefix="/trips/{trip_id}", tags=["AI Planning & Assistant"])

trip_repo = TripRepository()
ai_repo = AIPlanRepository()

async def get_trip_and_verify_owner(trip_id: str, user_id: str) -> dict:
    """Helper to verify that a trip exists and belongs to the active user."""
    trip = await trip_repo.get_by_id(trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )
    if trip["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: you do not own this trip"
        )
    return trip

@router.get("/weather", response_model=Dict)
async def get_trip_weather(
    trip_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve weather forecast or historical climate data for the trip destination."""
    trip = await get_trip_and_verify_owner(trip_id, current_user["id"])
    
    # Fetch weather report
    weather_report = await WeatherService.get_destination_weather(
        destination=trip["destination"],
        start_date=parse_date(trip["start_date"]),
        end_date=parse_date(trip["end_date"]),
        latitude=trip.get("latitude"),
        longitude=trip.get("longitude"),
        timezone=trip.get("timezone")
    )
    return weather_report

class AIPlanSaveRequest(BaseModel):
    places: Optional[List[Dict[str, Any]]] = None
    visiting_times_explanation: Optional[Dict[str, str]] = None
    itinerary: Optional[List[Dict[str, Any]]] = None
    outfit_recommendations: Optional[List[str]] = None
    packing_checklist: Optional[Dict[str, Any]] = None
    hotels: Optional[List[Dict[str, Any]]] = None
    restaurants: Optional[List[Dict[str, Any]]] = None

@router.post("/ai-plan", response_model=AIPlanResponse)
async def generate_trip_plan(
    trip_id: str,
    payload: Optional[AIPlanSaveRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a personalized AI travel plan adjusted to local weather conditions.
    If an existing plan payload is provided, save it directly without invoking OpenAI.
    """
    trip = await get_trip_and_verify_owner(trip_id, current_user["id"])
    
    if payload and (payload.itinerary or payload.places):
        # Save existing plan directly
        saved_plan = await ai_repo.save_plan(trip_id=trip_id, plan_data=payload.model_dump())
        return saved_plan
    
    # Get weather context first
    weather_report = await WeatherService.get_destination_weather(
        destination=trip["destination"],
        start_date=parse_date(trip["start_date"]),
        end_date=parse_date(trip["end_date"])
    )

    try:
        # Request generation from OpenAI
        generated_plan = await AIAssistantService.generate_travel_plan(
            trip_details=trip,
            weather_details=weather_report
        )
        
        # Save structural details to database
        saved_plan = await ai_repo.save_plan(trip_id=trip_id, plan_data=generated_plan)
        return saved_plan
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"AI Plan generation failed: {str(e)}"
        )

@router.get("/ai-plan", response_model=AIPlanResponse)
async def get_trip_plan(
    trip_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Fetch the saved AI travel plan. Returns 404 if not generated yet."""
    await get_trip_and_verify_owner(trip_id, current_user["id"])
    
    plan = await ai_repo.get_plan(trip_id=trip_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI Plan has not been generated for this trip yet."
        )
    return plan

@router.put("/ai-plan/checklist", response_model=AIPlanResponse)
async def mutate_packing_checklist(
    trip_id: str,
    payload: ChecklistItemUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Mutate items in the saved packing checklist (toggle checked status, add custom, remove)."""
    await get_trip_and_verify_owner(trip_id, current_user["id"])
    
    updated_plan = await ai_repo.update_checklist_item(
        trip_id=trip_id,
        category=payload.category,
        item_name=payload.item,
        checked=payload.checked,
        action=payload.action
    )
    if not updated_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update checklist (is the AI plan generated?)"
        )
    return updated_plan

@router.get("/ai-chat/messages", response_model=List[AIChatMessageResponse])
async def get_ai_chat_logs(
    trip_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Fetch the chat logs between the traveler and the AI Assistant for this trip."""
    await get_trip_and_verify_owner(trip_id, current_user["id"])
    return await ai_repo.get_chat_history(trip_id=trip_id)

@router.post("/ai-chat/messages", response_model=AIChatMessageResponse)
async def send_chat_message_to_ai(
    trip_id: str,
    payload: AIChatMessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Send a message to the AI Assistant. It responds contextually using trip parameters and active weather."""
    trip = await get_trip_and_verify_owner(trip_id, current_user["id"])
    
    # Save user's question
    user_msg = await ai_repo.save_chat_message(
        trip_id=trip_id,
        user_id=current_user["id"],
        content=payload.content,
        is_ai=False
    )
    
    # Gather context: weather, plan, and message history
    weather_report = await WeatherService.get_destination_weather(
        destination=trip["destination"],
        start_date=parse_date(trip["start_date"]),
        end_date=parse_date(trip["end_date"])
    )
    
    plan = await ai_repo.get_plan(trip_id=trip_id)
    history = await ai_repo.get_chat_history(trip_id=trip_id)

    # Call OpenAI
    ai_response_text = await AIAssistantService.generate_chat_response(
        trip_details=trip,
        weather_details=weather_report,
        ai_plan=plan,
        message_history=history,
        new_message=payload.content
    )

    # Save assistant's answer
    ai_msg = await ai_repo.save_chat_message(
        trip_id=trip_id,
        user_id="ai",
        content=ai_response_text,
        is_ai=True
    )
    return ai_msg
