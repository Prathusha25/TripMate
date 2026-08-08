import asyncio
import datetime
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.routes.auth import get_current_user
from app.services.geocoding_service import GeocodingService

# Mock current user for testing authenticated endpoints
async def mock_get_current_user():
    return {
        "id": "test_user_123",
        "email": "test@tripmate.com",
        "name": "Test Traveler",
        "role": "user"
    }

app.dependency_overrides[get_current_user] = mock_get_current_user

async def test_full_flow():
    print("====================================================")
    print("IN-PROCESS VERIFICATION OF GEOCODING & AI PLANNER")
    print("====================================================\n")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Comprehensive list of all required destinations
        test_destinations = [
            "Manali",
            "manali",
            "MANALI",
            "Manali, India",
            "Hyderabad",
            "Bangalore",
            "Bengaluru",
            "Mumbai",
            "Goa",
            "Delhi",
            "New Delhi",
            "Munnar",
            "Munnar Kerala",
            "Ooty",
            "Araku Valley",
            "Visakhapatnam",
            "Vizag",
            "Tirupati",
            "Kashmir",
            "Srinagar",
            "Darjeeling",
            "Jaipur",
            "Paris",
            "Paris, France",
            "London",
            "London UK",
            "Tokyo",
            "New York"
        ]

        print("--- 1. Testing Open-Meteo Geocoding Search (`GET /locations/search`) ---")
        resolved_locations = {}

        for dest in test_destinations:
            res = await client.get("/locations/search", params={"q": dest, "limit": 5})
            assert res.status_code == 200, f"Search failed for '{dest}': {res.status_code} {res.text}"
            data = res.json()
            results = data.get("results", [])
            assert len(results) > 0, f"CRITICAL: 0 results returned for valid destination '{dest}'"
            top = results[0]

            assert "name" in top and top["name"]
            assert "latitude" in top and isinstance(top["latitude"], (int, float))
            assert "longitude" in top and isinstance(top["longitude"], (int, float))
            assert "country" in top
            assert "timezone" in top

            resolved_locations[dest] = top
            print(f"[OK] '{dest}' -> Found {len(results)} matches | Top: {top['name']} ({top.get('region', '')}, {top.get('country', '')}) [{top['latitude']}, {top['longitude']}]")

        print("\n--- 2. Testing Location Resolve Endpoint (`POST /locations/resolve`) ---")
        resolve_res = await client.post("/locations/resolve", json={"query": "Manali"})
        assert resolve_res.status_code == 200, f"Resolve failed: {resolve_res.text}"
        resolved_obj = resolve_res.json().get("location")
        assert resolved_obj is not None
        print(f"[OK] Successfully resolved: {resolved_obj['name']}, {resolved_obj.get('country')}")

        # 3. Testing AI Recommendations with Dynamic Destinations
        print("\n--- 3. Testing AI Planner Recommendations (`POST /ai/planner/recommendations`) ---")
        sample_cities = ["Manali", "Bengaluru", "Munnar Kerala", "Paris, France", "Tokyo", "Araku Valley"]
        for city in sample_cities:
            loc_obj = resolved_locations[city]
            payload = {
                "destination": city,
                "location": loc_obj,
                "interests": ["Nature", "Photography", "Food"],
                "travel_style": "Balanced",
                "budget": "Moderate",
                "number_of_travelers": 2,
                "activities": ["Sightseeing", "Dining"]
            }
            rec_res = await client.post("/ai/planner/recommendations", json=payload)
            assert rec_res.status_code == 200, f"Recommendations failed for '{city}': {rec_res.status_code} {rec_res.text}"
            rec_data = rec_res.json()
            categories = rec_data.get("categories", [])
            assert len(categories) > 0, f"No categories returned for {city}"
            total_spots = sum(len(c.get('places', [])) for c in categories)
            print(f"[OK] Recommendations generated for '{city}' ({len(categories)} categories, {total_spots} spots)")

        # 4. Testing Weather Forecast Endpoint with Geocoded Locations
        print("\n--- 4. Testing Weather Forecast (`GET /weather/forecast`) ---")
        today = datetime.date.today()
        end_date = today + datetime.timedelta(days=3)
        start_str = today.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")

        for city in ["Manali, India", "Paris, France", "Tokyo"]:
            w_res = await client.get("/weather/forecast", params={"destination": city, "start_date": start_str, "end_date": end_str})
            assert w_res.status_code == 200, f"Weather failed for '{city}': {w_res.status_code} {w_res.text}"
            w_data = w_res.json()
            assert w_data.get("forecast_available") == True, f"Forecast unavailable for {city}"
            days = w_data.get("days", [])
            print(f"[OK] Weather retrieved for '{city}': {len(days)} days forecast ({w_data.get('destination')})")

        # 5. Testing End-to-End Itinerary Generation with Real Weather & Coordinates
        print("\n--- 5. Testing End-to-End Itinerary Generation (`POST /ai/planner/generate`) ---")
        manali_loc = resolved_locations["Manali"]
        itinerary_payload = {
            "destination": "Manali",
            "location": manali_loc,
            "start_date": start_str,
            "end_date": end_str,
            "budget": "Balanced",
            "interests": ["Nature", "Photography"],
            "travel_style": "Balanced",
            "number_of_travelers": 2,
            "selected_places": ["Solang Valley", "Hadimba Temple", "Old Manali Cafes"],
            "activities": ["Sightseeing", "Walking"]
        }
        
        plan_res = await client.post("/ai/planner/generate", json=itinerary_payload)
        assert plan_res.status_code == 200, f"Plan generation failed: {plan_res.status_code} {plan_res.text}"
        plan_data = plan_res.json()
        itinerary = plan_data.get("itinerary", [])
        assert len(itinerary) > 0, "No itinerary days generated"
        print(f"[OK] Weather-aware itinerary generated for Manali: {len(itinerary)} days")
        print(f"     Day 1: Morning ({itinerary[0].get('morning', [{}])[0].get('place_name', 'N/A')}), Afternoon ({itinerary[0].get('afternoon', [{}])[0].get('place_name', 'N/A')})")

    print("\n====================================================")
    print("ALL TESTS PASSED! DESTINATION NOT FOUND ERROR FULLY RESOLVED!")
    print("====================================================")

if __name__ == "__main__":
    asyncio.run(test_full_flow())
