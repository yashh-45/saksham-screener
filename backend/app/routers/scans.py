import uuid
import io
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from PIL import Image
from typing import Optional

from app.services import model_service, pdf_service
from app.services.db_service import get_db

router = APIRouter(tags=["Scans"])

MIN_IMAGE_DIMENSION = 32      # Reject images smaller than 32x32 (clearly not photos)
MAX_IMAGE_SIZE_MB   = 20      # Reject files over 20 MB


@router.post("/students/{student_id}/scans", status_code=201)
async def upload_scan(
    student_id: str,
    file: UploadFile = File(...),
    manual_irregular_spacing: Optional[bool]    = Form(None),
    manual_baseline_drift: Optional[bool]       = Form(None),
    manual_inconsistent_sizing: Optional[bool]  = Form(None),
):
    """
    Upload a handwriting image for a student and run screening analysis.

    In addition to automated ML inference (letter reversals + over-correction),
    the teacher can optionally submit three manually-observed indicators:
    - manual_irregular_spacing: uneven gaps between letters/words
    - manual_baseline_drift: text wandering above/below the ruled line
    - manual_inconsistent_sizing: erratic variation in letter heights

    This provides coverage of all five indicator categories described in §10
    of the project brief, not just the two that the CNN can reliably automate.
    """
    db = get_db()

    # ── Verify student exists or create on demand ─────────────────────────────
    student = db.table("students").select("*").eq("id", student_id).execute()
    if not student.data:
        student = db.table("students").insert({
            "id": student_id,
            "name": "Screening Student",
            "class_section": "Class 3-B",
        }).execute()

    # ── Validate file type ────────────────────────────────────────────────────
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
        raise HTTPException(400, "Only JPEG, PNG, or WebP images are accepted")

    img_bytes = await file.read()

    # ── Validate file size ────────────────────────────────────────────────────
    if len(img_bytes) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"Image must be under {MAX_IMAGE_SIZE_MB} MB")

    # ── Open and validate image dimensions ───────────────────────────────────
    try:
        image = Image.open(io.BytesIO(img_bytes))
        w, h = image.size
    except Exception:
        raise HTTPException(400, "Could not decode image. Please upload a valid image file.")

    if w < MIN_IMAGE_DIMENSION or h < MIN_IMAGE_DIMENSION:
        raise HTTPException(
            400,
            f"Image is too small ({w}x{h}px). Please upload a clear photo or scan of the handwriting sample."
        )

    # ── Basic content sanity check ────────────────────────────────────────────
    # Check image is not entirely blank (all-white or all-black)
    import numpy as np
    arr = np.array(image.convert("L"))
    std_dev = float(arr.std())
    if std_dev < 3.0:
        raise HTTPException(
            400,
            "The uploaded image appears to be blank or nearly uniform. "
            "Please upload a handwriting sample with visible ink on paper."
        )

    # ── Run ML inference ──────────────────────────────────────────────────────
    result = model_service.predict(image)

    # ── Combine ML + manual indicators ───────────────────────────────────────
    manual_flags = [
        manual_irregular_spacing,
        manual_baseline_drift,
        manual_inconsistent_sizing,
    ]
    manual_count = sum(1 for f in manual_flags if f is True)
    total_indicator_count = result["indicator_count"] + manual_count

    indicators_found = {
        # ML-detected
        "Corrected":              result["Corrected"],
        "Normal":                 result["Normal"],
        "Reversal":               result["Reversal"],
        "dominant_class":         result["dominant_class"],
        "confidence":             result["confidence"],
        "reversal_prob":          result["reversal_prob"],
        "indicator_count":        result["indicator_count"],
        "flag":                   result["flag"],
        "screening_mode":         result["screening_mode"],
        # Teacher-observed
        "manual_irregular_spacing":   manual_irregular_spacing,
        "manual_baseline_drift":      manual_baseline_drift,
        "manual_inconsistent_sizing": manual_inconsistent_sizing,
        "manual_indicator_count":     manual_count,
        "total_indicator_count":      total_indicator_count,
    }

    # ── Upgrade summary flag if manual indicators are also present ────────────
    if total_indicator_count == 0:
        indicators_found["summary_flag"] = "No indicators detected (automated or teacher-observed)"
    else:
        parts = []
        if result["indicator_count"] > 0:
            parts.append(result["flag"])
        if manual_count > 0:
            manual_names = []
            if manual_irregular_spacing:  manual_names.append("irregular spacing")
            if manual_baseline_drift:     manual_names.append("baseline drift")
            if manual_inconsistent_sizing: manual_names.append("inconsistent letter sizing")
            parts.append(f"{manual_count} teacher-observed indicator(s): {', '.join(manual_names)}")
        indicators_found["summary_flag"] = " | ".join(parts)

    # ── Store scan ────────────────────────────────────────────────────────────
    scan_id = str(uuid.uuid4())
    db.table("scans").insert({
        "id":               scan_id,
        "student_id":       student_id,
        "image_url":        None,
        "indicators_found": indicators_found,
        "indicator_count":  total_indicator_count,
    }).execute()

    return {
        "scan_id":          scan_id,
        "student_id":       student_id,
        "indicators_found": indicators_found,
    }


@router.get("/scans/{scan_id}")
async def get_scan(scan_id: str):
    db = get_db()
    result = db.table("scans").select("*").eq("id", scan_id).execute()
    if not result.data:
        raise HTTPException(404, "Scan not found")
    return result.data[0]


@router.get("/scans/{scan_id}/report")
async def download_report(scan_id: str):
    db = get_db()

    scan = db.table("scans").select("*").eq("id", scan_id).execute()
    if not scan.data:
        raise HTTPException(404, "Scan not found")
    scan_data = scan.data[0]

    student = db.table("students").select("*").eq("id", scan_data["student_id"]).execute()
    if not student.data:
        raise HTTPException(404, "Student not found")
    student_data = student.data[0]

    meta = model_service.get_metadata()
    pdf_bytes = pdf_service.generate_report(
        student_name=student_data["name"],
        class_section=student_data["class_section"],
        student_age=student_data.get("age_years"),
        scan_id=scan_id,
        indicators=scan_data["indicators_found"],
        validation_accuracy=meta.get("validation_accuracy", 0.0),
        dataset_description=meta.get("dataset_description", ""),
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="saksham_report_{scan_id[:8]}.pdf"'},
    )
