import os
import pickle
import json
import logging
import random
from datetime import datetime
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

from app.config.db import get_database
from app.utils.db_helpers import serialize_doc, serialize_docs

logger = logging.getLogger(__name__)

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

    async def seed_mock_interactions(self, force=False):
        """Seed 100 mock interaction records to train the model immediately."""
        count = await self.collection.count_documents({})
        if count > 0 and not force:
            logger.info("match_interactions collection already seeded.")
            return

        logger.info("Seeding 100 mock match interactions for model bootstrapping...")
        records = []
        now = datetime.utcnow()

        # Seed 50 positive matches (high overlap, accepted requests)
        for i in range(50):
            records.append({
                "sender_id": f"se_pos_{i}",
                "receiver_id": f"re_pos_{i}",
                "trip_id": f"tr_pos_{i}",
                "destination_similarity": 1.0 if random.random() > 0.1 else 0.0,
                "date_overlap_ratio": float(random.uniform(0.6, 1.0)),
                "interest_similarity": float(random.uniform(0.5, 0.9)),
                "budget_similarity": float(random.choice([0.66, 1.0])),
                "style_similarity": float(random.uniform(0.4, 0.8)),
                "activity_similarity": float(random.uniform(0.5, 0.9)),
                "label": 1,
                "status": "accepted",
                "created_at": now
            })

        # Seed 50 negative matches (low overlap, rejected/unresponsive requests)
        for i in range(50):
            records.append({
                "sender_id": f"se_neg_{i}",
                "receiver_id": f"re_neg_{i}",
                "trip_id": f"tr_neg_{i}",
                "destination_similarity": 1.0 if random.random() > 0.85 else 0.0,
                "date_overlap_ratio": float(random.uniform(0.0, 0.3)),
                "interest_similarity": float(random.uniform(0.0, 0.35)),
                "budget_similarity": float(random.choice([0.0, 0.33])),
                "style_similarity": float(random.uniform(0.0, 0.3)),
                "activity_similarity": float(random.uniform(0.0, 0.4)),
                "label": 0,
                "status": "rejected",
                "created_at": now
            })

        await self.collection.insert_many(records)
        logger.info("Successfully seeded 100 interaction records.")

    async def log_interaction(self, sender_id: str, receiver_id: str, trip_id: str, features: dict, status: str, label: int):
        """Create or update traveler matching request interactions."""
        now = datetime.utcnow()
        doc = {
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "trip_id": trip_id,
            "destination_similarity": float(features.get("destination_similarity", 0.0)),
            "date_overlap_ratio": float(features.get("date_overlap_ratio", 0.0)),
            "interest_similarity": float(features.get("interest_similarity", 0.0)),
            "budget_similarity": float(features.get("budget_similarity", 0.0)),
            "style_similarity": float(features.get("style_similarity", 0.0)),
            "activity_similarity": float(features.get("activity_similarity", 0.0)),
            "label": int(label),
            "status": status,
            "updated_at": now
        }
        await self.collection.update_one(
            {"sender_id": sender_id, "receiver_id": receiver_id, "trip_id": trip_id},
            {"$set": doc, "$setOnInsert": {"created_at": now}},
            upsert=True
        )

    async def train_model(self) -> dict:
        """Query interaction history, train scikit-learn Logistic Regression, and pickle the model."""
        # Seeding fallback check
        await self.seed_mock_interactions()

        cursor = self.collection.find({})
        docs = await cursor.to_list(length=5000)
        
        if len(docs) < 10:
            raise ValueError(f"Insufficient training samples. Found {len(docs)} records, need at least 10.")

        # Convert to pandas DataFrame
        df = pd.DataFrame(serialize_docs(docs))

        feature_cols = [
            "destination_similarity",
            "date_overlap_ratio",
            "interest_similarity",
            "budget_similarity",
            "style_similarity",
            "activity_similarity"
        ]

        x = df[feature_cols].values
        y = df["label"].values.astype(int)

        # Train/Test Split (80/20)
        x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)

        # Train Logistic Regression
        model = LogisticRegression(solver='liblinear')
        model.fit(x_train, y_train)

        # Evaluate
        predictions = model.predict(x_test)
        acc = accuracy_score(y_test, predictions)
        prec = precision_score(y_test, predictions, zero_division=0)
        rec = recall_score(y_test, predictions, zero_division=0)
        f1 = f1_score(y_test, predictions, zero_division=0)
        cm = confusion_matrix(y_test, predictions)

        # Serialize trained model to disk
        with open(self.model_path, "wb") as f:
            pickle.dump(model, f)

        # Prepare config and metrics log
        metrics = {
            "model_type": "Logistic Regression Classifier",
            "trained_at": datetime.utcnow().isoformat(),
            "samples_count": len(df),
            "accuracy": float(acc),
            "precision": float(prec),
            "recall": float(rec),
            "f1_score": float(f1),
            "confusion_matrix": cm.tolist()
        }

        with open(self.config_path, "w") as f:
            json.dump(metrics, f, indent=2)

        logger.info(f"Model trained successfully. Accuracy: {acc:.2f}")
        return metrics

    def get_current_metrics(self) -> dict:
        """Retrieve metrics configuration from disk."""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error reading model config: {e}")
        return {
            "model_type": "None",
            "status": "Using Rule-Based Fallback System (Model not trained yet)",
            "accuracy": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "f1_score": 0.0
        }
