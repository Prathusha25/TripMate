import logging
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from pydantic import BaseModel, Field
from app.routes.auth import get_current_user
from app.services.geocoding_service import GeocodingService
from app.services.weather import WeatherService
from app.services.ai_assistant import AIAssistantService
from app.repositories.ai_plan_draft import AIPlanDraftRepository
from app.repositories.planner_options import PlannerOptionsRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/planner", tags=["AI Trip Planner Page"])
draft_repo = AIPlanDraftRepository()
options_repo = PlannerOptionsRepository()

# Define request schemas
class LocationInput(BaseModel):
    name: Optional[str] = None
    latitude: float
    longitude: float
    country: Optional[str] = ""
    country_code: Optional[str] = ""
    region: Optional[str] = ""
    timezone: Optional[str] = "UTC"

class RecommendationsRequest(BaseModel):
    destination: str
    location: Optional[LocationInput] = None
    interests: List[str]
    travel_style: str
    budget: str
    number_of_travelers: int = 1
    activities: List[str] = Field(default_factory=list)

class ItineraryGenerateRequest(BaseModel):
    destination: str
    location: Optional[LocationInput] = None
    start_date: str
    end_date: str
    budget: str
    interests: List[str]
    travel_style: str
    number_of_travelers: int = 1
    selected_places: List[str]
    activities: List[str] = Field(default_factory=list)

class DraftSaveRequest(BaseModel):
    destination: str
    location: Optional[LocationInput] = None
    start_date: str
    end_date: str
    budget: str
    interests: List[str]
    travel_style: str
    number_of_travelers: int = 1
    selected_places: List[str]
    activities: List[str] = Field(default_factory=list)
    itinerary: Optional[List[Dict[str, Any]]] = None
    packing_checklist: Optional[Dict[str, Any]] = None
    outfit_recommendations: Optional[List[str]] = None
    hotels: Optional[List[Dict[str, Any]]] = None
    restaurants: Optional[List[Dict[str, Any]]] = None

class OptionsUpdateRequest(BaseModel):
    interests: List[str]
    travel_styles: List[str]
    budgets: List[str]
    activities: List[str]

class RegenerateDayRequest(BaseModel):
    destination: str
    day_number: int
    date: str
    budget: str
    travel_style: str
    interests: List[str]
    selected_places: List[str]
    weather_details: Dict[str, Any]
    prompt: Optional[str] = None

@router.post("/recommendations")
async def get_places_recommendations(
    payload: RecommendationsRequest,
    current_user: dict = Depends(get_current_user)
):
    """AI Place Discovery based on dynamic location resolution and preference inputs."""
    loc_dict = payload.location.model_dump() if payload.location else None
    resolved_loc = await GeocodingService.resolve_destination(payload.destination, loc_dict)
    
    if not resolved_loc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "DESTINATION_NOT_FOUND",
                "message": "No matching destination was found. Try entering a city, town, region, or country."
            }
        )

    fullname = resolved_loc.get("name") or payload.destination
    if resolved_loc.get("region"):
        fullname += f", {resolved_loc['region']}"
    if resolved_loc.get("country"):
        fullname += f", {resolved_loc['country']}"

    try:
        recs = await AIAssistantService.recommend_places(
            destination=fullname,
            interests=payload.interests,
            travel_style=payload.travel_style,
            budget=payload.budget,
            number_of_travelers=payload.number_of_travelers
        )
        return recs
    except Exception as e:
        logger.error(f"Failed to generate place recommendations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "AI_SERVICE_ERROR",
                "message": "AI planning is temporarily unavailable. Please try again."
            }
        )

