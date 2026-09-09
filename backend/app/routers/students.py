from fastapi import APIRouter, HTTPException
from app.models.schemas import StudentCreate, StudentOut
from app.services.db_service import get_db

router = APIRouter(prefix="/students", tags=["Students"])


@router.post("", status_code=201)
async def create_student(payload: StudentCreate):
    db = get_db()
    insert_data = {
        "name": payload.name,
        "class_section": payload.class_section,
    }
    if payload.age_years is not None:
        insert_data["age_years"] = payload.age_years

    result = db.table("students").insert(insert_data).execute()
    if not result.data:
        raise HTTPException(500, "Failed to create student record")
    return result.data[0]


@router.get("", response_model=list[dict])
async def list_students():
    db = get_db()
    result = db.table("students").select("*").order("created_at", desc=True).execute()
    return result.data or []


@router.get("/{student_id}")
async def get_student(student_id: str):
    db = get_db()
    student = db.table("students").select("*").eq("id", student_id).execute()
    if not student.data:
        raise HTTPException(404, "Student not found")
    scans = db.table("scans").select("*").eq("student_id", student_id)\
               .order("created_at", desc=True).execute()
    return {**student.data[0], "scans": scans.data or []}
