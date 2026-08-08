from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from pydantic import BaseModel

from app.routes.auth import get_current_user
from app.services.ml_service import MLService
from app.services.matching_service import MatchingService

router = APIRouter(prefix="/ml", tags=["Machine Learning"])

class TrainRequest(BaseModel):
    algorithm: Optional[str] = "logistic_regression" # or "random_forest"

@router.post("/train", response_model=dict)
async def train_buddy_matching_model(
    payload: Optional[TrainRequest] = None,
    current_user: dict = Depends(get_current_user),
    ml_service: MLService = Depends(),
    matching_service: MatchingService = Depends()
):
    """
    Train a scikit-learn model (Logistic Regression or Random Forest) on traveler connection interaction dataset.
    Stores model pickle, logs evaluation metrics (accuracy, precision, recall, f1, confusion matrix),
    and updates model versioning.
    """
    algo = payload.algorithm if payload and payload.algorithm else "logistic_regression"
    try:
        metrics = await ml_service.train_model(algorithm=algo)
        # Reload matching service model in memory
        matching_service.reload_model()
        return {
            "status": "success",
            "message": f"ML model ({metrics.get('algorithm')}) trained and reloaded successfully.",
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to train model: {str(e)}"
        )

@router.get("/status", response_model=dict)
async def get_ml_status(
    current_user: dict = Depends(get_current_user),
    ml_service: MLService = Depends()
):
    """
    Check if ML model is active, trained model version, algorithm, dataset size, and timestamp.
    """
    status_info = ml_service.get_status()
    return status_info

@router.get("/metrics", response_model=dict)
async def get_matching_model_metrics(
    current_user: dict = Depends(get_current_user),
    ml_service: MLService = Depends()
):
    """
    Retrieve validation metrics and evaluation confusion matrix of current matching model from disk.
    """
    metrics = ml_service.get_current_metrics()
    return metrics
