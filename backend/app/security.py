from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from .config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, JWT_SECRET


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(sub: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": sub, "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None
