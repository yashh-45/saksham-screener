import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL  = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY", "")

# Resolve paths relative to the backend/ directory so the project works
# on any machine after a fresh git clone, without editing .env.
_BACKEND_DIR  = Path(__file__).resolve().parent.parent          # .../backend/
_REPO_ROOT    = _BACKEND_DIR.parent                              # .../saksham/

_raw_model    = os.getenv("MODEL_PATH", "../model_output/saksham_model.pth")
_raw_meta     = os.getenv("METADATA_PATH", "../model_output/model_metadata.json")

MODEL_PATH    = Path(_raw_model) if Path(_raw_model).is_absolute() else (_BACKEND_DIR / _raw_model).resolve()
METADATA_PATH = Path(_raw_meta)  if Path(_raw_meta).is_absolute()  else (_BACKEND_DIR / _raw_meta).resolve()
