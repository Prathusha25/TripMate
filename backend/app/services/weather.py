import logging
import httpx
from datetime import date, datetime, timedelta
from typing import Optional, Tuple, List, Dict, Any
from fastapi import HTTPException, status
from app.services.geocoding_service import GeocodingService

logger = logging.getLogger(__name__)

WMO_CODES = {
    0: "Clear Sky",
    1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
    45: "Foggy", 48: "Depositing Rime Fog",
    51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
    56: "Light Freezing Drizzle", 57: "Dense Freezing Drizzle",
    61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
    66: "Light Freezing Rain", 67: "Heavy Freezing Rain",
    71: "Slight Snow Fall", 73: "Moderate Snow Fall", 75: "Heavy Snow Fall",
    77: "Snow Grains",
    80: "Slight Rain Showers", 81: "Moderate Rain Showers", 82: "Violent Rain Showers",
    85: "Slight Snow Showers", 86: "Heavy Snow Showers",
    95: "Slight Thunderstorm", 96: "Thunderstorm with Slight Hail", 99: "Thunderstorm with Heavy Hail"
}

def get_condition_string(code: Optional[int]) -> str:
    if code is None:
        return "Unknown"
    return WMO_CODES.get(code, "Cloudy")

class WeatherService:
    @staticmethod
    async def get_coordinates(destination: str) -> Optional[Tuple[float, float, str, str]]:
        """
        Dynamically resolves destination into latitude, longitude, formatted fullname, and timezone
        using the dedicated GeocodingService backed by Open-Meteo Geocoding API.
        """
        if not destination or not destination.strip():
            return None

        loc = await GeocodingService.resolve_destination(destination)
        if not loc:
            return None

        lat = loc["latitude"]
        lon = loc["longitude"]
        name = loc.get("name", destination.strip())
        region = loc.get("region", "")
        country = loc.get("country", "")
        
        parts = [p for p in [name, region, country] if p]
        fullname = ", ".join(parts) if parts else name
        timezone = loc.get("timezone") or "UTC"

        return lat, lon, fullname, timezone

    @staticmethod
    async def get_destination_weather(
        destination: str, 
        start_date: date, 
        end_date: date,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        timezone: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieves real-time weather forecast from Open-Meteo.
        If coordinates/timezone are not provided, dynamically resolves destination via GeocodingService first.
        """
        # 1. Resolve coordinates if not supplied
        if latitude is None or longitude is None or timezone is None:
            coords = await WeatherService.get_coordinates(destination)
            if not coords:
                return {
                    "destination": destination,
                    "timezone": "UTC",
                    "forecast_available": False,
                    "days": [],
                    "message": "No matching destination was found. Try entering a city, town, region, or country."
                }
            latitude, longitude, resolved_name, timezone = coords
        else:
            resolved_name = destination

        # 2. Check if dates are in forecast horizon
        today = date.today()
        forecast_limit = today + timedelta(days=14)
        
        # If dates are entirely in the past or far in the future:
        if start_date > forecast_limit or end_date < today:
            return {
                "destination": resolved_name,
                "timezone": timezone,
                "forecast_available": False,
                "days": [],
                "message": "Detailed weather forecast is not available yet for these dates. Forecast will become available closer to your trip dates."
            }

        # 3. Call Open-Meteo Forecast API with resolved coordinates
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weathercode,windspeed_10m_max",
            "hourly": "temperature_2m,precipitation_probability,weathercode",
            "timezone": timezone
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params=params)
                res.raise_for_status()
                data = res.json()
                
                daily = data.get("daily", {})
                hourly = data.get("hourly", {})
                
                dates = daily.get("time", [])
                max_temps = daily.get("temperature_2m_max", [])
                min_temps = daily.get("temperature_2m_min", [])
                rain_probs = daily.get("precipitation_probability_max", [])
                precip_sums = daily.get("precipitation_sum", [])
                codes = daily.get("weathercode", [])
                wind_speeds = daily.get("windspeed_10m_max", [])
                
                hourly_time = hourly.get("time", [])
                hourly_temp = hourly.get("temperature_2m", [])
                hourly_prob = hourly.get("precipitation_probability", [])
                hourly_code = hourly.get("weathercode", [])
                
                def get_hourly_val(target_time_str, time_list, val_list):
                    try:
                        idx = time_list.index(target_time_str)
                        return val_list[idx]
                    except (ValueError, IndexError):
                        return None

                days_forecast = []
                for i, date_str in enumerate(dates):
                    curr_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                    if start_date <= curr_date <= end_date:
                        # Extract hourly forecasts for Morning (09:00), Afternoon (15:00), Evening (21:00)
                        morning_time = f"{date_str}T09:00"
                        afternoon_time = f"{date_str}T15:00"
                        evening_time = f"{date_str}T21:00"
                        
                        m_temp = get_hourly_val(morning_time, hourly_time, hourly_temp)
                        m_prob = get_hourly_val(morning_time, hourly_time, hourly_prob)
                        m_code = get_hourly_val(morning_time, hourly_time, hourly_code)
                        
                        a_temp = get_hourly_val(afternoon_time, hourly_time, hourly_temp)
                        a_prob = get_hourly_val(afternoon_time, hourly_time, hourly_prob)
                        a_code = get_hourly_val(afternoon_time, hourly_time, hourly_code)
                        
                        e_temp = get_hourly_val(evening_time, hourly_time, hourly_temp)
                        e_prob = get_hourly_val(evening_time, hourly_time, hourly_prob)
                        e_code = get_hourly_val(evening_time, hourly_time, hourly_code)
                        
                        days_forecast.append({
                            "date": date_str,
                            "temperature_max": max_temps[i] if i < len(max_temps) else None,
                            "temperature_min": min_temps[i] if i < len(min_temps) else None,
                            "weather_condition": get_condition_string(codes[i]) if i < len(codes) else "Unknown",
                            "rain_probability": rain_probs[i] if i < len(rain_probs) else 0,
                            "precipitation": precip_sums[i] if i < len(precip_sums) else 0.0,
                            "wind_speed": wind_speeds[i] if i < len(wind_speeds) else 0.0,
                            "morning": {
                                "temperature": m_temp if m_temp is not None else (max_temps[i] if i < len(max_temps) else 20),
                                "rain_probability": m_prob if m_prob is not None else 0,
                                "condition": get_condition_string(m_code) if m_code is not None else "Unknown"
                            },
                            "afternoon": {
                                "temperature": a_temp if a_temp is not None else (max_temps[i] if i < len(max_temps) else 20),
                                "rain_probability": a_prob if a_prob is not None else 0,
                                "condition": get_condition_string(a_code) if a_code is not None else "Unknown"
                            },
                            "evening": {
                                "temperature": e_temp if e_temp is not None else (min_temps[i] if i < len(min_temps) else 15),
                                "rain_probability": e_prob if e_prob is not None else 0,
                                "condition": get_condition_string(e_code) if e_code is not None else "Unknown"
                            }
                        })
                
                # Check if any days within the schedule were returned
                if not days_forecast:
                    return {
                        "destination": resolved_name,
                        "timezone": timezone,
                        "forecast_available": False,
                        "days": [],
                        "message": "Detailed weather forecast is not available yet for these dates. Forecast will become available closer to your trip dates."
                    }

                return {
                    "destination": resolved_name,
                    "timezone": timezone,
                    "forecast_available": True,
                    "days": days_forecast
                }
        except Exception as e:
            logger.error(f"Weather forecast query failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "error_code": "WEATHER_SERVICE_ERROR",
                    "message": "Destination found, but weather data is temporarily unavailable."
                }
            )
