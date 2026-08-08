from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field
import json
import logging

from app.routes.auth import get_current_user
from app.services.geocoding_service import GeocodingService
from app.services.weather import WeatherService
from app.services.ai_assistant import AIAssistantService
from app.repositories.ai_plan_draft import AIPlanDraftRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Standalone & Planner Endpoints"])
draft_repo = AIPlanDraftRepository()

# Request schemas
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
    interests: List[str] = Field(default_factory=list)
    travel_style: str = "Balanced"
    budget: str = "Moderate"
    number_of_travelers: int = 1
    activities: List[str] = Field(default_factory=list)

class ItineraryGenerateRequest(BaseModel):
    destination: str
    location: Optional[LocationInput] = None
    start_date: str
    end_date: str
    budget: str = "Moderate"
    interests: List[str] = Field(default_factory=list)
    travel_style: str = "Balanced"
    number_of_travelers: int = 1
    selected_places: List[str] = Field(default_factory=list)
    activities: List[str] = Field(default_factory=list)

class OutfitsRequest(BaseModel):
    destination: str
    location: Optional[LocationInput] = None
    start_date: str
    end_date: str
    travel_style: Optional[str] = "Casual"
    activities: List[str] = Field(default_factory=list)

class PackingRequest(BaseModel):
    destination: str
    location: Optional[LocationInput] = None
    start_date: str
    end_date: str
    budget: Optional[str] = "Moderate"
    travel_style: Optional[str] = "Casual"
    interests: List[str] = Field(default_factory=list)
    activities: List[str] = Field(default_factory=list)

class AIChatRequest(BaseModel):
    destination: str
    message: str
    plan_context: Optional[Dict[str, Any]] = None

class PlanSaveRequest(BaseModel):
    destination: str
    location: Optional[LocationInput] = None
    start_date: str
    end_date: str
    budget: str = "Moderate"
    interests: List[str] = Field(default_factory=list)
    travel_style: str = "Balanced"
    number_of_travelers: int = 1
    selected_places: List[str] = Field(default_factory=list)
    activities: List[str] = Field(default_factory=list)
    itinerary: Optional[List[Dict[str, Any]]] = None
    packing_checklist: Optional[Dict[str, Any]] = None
    outfit_recommendations: Optional[List[str]] = None
    hotels: Optional[List[Dict[str, Any]]] = None
    restaurants: Optional[List[Dict[str, Any]]] = None

