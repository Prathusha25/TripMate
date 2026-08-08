from pydantic import BaseModel, Field
from typing import List, Optional

class WeatherDay(BaseModel):
    date: str = Field(..., description="Date (YYYY-MM-DD)")
    temp_c: float = Field(..., description="Temperature in Celsius")
    condition: str = Field(..., description="Weather condition description (e.g. Sunny, Rainy)")
    rain_prob: float = Field(0.0, description="Rain probability percentage (0-100)")
    icon: Optional[str] = Field(None, description="Weather icon identifier")

class WeatherResponse(BaseModel):
    destination: str
    is_available: bool
    forecast: List[WeatherDay]
    warnings: List[str] = []
    source: str = "Verified Weather Data"
