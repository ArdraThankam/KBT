"""Settings. Everything comes from the .env file (see .env.example); nothing secret lives in code."""
import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def _identifiers(name, default):
    """A comma-separated list of column names. Only plain identifiers are accepted (they go into SQL)."""
    cols = [c.strip() for c in os.getenv(name, default).split(",") if c.strip()]
    for c in cols:
        if not re.fullmatch(r"[A-Za-z0-9_]+", c):
            raise ValueError(f"{name}: '{c}' is not a valid column name")
    return cols


DB = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USERNAME", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_DATABASE", "kbt_new_db"),
}

APP_HOST = os.getenv("APP_HOST", "127.0.0.1")   # 127.0.0.1 = only this computer can open the app
APP_PORT = int(os.getenv("APP_PORT", "8000"))
APP_DEBUG = _bool("APP_DEBUG", False)

LUXURY_THRESHOLD_SQM = float(os.getenv("LUXURY_THRESHOLD_SQM", "300"))
LUXURY_AREA_COLUMNS = _identifiers("LUXURY_AREA_COLUMNS", "appln_PA_cnstrcted_res,appln_PA_cnstrcted_other")
STATE_SL = int(os.getenv("STATE_SL", "16"))
SHOW_PII = _bool("SHOW_PII", False)

SITE = {"title": "Enterprise Platform"}
_name = os.getenv("USER_NAME", "Demo User").strip() or "Demo User"
USER = {
    "name": _name,
    "initials": "".join(w[0] for w in _name.split()[:3]).upper(),
    "email": os.getenv("USER_EMAIL", "demo@example.com"),
}

LABELS = json.loads((BASE_DIR / "labels.json").read_text(encoding="utf-8"))
MENU = json.loads((BASE_DIR / "menu.json").read_text(encoding="utf-8"))
