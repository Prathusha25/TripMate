from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from bson import ObjectId

from app.repositories.trip import TripRepository
from app.repositories.user import UserRepository
from app.routes.auth import get_current_user
from app.services.matching_service import MatchingService
from app.config.db import get_database
from app.utils.db_helpers import serialize_docs, serialize_doc

router = APIRouter(prefix="/matching", tags=["Travel Buddy Matching & Compatibility"])

matching_service = MatchingService()

class ScoreRequest(BaseModel):
    candidate_user_id: Optional[str] = None
    candidate_trip_id: Optional[str] = None
    user_a: Optional[Dict[str, Any]] = None
    trip_a: Optional[Dict[str, Any]] = None
    user_b: Optional[Dict[str, Any]] = None
    trip_b: Optional[Dict[str, Any]] = None

@router.get("/candidates", response_model=List[dict])
async def get_matching_candidates(
    current_user: dict = Depends(get_current_user),
    trip_repo: TripRepository = Depends(),
    user_repo: UserRepository = Depends()
):
    """
    Retrieve ranked travel buddy candidates for the logged in traveler.
    Uses trained ML model (Logistic Regression / Random Forest) when available,
    otherwise uses transparent rule-based compatibility scoring.
    """
    db = get_database()
    if db is None:
        raise RuntimeError("Database not initialized")

    # Filter blocked users
    blocked_cursor = db.blocks.find({"blocker_id": current_user["id"]})
    blocked_docs = await blocked_cursor.to_list(length=100)
    blocked_ids = {b["blocked_id"] for b in blocked_docs}

    blocking_cursor = db.blocks.find({"blocked_id": current_user["id"]})
    blocking_docs = await blocking_cursor.to_list(length=100)
    blocking_ids = {b["blocker_id"] for b in blocking_docs}

    exclude_ids = blocked_ids | blocking_ids

    # Query other users
    try:
        user_cursor = db.users.find({"_id": {"$ne": ObjectId(current_user["id"])}})
    except Exception:
        user_cursor = db.users.find({"id": {"$ne": current_user["id"]}})
        
    other_users = await user_cursor.to_list(length=100)
    other_users = serialize_docs(other_users)

    # Fetch current user trips
    my_trips = await trip_repo.get_user_trips(user_id=current_user["id"])

    candidates = []
    for other in other_users:
        oid = other["id"]
        if oid in exclude_ids:
            continue

        other_trips = await trip_repo.get_user_trips(user_id=oid)

        best_score = 0.0
        best_meta = {
            "tier": "Possible Match",
            "reasons": ["✓ Compatible traveler profile"],
            "differences": [],
            "method": "Rule-Based Compatibility"
        }
        best_trip = None

        if my_trips and other_trips:
            for mt in my_trips:
                for ot in other_trips:
                    score, meta = matching_service.calculate_score(
                        tripA=mt, userA=current_user, tripB=ot, userB=other
                    )
                    if score >= best_score:
                        best_score = score
                        best_meta = meta
                        best_trip = ot
        elif my_trips:
            for mt in my_trips:
                score, meta = matching_service.calculate_score(
                    tripA=mt, userA=current_user, tripB=None, userB=other
                )
                if score >= best_score:
                    best_score = score
                    best_meta = meta
                    best_trip = None
        elif other_trips:
            for ot in other_trips:
                score, meta = matching_service.calculate_score(
                    tripA=None, userA=current_user, tripB=ot, userB=other
                )
                if score >= best_score:
                    best_score = score
                    best_meta = meta
                    best_trip = ot
        else:
            best_score, best_meta = matching_service.calculate_score(
                tripA=None, userA=current_user, tripB=None, userB=other
            )

        card_id = best_trip["id"] if best_trip else f"profile_{oid}"
        candidates.append({
            "id": card_id,
            "destination": best_trip.get("destination", other.get("home_city", "Flexible Destination")) if best_trip else (other.get("home_city") or "Flexible Destination"),
            "start_date": best_trip.get("start_date", "") if best_trip else "",
            "end_date": best_trip.get("end_date", "") if best_trip else "",
            "approximate_budget": best_trip.get("approximate_budget", 500) if best_trip else 500,
            "travel_interests": best_trip.get("travel_interests", other.get("interests", [])) if best_trip else other.get("interests", []),
            "preferred_travel_style": best_trip.get("preferred_travel_style", other.get("travel_style", [])) if best_trip else other.get("travel_style", []),
            "number_of_travelers": best_trip.get("number_of_travelers", 1) if best_trip else 1,
            "description": best_trip.get("description") if best_trip else other.get("bio"),
            "user": {
                "id": oid,
                "name": other["name"],
                "profile_photo": other.get("profile_photo"),
                "bio": other.get("bio"),
                "interests": other.get("interests", []),
                "travel_style": other.get("travel_style", [])
            },
            "compatibility": f"{int(best_score)}%",
            "match_score": float(best_score),
            "match_tier": best_meta.get("tier", "Possible Match"),
            "match_reasons": best_meta.get("reasons", []),
            "match_differences": best_meta.get("differences", []),
            "match_method": best_meta.get("method", "Rule-Based Compatibility")
        })

    # Sort descending by match score
    candidates.sort(key=lambda x: x["match_score"], reverse=True)
    return candidates

