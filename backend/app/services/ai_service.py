import os
import json
import urllib.request
import urllib.parse
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.api_url = "https://api.openai.com/v1/chat/completions"

    def _has_key(self) -> bool:
        return bool(self.api_key)

    async def generate_plan(self, trip_details: Dict[str, Any], weather_data: Dict[str, Any]) -> Dict[str, Any]:
        """Call OpenAI to generate the complete personalized, weather-aware travel plan."""
        if not self._has_key():
            logger.error("OPENAI_API_KEY env variable is missing.")
            raise Exception("AI Planning service is currently unconfigured. Set the OPENAI_API_KEY in the backend .env.")

        system_prompt = (
            "You are TripMate AI, an expert travel concierge and planner.\n"
            "Generate a highly personalized travel plan in valid JSON format. "
            "You must strictly output ONLY a JSON object matching the requested schema. No conversational replies before or after the JSON."
        )

        user_content = f"""
Generate a travel plan for a trip with these specifications:
- Destination: {trip_details.get('destination')}
- Dates: {trip_details.get('start_date')} to {trip_details.get('end_date')}
- Budget: ${trip_details.get('approximate_budget')} USD
- Travelers: {trip_details.get('number_of_travelers')}
- Interests: {', '.join(trip_details.get('travel_interests', []))}
- Travel Style: {', '.join(trip_details.get('preferred_travel_style', []))}
- Description / Preferences: {trip_details.get('description', 'None')}

Verified Weather Information:
{json.dumps(weather_data.get('forecast', []), indent=2)}
Weather Warnings:
{', '.join(weather_data.get('warnings', []))}

Instructions:
1. Align recommendations and daily activities strictly to the user's interests:
   - If user interests contain 'Photography' and/or 'Nature': Prioritize scenic lookouts, sunrise/sunset viewing spots, nature trails, national parks, and photography-friendly spots.
   - If user interests contain 'Food' and/or 'Culture': Prioritize local street food hubs, traditional restaurants, culinary experiences, historical cultural sites, temples, local crafts, and heritage centers.
   - If user interests contain 'Nightlife' or 'Adventure': Prioritize active hiking peaks, zip lines, social clubs, bars, night markets, and late-night walking spots.
2. Schedule weather-aware activities. If rain probability is high (>60%) or temperature is extreme on a day, adjust activities (e.g., recommend indoor museums, shopping, or covered cafés instead of outdoor sight-seeing).
3. If weather data is empty/unavailable, plan standard outdoor/indoor activities.

Generate a JSON object matching this schema exactly:
{{
  "days": [
    {{
      "day_number": 1,
      "morning": {{
        "activity_name": "Name",
        "description": "Short description of what to do.",
        "why_matches": "Why it matches user's interests.",
        "suggested_duration": "2 hours",
        "time_of_day": "Morning",
        "activity_type": "Nature"
      }},
      "afternoon": {{ ... }},
      "evening": {{ ... }}
    }}
  ],
  "recommendations": [
    {{
      "place_name": "Place Name",
      "description": "Short description.",
      "why_matches": "Explain how it fits their interest tag.",
      "suggested_duration": "1-2 hours",
      "recommended_visiting_period": "Afternoon",
      "activity_type": "Culture"
    }}
  ],
  "outfit_recommendations": [
    {{
      "category": "Everyday",
      "items": ["Item 1", "Item 2"],
      "advice": "General tips."
    }}
  ],
  "packing_checklist": [
    {{
      "name": "Passport",
      "category": "Documents",
      "quantity": 1
    }}
  ]
}}
"""

        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.7,
            "response_format": {"type": "json_object"}
        }

        try:
            req = urllib.request.Request(
                self.api_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                choice = res_data["choices"][0]["message"]["content"]
                parsed_json = json.loads(choice)
                return parsed_json
        except Exception as e:
            logger.error(f"OpenAI Plan API call failed: {e}")
            raise Exception("Failed to contact OpenAI API to generate travel plan.")

    async def chat_assistant(self, trip_details: Dict[str, Any], current_plan: Dict[str, Any], weather_data: Dict[str, Any], user_message: str, chat_history: List[Dict[str, Any]]) -> str:
        """Chat with the AI travel assistant using the current trip context and plan."""
        if not self._has_key():
            logger.error("OPENAI_API_KEY env variable is missing.")
            raise Exception("AI Chat service is currently unconfigured. Set the OPENAI_API_KEY in the backend .env.")

        system_prompt = (
            "You are TripMate AI, an intelligent personal travel assistant.\n"
            "You help solo travelers plan, organize, and refine their travel itineraries.\n"
            "Answer questions using the user's trip details, current weather, and itinerary plan.\n"
            "Guidelines:\n"
            "- Always be helpful, warm, and encourage travel safety.\n"
            "- Keep answers relatively concise and highly specific to their trip.\n"
            "- If the user asks to replace an activity, suggest 1-2 realistic alternatives nearby.\n"
            "- Clearly distinguish verified weather details from AI recommendations.\n"
            "- Encourage them to verify safety requirements or local travel warnings with official sources."
        )

        context_prompt = f"""
Trip Context:
- Destination: {trip_details.get('destination')}
- Dates: {trip_details.get('start_date')} to {trip_details.get('end_date')}
- Budget: ${trip_details.get('approximate_budget')} USD
- Travelers: {trip_details.get('number_of_travelers')}
- Interests: {', '.join(trip_details.get('travel_interests', []))}
- Travel Style: {', '.join(trip_details.get('preferred_travel_style', []))}

Current Saved Itinerary:
{json.dumps(current_plan.get('days', []), indent=2)}

Current Packing List:
{json.dumps([item.get('name') for item in current_plan.get('packing_checklist', [])], indent=2)}

Current Weather Forecast:
{json.dumps(weather_data.get('forecast', []), indent=2)}
Warnings: {', '.join(weather_data.get('warnings', []))}
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "system", "content": context_prompt}
        ]

        # Append Chat History (keep last 6 turns for token performance)
        for msg in chat_history[-6:]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": "gpt-4o-mini",
            "messages": messages,
            "temperature": 0.7
        }

        try:
            req = urllib.request.Request(
                self.api_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                reply = res_data["choices"][0]["message"]["content"]
                return reply
        except Exception as e:
            logger.error(f"OpenAI Chat API call failed: {e}")
            raise Exception("Failed to contact OpenAI API for travel chat assistance.")
