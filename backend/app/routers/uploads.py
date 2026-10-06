import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..config import ALLOWED_EXT, ALLOWED_FAVICON, MAX_UPLOAD_MB, UPLOAD_DIR
from ..deps import require_admin

router = APIRouter(prefix="/api/admin", tags=["uploads"])


@router.post("/uploads")
def upload_asset(
    kind: str = Form(...),
    file: UploadFile = File(...),
    _: object = Depends(require_admin),
):
    allowed_kinds = {"logo", "login_bg", "splash", "favicon", "promotion"}
    if kind not in allowed_kinds:
        raise HTTPException(status_code=400, detail="不支持的资源类型")

    suffix = Path(file.filename or "").suffix.lower()
    exts = ALLOWED_FAVICON if kind == "favicon" else ALLOWED_EXT
    if suffix not in exts:
        raise HTTPException(status_code=400, detail="仅支持常见图片格式")

    name = f"{uuid.uuid4().hex}{suffix}"
    dest = UPLOAD_DIR / name

    size = 0
    with dest.open("wb") as buf:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_MB * 1024 * 1024:
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=400,
                    detail=f"文件过大（上限 {MAX_UPLOAD_MB}MB）",
                )
            buf.write(chunk)

    return {"filename": name, "url": f"/uploads/{name}", "kind": kind}
