import os
import pickle
import json
import logging
from datetime import datetime, date
from typing import Dict, Any, List, Tuple, Optional

logger = logging.getLogger(__name__)

BUDGET_TIERS = {
    "budget": 0,
    "moderate": 1,
    "premium": 2,
    "luxury": 3
}

class MatchingService:
    def __init__(self):
        self.model_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            "models", "saved_models", "matching_model.pkl"
        )
        self.config_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            "models", "saved_models", "model_config.json"
        )
        self.model = None
        self.model_loaded = False
        self._load_model()

    def _load_model(self):
        """Attempt to load pickled scikit-learn matching model."""
        if os.path.exists(self.model_path):
            try:
                with open(self.model_path, "rb") as f:
                    self.model = pickle.load(f)
                self.model_loaded = True
                logger.info("Successfully loaded trained scikit-learn matching model.")
            except Exception as e:
                logger.error(f"Failed to load scikit-learn matching model: {e}")
                self.model = None
                self.model_loaded = False
        else:
            self.model = None
            self.model_loaded = False

    def reload_model(self):
        """Force reload model file (useful after training endpoint finishes)."""
        self._load_model()

    def _get_budget_tier(self, budget_val: Any) -> int:
        """Map budget preference string or trip budget value to numeric tier."""
        if isinstance(budget_val, str):
            val_lower = budget_val.lower()
            return BUDGET_TIERS.get(val_lower, 1) # default to moderate
        
        # If float/int budget value
        try:
            budget = float(budget_val)
            if budget <= 400:
                return 0 # Budget
            elif budget <= 1000:
                return 1 # Moderate
            elif budget <= 2500:
                return 2 # Premium
            else:
                return 3 # Luxury
        except (ValueError, TypeError):
            return 1 # Default

    def calculate_features(self, tripA: Optional[Dict[str, Any]], userA: Dict[str, Any], tripB: Dict[str, Any], userB: Dict[str, Any]) -> Dict[str, float]:
        """
        Compute similarity features between User A (logged in) and User B (other traveler).
        Features are normalized between 0.0 and 1.0.
        """
        # 1. Destination Similarity
        dest_match = 0.0
        if tripA and tripB:
            cityA = tripA.get("destination", "").split(",")[0].strip().lower()
            cityB = tripB.get("destination", "").split(",")[0].strip().lower()
            if cityA == cityB:
                dest_match = 1.0

        # 2. Date Overlap Ratio
        date_overlap = 0.0
        if tripA and tripB:
            try:
                # Handle both datetime string conversions and raw date objects
                startA = tripA.get("start_date")
                endA = tripA.get("end_date")
                startB = tripB.get("start_date")
                endB = tripB.get("end_date")

                if isinstance(startA, str):
                    startA = datetime.strptime(startA.split("T")[0], "%Y-%m-%d").date()
                if isinstance(endA, str):
                    endA = datetime.strptime(endA.split("T")[0], "%Y-%m-%d").date()
                if isinstance(startB, str):
                    startB = datetime.strptime(startB.split("T")[0], "%Y-%m-%d").date()
                if isinstance(endB, str):
                    endB = datetime.strptime(endB.split("T")[0], "%Y-%m-%d").date()

                overlap_days = max(0, (min(endA, endB) - max(startA, startB)).days + 1)
                durationA = max(1, (endA - startA).days + 1)
                date_overlap = min(1.0, float(overlap_days / durationA))
            except Exception as e:
                logger.error(f"Error parsing dates for match calculation: {e}")
                date_overlap = 0.0

        # 3. Interest Similarity (Jaccard Index)
        interestsA = set(userA.get("interests", []) or [])
        interestsB = set(userB.get("interests", []) or [])
        interest_sim = 0.0
        if interestsA or interestsB:
            union_len = len(interestsA | interestsB)
            interest_sim = len(interestsA & interestsB) / union_len if union_len > 0 else 0.0

        # 4. Budget Similarity
        tierA = self._get_budget_tier(tripA.get("approximate_budget") if tripA else userA.get("budget_preference", "Moderate"))
        tierB = self._get_budget_tier(tripB.get("approximate_budget") if tripB else userB.get("budget_preference", "Moderate"))
        diff = abs(tierA - tierB)
        budget_sim = float(1.0 - (diff / 3.0))

        # 5. Travel Style Similarity (Jaccard Index)
        stylesA = set(userA.get("travel_style", []) or [])
        stylesB = set(userB.get("travel_style", []) or [])
        style_sim = 0.0
        if stylesA or stylesB:
            union_len = len(stylesA | stylesB)
            style_sim = len(stylesA & stylesB) / union_len if union_len > 0 else 0.0

        # 6. Activity / Pref Overlap (Jaccard Index of trip specific tags)
        trip_interestsA = set(tripA.get("travel_interests", []) if tripA else [])
        trip_interestsB = set(tripB.get("travel_interests", []) if tripB else [])
        activity_sim = 0.0
        if trip_interestsA or trip_interestsB:
            union_len = len(trip_interestsA | trip_interestsB)
            activity_sim = len(trip_interestsA & trip_interestsB) / union_len if union_len > 0 else 0.0
        else:
            # fallback to user interests
            activity_sim = interest_sim

        return {
            "destination_similarity": dest_match,
            "date_overlap_ratio": date_overlap,
            "interest_similarity": interest_sim,
            "budget_similarity": budget_sim,
            "style_similarity": style_sim,
            "activity_similarity": activity_sim
        }

    def get_tier_label(self, score: float) -> str:
        """Categorize matches into clear UI ranking tiers."""
        if score >= 85:
            return "Best Match"
        elif score >= 70:
            return "Strong Match"
        elif score >= 55:
            return "Good Match"
        elif score >= 35:
            return "Possible Match"
        else:
            return "Low Match"

    def get_reasons(self, score: float, feats: Dict[str, float], userB: Dict[str, Any]) -> List[str]:
        """Build descriptive user-friendly reasons for the match score."""
        reasons = []
        
        if feats["destination_similarity"] > 0.9:
            reasons.append("Same destination")
        
        if feats["date_overlap_ratio"] > 0.9:
            reasons.append("Dates overlap completely")
        elif feats["date_overlap_ratio"] > 0.3:
            reasons.append("Dates overlap partially")

        if feats["interest_similarity"] > 0.4:
            shared = list(set(feats.get("shared_interests_list", [])))
            if shared:
                reasons.append(f"Shared interests: {', '.join(shared[:3])}")
            else:
                reasons.append("Highly matching interests")

        if feats["budget_similarity"] > 0.9:
            reasons.append("Similar budget preference")
        elif feats["budget_similarity"] < 0.4:
            reasons.append("Different budget preference")

        if feats["style_similarity"] > 0.4:
            reasons.append("Compatible travel styles")

        return reasons

    def calculate_score(self, tripA: Optional[Dict[str, Any]], userA: Dict[str, Any], tripB: Dict[str, Any], userB: Dict[str, Any]) -> Tuple[float, Dict[str, Any]]:
        """
        Main score generator. Uses the scikit-learn model if available,
        otherwise falls back to rule-based weighting.
        """
        if not self.model_loaded or self.model is None:
            self._load_model()

        feats = self.calculate_features(tripA, userA, tripB, userB)

        # Retrieve matching list for reasons summary
        interestsA = set(userA.get("interests", []) or [])
        interestsB = set(userB.get("interests", []) or [])
        shared_list = list(interestsA & interestsB)
        feats["shared_interests_list"] = shared_list

        if self.model_loaded and self.model is not None:
            # ML model prediction path
            try:
                # Feature vector array
                x = [
                    feats["destination_similarity"],
                    feats["date_overlap_ratio"],
                    feats["interest_similarity"],
                    feats["budget_similarity"],
                    feats["style_similarity"],
                    feats["activity_similarity"]
                ]
                # Predict probability of accepted connection (class 1)
                prob = self.model.predict_proba([x])[0][1]
                score = round(prob * 100)
                score = max(0, min(100, score))
                
                return float(score), {
                    "method": "Trained ML Prediction",
                    "features": {k: v for k, v in feats.items() if k != "shared_interests_list"},
                    "tier": self.get_tier_label(score),
                    "reasons": self.get_reasons(score, feats, userB)
                }
            except Exception as e:
                logger.error(f"ML inference error, falling back to rule-based math: {e}")

        # Rule-Based Score path (Phase 3A)
        # Weighted parameters:
        # Destination: 25%, Dates: 25%, Interests: 20%, Budget: 15%, Styles: 10%, Activities: 5%
        w_dest = feats["destination_similarity"] * 25
        w_date = feats["date_overlap_ratio"] * 25
        w_inter = feats["interest_similarity"] * 20
        w_budg = feats["budget_similarity"] * 15
        w_style = feats["style_similarity"] * 10
        w_activ = feats["activity_similarity"] * 5

        # If user has no active trips, fall back to profile-only weights
        if not tripA:
            # Rescale weights: Interests 40%, Budget 30%, Style 20%, Home City 10%
            city_match = 1.0 if userA.get("home_city") == userB.get("home_city") and userA.get("home_city") else 0.0
            score = (feats["interest_similarity"] * 40) + (feats["budget_similarity"] * 30) + (feats["style_similarity"] * 20) + (city_match * 10)
        else:
            score = w_dest + w_date + w_inter + w_budg + w_style + w_activ

        score = round(score)
        score = max(0, min(100, score))

        return float(score), {
            "method": "Rule-Based Compatibility",
            "features": {k: v for k, v in feats.items() if k != "shared_interests_list"},
            "tier": self.get_tier_label(score),
            "reasons": self.get_reasons(score, feats, userB)
        }
