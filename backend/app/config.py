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

# 生产环境必须通过环境变量覆盖 JWT_SECRET（否则任何人可伪造登录令牌）
IS_DEFAULT_JWT_SECRET = JWT_SECRET == "dev-jwt-secret-please-change"

# 允许跨域的来源（前后端同源部署时用不到；可用环境变量覆盖）
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        ",".join(
            [
                "https://tff.tsaopc.cn",
                "http://127.0.0.1:3333",
                "http://localhost:3333",
                "http://127.0.0.1:5173",
                "http://localhost:5173",
                "http://127.0.0.1:4173",
                "http://localhost:4173",
            ]
        ),
    ).split(",")
    if o.strip()
]

MAX_UPLOAD_MB = 8
ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
ALLOWED_FAVICON = ALLOWED_EXT | {".ico"}

# 欣欣云短信（可选；亦可在后台「短信通知」中配置）
SMS_XINXINYUN_SP_ID = os.environ.get("SMS_XINXINYUN_SP_ID", "").strip()
SMS_XINXINYUN_PASSWORD_MD5 = os.environ.get("SMS_XINXINYUN_PASSWORD_MD5", "").strip()
