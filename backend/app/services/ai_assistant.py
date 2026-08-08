import os
import json
import logging
import httpx
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Any
from dotenv import load_dotenv

# Try importing LangChain & Ollama components with fallbacks
try:
    from langchain_ollama import ChatOllama
except ImportError:
    try:
        from langchain_community.chat_models import ChatOllama
    except ImportError:
        ChatOllama = None

try:
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
except ImportError:
    ChatPromptTemplate = None
    JsonOutputParser = None
    StrOutputParser = None

from app.services.rag_service import RAGService

load_dotenv()
logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

# Curated local knowledge base for popular travel hubs
DESTINATION_CATALOG = {
    "vizag": [
        {"name": "RK Beach & Submarine Museum", "description": "Iconic beach boulevard featuring the decommissioned INS Kursura submarine museum and seaside cafes.", "category": "Famous attractions", "activity_type": "Outdoor", "why_matches": "Scenic coastal views, unique naval heritage, and relaxed sunset strolls."},
        {"name": "Kailasagiri Hilltop Park", "description": "Picturesque hilltop park with sweeping 360-degree views of the Bay of Bengal, ropeway cable car, and tranquil gardens.", "category": "Nature & Adventure", "activity_type": "Outdoor", "why_matches": "Breathtaking photography vantage point and gentle trekking trails."},
        {"name": "Rushikonda Beach", "description": "Golden sand beach known for water sports like kayaking, surfing, speed boating, and pristine beachside dining.", "category": "Nature & Adventure", "activity_type": "Outdoor", "why_matches": "Exciting water activities, swimming, and beach photography."},
        {"name": "Yarada Beach & Dolphin's Nose Lighthouse", "description": "Secluded, palm-fringed beach nestled beneath lush hills and the historic rocky promontory lighthouse.", "category": "Photography & Scenery", "activity_type": "Outdoor", "why_matches": "Pristine nature, tranquil atmosphere, and golden hour coastal photography."},
        {"name": "Simhachalam Temple", "description": "11th-century hill shrine dedicated to Lord Narasimha, renowned for intricate Kalinga-style stone architecture.", "category": "Culture & Heritage", "activity_type": "Indoor", "why_matches": "Rich heritage, spiritual ambiance, and historical architecture."},
        {"name": "Borra Caves & Araku Valley Viewpoints", "description": "Ancient million-year-old limestone karst caves with natural stalactite and stalagmite formations amidst the Eastern Ghats.", "category": "Famous attractions", "activity_type": "Outdoor", "why_matches": "Adventure discovery, unique geological structures, and mountain nature."},
        {"name": "Jagadamba Junction Food Walk", "description": "Lively downtown street market hub celebrated for authentic Andhra coastal street cuisine, sweets, and seafood stalls.", "category": "Food & Cafes", "activity_type": "Outdoor", "why_matches": "Authentic regional spicy cuisine and vibrant evening foodie culture."},
        {"name": "Tenneti Beach Park", "description": "Cliffside park overlooking a scenic natural sea cove, famous for romantic sunset views and coastal photo shoots.", "category": "Relaxation", "activity_type": "Outdoor", "why_matches": "Peaceful sea breeze, scenic benches, and relaxed evening strolls."}
    ],
    "manali": [
        {"name": "Solang Valley", "description": "High-altitude adventure haven famous for paragliding, zorbing, and panoramic Himalayan vistas.", "category": "Nature & Adventure", "activity_type": "Outdoor", "why_matches": "Adventure thrills and alpine photography."},
        {"name": "Hadimba Temple", "description": "Historic wooden pagoda temple set inside ancient cedar and deodar forests.", "category": "Culture & Heritage", "activity_type": "Outdoor", "why_matches": "Serene spiritual atmosphere and wooden craftsmanship."},
        {"name": "Jogini Waterfall Trek", "description": "Scenic hiking trail traversing apple orchards and mountain streams leading to a cascading waterfall.", "category": "Nature & Adventure", "activity_type": "Outdoor", "why_matches": "Nature hiking and mountain stream photography."},
        {"name": "Old Manali Cafes", "description": "Vibrant artistic cafes offering local trout, Israeli pastries, live acoustic music, and mountain views.", "category": "Food & Cafes", "activity_type": "Indoor", "why_matches": "Social vibe, cozy ambiance, and artisanal culinary experiences."},
        {"name": "Mall Road & Tibetan Monasteries", "description": "Bustling town center with handicraft stalls, Tibetan carpets, shawls, and steamed momos.", "category": "Famous attractions", "activity_type": "Outdoor", "why_matches": "Shopping, cultural souvenirs, and casual town exploration."}
    ],
    "goa": [
        {"name": "Baga & Calangute Beach", "description": "Energetic coastal stretch with water sports, beach shacks, seafood grills, and sunset music.", "category": "Famous attractions", "activity_type": "Outdoor", "why_matches": "Water activities, lively social crowd, and beachside relaxation."},
        {"name": "Basilica of Bom Jesus", "description": "UNESCO World Heritage Baroque landmark with 16th-century Portuguese architecture.", "category": "Culture & Heritage", "activity_type": "Indoor", "why_matches": "Historic architecture and cultural significance."},
        {"name": "Dudhsagar Waterfalls", "description": "Magnificent multi-tiered milky waterfall accessible via a thrilling jungle jeep safari.", "category": "Nature & Adventure", "activity_type": "Outdoor", "why_matches": "Lush jungle scenery and spectacular waterfall photography."},
        {"name": "Fontainhas Latin Quarter", "description": "Charming heritage quarter with pastel-painted Portuguese villas, art galleries, and bakeries.", "category": "Photography & Scenery", "activity_type": "Outdoor", "why_matches": "Heritage architecture, street photography, and artisanal coffee."}
    ]
}

