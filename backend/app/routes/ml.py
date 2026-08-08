from fastapi import APIRouter, Depends, HTTPException, status
from app.routes.auth import get_current_user
from app.services.ml_service import MLService
from app.services.matching_service import MatchingService

router = APIRouter(prefix="/ml", tags=["Machine Learning"])

@router.post("/train", response_model=dict)
async def train_buddy_matching_model(
    current_user: dict = Depends(get_current_user),
    ml_service: MLService = Depends(),
    matching_service: MatchingService = Depends()
):
    """
    Train a scikit-learn Logistic Regression model on connection interaction datasets.
    Stores Pickle binary and returns model metrics.
    """
    try:
        metrics = await ml_service.train_model()
        # Reload matching service model in memory
        matching_service.reload_model()
        return {
            "status": "success",
            "message": "Model trained and reloaded successfully.",
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to train model: {str(e)}"
        )

@router.get("/metrics", response_model=dict)
async def get_matching_model_metrics(
    current_user: dict = Depends(get_current_user),
    ml_service: MLService = Depends()
):
    """Retrieve validation metrics of the current matching model from disk."""
    metrics = ml_service.get_current_metrics()
    return metrics