@router.get("/{user_id}", response_model=dict)
async def get_user_compatibility(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    user_repo: UserRepository = Depends(),
    trip_repo: TripRepository = Depends()
):
    """
    Get detailed match score, tier, and explainability breakdown between current user and target user.
    """
    target_user = await user_repo.get_by_id(user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found"
        )

    my_trips = await trip_repo.get_user_trips(user_id=current_user["id"])
    target_trips = await trip_repo.get_user_trips(user_id=user_id)

    best_score = 0.0
    best_meta = {
        "tier": "Possible Match",
        "reasons": ["✓ Compatible traveler profile"],
        "differences": [],
        "method": "Rule-Based Compatibility"
    }

    if my_trips and target_trips:
        for mt in my_trips:
            for ot in target_trips:
                score, meta = matching_service.calculate_score(
                    tripA=mt, userA=current_user, tripB=ot, userB=target_user
                )
                if score >= best_score:
                    best_score = score
                    best_meta = meta
    elif my_trips:
        for mt in my_trips:
            score, meta = matching_service.calculate_score(
                tripA=mt, userA=current_user, tripB=None, userB=target_user
            )
            if score >= best_score:
                best_score = score
                best_meta = meta
    elif target_trips:
        for ot in target_trips:
            score, meta = matching_service.calculate_score(
                tripA=None, userA=current_user, tripB=ot, userB=target_user
            )
            if score >= best_score:
                best_score = score
                best_meta = meta
    else:
        best_score, best_meta = matching_service.calculate_score(
            tripA=None, userA=current_user, tripB=None, userB=target_user
        )

    return {
        "candidate_user_id": user_id,
        "candidate_name": target_user["name"],
        "compatibility_score": float(best_score),
        "compatibility_formatted": f"{int(best_score)}%",
        "match_tier": best_meta.get("tier", "Possible Match"),
        "match_reasons": best_meta.get("reasons", []),
        "match_differences": best_meta.get("differences", []),
        "match_method": best_meta.get("method", "Rule-Based Compatibility"),
        "features": best_meta.get("features", {})
    }

@router.post("/score", response_model=dict)
async def compute_matching_score(
    payload: ScoreRequest,
    current_user: dict = Depends(get_current_user),
    user_repo: UserRepository = Depends(),
    trip_repo: TripRepository = Depends()
):
    """
    Compute compatibility score and explainability reasons for arbitrary user/trip objects.
    """
    user_a = payload.user_a or current_user
    trip_a = payload.trip_a
    user_b = payload.user_b
    trip_b = payload.trip_b

    if not user_b and payload.candidate_user_id:
        user_b = await user_repo.get_by_id(payload.candidate_user_id)
    if not trip_b and payload.candidate_trip_id:
        trip_b = await trip_repo.get_by_id(payload.candidate_trip_id)

    if not user_b:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate user information required for scoring"
        )

    score, meta = matching_service.calculate_score(
        tripA=trip_a, userA=user_a, tripB=trip_b, userB=user_b
    )

    return {
        "compatibility_score": float(score),
        "compatibility_formatted": f"{int(score)}%",
        "match_tier": meta.get("tier", "Possible Match"),
        "match_reasons": meta.get("reasons", []),
        "match_differences": meta.get("differences", []),
        "match_method": meta.get("method", "Rule-Based Compatibility"),
        "features": meta.get("features", {})
    }
