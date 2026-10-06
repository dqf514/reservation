from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..branding_util import get_or_create_branding, to_public
from ..database import get_db
from ..deps import require_admin
from ..schemas import BrandingPublic, BrandingUpdate

router = APIRouter(tags=["branding"])


@router.get("/api/branding", response_model=BrandingPublic)
def get_branding(db: Session = Depends(get_db)):
    b = get_or_create_branding(db)
    return to_public(b)


@router.put("/api/admin/branding", response_model=BrandingPublic)
def update_branding(payload: BrandingUpdate, db: Session = Depends(get_db), _: object = Depends(require_admin)):
    b = get_or_create_branding(db)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(b, k, v)
    db.add(b)
    db.commit()
    db.refresh(b)
    return to_public(b)
