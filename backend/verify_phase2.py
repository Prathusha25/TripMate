import sys
import time
import os
import subprocess

try:
    import requests
except ImportError:
    print("Installing 'requests' library for verification...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

BASE_URL = "http://127.0.0.1:8000"

def test_phase2():
    print("====================================================")
    print("STARTING TRIPMATE AI PHASE 2 E2E VERIFICATION")
    print("====================================================\n")

    # 1. Ping status
    print("[1/6] Checking API service liveness...")
    try:
        res = requests.get(f"{BASE_URL}/")
        res.raise_for_status()
        print(f"Service online: {res.json()}\n")
    except Exception as e:
        print(f"ERROR: Cannot connect to server at {BASE_URL}. Is it running?")
        sys.exit(1)

    # 2. Register a new user
    print("[2/6] Registering test user...")
    email = f"user_p2_{int(time.time())}@test.com"
    signup_payload = {
        "email": email,
        "name": "Phase 2 Tester",
        "password": "password123",
        "confirm_password": "password123"
    }
    res = requests.post(f"{BASE_URL}/auth/signup", json=signup_payload)
    if res.status_code != 201:
        print(f"Signup failed: {res.text}")
        sys.exit(1)
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("User registered and logged in successfully.\n")

    # 3. Create a Trip
    print("[3/6] Creating a travel trip...")
    trip_payload = {
        "destination": "London, UK",
        "start_date": "2026-08-15",
        "end_date": "2026-08-22",
        "approximate_budget": 2000.0,
        "travel_interests": ["History", "Culture", "Food"],
        "preferred_travel_style": ["Solo", "Cultural"],
        "number_of_travelers": 1,
        "description": "Planning to visit museums and historical sites."
    }
    res = requests.post(f"{BASE_URL}/trips", json=trip_payload, headers=headers)
    if res.status_code != 201:
        print(f"Trip creation failed: {res.text}")
        sys.exit(1)
    trip_id = res.json()["id"]
    print(f"Trip created: ID {trip_id} to {trip_payload['destination']}\n")

    # 4. Fetch Weather Data (Open-Meteo Integration)
    print("[4/6] Fetching weather forecast for London...")
    res = requests.get(f"{BASE_URL}/trips/{trip_id}/weather", headers=headers)
    if res.status_code != 200:
        print(f"Weather query failed: {res.text}")
        sys.exit(1)
    
    weather_data = res.json()
    print("Weather retrieved successfully!")
    print(f"Resolved Destination: {weather_data.get('destination_name')}")
    print(f"Message type: {weather_data.get('message')}")
    weather_days = weather_data.get("weather", [])
    if weather_days:
        first_day = weather_days[0]
        print(f"Day 1 weather forecast: {first_day['date']} - {first_day['condition']} (Max {first_day['temp_max']}°C, Min {first_day['temp_min']}°C)\n")
    else:
        print("Warning: No weather forecast list returned.\n")

    # 5. Generate AI Travel Plan (Local Ollama integration)
    print("[5/6] Testing AI Plan generation (Local Ollama)...")
    try:
        res = requests.post(f"{BASE_URL}/trips/{trip_id}/ai-plan", headers=headers)
        if res.status_code != 200:
            detail = res.json().get("detail", "")
            if "Ollama server is offline" in detail or "connection" in detail.lower():
                print(f"--> Local Ollama is offline or model is not pulled yet (Response detail: {detail})")
                print("Skipping remaining AI steps because Ollama is not active locally. This is expected if the model is offline.")
            else:
                print(f"Plan generation failed: {res.status_code} - {res.text}")
                sys.exit(1)
        else:
            plan = res.json()
            print("AI Travel Plan successfully generated and saved to MongoDB!")
            print(f"Places recommended: {len(plan.get('places', []))}")
            print(f"Itinerary days: {len(plan.get('itinerary', []))}")
            print(f"Checklist categories: {list(plan.get('packing_checklist', {}).keys())}\n")
            
            # Run the next tests if plan succeeded
            # 6. Mutate Packing Checklist
            print("[6/6] Testing Packing Checklist mutations...")
            # A. Add item
            add_payload = {
                "category": "clothing",
                "item": "Test Custom Jacket",
                "action": "add"
            }
            res = requests.put(f"{BASE_URL}/trips/{trip_id}/ai-plan/checklist", json=add_payload, headers=headers)
            assert res.status_code == 200
            plan = res.json()
            checklist_clothing = plan["packing_checklist"].get("clothing", [])
            added_found = any(it["item"] == "Test Custom Jacket" for it in checklist_clothing)
            print(f"Custom item added: {added_found}")

            # B. Toggle item
            toggle_payload = {
                "category": "clothing",
                "item": "Test Custom Jacket",
                "checked": True,
                "action": "toggle"
            }
            res = requests.put(f"{BASE_URL}/trips/{trip_id}/ai-plan/checklist", json=toggle_payload, headers=headers)
            assert res.status_code == 200
            plan = res.json()
            item_state = next((it for it in plan["packing_checklist"]["clothing"] if it["item"] == "Test Custom Jacket"), None)
            print(f"Custom item checked status: {item_state.get('checked') if item_state else 'Not found'}")

            # C. Remove item
            remove_payload = {
                "category": "clothing",
                "item": "Test Custom Jacket",
                "action": "remove"
            }
            res = requests.put(f"{BASE_URL}/trips/{trip_id}/ai-plan/checklist", json=remove_payload, headers=headers)
            assert res.status_code == 200
            plan = res.json()
            removed_found = any(it["item"] == "Test Custom Jacket" for it in plan["packing_checklist"].get("clothing", []))
            print(f"Custom item still exists after removal: {removed_found}\n")

            # 7. AI Chat assistant
            print("[Bonus] Testing AI chat assistant prompt...")
            chat_payload = {"content": "What should I wear on Day 1?"}
            res = requests.post(f"{BASE_URL}/trips/{trip_id}/ai-chat/messages", json=chat_payload, headers=headers)
            if res.status_code != 200:
                print(f"AI Chat failed: {res.text}")
                sys.exit(1)
            chat_reply = res.json()
            print(f"User: {chat_payload['content']}")
            print(f"AI: {chat_reply['content']}\n")
    except Exception as e:
        print(f"AI steps failed with exception: {e}")
        sys.exit(1)

    print("====================================================")
    print("PHASE 2 VERIFICATION SUCCESSFULLY COMPLETED!")
    print("====================================================")

if __name__ == "__main__":
    test_phase2()