class AIAssistantService:
    @classmethod
    def get_llm(cls, format_json: bool = False):
        """Get the LangChain ChatOllama instance if available."""
        if ChatOllama is None:
            return None
        try:
            kwargs = {
                "base_url": OLLAMA_BASE_URL,
                "model": OLLAMA_MODEL,
                "temperature": 0.7
            }
            if format_json:
                kwargs["format"] = "json"
            return ChatOllama(**kwargs)
        except Exception as e:
            logger.warning(f"Failed to initialize ChatOllama: {e}")
            return None

    @classmethod
    async def _call_ollama(cls, system_prompt: str, user_content: str, format_json: bool = False) -> str:
        """Helper to invoke local Ollama model using LangChain, falling back to direct HTTP on failure."""
        llm = cls.get_llm(format_json)
        
        # Method 1: Use LangChain Expression Language (LCEL)
        if llm and ChatPromptTemplate and (not format_json or JsonOutputParser):
            try:
                escaped_system = system_prompt.replace("{", "{{").replace("}", "}}")
                prompt = ChatPromptTemplate.from_messages([
                    ("system", escaped_system),
                    ("user", "{user_content}")
                ])
                if format_json:
                    chain = prompt | llm | JsonOutputParser()
                    result = await chain.ainvoke({"user_content": user_content})
                    return json.dumps(result)
                else:
                    chain = prompt | llm | StrOutputParser()
                    return await chain.ainvoke({"user_content": user_content})
            except Exception as e:
                logger.warning(f"LangChain invocation failed, falling back to direct HTTP: {e}")
        
        # Method 2: Fallback to direct HTTP request to Ollama server
        url = f"{OLLAMA_BASE_URL}/api/chat"
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        payload = {
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.7}
        }
        if format_json:
            payload["format"] = "json"
            
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                res.raise_for_status()
                data = res.json()
                return data["message"]["content"]
        except httpx.ConnectError:
            raise ValueError(
                f"Local Ollama server is offline. Please make sure Ollama is running at {OLLAMA_BASE_URL} "
                f"and model '{OLLAMA_MODEL}' is pulled."
            )
        except Exception as e:
            logger.error(f"Direct Ollama call failed: {e}")
            raise e

    @classmethod
    def _get_catalog_places(cls, destination: str) -> List[Dict[str, Any]]:
        """Retrieve curated places matching destination query."""
        dest_clean = destination.split(",")[0].strip().lower()
        for key, places in DESTINATION_CATALOG.items():
            if key in dest_clean or dest_clean in key:
                return places
        
        # Generic high-value places for any unspecified destination
        return [
            {"name": f"{destination.title()} Central Square & Old Town", "description": "Historic center featuring pedestrian avenues, local architecture, and vibrant town life.", "category": "Famous attractions", "activity_type": "Outdoor", "why_matches": "Central landmark exploration and street photography."},
            {"name": f"{destination.title()} Scenic Viewpoint Park", "description": "Elevated scenic park offering panoramic sunset views across the city skyline and landscape.", "category": "Photography & Scenery", "activity_type": "Outdoor", "why_matches": "Nature photography and relaxing evening strolls."},
            {"name": f"{destination.title()} Heritage & Arts Museum", "description": "Prominent cultural institution showcasing historical artifacts, regional heritage, and classical art.", "category": "Culture & Heritage", "activity_type": "Indoor", "why_matches": "Insight into local history and culture."},
            {"name": f"{destination.title()} Waterfront Promenade", "description": "Sprawling boardwalk or riverwalk lined with charming cafes, street performers, and artisan shops.", "category": "Relaxation", "activity_type": "Outdoor", "why_matches": "Breezy walks, people-watching, and dining."},
            {"name": f"{destination.title()} Local Food Market", "description": "Authentic bustling food bazaar filled with fresh produce, regional delicacies, and street food stalls.", "category": "Food & Cafes", "activity_type": "Outdoor", "why_matches": "Sampling authentic regional culinary specialties."}
        ]

    @classmethod
    async def recommend_places(
        cls,
        destination: str,
        interests: List[str],
        travel_style: str,
        budget: str,
        number_of_travelers: int
    ) -> Dict:
        """Recommend interesting places using local ChromaDB places, Ollama, and smart RAG fallback."""
        interests_str = ", ".join(interests)

        # 1. Local RAG lookup
        rag_places = RAGService.search_places(destination=destination, query=interests_str, limit=8)
        rag_places_str = ""
        for p in rag_places:
            rag_places_str += f"- {p['name']}: {p['description']} (Type: {p.get('activity_type', 'Outdoor')}, Fits: {p['why_matches']})\n"

        system_prompt = (
            "You are a professional travel planner and local AI assistant.\n"
            "Recommend interesting places to visit at the destination based on user preferences and local vector search.\n"
            "Retrieved place context from ChromaDB:\n"
            f"{rag_places_str or 'No records found.'}\n\n"
            "Generate a JSON object matching this schema exactly:\n"
            "{\n"
            "  \"categories\": [\n"
            "    {\n"
            "      \"category_name\": \"Category Name (e.g. Famous attractions, Nature, Photography, Culture, Food, Relaxation)\",\n"
            "      \"places\": [\n"
            "        {\n"
            "          \"name\": \"Place Name\",\n"
            "          \"description\": \"Brief description\",\n"
            "          \"why_matches\": \"Why it matches user preferences\"\n"
            "        }\n"
            "      ]\n"
            "    }\n"
            "  ]\n"
            "}"
        )

        user_content = f"Find top places in {destination} catering to {interests_str} ({travel_style} style, {budget} budget)."
        try:
            raw_res = await cls._call_ollama(system_prompt, user_content, format_json=True)
            return json.loads(raw_res)
        except Exception as e:
            logger.info(f"Ollama offline/unavailable ({e}); utilizing local RAG & knowledge base fallback.")
            
            # Local RAG & Catalog fallback
            places = cls._get_catalog_places(destination)
            categorized = {}
            for p in places:
                cat = p.get("category", "Famous attractions")
                if cat not in categorized:
                    categorized[cat] = []
                categorized[cat].append({
                    "name": p["name"],
                    "description": p["description"],
                    "why_matches": p["why_matches"]
                })
            
            categories_list = [{"category_name": k, "places": v} for k, v in categorized.items()]
            return {"categories": categories_list}

    @classmethod
    async def generate_itinerary_plan(
        cls,
        destination: str,
        start_date: str,
        end_date: str,
        budget: str,
        interests: List[str],
        travel_style: str,
        number_of_travelers: int,
        selected_places: List[str],
        weather_details: Dict
    ) -> Dict:
        """Create a weather-aware itinerary based on selected places and forecast context using local Ollama or smart RAG planner."""
        places_str = ", ".join(selected_places)
        weather_days = weather_details.get("days", [])
        weather_summary = ""
        if weather_days:
            for day in weather_days:
                prob = f", Rain probability: {day.get('rain_probability', 0)}%"
                weather_summary += f"- {day['date']}: {day['weather_condition']} (Max: {day['temperature_max']}°C{prob})\n"

        system_prompt = (
            "You are a professional travel planner and local AI assistant.\n"
            "Create a realistic, weather-aware travel plan and day-by-day itinerary based on details, weather, and SELECTED places.\n"
            "Under no circumstances should you invent specific hotel or restaurant names. Mark accommodations/restaurants as 'AI-suggested area/type'.\n"
            "Generate a JSON object matching this schema exactly:\n"
            "{\n"
            "  \"itinerary\": [\n"
            "    {\n"
            "      \"day\": 1,\n"
            "      \"date\": \"YYYY-MM-DD\",\n"
            "      \"morning\": [\n"
            "        {\n"
            "          \"place_name\": \"Name\",\n"
            "          \"activity\": \"Specific activity description\",\n"
            "          \"duration\": \"e.g. 2 hours\"\n"
            "        }\n"
            "      ],\n"
            "      \"afternoon\": [ ... ],\n"
            "      \"evening\": [ ... ]\n"
            "    }\n"
            "  ],\n"
            "  \"hotels\": [\n"
            "    {\n"
            "      \"area\": \"Suggested area/neighborhood\",\n"
            "      \"type\": \"Boutique Hostel | Guesthouse | Resort\",\n"
            "      \"description\": \"AI advice on lodging in this area (do NOT invent hotel names)\"\n"
            "    }\n"
            "  ],\n"
            "  \"restaurants\": [\n"
            "    {\n"
            "      \"area\": \"Suggested area/street\",\n"
            "      \"type\": \"Local Cafe | Food Stall | Traditional Diner\",\n"
            "      \"description\": \"AI advice on food experience here (do NOT invent restaurant names)\"\n"
            "    }\n"
            "  ],\n"
            "  \"outfit_recommendations\": [\n"
            "    \"Specific outfit suggestion based on weather forecast and activities\"\n"
            "  ],\n"
            "  \"packing_checklist\": {\n"
            "    \"clothing\": [\"item1\", \"item2\"],\n"
            "    \"weather\": [\"item1\", ...],\n"
            "    \"personal_care\": [ ... ],\n"
            "    \"electronics\": [ ... ],\n"
            "    \"documents\": [ ... ],\n"
            "    \"activity_specific\": [ ... ],\n"
            "    \"emergency_essentials\": [ ... ]\n"
            "  }\n"
            "}"
        )

        user_content = f"Generate weather-aware itinerary for {destination} from {start_date} to {end_date} incorporating selected places: {places_str}."
        try:
            raw_res = await cls._call_ollama(system_prompt, user_content, format_json=True)
            return json.loads(raw_res)
        except Exception as e:
            logger.info(f"Ollama offline/unavailable ({e}); constructing rule-based weather-aware itinerary.")
            
            # Construct weather-aware schedule
            start_d = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_d = datetime.strptime(end_date, "%Y-%m-%d").date()
            num_days = max(1, (end_d - start_d).days + 1)
            
            available_places = list(selected_places)
            if not available_places:
                catalog = cls._get_catalog_places(destination)
                available_places = [p["name"] for p in catalog]

            itinerary = []
            place_idx = 0

            for d in range(num_days):
                curr_date = start_d + timedelta(days=d)
                curr_date_str = curr_date.strftime("%Y-%m-%d")
                
                # Check real weather for current day
                w_day = next((w for w in weather_days if w["date"] == curr_date_str), None)
                rain_prob = w_day.get("rain_probability", 0) if w_day else 0
                condition = w_day.get("weather_condition", "Fair") if w_day else "Pleasant"
                max_t = w_day.get("temperature_max", 24) if w_day else 24

                # Assign places to Morning, Afternoon, Evening
                p_morning = available_places[place_idx % len(available_places)]
                place_idx += 1
                p_afternoon = available_places[place_idx % len(available_places)]
                place_idx += 1
                p_evening = available_places[place_idx % len(available_places)]
                place_idx += 1

                # If afternoon rain is high, optimize indoor/covered activities
                afternoon_desc = "Explore indoor exhibitions and local heritage sites" if rain_prob > 40 else "Outdoor sightseeing, cultural highlights, and scenic photography"

                itinerary.append({
                    "day": d + 1,
                    "date": curr_date_str,
                    "morning": [
                        {
                            "place_name": p_morning,
                            "activity": f"Morning walk and photography ({condition}, {max_t}°C)",
                            "duration": "2.5 hours"
                        }
                    ],
                    "afternoon": [
                        {
                            "place_name": p_afternoon,
                            "activity": afternoon_desc,
                            "duration": "2.5 hours"
                        }
                    ],
                    "evening": [
                        {
                            "place_name": p_evening,
                            "activity": "Sunset stroll, vibrant street food exploration, and relaxing atmosphere",
                            "duration": "2 hours"
                        }
                    ]
                })

            return {
                "itinerary": itinerary,
                "hotels": [
                    {
                        "area": f"Central {destination.split(',')[0]} / Waterfront District",
                        "type": "Boutique Hotel | Guesthouse",
                        "description": f"Recommended area for convenient access to top transit hubs, dining, and scenic views in {destination}."
                    }
                ],
                "restaurants": [
                    {
                        "area": f"{destination.split(',')[0]} Main Promenade & Night Market",
                        "type": "Traditional Eatery | Coastal Seafood Diner",
                        "description": "Ideal location to taste authentic regional specialties, seafood, and fresh local snacks."
                    }
                ],
                "outfit_recommendations": [
                    f"Day 1: Breathable cotton clothing, comfortable walking sneakers, and sunglasses.",
                    f"Day 2: Light waterproof layer or compact umbrella (Rain prob: {rain_prob}%), comfortable hiking footwear.",
                    f"Day 3: Casual evening layers, light sweater, and relaxed resort wear."
                ],
                "packing_checklist": {
                    "clothing": ["Light cotton t-shirts", "Comfortable walking shoes", "Casual evening trousers", "Light jacket / sweater"],
                    "weather": ["Compact umbrella", "UV-protective sunglasses", "Sunscreen SPF 50+", "Quick-dry towel"],
                    "personal_care": ["Hydrating lip balm", "Personal toiletries", "Hand sanitizer", "Mosquito repellent"],
                    "electronics": ["Smartphone camera & charger", "Power bank (10000mAh+)", "Universal adapter"],
                    "documents": ["Government photo ID", "Hotel reservations", "Digital copies of travel insurance"],
                    "activity_specific": ["Daypack / backpack", "Refillable water bottle", "Trekking socks"],
                    "emergency_essentials": ["Basic first-aid kit", "Prescribed medications", "Emergency cash"]
                }
            }

    @classmethod
    async def generate_chat_response(
        cls,
        trip_details: Dict,
        weather_details: Dict,
        ai_plan: Optional[Dict],
        message_history: List[Dict],
        new_message: str
    ) -> str:
        """Generates a contextual chat response using local RAG search & Ollama or smart assistant fallback."""
        destination = trip_details.get("destination", "your destination")
        system_prompt = (
            f"You are the TripMate AI Travel Assistant running locally.\n"
            f"You are helping a traveler coordinate a trip to {destination}.\n"
            "Respond in a helpful, concise, and friendly manner."
        )
        user_content = f"User question: '{new_message}'"
        try:
            return await cls._call_ollama(system_prompt, user_content, format_json=False)
        except Exception:
            # Smart assistant fallback response
            msg_lower = new_message.lower()
            if "pack" in msg_lower or "what to bring" in msg_lower:
                return f"For your trip to {destination}, I recommend packing lightweight breathable clothing, comfortable walking shoes, a power bank, a compact umbrella, and any personal medications. Check out the Packing Checklist tab for the complete list!"
            elif "wear" in msg_lower or "outfit" in msg_lower:
                return f"Based on the local weather forecast in {destination}, layer with breathable cottons for daytime exploration and keep a light jacket or windbreaker handy for cooler evenings."
            elif "day" in msg_lower:
                return f"For each day in {destination}, start early to enjoy cooler morning temperatures and softer lighting for photography, visit indoor or cultural spots during midday, and head out to scenic waterfronts or night markets in the evening."
            else:
                return f"I am here to help you plan the best trip to {destination}! You can explore recommended places, customize your itinerary, check daily weather-aware outfits, and save your plan drafts anytime."

    @classmethod
    async def generate_travel_plan(cls, trip_details: Dict, weather_details: Dict) -> Dict:
        """Generates a complete personalized, weather-aware travel plan."""
        return await cls.generate_itinerary_plan(
            destination=trip_details.get("destination", "Destination"),
            start_date=str(trip_details.get("start_date", date.today())),
            end_date=str(trip_details.get("end_date", date.today() + timedelta(days=3))),
            budget=str(trip_details.get("approximate_budget", "Moderate")),
            interests=trip_details.get("travel_interests", ["Nature", "Photography"]),
            travel_style=trip_details.get("preferred_travel_style", "Balanced"),
            number_of_travelers=trip_details.get("number_of_travelers", 1),
            selected_places=[],
            weather_details=weather_details
        )
