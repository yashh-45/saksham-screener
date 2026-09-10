from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime


class StudentCreate(BaseModel):
    name: str
    class_section: str
    age_years: Optional[int] = Field(None, ge=1, le=120, description="Student age in years")


class StudentOut(BaseModel):
    id: str
    name: str
    class_section: str
    age_years: Optional[int] = None
    created_at: str


class IndicatorResult(BaseModel):
    # ML-detected indicators
    Corrected: bool          # Over-correction / excessive rewriting
    Normal: bool             # No significant ML-detected indicator
    Reversal: bool           # Letter reversal (b/d, p/q) — sensitivity-optimised
    dominant_class: str
    confidence: float
    reversal_prob: float     # Raw probability for Reversal class (for transparency)
    indicator_count: int     # Count of ML-detected indicators (0–2)
    flag: str
    screening_mode: str      # e.g. "sensitivity_optimised_TTA"
    # Teacher-observed manual indicators (3 additional from §10 of brief)
    manual_irregular_spacing: Optional[bool] = None
    manual_baseline_drift: Optional[bool] = None
    manual_inconsistent_sizing: Optional[bool] = None
    total_indicator_count: Optional[int] = None   # ML + manual combined


class ScanOut(BaseModel):
    id: str
    student_id: str
    image_url: Optional[str]
    indicators_found: dict
    indicator_count: int
    created_at: str


class ValidationStats(BaseModel):
    version: str
    backbone: str
    dataset_description: str
    train_samples_used: int
    test_samples_used: int
    validation_accuracy: float
    per_class_metrics: Dict
    training_notes: str
    trained_at: str
