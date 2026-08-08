import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Query, HTTPException, status
from pydantic import BaseModel, Field

from app.services.geocoding_service import GeocodingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/locations", tags=["Location & Geocoding Search"])

class LocationSchema(BaseModel):
    name: str
    latitude: float
    longitude: float
    country: str = ""
    country_code: Optional[str] = ""
    region: Optional[str] = ""
    timezone: str = "UTC"
    population: Optional[int] = None
    feature_code: Optional[str] = None

class SearchResponse(BaseModel):
    results: List[LocationSchema]

class ResolveRequest(BaseModel):
    query: str
    location: Optional[LocationSchema] = None

class ResolveResponse(BaseModel):
    location: LocationSchema

@router.get("/search", response_model=SearchResponse)
async def search_locations(
    q: str = Query(..., description="Destination query (e.g. Manali, Paris, Goa, Munnar)"),
    limit: int = Query(10, ge=1, le=20)
):
    """
    Dynamically search for real-world destinations using Open-Meteo Geocoding API.
    Supports debounced autocomplete suggestions and composite queries.
    """
    if not q or len(q.strip()) < 2:
        return {"results": []}

    try:
        results = await GeocodingService.search_destinations(q.strip(), limit=limit)
        return {"results": results}
    except Exception as e:
        logger.error(f"Geocoding service error for query '{q}': {e}")
        # If open-meteo fails or is unreachable, raise GEOCODING_SERVICE_ERROR
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": "GEOCODING_SERVICE_ERROR",
                "message": "We couldn't verify this destination right now. Please try again."
            }
        )

@router.post("/resolve", response_model=ResolveResponse)
async def resolve_location(payload: ResolveRequest):
    """
    Resolves or validates a destination input to a structured location object.
    """
    try:
        resolved = await GeocodingService.resolve_destination(
            query=payload.query,
            selected_location=payload.location.model_dump() if payload.location else None
        )
        if not resolved:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "DESTINATION_NOT_FOUND",
                    "message": "No matching destination was found. Try entering a city, town, region, or country."
                }
            )
        return {"location": resolved}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Failed to resolve location: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "GEOCODING_SERVICE_ERROR",
                "message": "We couldn't verify this destination right now. Please try again."
            }
        )
