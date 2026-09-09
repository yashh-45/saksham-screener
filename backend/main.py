from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.services import model_service
from app.routers import students, scans, model_info


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        model_service.load_model()
    except Exception as e:
        print(f"[backend] Model not yet loaded at startup ({e}). Will load on demand.")
    yield

app = FastAPI(
    title="Saksham API",
    description=(
        "Early learning-difficulty screening API. "
        "Analyses handwriting samples for common visual indicators of dyslexia. "
        "This is a screening tool, not a diagnostic instrument."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students.router)
app.include_router(scans.router)
app.include_router(model_info.router)


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "Saksham",
        "status": "ok",
        "note": "Screening tool only — not a clinical diagnostic instrument.",
    }
