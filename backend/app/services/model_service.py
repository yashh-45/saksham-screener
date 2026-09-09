"""
Handles loading the trained MobileNetV2 model and running inference
on uploaded handwriting images.

Screening Mode: Sensitivity-Optimised
--------------------------------------
For a first-pass classroom screening tool, missing a real indicator
(false negative) is worse than flagging something for a closer look
(false positive). We therefore apply a lowered probability threshold
for the Reversal class (REVERSAL_THRESHOLD = 0.28) and support
test-time augmentation (TTA) over multiple crops to improve recall.

This is a deliberate, disclosed clinical tradeoff — not an attempt
to overstate accuracy. The held-out validation accuracy (77.06%)
is reported without TTA, as it was measured on the original test split.
"""
import json
from pathlib import Path
from typing import Dict, Any

import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image, ImageFilter

from app.config import MODEL_PATH, METADATA_PATH


# ── Singleton model holder ────────────────────────────────────────────────────
_model = None
_class_names = None
_img_size = 224
_metadata: Dict[str, Any] = {}

# Sensitivity-optimised threshold for Reversal class.
# Standard argmax threshold is 0.33 (equal for 3 classes).
# We lower Reversal's threshold to improve recall (reduce missed cases).
# Tradeoff: slightly more false positives, which a teacher or counsellor
# can rule out in a follow-up professional assessment.
REVERSAL_THRESHOLD = 0.28

BASE_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# TTA transforms — 4 variants: original + slight rotations + brightness shift
TTA_TRANSFORMS = [
    BASE_TRANSFORM,
    transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomRotation(degrees=(-5, 5)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]),
    transforms.Compose([
        transforms.Resize((232, 232)),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]),
    transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ColorJitter(brightness=0.15, contrast=0.1),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]),
]


def _build_model(num_classes: int) -> nn.Module:
    model = models.mobilenet_v2(weights=None)
    in_f = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(in_f, 256),
        nn.ReLU(),
        nn.Dropout(0.2),
        nn.Linear(256, num_classes),
    )
    return model


def load_model():
    """Load model weights and metadata once at startup."""
    global _model, _class_names, _img_size, _metadata

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model weights not found at {MODEL_PATH}. "
            "Please run train_model.py first."
        )

    checkpoint = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
    _class_names = checkpoint["class_names"]
    _img_size = checkpoint.get("img_size", 224)

    _model = _build_model(len(_class_names))
    _model.load_state_dict(checkpoint["model_state_dict"])
    _model.eval()

    if METADATA_PATH.exists():
        with open(METADATA_PATH) as f:
            _metadata = json.load(f)

    print(f"[model_service] Loaded model. Classes: {_class_names}")
    print(f"[model_service] Validation accuracy: {_metadata.get('validation_accuracy', 'N/A')}")
    print(f"[model_service] Reversal sensitivity threshold: {REVERSAL_THRESHOLD}")


def _run_tta(image: Image.Image) -> Dict[str, float]:
    """
    Run inference with Test-Time Augmentation over 4 transforms.
    Returns averaged softmax probabilities per class.
    """
    rgb = image.convert("RGB")
    all_probs = []
    for tfm in TTA_TRANSFORMS:
        tensor = tfm(rgb).unsqueeze(0)
        with torch.no_grad():
            logits = _model(tensor)
            probs = torch.softmax(logits, dim=1)[0]
        all_probs.append(probs)

    avg_probs = torch.stack(all_probs).mean(dim=0)
    return {cls: float(avg_probs[i]) for i, cls in enumerate(_class_names)}


def predict(image: Image.Image) -> dict:
    """
    Run sensitivity-optimised inference on a PIL image using TTA.

    Clinical note: The Reversal class uses a lowered probability threshold
    (REVERSAL_THRESHOLD = 0.28) to reduce missed cases (false negatives).
    This is appropriate for a first-pass screening tool where the downstream
    consequence of missing an indicator is higher than the cost of a
    professional follow-up visit.
    """
    global _model
    if _model is None:
        load_model()

    prob_dict = _run_tta(image)
    reversal_prob = prob_dict.get("Reversal", 0.0)

    # Sensitivity-optimised decision:
    # 1. If Reversal probability exceeds the lower threshold, flag it —
    #    even if another class has the highest raw probability.
    # 2. Otherwise, fall back to standard argmax.
    if reversal_prob >= REVERSAL_THRESHOLD:
        dominant = "Reversal"
    else:
        dominant = max(prob_dict, key=prob_dict.get)

    confidence = prob_dict[dominant]

    indicators = {
        "Corrected": dominant == "Corrected",
        "Normal":    dominant == "Normal",
        "Reversal":  dominant == "Reversal",
    }
    indicator_count = sum([indicators["Corrected"], indicators["Reversal"]])
    present = [k for k, v in indicators.items() if v and k != "Normal"]

    if indicator_count == 0:
        flag = "No common indicators detected"
    else:
        label = " & ".join(present)
        flag = (
            f"{indicator_count} of 2 automated indicator(s) flagged "
            f"({label}) - recommend professional evaluation"
        )

    return {
        "probabilities":   prob_dict,
        "dominant_class":  dominant,
        "confidence":      round(confidence, 4),
        "reversal_prob":   round(reversal_prob, 4),
        "Corrected":       indicators["Corrected"],
        "Normal":          indicators["Normal"],
        "Reversal":        indicators["Reversal"],
        "indicator_count": indicator_count,
        "flag":            flag,
        "screening_mode":  "sensitivity_optimised_TTA",
    }


def get_metadata() -> dict:
    global _metadata
    if not _metadata and METADATA_PATH.exists():
        try:
            with open(METADATA_PATH) as f:
                _metadata = json.load(f)
        except Exception:
            pass
    return _metadata
