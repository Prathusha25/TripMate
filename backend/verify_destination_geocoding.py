import sys
import os
import requests
import datetime
import json

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("====================================================")
    print("TESTING DYNAMIC DESTINATION GEOCODING & AI PLANNER")
    print("====================================================\n")

    # 1. Register a test user
    email = f"geo_tester_{int(datetime.datetime.now().timestamp())}@test.com"
    signup_res = requests.post(f"{BASE_URL}/auth/signup", json={
        "email": email,
        "name": "Geocoding Tester",
        "password": "password123",
        "confirm_password": "password123"
    })
    assert signup_res.status_code == 201, f"Signup failed: {signup_res.text}"
    token = signup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[OK] User authenticated successfully.\n")

    # 2. Test destination search list
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

    print("--- 1. Testing Open-Meteo Geocoding Search Endpoint (`GET /locations/search`) ---")
    resolved_locations = {}

    for dest in test_destinations:
        res = requests.get(f"{BASE_URL}/locations/search", params={"q": dest, "limit": 5})
        assert res.status_code == 200, f"Search failed for '{dest}': {res.status_code} {res.text}"
        data = res.json()
        results = data.get("results", [])
        assert len(results) > 0, f"CRITICAL: 0 results returned for valid destination '{dest}'"
        top = results[0]
        
        # Verify structured attributes
        assert "name" in top and top["name"], f"Missing name for {dest}"
        assert "latitude" in top and isinstance(top["latitude"], (int, float)), f"Invalid latitude for {dest}"
        assert "longitude" in top and isinstance(top["longitude"], (int, float)), f"Invalid longitude for {dest}"
        assert "country" in top, f"Missing country for {dest}"
        assert "timezone" in top, f"Missing timezone for {dest}"

        resolved_locations[dest] = top
        print(f"[OK] '{dest}' -> Found {len(results)} matches | Top: {top['name']} ({top.get('region', '')}, {top.get('country', '')}) [{top['latitude']}, {top['longitude']}]")

    print("\n--- 2. Testing Location Resolve Endpoint (`POST /locations/resolve`) ---")
    resolve_res = requests.post(f"{BASE_URL}/locations/resolve", json={"query": "Manali"})
    assert resolve_res.status_code == 200, f"Resolve failed: {resolve_res.text}"
    resolved_obj = resolve_res.json().get("location")
    assert resolved_obj is not None
    print(f"[OK] Successfully resolved: {resolved_obj['name']}, {resolved_obj.get('country')}")

    # 3. Testing AI Recommendations with Dynamic Destinations
    print("\n--- 3. Testing AI Planner Recommendations (`POST /ai/planner/recommendations`) ---")
    sample_cities = ["Manali", "Bengaluru", "Munnar Kerala", "Paris, France", "Tokyo"]
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
        rec_res = requests.post(f"{BASE_URL}/ai/planner/recommendations", json=payload, headers=headers)
        assert rec_res.status_code == 200, f"Recommendations failed for '{city}': {rec_res.status_code} {rec_res.text}"
        rec_data = rec_res.json()
        categories = rec_data.get("categories", [])
        assert len(categories) > 0, f"No categories returned for {city}"
        print(f"[OK] Recommendations generated for '{city}' ({len(categories)} categories, {sum(len(c.get('places', [])) for c in categories)} spots)")

    # 4. Testing End-to-End Itinerary Generation with Real Weather & Coordinates
    print("\n--- 4. Testing End-to-End Itinerary Generation (`POST /ai/planner/generate`) ---")
    today = datetime.date.today()
    end_date = today + datetime.timedelta(days=3)
    start_str = today.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

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
    
    plan_res = requests.post(f"{BASE_URL}/ai/planner/generate", json=itinerary_payload, headers=headers)
    assert plan_res.status_code == 200, f"Plan generation failed: {plan_res.status_code} {plan_res.text}"
    plan_data = plan_res.json()
    itinerary = plan_data.get("itinerary", [])
    assert len(itinerary) > 0, "No itinerary days generated"
    print(f"[OK] Weather-aware itinerary generated for Manali: {len(itinerary)} days")
    print(f"     Day 1: Morning ({itinerary[0].get('morning', [{}])[0].get('place_name', 'N/A')}), Afternoon ({itinerary[0].get('afternoon', [{}])[0].get('place_name', 'N/A')})")
    
    print("\n====================================================")
    print("ALL TESTS PASSED! DESTINATION NOT FOUND ERROR ELIMINATED!")
    print("====================================================")

if __name__ == "__main__":
    run_tests()