@router.post("/generate")
async def generate_weather_aware_itinerary(
    payload: ItineraryGenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Make My Plan based on selected places and real weather."""
    # 1. Validate dates
    try:
        start_d = datetime.strptime(payload.start_date, "%Y-%m-%d").date()
        end_d = datetime.strptime(payload.end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_DATE_RANGE",
                "message": "Invalid date format. Use YYYY-MM-DD."
            }
        )

    if start_d > end_d:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_DATE_RANGE",
                "message": "Start date must be before or equal to end date."
            }
        )

    # 2. Dynamic Geocoding lookup
    loc_dict = payload.location.model_dump() if payload.location else None
    resolved_loc = await GeocodingService.resolve_destination(payload.destination, loc_dict)
    
    if not resolved_loc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "DESTINATION_NOT_FOUND",
                "message": "No matching destination was found. Try entering a city, town, region, or country."
            }
        )

    lat = resolved_loc["latitude"]
    lon = resolved_loc["longitude"]
    timezone = resolved_loc.get("timezone", "UTC")
    
    parts = [p for p in [resolved_loc.get("name", payload.destination), resolved_loc.get("region"), resolved_loc.get("country")] if p]
    fullname = ", ".join(parts) if parts else payload.destination

    # 3. Fetch weather
    try:
        weather_report = await WeatherService.get_destination_weather(
            destination=fullname,
            start_date=start_d,
            end_date=end_d,
            latitude=lat,
            longitude=lon,
            timezone=timezone
        )
    except Exception as e:
        logger.warning(f"Weather retrieval error during itinerary generation: {e}")
        weather_report = {
            "destination": fullname,
            "timezone": timezone,
            "forecast_available": False,
            "days": [],
            "message": "Destination found, but weather data is temporarily unavailable."
        }

    try:
        itinerary_plan = await AIAssistantService.generate_itinerary_plan(
            destination=fullname,
            start_date=payload.start_date,
            end_date=payload.end_date,
            budget=payload.budget,
            interests=payload.interests,
            travel_style=payload.travel_style,
            number_of_travelers=payload.number_of_travelers,
            selected_places=payload.selected_places,
            weather_details=weather_report
        )
        return itinerary_plan
    except Exception as e:
        logger.error(f"Itinerary generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "AI_SERVICE_ERROR",
                "message": "AI planning is temporarily unavailable. Please try again."
            }
        )

@router.post("/save")
async def save_plan_draft(
    payload: DraftSaveRequest,
    current_user: dict = Depends(get_current_user)
):
    """Saves the generated plan draft to MongoDB drafts database."""
    try:
        saved_doc = await draft_repo.save_draft(user_id=current_user["id"], plan_data=payload.model_dump())
        return saved_doc
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save plan draft: {str(e)}"
        )

@router.get("/options")
async def get_planner_options():
    """Retrieve dynamic configuration options for interests, styles, budgets, and activities."""
    try:
        opts = await options_repo.get_options()
        return opts
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve configuration options: {str(e)}"
        )

@router.post("/options")
async def update_planner_options(
    payload: OptionsUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update dynamic configuration options."""
    try:
        opts = await options_repo.update_options(payload.model_dump())
        return opts
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update configuration options: {str(e)}"
        )

@router.post("/regenerate-day")
async def regenerate_day(
    payload: RegenerateDayRequest,
    current_user: dict = Depends(get_current_user)
):
    """Regenerate a single day's activities in a weather-aware and interest-aware manner."""
    try:
        day_plan = await AIAssistantService.regenerate_day_plan(
            destination=payload.destination,
            day_number=payload.day_number,
            date_str=payload.date,
            budget=payload.budget,
            travel_style=payload.travel_style,
            interests=payload.interests,
            selected_places=payload.selected_places,
            weather_details=payload.weather_details,
            regeneration_prompt=payload.prompt
        )
        return day_plan
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to regenerate day: {str(e)}"
        )

class AddPlaceRequest(BaseModel):
    destination: str
    prompt: str

@router.post("/recommendations/add")
async def suggest_and_add_place(
    payload: AddPlaceRequest,
    current_user: dict = Depends(get_current_user)
):
    """Dynamically suggest places based on a user search prompt to add to the checklist using local Ollama."""
    import json
    system_prompt = (
        "You are a professional travel planner and AI assistant.\n"
        f"The user wants to add places to their trip to {payload.destination}.\n"
        f"They searched/requested: '{payload.prompt}'\n\n"
        "Recommend 2 or 3 specific, real places matching this request.\n"
        "Generate a JSON object matching this schema exactly:\n"
        "{\n"
        "  \"places\": [\n"
        "    {\n"
        "      \"name\": \"Place Name\",\n"
        "      \"description\": \"Short description\",\n"
        "      \"why_matches\": \"Why it matches the user request\"\n"
        "    }\n"
        "  ]\n"
        "}\n"
    )
    user_content = f"Find 2 or 3 places in {payload.destination} matching: '{payload.prompt}'."
    try:
        raw_res = await AIAssistantService._call_ollama(system_prompt, user_content, format_json=True)
        return json.loads(raw_res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def get_all_plan_drafts(
    current_user: dict = Depends(get_current_user)
):
    """Retrieves all saved plan drafts for the current user."""
    try:
        drafts = await draft_repo.get_user_drafts(current_user["id"])
        return drafts
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve plan drafts: {str(e)}"
        )

@router.put("/{plan_id}")
async def update_plan_draft(
    plan_id: str,
    payload: DraftSaveRequest,
    current_user: dict = Depends(get_current_user)
):
    """Updates a saved plan draft."""
    updated = await draft_repo.update_draft(
        plan_id=plan_id,
        user_id=current_user["id"],
        plan_data=payload.model_dump()
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail="Plan draft not found or unauthorized to update"
        )
    return updated

@router.get("/{plan_id}")
async def get_plan_draft(
    plan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieves a saved plan draft by ID."""
    draft = await draft_repo.get_by_id(plan_id)
    if not draft:
        raise HTTPException(
            status_code=404,
            detail="Plan draft not found"
        )
    if draft["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: you do not own this plan draft"
        )
    return draft

@router.delete("/{plan_id}")
async def delete_plan_draft(
    plan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deletes a saved plan draft by ID."""
    deleted = await draft_repo.delete_draft(plan_id=plan_id, user_id=current_user["id"])
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Plan draft not found or unauthorized to delete"
        )
    return {"status": "success", "message": "Plan draft deleted successfully"}
