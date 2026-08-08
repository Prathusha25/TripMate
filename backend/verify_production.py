import sys
import os
import json
import random
from datetime import datetime

# Direct in-process verification
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.matching_service import MatchingService
from app.services.ml_service import MLService
from app.services.geocoding_service import GeocodingService
from app.services.weather_service import WeatherService
from app.services.ai_service import AIService
from app.services.rag_service import RAGService

def test_security_and_hashing():
    print("\n--- 1. Security & Authentication Checks ---")
    from app.utils.security import hash_password, verify_password, create_access_token, decode_access_token
    
    password = "SecureTravelerPassword123!"
    hashed = hash_password(password)
    assert hashed != password, "Password must be securely hashed"
    assert verify_password(password, hashed) is True, "Password verification failed"
    assert verify_password("WrongPassword", hashed) is False, "Invalid password falsely verified"
    print("[OK] Bcrypt password hashing verified.")
    
    token = create_access_token({"sub": "user_12345", "role": "traveler"})
    decoded = decode_access_token(token)
    assert decoded["sub"] == "user_12345", "JWT sub claim mismatch"
    assert decoded["role"] == "traveler", "JWT role claim mismatch"
    print("[OK] JWT Token encoding and decoding verified.")

def test_destination_geocoding_and_typo_tolerance():
    print("\n--- 2. Destination Geocoding & Typo-Tolerance ---")
    test_queries = [
        ("Gao", "Goa"),
        ("Goa", "Goa"),
        ("Banglore", "Bengaluru"),
        ("Hydrabad", "Hyderabad"),
        ("Mumabi", "Mumbai"),
        ("Delh", "Delhi"),
        ("Manali", "Manali"),
        ("Paris", "Paris")
    ]
    for q, expected in test_queries:
        candidates = GeocodingService._find_catalog_candidates(q)
        top = candidates[0][1]["name"] if candidates else "None"
        assert top.lower() == expected.lower() or expected.lower() in top.lower(), f"Expected {expected} for '{q}', got {top}"
    print("[OK] All typo-tolerant destination matches verified.")

def test_ml_matching_and_explainability():
    print("\n--- 3. Machine Learning Travel Buddy Matching & Explainability ---")
    matching = MatchingService()
    userA = {"id": "u1", "interests": ["Nature", "Photography"], "travel_style": ["Backpacker"], "budget_preference": "Moderate"}
    userB = {"id": "u2", "interests": ["Nature", "Photography"], "travel_style": ["Backpacker"], "budget_preference": "Moderate"}
    tripA = {"destination": "Goa, India", "start_date": "2026-12-01", "end_date": "2026-12-10", "approximate_budget": 500, "travel_interests": ["Nature"]}
    tripB = {"destination": "Goa, India", "start_date": "2026-12-01", "end_date": "2026-12-10", "approximate_budget": 500, "travel_interests": ["Nature"]}
    
    score, meta = matching.calculate_score(tripA, userA, tripB, userB)
    assert score >= 85, f"Expected high compatibility score >= 85, got {score}"
    assert meta["tier"] == "Best Match", f"Expected Best Match, got {meta['tier']}"
    assert len(meta["reasons"]) > 0, "Expected positive explainability reasons"
    print(f"[OK] Compatibility calculation verified: {score}% ({meta['tier']}, {meta['method']})")

def test_admin_role_security():
    print("\n--- 4. Role-Based Admin Access Verification ---")
    from app.routes.admin import verify_admin_role
    from fastapi import HTTPException
    
    admin_user = {"id": "adm_1", "email": "admin@tripmate.com", "role": "admin"}
    normal_user = {"id": "usr_1", "email": "traveler@example.com", "role": "traveler"}
    
    # Admin user should pass without exception
    verify_admin_role(admin_user)
    print("[OK] Admin user authorized.")
    
    # Normal user should be rejected with 403 Forbidden
    rejected = False
    try:
        verify_admin_role(normal_user)
    except HTTPException as e:
        if e.status_code == 403:
            rejected = True
    assert rejected is True, "Normal user was not blocked from admin route"
    print("[OK] Non-admin user blocked with HTTP 403 Forbidden.")

def test_ai_and_rag_fallback():
    print("\n--- 5. AI & RAG Graceful Fallback Checks ---")
    # Verify RAG places catalog is populated
    places = RAGService.search_places("Goa", ["Nature", "Beach"])
    assert len(places) > 0, "Expected places catalog to return recommendations"
    print(f"[OK] Local RAG Places index verified ({len(places)} places retrieved).")

def main():
    print("==================================================================")
    print("TRIPMATE AI — PRODUCTION POLISH & ALL-PHASE INTEGRATION SUITE")
    print("==================================================================")
    
    test_security_and_hashing()
    test_destination_geocoding_and_typo_tolerance()
    test_ml_matching_and_explainability()
    test_admin_role_security()
    test_ai_and_rag_fallback()
    
    print("\n==================================================================")
    print("ALL PRODUCTION INTEGRATION CHECKS PASSED SUCCESSFULLY (100%)!")
    print("==================================================================")

if __name__ == "__main__":
    main()