# --- 1. Places Recommendations ---
@router.post("/recommendations")
async def get_places_recommendations(
    payload: RecommendationsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate recommendations based on destination, interests, travel style, and budget using local RAG & Ollama."""
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

    parts = [p for p in [resolved_loc.get("name", payload.destination), resolved_loc.get("region"), resolved_loc.get("country")] if p]
    fullname = ", ".join(parts) if parts else payload.destination

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

# --- 2. Weather-Aware Itinerary Generation ---
@router.post("/itinerary")
async def generate_itinerary(
    payload: ItineraryGenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate a weather-aware itinerary based on real Open-Meteo forecasts, selected places, and local Ollama."""
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
        logger.warning(f"Weather query failed during standalone itinerary generation: {e}")
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

# --- 3. AI Outfit Suggestions ---
@router.post("/outfits")
async def generate_outfits(
    payload: OutfitsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate daily weather-aware outfit suggestions."""
    try:
        start_d = datetime.strptime(payload.start_date, "%Y-%m-%d").date()
        end_d = datetime.strptime(payload.end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    loc_dict = payload.location.model_dump() if payload.location else None
    resolved_loc = await GeocodingService.resolve_destination(payload.destination, loc_dict)
    fullname = resolved_loc.get("name") if resolved_loc else payload.destination
    lat = resolved_loc["latitude"] if resolved_loc else None
    lon = resolved_loc["longitude"] if resolved_loc else None
    timezone = resolved_loc.get("timezone", "UTC") if resolved_loc else "UTC"

    weather_report = await WeatherService.get_destination_weather(
        destination=fullname,
        start_date=start_d,
        end_date=end_d,
        latitude=lat,
        longitude=lon,
        timezone=timezone
    )

    system_prompt = (
        "You are an expert travel stylist and local AI assistant.\n"
        "Generate realistic, weather-aware daily outfit suggestions based on the forecast, travel style, and activities.\n"
        "Generate a JSON object matching this schema exactly:\n"
        "{\n"
        "  \"outfits\": [\n"
        "    {\n"
        "      \"day\": 1,\n"
        "      \"date\": \"YYYY-MM-DD\",\n"
        "      \"weather_summary\": \"e.g. Rain showers, Max 18°C\",\n"
        "      \"morning_outfit\": \"e.g. Breathable cotton tee, light cardigan, comfortable sneakers\",\n"
        "      \"afternoon_outfit\": \"e.g. Waterproof windbreaker with denim pants\",\n"
        "      \"evening_outfit\": \"e.g. Smart casual sweater and warm jacket\",\n"
        "      \"accessories\": [\"Compact umbrella\", \"Sunglasses\"]\n"
        "    }\n"
        "  ]\n"
        "}\n"
    )
    user_content = (
        f"Generate outfit suggestions for {fullname} from {payload.start_date} to {payload.end_date}.\n"
        f"Travel Style: {payload.travel_style}. Activities: {', '.join(payload.activities)}.\n"
        f"Weather Forecast Data:\n{json.dumps(weather_report)}"
    )
    try:
        raw_res = await AIAssistantService._call_ollama(system_prompt, user_content, format_json=True)
        return json.loads(raw_res)
    except Exception:
        # Graceful weather-aware outfit suggestions fallback
        outfits = []
        w_days = weather_report.get("days", [])
        num_days = max(1, (end_d - start_d).days + 1)
        for i in range(num_days):
            d_curr = start_d + timedelta(days=i)
            d_str = d_curr.strftime("%Y-%m-%d")
            w_info = next((w for w in w_days if w["date"] == d_str), None)
            w_cond = w_info.get("weather_condition", "Mild") if w_info else "Pleasant"
            w_max = w_info.get("temperature_max", 25) if w_info else 25
            rain_p = w_info.get("rain_probability", 0) if w_info else 0
            
            m_outfit = f"Breathable cotton t-shirt with comfortable walking sneakers ({w_cond}, {w_max}°C)"
            a_outfit = "Light waterproof windbreaker and sunglasses" if rain_p > 30 else "Casual light shirt with denim or chinos"
            e_outfit = "Cozy sweater or lightweight jacket for breezy evening walks"
            acc = ["Compact umbrella", "Sunglasses", "Power bank"] if rain_p > 30 else ["Sunglasses", "Sunscreen SPF 50+", "Refillable water bottle"]
            
            outfits.append({
                "day": i + 1,
                "date": d_str,
                "weather_summary": f"{w_cond}, Max {w_max}°C (Rain {rain_p}%)",
                "morning_outfit": m_outfit,
                "afternoon_outfit": a_outfit,
                "evening_outfit": e_outfit,
                "accessories": acc
            })
        return {"outfits": outfits}

# --- 4. Dynamic Packing Checklist ---
@router.post("/packing")
async def generate_packing(
    payload: PackingRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate a dynamic categorized packing checklist based on destination, real weather, and activities."""
    try:
        start_d = datetime.strptime(payload.start_date, "%Y-%m-%d").date()
        end_d = datetime.strptime(payload.end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    loc_dict = payload.location.model_dump() if payload.location else None
    resolved_loc = await GeocodingService.resolve_destination(payload.destination, loc_dict)
    fullname = resolved_loc.get("name") if resolved_loc else payload.destination
    lat = resolved_loc["latitude"] if resolved_loc else None
    lon = resolved_loc["longitude"] if resolved_loc else None
    timezone = resolved_loc.get("timezone", "UTC") if resolved_loc else "UTC"

    weather_report = await WeatherService.get_destination_weather(
        destination=fullname,
        start_date=start_d,
        end_date=end_d,
        latitude=lat,
        longitude=lon,
        timezone=timezone
    )

    system_prompt = (
        "You are an expert travel assistant.\n"
        "Generate a dynamic categorized packing checklist tailored to the destination, trip duration, activities, and real weather forecast.\n"
        "Generate a JSON object matching this schema exactly:\n"
        "{\n"
        "  \"clothing\": [\"item1\", \"item2\"],\n"
        "  \"weather\": [\"item1\", \"item2\"],\n"
        "  \"personal_care\": [\"item1\", \"item2\"],\n"
        "  \"electronics\": [\"item1\", \"item2\"],\n"
        "  \"documents\": [\"item1\", \"item2\"],\n"
        "  \"activity_specific\": [\"item1\", \"item2\"],\n"
        "  \"emergency_essentials\": [\"item1\", \"item2\"]\n"
        "}\n"
    )
    user_content = (
        f"Generate packing list for {fullname} from {payload.start_date} to {payload.end_date}.\n"
        f"Interests: {', '.join(payload.interests)}. Activities: {', '.join(payload.activities)}.\n"
        f"Real Weather Context:\n{json.dumps(weather_report)}"
    )
    try:
        raw_res = await AIAssistantService._call_ollama(system_prompt, user_content, format_json=True)
        return json.loads(raw_res)
    except Exception:
        # Resilient weather-aware packing list fallback
        w_days = weather_report.get("days", [])
        has_rain = any(w.get("rain_probability", 0) > 30 for w in w_days)
        weather_items = ["Compact umbrella", "Quick-dry towel", "Rain poncho"] if has_rain else ["UV-protective sunglasses", "Sunscreen SPF 50+", "Sun hat"]
        
        return {
            "clothing": ["Light cotton t-shirts", "Comfortable walking shoes / sneakers", "Casual evening trousers", "Light jacket / layer"],
            "weather": weather_items,
            "personal_care": ["Hydrating lip balm", "Personal toiletries", "Hand sanitizer", "Mosquito repellent"],
            "electronics": ["Smartphone camera & high-speed charger", "Power bank (10000mAh+)", "Universal power adapter"],
            "documents": ["Government photo ID", "Hotel reservations / booking vouchers", "Digital travel insurance copy"],
            "activity_specific": ["Daypack / lightweight backpack", "Refillable water bottle", "Trekking socks"],
            "emergency_essentials": ["Basic travel first-aid kit", "Personal prescription medications", "Emergency cash reserve"]
        }

# --- 5. AI Travel Assistant Chat ---
@router.post("/chat")
async def chat_with_assistant(
    payload: AIChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """Chat with the AI travel assistant utilizing trip context, packing list, saved itinerary, and ChromaDB RAG."""
    trip_details = {
        "destination": payload.destination,
        "travel_interests": [],
        "preferred_travel_style": []
    }
    coords = await WeatherService.get_coordinates(payload.destination)
    fullname = coords[2] if coords else payload.destination
    today = date.today()
    weather_report = await WeatherService.get_destination_weather(
        destination=fullname,
        start_date=today,
        end_date=today + timedelta(days=5)
    )
    try:
        reply = await AIAssistantService.generate_chat_response(
            trip_details=trip_details,
            weather_details=weather_report,
            ai_plan=payload.plan_context,
            message_history=[],
            new_message=payload.message
        )
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI chat response failed: {str(e)}")

# --- 6. Saved Plans CRUD ---
@router.get("/plans")
async def list_saved_plans(
    current_user: dict = Depends(get_current_user)
):
    """Retrieve all saved AI trip plans for the authenticated user."""
    drafts = await draft_repo.get_user_drafts(current_user["id"])
    return drafts

@router.get("/plans/{plan_id}")
async def get_saved_plan(
    plan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve a specific saved AI trip plan by ID."""
    draft = await draft_repo.get_by_id(plan_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Saved plan not found")
    if draft["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return draft

@router.post("/plans", status_code=status.HTTP_201_CREATED)
async def create_saved_plan(
    payload: PlanSaveRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save an AI trip plan."""
    try:
        saved = await draft_repo.save_draft(user_id=current_user["id"], plan_data=payload.model_dump())
        return saved
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save plan: {str(e)}")

@router.patch("/plans/{plan_id}")
async def update_saved_plan(
    plan_id: str,
    payload: PlanSaveRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing saved AI trip plan."""
    updated = await draft_repo.update_draft(plan_id=plan_id, user_id=current_user["id"], plan_data=payload.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="Saved plan not found or unauthorized")
    return updated

@router.delete("/plans/{plan_id}")
async def delete_saved_plan(
    plan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a saved AI trip plan."""
    deleted = await draft_repo.delete_draft(plan_id=plan_id, user_id=current_user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved plan not found or unauthorized")
    return {"status": "success", "message": "Plan deleted successfully"}
