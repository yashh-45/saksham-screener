from fastapi import APIRouter
from app.services import model_service

router = APIRouter(prefix="/model", tags=["Model"])


@router.get("/validation-stats")
async def validation_stats():
    """
    Returns the model's real, held-out validation metrics.
    Surfacing this endpoint fulfils the transparency requirement from the project brief.
    """
    meta = model_service.get_metadata()
    return {
        "version":             meta.get("version"),
        "backbone":            meta.get("backbone"),
        "dataset_description": meta.get("dataset_description"),
        "train_samples_used":  meta.get("train_samples_used"),
        "test_samples_used":   meta.get("test_samples_used"),
        "validation_accuracy": meta.get("validation_accuracy"),
        "per_class_metrics":   meta.get("per_class_metrics"),
        "training_notes":      meta.get("training_notes"),
        "trained_at":          meta.get("trained_at"),
    }
