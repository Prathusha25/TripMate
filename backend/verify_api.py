import sys
import time
import subprocess

# Self-bootstrap requests library if not present
try:
    import requests
except ImportError:
    print("Installing 'requests' library for verification...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    print("====================================================")
    print("STARTING TRIPMATE AI PHASE 1 API E2E VERIFICATION")
    print("====================================================\n")

    # 1. Ping test
    print("[1/10] Checking backend service status...")
    try:
        res = requests.get(f"{BASE_URL}/")
        res.raise_for_status()
        print(f"Service online: {res.json()}\n")
    except Exception as e:
        print(f"ERROR: Cannot connect to backend server at {BASE_URL}. Is it running?")
        print(f"Details: {e}")
        sys.exit(1)

    # 2. Register User A
    print("[2/10] Creating User A (Sender)...")
    email_a = f"usera_{int(time.time())}@test.com"
    signup_data_a = {
        "email": email_a,
        "name": "User A",
        "password": "password123",
        "confirm_password": "password123"
    }
    res = requests.post(f"{BASE_URL}/auth/signup", json=signup_data_a)
    if res.status_code != 201:
        print(f"Failed to sign up User A: {res.text}")
        sys.exit(1)
    token_a = res.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print("User A successfully registered!\n")

    # 3. Register User B
    print("[3/10] Creating User B (Receiver)...")
    email_b = f"userb_{int(time.time())}@test.com"
    signup_data_b = {
        "email": email_b,
        "name": "User B",
        "password": "password123",
        "confirm_password": "password123"
    }
    res = requests.post(f"{BASE_URL}/auth/signup", json=signup_data_b)
    if res.status_code != 201:
        print(f"Failed to sign up User B: {res.text}")
        sys.exit(1)
    token_b = res.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # Save User B profile info
    res = requests.get(f"{BASE_URL}/auth/me", headers=headers_b)
    user_b_id = res.json()["id"]
    print(f"User B successfully registered (ID: {user_b_id})!\n")

    # 4. Edit User B Profile details
    print("[4/10] Updating User B profile settings...")
    profile_update = {
        "bio": "Adventure traveler loving nature and backpacking.",
        "home_city": "Los Angeles",
        "interests": ["Nature", "Adventure"],
        "travel_style": ["Backpacker", "Solo"],
        "budget_preference": "Budget"
    }
    res = requests.put(f"{BASE_URL}/users/me", json=profile_update, headers=headers_b)
    assert res.status_code == 200
    print("User B profile details updated!\n")

    # 5. User B Creates a Trip
    print("[5/10] Creating a scheduled trip for User B...")
    trip_data = {
        "destination": "Tokyo, Japan",
        "start_date": "2026-09-10",
        "end_date": "2026-09-20",
        "approximate_budget": 1200.0,
        "travel_interests": ["Nature", "Food"],
        "preferred_travel_style": ["Backpacker"],
        "number_of_travelers": 2,
        "description": "Looking for a buddy to explore temples and grab sushi."
    }
    res = requests.post(f"{BASE_URL}/trips", json=trip_data, headers=headers_b)
    if res.status_code != 201:
        print(f"Failed to create trip: {res.text}")
        sys.exit(1)
    trip_id = res.json()["id"]
    print(f"Trip successfully created! (ID: {trip_id})\n")

    # 6. User A Searches Travel Buddies (Discovery)
    print("[6/10] Running buddy discovery search for User A...")
    res = requests.get(f"{BASE_URL}/travel-buddies", headers=headers_a)
    assert res.status_code == 200
    buddies = res.json()
    print(f"Found {len(buddies)} available travel cards in discovery.")
    
    # Locate User B's trip card
    card_found = None
    for b in buddies:
        if b.get("trip_id") == trip_id or b["id"] == user_b_id or b["user"]["id"] == user_b_id:
            card_found = b
            break
            
    if not card_found:
        print(f"ERROR: Could not locate User B's trip in discovery grid.")
        sys.exit(1)
    print(f"Located User B's trip: {card_found['destination']} with placeholder '{card_found['compatibility']}'\n")

    # 7. User A sends Buddy Request to User B
    print("[7/10] Sending travel buddy request from User A to User B...")
    req_payload = {
        "trip_id": trip_id,
        "receiver_id": user_b_id
    }
    res = requests.post(f"{BASE_URL}/requests", json=req_payload, headers=headers_a)
    if res.status_code != 201:
        print(f"Failed to send travel request: {res.text}")
        sys.exit(1)
    request_id = res.json()["id"]
    print(f"Request successfully sent! (ID: {request_id})\n")

    # 8. User B views incoming requests and Accepts
    print("[8/10] Checking User B's incoming requests and accepting...")
    res = requests.get(f"{BASE_URL}/requests/incoming", headers=headers_b)
    incoming_reqs = res.json()
    assert len(incoming_reqs) > 0
    assert incoming_reqs[0]["id"] == request_id
    
    # Accept the request
    res = requests.put(f"{BASE_URL}/requests/{request_id}/accept", headers=headers_b)
    if res.status_code != 200:
        print(f"Failed to accept request: {res.text}")
        sys.exit(1)
    print("Request accepted and connection created!\n")

    # 9. Verify Connection exists for both users
    print("[9/10] Validating connection records...")
    res = requests.get(f"{BASE_URL}/connections", headers=headers_a)
    assert res.status_code == 200
    connections_a = res.json()
    assert len(connections_a) > 0
    connection_id = connections_a[0]["id"]
    print(f"Mutual connection verified: Connection ID {connection_id} (Buddy: {connections_a[0]['buddy']['name']})\n")

    # 10. Send and receive messages
    print("[10/10] Testing secure connection chat exchange...")
    msg_payload = {"content": "Hey User B, I saw your trip to Tokyo! Let's explore together."}
    res = requests.post(f"{BASE_URL}/connections/{connection_id}/messages", json=msg_payload, headers=headers_a)
    if res.status_code != 201:
        print(f"Failed to send chat message: {res.text}")
        sys.exit(1)
    print("User A sent chat message.")
    
    res = requests.get(f"{BASE_URL}/connections/{connection_id}/messages", headers=headers_b)
    assert res.status_code == 200
    messages = res.json()
    assert len(messages) > 0
    assert messages[0]["content"] == msg_payload["content"]
    print(f"User B read message content: '{messages[0]['content']}'\n")

    print("====================================================")
    print("VERIFICATION COMPLETED SUCCESSFULLY!")
    print("ALL API ENDPOINTS INTEGRATED AND LOGIC TESTED.")
    print("====================================================")

if __name__ == "__main__":
    test_api()
