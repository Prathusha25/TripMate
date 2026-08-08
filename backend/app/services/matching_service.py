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

    def calculate_features(
        self, 
        tripA: Optional[Dict[str, Any]], 
        userA: Dict[str, Any], 
        tripB: Optional[Dict[str, Any]], 
        userB: Dict[str, Any]
    ) -> Dict[str, float]:
        """
        Compute similarity features between User A (logged in) and User B (candidate traveler).
        Features are normalized between 0.0 and 1.0.
        """
        # 1. Destination Similarity (0 or 1)
        dest_match = 0.0
        if tripA and tripB:
            cityA = tripA.get("destination", "").split(",")[0].strip().lower()
            cityB = tripB.get("destination", "").split(",")[0].strip().lower()
            if cityA and cityB and cityA == cityB:
                dest_match = 1.0

        # 2. Date Overlap Ratio (0.0 to 1.0)
        date_overlap = 0.0
        if tripA and tripB:
            try:
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
                logger.debug(f"Error parsing dates for match calculation: {e}")
                date_overlap = 0.0

        # 3. Interest Similarity (Jaccard Index: 0.0 to 1.0)
        interestsA = set(userA.get("interests", []) or [])
        interestsB = set(userB.get("interests", []) or [])
        interest_sim = 0.0
        if interestsA or interestsB:
            union_len = len(interestsA | interestsB)
            interest_sim = len(interestsA & interestsB) / union_len if union_len > 0 else 0.0

        # 4. Budget Similarity (Normalized tier difference: 0.0 to 1.0)
        tierA = self._get_budget_tier(tripA.get("approximate_budget") if tripA else userA.get("budget_preference", "Moderate"))
        tierB = self._get_budget_tier(tripB.get("approximate_budget") if tripB else userB.get("budget_preference", "Moderate"))
        diff = abs(tierA - tierB)
        budget_sim = float(max(0.0, 1.0 - (diff / 3.0)))

        # 5. Travel Style Similarity (Jaccard Index: 0.0 to 1.0)
        stylesA = set(userA.get("travel_style", []) or [])
        stylesB = set(userB.get("travel_style", []) or [])
        style_sim = 0.0
        if stylesA or stylesB:
            union_len = len(stylesA | stylesB)
            style_sim = len(stylesA & stylesB) / union_len if union_len > 0 else 0.0

        # 6. Activity Similarity (Jaccard Index of trip specific interests/activities: 0.0 to 1.0)
        trip_interestsA = set(tripA.get("travel_interests", []) if tripA else [])
        trip_interestsB = set(tripB.get("travel_interests", []) if tripB else [])
        activity_sim = 0.0
        if trip_interestsA or trip_interestsB:
            union_len = len(trip_interestsA | trip_interestsB)
            activity_sim = len(trip_interestsA & trip_interestsB) / union_len if union_len > 0 else 0.0
        else:
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

    def get_explainability(
        self, 
        feats: Dict[str, float], 
        userA: Dict[str, Any], 
        userB: Dict[str, Any],
        tripA: Optional[Dict[str, Any]], 
        tripB: Optional[Dict[str, Any]]
    ) -> Tuple[List[str], List[str]]:
        """
        Builds clear human-friendly positive reasons and potential differences.
        No model coefficients or feature vectors are shown.
        """
        reasons = []
        differences = []

        # Destination
        if feats["destination_similarity"] > 0.9:
            reasons.append("✓ Same destination")
        elif tripA and tripB:
            differences.append("Different destination plans")

        # Dates
        if feats["date_overlap_ratio"] > 0.85:
            reasons.append("✓ Complete date overlap")
        elif feats["date_overlap_ratio"] > 0.3:
            reasons.append("✓ Partial date overlap")
        elif tripA and tripB:
            differences.append("No overlapping travel dates")

        # Interests
        interestsA = set(userA.get("interests", []) or [])
        interestsB = set(userB.get("interests", []) or [])
        shared = list(interestsA & interestsB)
        if len(shared) > 0:
            reasons.append(f"✓ {len(shared)} shared interests ({', '.join(shared[:3])})")
        elif len(interestsA) > 0 and len(interestsB) > 0:
            differences.append("Different personal travel interests")

        # Budget
        if feats["budget_similarity"] > 0.85:
            reasons.append("✓ Similar budget preference")
        elif feats["budget_similarity"] < 0.4:
            differences.append("Different budget tiers")

        # Style
        stylesA = set(userA.get("travel_style", []) or [])
        stylesB = set(userB.get("travel_style", []) or [])
        shared_styles = list(stylesA & stylesB)
        if len(shared_styles) > 0:
            reasons.append(f"✓ Compatible travel style ({', '.join(shared_styles[:2])})")
        elif len(stylesA) > 0 and len(stylesB) > 0:
            differences.append("Different travel pacing/styles")

        # Activities
        if feats["activity_similarity"] > 0.6:
            reasons.append("✓ Matching activity preferences")
        elif feats["activity_similarity"] < 0.25 and (tripA or tripB):
            differences.append("Different activity preference")

        if not reasons:
            reasons.append("✓ Compatible traveler profile")

        return reasons, differences

    def calculate_score(
        self, 
        tripA: Optional[Dict[str, Any]], 
        userA: Dict[str, Any], 
        tripB: Optional[Dict[str, Any]], 
        userB: Dict[str, Any]
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Main compatibility score generator. Uses the scikit-learn ML model if available,
        otherwise falls back to transparent rule-based compatibility weighting.
        """
        if not self.model_loaded or self.model is None:
            self._load_model()

        feats = self.calculate_features(tripA, userA, tripB, userB)
        reasons, differences = self.get_explainability(feats, userA, userB, tripA, tripB)

        # 1. ML Model Prediction Path (if active and loaded)
        if self.model_loaded and self.model is not None:
            try:
                x = [
                    feats["destination_similarity"],
                    feats["date_overlap_ratio"],
                    feats["interest_similarity"],
                    feats["budget_similarity"],
                    feats["style_similarity"],
                    feats["activity_similarity"]
                ]
                # Predict probability of accepted connection
                prob = self.model.predict_proba([x])[0][1]
                score = round(prob * 100)
                score = max(0, min(100, score))
                
                return float(score), {
                    "method": "Trained ML Prediction",
                    "tier": self.get_tier_label(score),
                    "reasons": reasons,
                    "differences": differences,
                    "features": feats
                }
            except Exception as e:
                logger.error(f"ML inference error, falling back to rule-based: {e}")

        # 2. Transparent Rule-Based Compatibility Path
        # Formula weights:
        # Destination = 25%
        # Date overlap = 25%
        # Interests = 20%
        # Budget = 15%
        # Travel style = 10%
        # Activities = 5%
        w_dest = feats["destination_similarity"] * 25.0
        w_date = feats["date_overlap_ratio"] * 25.0
        w_inter = feats["interest_similarity"] * 20.0
        w_budg = feats["budget_similarity"] * 15.0
        w_style = feats["style_similarity"] * 10.0
        w_activ = feats["activity_similarity"] * 5.0

        if not tripA and not tripB:
            # Cold-start profile matching: Interests 40%, Budget 30%, Style 20%, City 10%
            city_match = 1.0 if userA.get("home_city") and userA.get("home_city") == userB.get("home_city") else 0.0
            score = (feats["interest_similarity"] * 40.0) + (feats["budget_similarity"] * 30.0) + (feats["style_similarity"] * 20.0) + (city_match * 10.0)
        else:
            score = w_dest + w_date + w_inter + w_budg + w_style + w_activ

        score = round(score)
        score = max(0, min(100, score))

        return float(score), {
            "method": "Rule-Based Compatibility",
            "tier": self.get_tier_label(score),
            "reasons": reasons,
            "differences": differences,
            "features": feats
        }
