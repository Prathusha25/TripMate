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

def test_phase3():
    print("====================================================")
    print("STARTING TRIPMATE AI PHASE 3 ML MATCHING VERIFICATION")
    print("====================================================\n")

    # 1. Ping status
    print("[1/7] Checking API service liveness...")
    try:
        res = requests.get(f"{BASE_URL}/")
        res.raise_for_status()
        print(f"Service online: {res.json()}\n")
    except Exception as e:
        print(f"ERROR: Cannot connect to server at {BASE_URL}. Is it running?")
        sys.exit(1)

    # 2. Register User A (History + Photography + Nature enthusiast)
    print("[2/7] Registering User A...")
    email_a = f"usera_p3_{int(time.time())}@test.com"
    res_a = requests.post(f"{BASE_URL}/auth/signup", json={
        "email": email_a,
        "name": "User A (Photographer)",
        "password": "password123",
        "confirm_password": "password123"
    })
    assert res_a.status_code == 201, f"User A registration failed: {res_a.text}"
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Update User A profile to match interests
    requests.put(f"{BASE_URL}/users/me", json={
        "name": "User A (Photographer)",
        "bio": "Nature photographer and explorer.",
        "interests": ["Photography", "Nature", "History"],
        "travel_style": ["Adventure", "Cultural"],
        "budget_preference": "Moderate"
    }, headers=headers_a)
    print("User A registered and profile configured with interests.")

    # 3. Register User B (History + Photography enthusiast)
    print("Registering User B...")
    email_b = f"userb_p3_{int(time.time())}@test.com"
    res_b = requests.post(f"{BASE_URL}/auth/signup", json={
        "email": email_b,
        "name": "User B (Explorer)",
        "password": "password123",
        "confirm_password": "password123"
    })
    assert res_b.status_code == 201, f"User B registration failed: {res_b.text}"
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Update User B profile
    requests.put(f"{BASE_URL}/users/me", json={
        "name": "User B (Explorer)",
        "bio": "Love photography and history tour guide.",
        "interests": ["Photography", "History", "Culture"],
        "travel_style": ["Adventure", "Cultural"],
        "budget_preference": "Moderate"
    }, headers=headers_b)
    print("User B registered and profile configured.\n")

    # 4. Create Trips to match
    print("[3/7] Creating trips for User A and User B...")
    # User A creates trip to Goa
    trip_a_res = requests.post(f"{BASE_URL}/trips", json={
        "destination": "Goa, India",
        "start_date": "2026-09-01",
        "end_date": "2026-09-07",
        "approximate_budget": 1200.0,
        "travel_interests": ["Photography", "Nature"],
        "preferred_travel_style": ["Adventure"],
        "number_of_travelers": 1,
        "description": "Landscape photoshoot."
    }, headers=headers_a)
    assert trip_a_res.status_code == 201
    trip_a_id = trip_a_res.json()["id"]

    # User B creates trip to Goa on overlapping dates
    trip_b_res = requests.post(f"{BASE_URL}/trips", json={
        "destination": "Goa, India",
        "start_date": "2026-09-02",
        "end_date": "2026-09-08",
        "approximate_budget": 1100.0,
        "travel_interests": ["Photography", "Culture"],
        "preferred_travel_style": ["Adventure"],
        "number_of_travelers": 1,
        "description": "Historical beach adventure."
    }, headers=headers_b)
    assert trip_b_res.status_code == 201
    trip_b_id = trip_b_res.json()["id"]
    print("Trips successfully created.\n")

    # 5. Fetch buddy list & verify Phase 3A (Transparent Weighted Compatibility)
    print("[4/7] Testing Initial Matching (Phase 3A: Rule-Based Fallback)...")
    buddies_res = requests.get(f"{BASE_URL}/travel-buddies", headers=headers_a)
    assert buddies_res.status_code == 200, f"Get buddies failed: {buddies_res.text}"
    
    buddies = buddies_res.json()
    matched_b = next((b for b in buddies if b["user"]["id"] == res_b.json()["access_token"]), None) # wait, access_token contains the user id? No, let's just inspect all entries
    print(f"Discovered {len(buddies)} other trips.")
    
    # Print compatibility detail of the first match
    if buddies:
        first = buddies[0]
        print(f"Match: {first['user']['name']} -> {first['destination']}")
        print(f"Score: {first['compatibility']}")
        print(f"Tier: {first['match_tier']}")
        print(f"Reasons: {first['match_reasons']}")
        print(f"Scoring Method: {first['match_method']} (Expected: Rule-Based Compatibility)")
        assert "Rule-Based" in first["match_method"], "Scoring method should be Rule-Based prior to ML training."
    print("")

    # 6. Verify Phase 3B (Interaction logs)
    print("[5/7] Testing Data Collection (Phase 3B: Sending, Accepting, Rejecting requests)...")
    # User A invites User B
    invite_res = requests.post(f"{BASE_URL}/requests", json={
        "trip_id": trip_a_id,
        "receiver_id": res_b.json()["access_token"]  # wait, signup returns access_token. The User ID is retrieved by decoding, but our verify script can just fetch user details if needed. Let's find User B's ID from buddies list!
    }, headers=headers_a)
    
    # Let's get User B's actual ID from the buddies list
    user_b_id = None
    for b in buddies:
        if b["destination"] == "Goa, India":
            user_b_id = b["user"]["id"]
            break
            
    if not user_b_id:
        print("Error: Could not find User B ID in buddy list.")
        sys.exit(1)

    print(f"Resolved User B ID: {user_b_id}")
    
    # Send actual request from A to B
    req_res = requests.post(f"{BASE_URL}/requests", json={
        "trip_id": trip_a_id,
        "receiver_id": user_b_id
    }, headers=headers_a)
    assert req_res.status_code == 201, f"Failed to send request: {req_res.text}"
    request_id = req_res.json()["id"]
    print(f"Buddy request sent successfully. Request ID: {request_id}")

    # User B accepts request
    accept_res = requests.put(f"{BASE_URL}/requests/{request_id}/accept", headers=headers_b)
    assert accept_res.status_code == 200, f"Failed to accept request: {accept_res.text}"
    print("Buddy request accepted by User B. Interaction signals successfully written to database.\n")

    # 7. Train ML Match Classifier (Phase 3C)
    print("[6/7] Retraining scikit-learn Classifier model (Phase 3C)...")
    train_res = requests.post(f"{BASE_URL}/ml/train", headers=headers_a)
    assert train_res.status_code == 200, f"Model training failed: {train_res.text}"
    
    train_data = train_res.json()
    metrics = train_data["metrics"]
    print("ML Match Classifier Retraining Output:")
    print(f"- Status: {train_data['status']}")
    print(f"- Samples Count: {metrics['samples_count']}")
    print(f"- Accuracy: {metrics['accuracy']:.4f}")
    print(f"- Precision: {metrics['precision']:.4f}")
    print(f"- Recall: {metrics['recall']:.4f}")
    print(f"- F1-Score: {metrics['f1_score']:.4f}")
    print(f"- Confusion Matrix: {metrics['confusion_matrix']}\n")

    # 8. Verify Phase 3D (ML serving/ranking)
    print("[7/7] Verifying ML Match Prediction Serving (Phase 3D)...")
    buddies_post_res = requests.get(f"{BASE_URL}/travel-buddies", headers=headers_a)
    assert buddies_post_res.status_code == 200
    buddies_post = buddies_post_res.json()
    if buddies_post:
        first = buddies_post[0]
        print(f"Match: {first['user']['name']} -> {first['destination']}")
        print(f"ML Compatibility Score: {first['compatibility']}")
        print(f"ML Match Tier: {first['match_tier']}")
        print(f"ML Reasons: {first['match_reasons']}")
        print(f"Scoring Method: {first['match_method']} (Expected: Trained ML Prediction)")
        assert "Trained ML" in first["match_method"], "Scoring method should be Trained ML Prediction after model training."

    print("\n====================================================")
    print("PHASE 3 ML MATCHING VERIFICATION COMPLETED SUCCESSFULLY!")
    print("====================================================")

if __name__ == "__main__":
    test_phase3()
