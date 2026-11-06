from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import ROLE_SUPER, require_staff
from ..models import DiningTable, Reservation, User
from ..reservation_schema_compat import ensure_assigned_table_ids_column
from ..reservation_tables_util import parse_assigned_table_ids
from ..schemas import DiningTableCreate, DiningTableItem, DiningTableUpdate
from ..table_capacity_util import normalize_table_type
from ..table_schema_compat import ensure_table_type_column

router = APIRouter(
    prefix="/api/admin/dining-tables",
    tags=["admin-dining-tables"],
)


def _item(r: DiningTable) -> DiningTableItem:
    sh = (
        r.shape
        if r.shape in ("circle", "square", "rect_h", "rect_v")
        else "circle"
    )
    return DiningTableItem(
        id=r.id,
        code=r.code,
        label=r.label,
        shape=sh,
        pos_x=float(r.pos_x),
        pos_y=float(r.pos_y),
        pos_size=float(r.pos_size),
        sort_order=r.sort_order,
        capacity=r.capacity,
        is_active=r.is_active,
        table_type=normalize_table_type(getattr(r, "table_type", None)),
    )


@router.get("", response_model=list[DiningTableItem])
def list_dining_tables(
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    """餐位列表（含平面图坐标），供下拉与餐位管理页共用。"""
    ensure_table_type_column(db)
    rows = (
        db.query(DiningTable)
        .order_by(DiningTable.sort_order, DiningTable.id)
        .all()
    )
    return [_item(r) for r in rows]


@router.post("", response_model=DiningTableItem)
def create_dining_table(
    body: DiningTableCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_table_type_column(db)
    code = body.code.strip()
    if db.query(DiningTable).filter(DiningTable.code == code).first():
        raise HTTPException(status_code=400, detail="桌台编号已存在")
    t = DiningTable(
        code=code,
        label=body.label.strip(),
        shape=body.shape,
        pos_x=body.pos_x,
        pos_y=body.pos_y,
        pos_size=body.pos_size,
        sort_order=body.sort_order,
        capacity=body.capacity,
        is_active=body.is_active,
        table_type=normalize_table_type(body.table_type),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _item(t)


@router.patch("/{table_id}", response_model=DiningTableItem)
def update_dining_table(
    table_id: int,
    body: DiningTableUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    ensure_table_type_column(db)
    t = db.get(DiningTable, table_id)
    if not t:
        raise HTTPException(status_code=404, detail="桌台不存在")
    data = body.model_dump(exclude_unset=True)
    layout_keys = {"pos_x", "pos_y", "pos_size", "sort_order"}
    if user.role != ROLE_SUPER and any(k in data for k in layout_keys):
        raise HTTPException(
            status_code=403,
            detail="仅超级管理员可修改桌台平面布局",
        )
    if "code" in data and data["code"] is not None:
        code = str(data["code"]).strip()
        dup = (
            db.query(DiningTable)
            .filter(DiningTable.code == code, DiningTable.id != table_id)
            .first()
        )
        if dup:
            raise HTTPException(status_code=400, detail="桌台编号已存在")
        t.code = code
    if "label" in data and data["label"] is not None:
        t.label = str(data["label"]).strip()
    if "shape" in data and data["shape"] is not None:
        t.shape = data["shape"]
    if "pos_x" in data and data["pos_x"] is not None:
        t.pos_x = float(data["pos_x"])
    if "pos_y" in data and data["pos_y"] is not None:
        t.pos_y = float(data["pos_y"])
    if "pos_size" in data and data["pos_size"] is not None:
        t.pos_size = float(data["pos_size"])
    if "sort_order" in data and data["sort_order"] is not None:
        t.sort_order = int(data["sort_order"])
    if "capacity" in data and data["capacity"] is not None:
        t.capacity = int(data["capacity"])
    if "is_active" in data and data["is_active"] is not None:
        t.is_active = bool(data["is_active"])
    if "table_type" in data and data["table_type"] is not None:
        t.table_type = normalize_table_type(data["table_type"])
    db.add(t)
    db.commit()
    db.refresh(t)
    return _item(t)


@router.delete("/{table_id}")
def delete_dining_table(
    table_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    ensure_assigned_table_ids_column(db)
    t = db.get(DiningTable, table_id)
    if not t:
        raise HTTPException(status_code=404, detail="桌台不存在")
    ref = 0
    rows = db.query(Reservation).all()
    for row in rows:
        if table_id in parse_assigned_table_ids(row):
            ref += 1
    if ref > 0:
        raise HTTPException(
            status_code=400,
            detail=f"仍有 {ref} 条预订关联此餐位，无法删除。可将餐位改为停用，或先在预订中解除分配。",
        )
    db.delete(t)
    db.commit()
    return {"ok": True}
