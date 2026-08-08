from fastapi import APIRouter, Depends, HTTPException, status
from app.routes.auth import get_current_user
from app.repositories.trip import TripRepository
from app.services.weather_service import WeatherService
from app.schemas.weather import WeatherResponse
from datetime import datetime, date, timedelta

router = APIRouter(prefix="/ai/trips/{trip_id}/weather", tags=["AI Weather"])

@router.get("", response_model=WeatherResponse)
async def get_trip_weather(
    trip_id: str,
    current_user: dict = Depends(get_current_user),
    trip_repo: TripRepository = Depends(),
    weather_service: WeatherService = Depends()
):
    """Retrieve weather forecast data for a specific trip destination."""
    # 1. Fetch trip and verify ownership
    trip = await trip_repo.get_by_id(trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )
    if trip["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not own this trip"
        )

    # 2. Get real weather forecast
    core_data = await weather_service.get_destination_weather(
        destination=trip["destination"],
        start_date=date.today(),
        end_date=date.today() + timedelta(days=7),
        latitude=trip.get("latitude"),
        longitude=trip.get("longitude"),
        timezone=trip.get("timezone")
    )
    # Map to WeatherResponse
    mapped_forecast = []
    for day in core_data.get("days", []):
        mapped_forecast.append({
            "date": day["date"],
            "temp_c": day["temperature_max"] if day["temperature_max"] is not None else 20.0,
            "condition": day["weather_condition"],
            "rain_prob": float(day["rain_probability"]),
            "icon": None
        })
    return {
        "destination": core_data.get("destination", trip["destination"]),
        "is_available": core_data.get("forecast_available", False),
        "forecast": mapped_forecast,
        "warnings": [],
        "source": "Open-Meteo"
    }

# General forecast router
forecast_router = APIRouter(prefix="/weather", tags=["Weather Forecast"])

@forecast_router.get("/geocode")
async def geocode_destination(
    destination: str,
    current_user: dict = Depends(get_current_user),
    weather_service: WeatherService = Depends()
):
    """Resolve destination into coordinates, formatted name, and timezone."""
    coords = await WeatherService.get_coordinates(destination)
    if not coords:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "DESTINATION_NOT_FOUND",
                "message": "No matching destination was found. Try entering a city, town, region, or country."
            }
        )
    lat, lon, fullname, timezone = coords
    return {
        "destination": destination,
        "resolved_name": fullname,
        "latitude": lat,
        "longitude": lon,
        "timezone": timezone
    }

@forecast_router.get("/forecast")
async def get_general_weather_forecast(
    destination: str,
    start_date: str,
    end_date: str,
    current_user: dict = Depends(get_current_user),
    weather_service: WeatherService = Depends()
):
    """Retrieve weather forecast data for a generic destination and date range."""
    # 1. Validate dates
    try:
        start_d = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_d = datetime.strptime(end_date, "%Y-%m-%d").date()
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

    # 2. Resolve coordinates using Geocoding
    coords = await WeatherService.get_coordinates(destination)
    if not coords:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "DESTINATION_NOT_FOUND",
                "message": "No matching destination was found. Try entering a city, town, region, or country."
            }
        )

    lat, lon, fullname, timezone = coords

    # 3. Get weather forecast
    try:
        core_data = await weather_service.get_destination_weather(
            destination=fullname,
            start_date=start_d,
            end_date=end_d,
            latitude=lat,
            longitude=lon,
            timezone=timezone
        )
        return core_data
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": "WEATHER_SERVICE_ERROR",
                "message": "Destination found, but weather data is temporarily unavailable."
            }
        )
