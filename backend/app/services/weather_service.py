from app.services.weather import WeatherService as CoreWeatherService
from datetime import date, timedelta
from typing import Dict, Any

class WeatherService(CoreWeatherService):
    async def get_forecast(self, destination: str) -> Dict[str, Any]:
        """Backward compatible forecast retriever using the new Open-Meteo core service."""
        today = date.today()
        return await self.get_destination_weather(
            destination=destination,
            start_date=today,
            end_date=today + timedelta(days=7)
        )
