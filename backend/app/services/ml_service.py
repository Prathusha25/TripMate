import os
import pickle
import json
import logging
import random
from datetime import datetime
from typing import Dict, Any, Optional, List
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

from app.config.db import get_database
from app.utils.db_helpers import serialize_doc, serialize_docs

logger = logging.getLogger(__name__)

FEATURE_COLUMNS = [
    "destination_similarity",
    "date_overlap_ratio",
    "interest_similarity",
    "budget_similarity",
    "style_similarity",
    "activity_similarity"
]

FEATURE_VERSION = "v1.0"
MODEL_VERSION = "v1.0.0"
MIN_DATASET_THRESHOLD = 10

class MLService:
    def __init__(self):
        self.model_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            "models", "saved_models"
        )
        self.model_path = os.path.join(self.model_dir, "matching_model.pkl")
        self.config_path = os.path.join(self.model_dir, "model_config.json")
        os.makedirs(self.model_dir, exist_ok=True)

    @property
    def collection(self):
        db = get_database()
        if db is None:
            raise RuntimeError("Database not initialized")
        return db.match_interactions

    async def seed_mock_interactions(self, force: bool = False, count: int = 100):
        """Seed interaction records to bootstrap model training if dataset is empty."""
        existing_count = await self.collection.count_documents({})
        if existing_count > 0 and not force:
            logger.info("match_interactions collection already has data.")
            return

        logger.info(f"Seeding {count} mock match interactions for model bootstrapping...")
        records = []
        now = datetime.utcnow()

        pos_count = count // 2
        neg_count = count - pos_count

        # Seed positive matches (accepted connections, high similarity)
        for i in range(pos_count):
            records.append({
                "userId": f"usr_pos_s_{i}",
                "candidateUserId": f"usr_pos_r_{i}",
                "tripId": f"trip_pos_s_{i}",
                "candidateTripId": f"trip_pos_r_{i}",
                "sender_id": f"usr_pos_s_{i}",
                "receiver_id": f"usr_pos_r_{i}",
                "trip_id": f"trip_pos_s_{i}",
                "destination_similarity": 1.0 if random.random() > 0.15 else 0.0,
                "date_overlap_ratio": float(random.uniform(0.6, 1.0)),
                "interest_similarity": float(random.uniform(0.5, 0.95)),
                "budget_similarity": float(random.choice([0.66, 1.0])),
                "style_similarity": float(random.uniform(0.4, 0.85)),
                "activity_similarity": float(random.uniform(0.5, 0.95)),
                "requestStatus": "accepted",
                "status": "accepted",
                "label": 1,
                "created_at": now,
                "createdAt": now
            })

        # Seed negative matches (rejected interactions, low compatibility)
        for i in range(neg_count):
            records.append({
                "userId": f"usr_neg_s_{i}",
                "candidateUserId": f"usr_neg_r_{i}",
                "tripId": f"trip_neg_s_{i}",
                "candidateTripId": f"trip_neg_r_{i}",
                "sender_id": f"usr_neg_s_{i}",
                "receiver_id": f"usr_neg_r_{i}",
                "trip_id": f"trip_neg_s_{i}",
                "destination_similarity": 1.0 if random.random() > 0.85 else 0.0,
                "date_overlap_ratio": float(random.uniform(0.0, 0.25)),
                "interest_similarity": float(random.uniform(0.0, 0.35)),
                "budget_similarity": float(random.choice([0.0, 0.33])),
                "style_similarity": float(random.uniform(0.0, 0.3)),
                "activity_similarity": float(random.uniform(0.0, 0.35)),
                "requestStatus": "rejected",
                "status": "rejected",
                "label": 0,
                "created_at": now,
                "createdAt": now
            })

        await self.collection.insert_many(records)
        logger.info(f"Successfully seeded {count} interaction records.")

    async def log_interaction(
        self, 
        sender_id: str, 
        receiver_id: str, 
        trip_id: str, 
        features: dict, 
        status: str, 
        label: int,
        candidate_trip_id: Optional[str] = None
    ):
        """Record non-sensitive traveler matching interactions for ML training."""
        now = datetime.utcnow()
        doc = {
            "userId": sender_id,
            "candidateUserId": receiver_id,
            "tripId": trip_id,
            "candidateTripId": candidate_trip_id or trip_id,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "trip_id": trip_id,
            "destination_similarity": float(features.get("destination_similarity", 0.0)),
            "date_overlap_ratio": float(features.get("date_overlap_ratio", 0.0)),
            "interest_similarity": float(features.get("interest_similarity", 0.0)),
            "budget_similarity": float(features.get("budget_similarity", 0.0)),
            "style_similarity": float(features.get("style_similarity", 0.0)),
            "activity_similarity": float(features.get("activity_similarity", 0.0)),
            "requestStatus": status,
            "status": status,
            "label": int(label),
            "updated_at": now
        }
        await self.collection.update_one(
            {"sender_id": sender_id, "receiver_id": receiver_id, "trip_id": trip_id},
            {"$set": doc, "$setOnInsert": {"created_at": now, "createdAt": now}},
            upsert=True
        )

    async def get_dataset_size(self) -> int:
        """Count available interaction records."""
        try:
            return await self.collection.count_documents({})
        except Exception:
            return 0

    async def train_model(self, algorithm: str = "logistic_regression") -> dict:
        """
        Train a scikit-learn model (Logistic Regression or Random Forest) on interaction data.
        Performs train/test split, calculates evaluation metrics, and serializes the model.
        """
        # Ensure we have minimum dataset
        count = await self.get_dataset_size()
        if count < MIN_DATASET_THRESHOLD:
            await self.seed_mock_interactions(force=False)
            count = await self.get_dataset_size()

        cursor = self.collection.find({})
        docs = await cursor.to_list(length=10000)
        
        if len(docs) < MIN_DATASET_THRESHOLD:
            raise ValueError(
                f"Insufficient training samples. Found {len(docs)} records, need at least {MIN_DATASET_THRESHOLD}."
            )

        df = pd.DataFrame(serialize_docs(docs))

        # Fill missing features with 0.0
        for col in FEATURE_COLUMNS:
            if col not in df.columns:
                df[col] = 0.0
            else:
                df[col] = df[col].fillna(0.0).astype(float)

        if "label" not in df.columns:
            df["label"] = 1

        x = df[FEATURE_COLUMNS].values
        y = df["label"].values.astype(int)

        # Use stratification if we have at least 2 instances of each class
        strat = y if len(np.unique(y)) > 1 and np.min(np.bincount(y)) >= 2 else None
        x_train, x_test, y_train, y_test = train_test_split(
            x, y, test_size=0.2, random_state=42, stratify=strat
        )

        # Initialize chosen algorithm
        algo_name = "Logistic Regression"
        if algorithm.lower() in ["random_forest", "rf", "randomforest"]:
            model = RandomForestClassifier(n_estimators=50, max_depth=5, random_state=42)
            algo_name = "Random Forest Classifier"
        else:
            model = LogisticRegression(solver='liblinear', random_state=42)
            algo_name = "Logistic Regression Classifier"

        model.fit(x_train, y_train)

        # Evaluate
        predictions = model.predict(x_test)
        acc = accuracy_score(y_test, predictions)
        prec = precision_score(y_test, predictions, zero_division=0)
        rec = recall_score(y_test, predictions, zero_division=0)
        f1 = f1_score(y_test, predictions, zero_division=0)
        cm = confusion_matrix(y_test, predictions)

        # Save model pickle
        with open(self.model_path, "wb") as f:
            pickle.dump(model, f)

        # Model Versioning & Metrics
        metrics = {
            "status": "Model active & trained",
            "algorithm": algo_name,
            "modelVersion": MODEL_VERSION,
            "featureVersion": FEATURE_VERSION,
            "datasetSize": len(df),
            "trainedAt": datetime.utcnow().isoformat(),
            "metrics": {
                "accuracy": float(round(acc, 4)),
                "precision": float(round(prec, 4)),
                "recall": float(round(rec, 4)),
                "f1_score": float(round(f1, 4)),
                "confusion_matrix": cm.tolist()
            },
            "configuration": {
                "test_size": 0.2,
                "random_state": 42,
                "features": FEATURE_COLUMNS,
                "threshold": MIN_DATASET_THRESHOLD
            }
        }

        with open(self.config_path, "w") as f:
            json.dump(metrics, f, indent=2)

        logger.info(f"Model trained successfully ({algo_name}). Accuracy: {acc:.2%}")
        return metrics

    def get_status(self) -> dict:
        """Retrieve ML model status and metadata."""
        if os.path.exists(self.model_path) and os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    cfg = json.load(f)
                return {
                    "ml_available": True,
                    "status": "Active (Using Scikit-Learn Model)",
                    "algorithm": cfg.get("algorithm", "Logistic Regression"),
                    "modelVersion": cfg.get("modelVersion", MODEL_VERSION),
                    "featureVersion": cfg.get("featureVersion", FEATURE_VERSION),
                    "datasetSize": cfg.get("datasetSize", 0),
                    "trainedAt": cfg.get("trainedAt"),
                    "accuracy": cfg.get("metrics", {}).get("accuracy", 0.0),
                    "f1_score": cfg.get("metrics", {}).get("f1_score", 0.0)
                }
            except Exception as e:
                logger.error(f"Error reading model config: {e}")

        return {
            "ml_available": False,
            "status": "Using Transparent Rule-Based Fallback (Model not trained yet)",
            "algorithm": "Rule-Based Weighted Scoring",
            "modelVersion": "None",
            "featureVersion": FEATURE_VERSION,
            "datasetSize": 0,
            "trainedAt": None,
            "accuracy": 0.0,
            "f1_score": 0.0
        }

    def get_current_metrics(self) -> dict:
        """Retrieve full metrics configuration from disk."""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error reading model metrics: {e}")
                
        return {
            "status": "Using Rule-Based Compatibility System (Model not trained yet)",
            "algorithm": "Rule-Based Weighted Scoring",
            "modelVersion": "None",
            "featureVersion": FEATURE_VERSION,
            "datasetSize": 0,
            "trainedAt": None,
            "metrics": {
                "accuracy": 0.0,
                "precision": 0.0,
                "recall": 0.0,
                "f1_score": 0.0,
                "confusion_matrix": [[0, 0], [0, 0]]
            },
            "configuration": {
                "features": FEATURE_COLUMNS,
                "threshold": MIN_DATASET_THRESHOLD
            }
        }
