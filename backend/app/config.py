import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_default_sqlite = f"sqlite:///{(DATA_DIR / 'app.db').as_posix()}"
DATABASE_URL = os.environ.get("DATABASE_URL", _default_sqlite)

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-jwt-secret-please-change")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

ALLOWED_ORIGINS = [
    "http://127.0.0.1:3333",
    "http://localhost:3333",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
]

MAX_UPLOAD_MB = 8
ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
ALLOWED_FAVICON = ALLOWED_EXT | {".ico"}

# 欣欣云短信（可选；亦可在后台「短信通知」中配置）
SMS_XINXINYUN_SP_ID = os.environ.get("SMS_XINXINYUN_SP_ID", "").strip()
SMS_XINXINYUN_PASSWORD_MD5 = os.environ.get("SMS_XINXINYUN_PASSWORD_MD5", "").strip()
