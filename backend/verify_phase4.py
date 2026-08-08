import sys
import urllib.request
import urllib.parse
import json
import time

BACKEND_URL = "http://127.0.0.1:8000"

def get_auth_token(email, name="Tester User"):
    """Retrieve test traveler token or create a new test user if missing."""
    signup_url = f"{BACKEND_URL}/auth/signup"
    signup_payload = {
        "email": email,
        "password": "Password123!",
        "confirm_password": "Password123!",
        "name": name,
        "home_city": "Mumbai",
        "interests": ["Photography", "Nature"],
        "travel_style": ["Backpacker"],
        "budget_preference": "Moderate"
    }

    try:
        req = urllib.request.Request(
            signup_url,
            data=json.dumps(signup_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            pass
    except Exception:
        pass

    # Login
    login_url = f"{BACKEND_URL}/auth/login"
    login_payload = {
        "email": email,
        "password": "Password123!"
    }
    
    req = urllib.request.Request(
        login_url,
        data=json.dumps(login_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["access_token"]

def main():
    print("=== STARTING PHASE 4 END-TO-END BACKEND VERIFICATION ===")
    
    unique_suffix = int(time.time())
    email1 = f"traveler1_{unique_suffix}@tripmate.com"
    email2 = f"traveler2_{unique_suffix}@tripmate.com"
    admin_email = f"admin@tripmate.com"
    
    try:
        print("\n1. Authenticating test travelers...")
        token1 = get_auth_token(email1, "Traveler One")
        token2 = get_auth_token(email2, "Traveler Two")
        admin_token = get_auth_token(admin_email, "Admin User")
        
        headers1 = {"Authorization": f"Bearer {token1}", "Content-Type": "application/json"}
        headers2 = {"Authorization": f"Bearer {token2}", "Content-Type": "application/json"}
        admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        
        print("✓ Authenticated users and admin.")
        
        print("\n2. Creating a trip for Traveler One...")
        trip_url = f"{BACKEND_URL}/trips"
        trip_payload = {
            "destination": "Goa, India",
            "start_date": "2026-12-01",
            "end_date": "2026-12-10",
            "approximate_budget": 500,
            "number_of_travelers": 2,
            "description": "Fun weekend trip to Baga beach, nature hikes and sunset photography.",
            "travel_interests": ["Nature", "Photography"],
            "preferred_travel_style": ["Backpacker"]
        }
        
        req = urllib.request.Request(
            trip_url,
            data=json.dumps(trip_payload).encode("utf-8"),
            headers=headers1,
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            trip_data = json.loads(resp.read().decode("utf-8"))
            trip_id = trip_data["id"]
            print(f"✓ Trip created successfully with ID: {trip_id}")
            
        print("\n3. Testing Collaboration Space initialization...")
        collab_url = f"{BACKEND_URL}/trips/{trip_id}/collaboration"
        req = urllib.request.Request(collab_url, headers=headers1, method="GET")
        with urllib.request.urlopen(req) as resp:
            collab_data = json.loads(resp.read().decode("utf-8"))
            print(f"✓ Collaboration space initialized. Notes count: {len(collab_data['notes'])}")
            
        print("\n4. Posting a shared note to the workspace...")
        note_url = f"{BACKEND_URL}/trips/{trip_id}/collaboration/notes"
        note_payload = {"content": "Hey, I booked my train tickets for Dec 1st!"}
        req = urllib.request.Request(
            note_url,
            data=json.dumps(note_payload).encode("utf-8"),
            headers=headers1,
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            note_data = json.loads(resp.read().decode("utf-8"))
            print(f"✓ Shared note added: '{note_data['content']}' by {note_data['author_name']}")
            
        print("\n5. Testing Safety features: Reporting content...")
        report_url = f"{BACKEND_URL}/safety/report"
        report_payload = {
            "reported_id": trip_id,
            "type": "content",
            "reason": "Offensive language in descriptions",
            "details": "Checking if report pipelines log entries successfully."
        }
        req = urllib.request.Request(
            report_url,
            data=json.dumps(report_payload).encode("utf-8"),
            headers=headers2,
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            report_data = json.loads(resp.read().decode("utf-8"))
            print(f"✓ Report submitted successfully. Status: {report_data['status']}")
            
        print("\n6. Testing Admin moderation dashboard analytics...")
        admin_stats_url = f"{BACKEND_URL}/admin/stats"
        req = urllib.request.Request(admin_stats_url, headers=admin_headers, method="GET")
        with urllib.request.urlopen(req) as resp:
            stats_data = json.loads(resp.read().decode("utf-8"))
            print(f"✓ Admin Stats fetched:")
            print(f"  - Users Total: {stats_data['users_count']}")
            print(f"  - Trips Total: {stats_data['trips_count']}")
            print(f"  - Pending Content Reports: {stats_data['reported_content_count']}")
            
        print("\n7. Fetching pending safety reports for review...")
        admin_reports_url = f"{BACKEND_URL}/admin/reports"
        req = urllib.request.Request(admin_reports_url, headers=admin_headers, method="GET")
        with urllib.request.urlopen(req) as resp:
            reports_list = json.loads(resp.read().decode("utf-8"))
            print(f"✓ Pending reports found: {len(reports_list)}")
            
        print("\n=== PHASE 4 VERIFICATION SUCCESSFUL! ===")
        sys.exit(0)
        
    except urllib.error.HTTPError as e:
        print(f"\n❌ API Error: {e.code} - {e.reason}")
        print(e.read().decode("utf-8"))
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Connection Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
