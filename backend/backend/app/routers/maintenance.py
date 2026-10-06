from __future__ import annotations

import csv
import io
import shutil
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..config import BASE_DIR, DATA_DIR
from ..database import get_db
from ..deps import require_admin
from ..models import (
    BackupPlanSettings,
    Customer,
    Deposit,
    DiningTable,
    Reservation,
)
from ..reservation_schema_compat import ensure_assigned_table_ids_column
from ..reservation_tables_util import (
    parse_assigned_table_ids,
    set_assigned_table_ids,
)
from ..log_util import write_operation_log

router = APIRouter(prefix="/api/admin/maintenance", tags=["maintenance"])


def _backup_db_file() -> tuple[Path, Path]:
    src = DATA_DIR / "app.db"
    if not src.exists():
        raise HTTPException(status_code=500, detail="数据库文件不存在，无法备份")
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = BASE_DIR / f"app-backup-{stamp}.db"
    shutil.copy2(src, dst)
    return src, dst


def _list_backup_files() -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    files = sorted(
        [p for p in BASE_DIR.glob("*.db") if p.is_file()],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for p in files:
        name = p.name
        if not (name.startswith("app-backup-") or name.startswith("restore-")):
            continue
        st = p.stat()
        out.append(
            {
                "filename": name,
                "size_bytes": int(st.st_size),
                "modified_at": datetime.fromtimestamp(st.st_mtime).strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
            }
        )
    return out


def _get_or_create_backup_plan(db: Session) -> BackupPlanSettings:
    row = db.get(BackupPlanSettings, 1)
    if row:
        return row
    row = BackupPlanSettings(id=1)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _restore_db_from_path(src_path: Path) -> str:
    if not src_path.exists():
        raise HTTPException(status_code=404, detail="备份文件不存在")
    if src_path.suffix.lower() != ".db":
        raise HTTPException(status_code=400, detail="仅支持 .db 文件")
    if src_path.resolve() == (DATA_DIR / "app.db").resolve():
        raise HTTPException(status_code=400, detail="不能用当前数据库自身进行恢复")
    dst = DATA_DIR / "app.db"
    shutil.copy2(src_path, dst)
    return str(dst)


def _csv_response(
    filename: str,
    rows: list[dict[str, object]],
) -> StreamingResponse:
    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    else:
        buf.write("")
    data = buf.getvalue().encode("utf-8-sig")
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _read_csv(file: UploadFile) -> list[dict[str, str]]:
    raw = file.file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as ex:
        raise HTTPException(status_code=400, detail="CSV 编码需为 UTF-8") from ex
    sio = io.StringIO(text)
    reader = csv.DictReader(sio)
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV 缺少表头")
    rows: list[dict[str, str]] = []
    for row in reader:
        clean: dict[str, str] = {}
        for k, v in row.items():
            key = str(k or "").strip()
            if not key:
                continue
            clean[key] = str(v or "").strip()
        if any(clean.values()):
            rows.append(clean)
    return rows


def _parse_int(value: str, field: str, line_no: int) -> int:
    try:
        return int(value)
    except ValueError as ex:
        raise HTTPException(
            status_code=400,
            detail=f"第 {line_no} 行字段 {field} 需为整数",
        ) from ex


def _normalize_table_codes(raw: str) -> list[str]:
    s = raw.replace("，", ",").replace("、", ",")
    parts = [x.strip() for x in s.split(",") if x.strip()]
    return list(dict.fromkeys(parts))


@router.post("/clear-reservations")
def clear_all_reservations(
    db: Session = Depends(get_db),
    user: object = Depends(require_admin),
):
    """
    清空业务测试数据：订金、预订、客户档案。
    保留：管理员账号、品牌设置、桌台布局与上传文件。
    """
    _, backup_path = _backup_db_file()
    d_dep = db.execute(delete(Deposit))
    d_res = db.execute(delete(Reservation))
    d_cus = db.execute(delete(Customer))
    db.commit()
    write_operation_log(
        db,
        actor=user,
        category="maintenance",
        action="clear_business_data",
        entity="db",
        entity_id=None,
        detail={"backup_file": str(backup_path.name)},
    )
    return {
        "deleted_deposits": int(d_dep.rowcount or 0),
        "deleted_reservations": int(d_res.rowcount or 0),
        "deleted_customers": int(d_cus.rowcount or 0),
        "backup_file": str(backup_path.name),
        "message": "已备份数据库并清空订金、预订与客户档案（桌台与品牌设置已保留）",
    }


@router.post("/backup-db")
def backup_database(
    db: Session = Depends(get_db),
    user: object = Depends(require_admin),
):
    _, backup_path = _backup_db_file()
    write_operation_log(
        db,
        actor=user,
        category="maintenance",
        action="backup_db",
        entity="db",
        entity_id=None,
        detail={"backup_file": str(backup_path.name)},
    )
    return {
        "ok": True,
        "backup_file": backup_path.name,
        "backup_path": str(backup_path),
        "message": "数据库已备份",
    }


@router.get("/backups")
def list_backups(
    _: object = Depends(require_admin),
):
    return {"items": _list_backup_files()}


@router.get("/backups/download")
def download_backup(
    filename: str = Query(..., min_length=1),
    _: object = Depends(require_admin),
):
    name = filename.strip()
    if "/" in name or "\\" in name or ".." in name:
        raise HTTPException(status_code=400, detail="文件名不合法")
    target = BASE_DIR / name
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="备份文件不存在")
    return FileResponse(
        path=str(target),
        media_type="application/octet-stream",
        filename=name,
    )


@router.post("/restore-db/from-backup")
def restore_db_from_backup(
    filename: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    user: object = Depends(require_admin),
):
    name = filename.strip()
    if "/" in name or "\\" in name or ".." in name:
        raise HTTPException(status_code=400, detail="文件名不合法")
    src = BASE_DIR / name
    if not src.exists():
        raise HTTPException(status_code=404, detail="备份文件不存在")
    # 恢复前先自动再备份一份，避免误操作
    _, before_path = _backup_db_file()
    _restore_db_from_path(src)
    write_operation_log(
        db,
        actor=user,
        category="maintenance",
        action="restore_db",
        entity="db",
        entity_id=None,
        detail={
            "from_backup": name,
            "before_backup": before_path.name,
        },
    )
    return {
        "ok": True,
        "message": "数据库已恢复到指定备份文件。请重启后端服务以确保连接刷新生效。",
        "before_backup": before_path.name,
    }


@router.post("/restore-db/upload")
def restore_db_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: object = Depends(require_admin),
):
    if not file.filename or not file.filename.lower().endswith(".db"):
        raise HTTPException(status_code=400, detail="请上传 .db 文件")
    raw = file.file.read()
    if len(raw) < 1024:
        raise HTTPException(status_code=400, detail="文件过小，疑似无效数据库")
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    saved = BASE_DIR / f"restore-upload-{stamp}.db"
    saved.write_bytes(raw)
    _, before_path = _backup_db_file()
    _restore_db_from_path(saved)
    write_operation_log(
        db,
        actor=user,
        category="maintenance",
        action="restore_db_upload",
        entity="db",
        entity_id=None,
        detail={
            "uploaded_as": saved.name,
            "before_backup": before_path.name,
        },
    )
    return {
        "ok": True,
        "message": "数据库已从上传文件恢复。请重启后端服务以确保连接刷新生效。",
        "uploaded_as": saved.name,
        "before_backup": before_path.name,
    }


@router.get("/backup-plan")
def get_backup_plan(
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    s = _get_or_create_backup_plan(db)
    return {
        "enabled": bool(s.enabled),
        "daily_time_hm": (s.daily_time_hm or "03:00").strip(),
        "keep_last": int(s.keep_last or 30),
        "last_run_date": s.last_run_date or "",
    }


@router.put("/backup-plan")
def put_backup_plan(
    payload: dict,
    db: Session = Depends(get_db),
    user: object = Depends(require_admin),
):
    s = _get_or_create_backup_plan(db)
    enabled = bool(payload.get("enabled", s.enabled))
    hm = str(payload.get("daily_time_hm", s.daily_time_hm or "03:00")).strip()
    keep_last = int(payload.get("keep_last", s.keep_last or 30))
    if not hm or len(hm) != 5 or hm.count(":") != 1:
        raise HTTPException(status_code=400, detail="时间格式应为 HH:MM")
    hh, mm = hm.split(":", 1)
    if not (hh.isdigit() and mm.isdigit()):
        raise HTTPException(status_code=400, detail="时间格式应为 HH:MM")
    h = int(hh)
    m = int(mm)
    if h < 0 or h > 23 or m < 0 or m > 59:
        raise HTTPException(status_code=400, detail="时间不合法")
    keep_last = max(1, min(keep_last, 3650))
    s.enabled = enabled
    s.daily_time_hm = f"{h:02d}:{m:02d}"
    s.keep_last = keep_last
    db.add(s)
    db.commit()
    write_operation_log(
        db,
        actor=user,
        category="maintenance",
        action="set_backup_plan",
        entity="backup_plan_settings",
        entity_id=1,
        detail={
            "enabled": enabled,
            "daily_time_hm": s.daily_time_hm,
            "keep_last": keep_last,
        },
    )
    return {
        "ok": True,
        "enabled": bool(s.enabled),
        "daily_time_hm": s.daily_time_hm,
        "keep_last": int(s.keep_last),
        "last_run_date": s.last_run_date or "",
        "message": "自动备份计划已保存",
    }


@router.get("/customers/template.csv")
def customers_template_csv(
    _: object = Depends(require_admin),
):
    rows = [
        {
            "phone": "13800000000",
            "display_name": "张三",
            "email": "demo@example.com",
            "tags": "VIP,回头客",
            "note": "偏好靠窗",
        }
    ]
    return _csv_response("customers-template.csv", rows)


@router.get("/reservations/template.csv")
def reservations_template_csv(
    _: object = Depends(require_admin),
):
    rows = [
        {
            "customer_name": "张三",
            "phone": "13800000000",
            "reservation_date": "2026-03-27",
            "time_slot": "18:30",
            "party_size": "4",
            "flow_status": "waiting",
            "tags": "生日",
            "note": "无辣",
            "booking_source": "admin",
            "assigned_table_codes": "t1,t2",
        }
    ]
    return _csv_response("reservations-template.csv", rows)


@router.get("/customers/export.csv")
def export_customers_csv(
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    rows_db = db.query(Customer).order_by(Customer.id.asc()).all()
    rows: list[dict[str, object]] = []
    for c in rows_db:
        rows.append(
            {
                "id": c.id,
                "phone": c.phone or "",
                "display_name": c.display_name or "",
                "email": c.email or "",
                "tags": c.tags or "",
                "note": c.note or "",
                "created_at": c.created_at.strftime("%Y-%m-%d %H:%M:%S")
                if c.created_at
                else "",
                "updated_at": c.updated_at.strftime("%Y-%m-%d %H:%M:%S")
                if c.updated_at
                else "",
            }
        )
    return _csv_response("customers-export.csv", rows)


@router.get("/reservations/export.csv")
def export_reservations_csv(
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    ensure_assigned_table_ids_column(db)
    table_map = {
        int(t.id): str(t.code)
        for t in db.query(DiningTable.id, DiningTable.code).all()
    }
    rows_db = db.query(Reservation).order_by(Reservation.id.asc()).all()
    rows: list[dict[str, object]] = []
    for r in rows_db:
        tids = parse_assigned_table_ids(r)
        codes = [table_map[tid] for tid in tids if tid in table_map]
        rows.append(
            {
                "id": r.id,
                "customer_name": r.customer_name or "",
                "phone": r.phone or "",
                "reservation_date": r.reservation_date or "",
                "time_slot": r.time_slot or "",
                "party_size": r.party_size,
                "flow_status": r.flow_status or "",
                "tags": r.tags or "",
                "note": r.note or "",
                "booking_source": r.booking_source or "",
                "assigned_table_codes": ",".join(codes),
                "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S")
                if r.created_at
                else "",
            }
        )
    return _csv_response("reservations-export.csv", rows)


@router.post("/customers/import.csv")
def import_customers_csv(
    duplicate_strategy: str = Query("skip", pattern="^(skip|update)$"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: object = Depends(require_admin),
):
    rows = _read_csv(file)
    created = 0
    updated = 0
    skipped = 0
    errors: list[str] = []
    for i, row in enumerate(rows, start=2):
        phone = (row.get("phone") or "").strip()
        display_name = (row.get("display_name") or "").strip()
        email = (row.get("email") or "").strip() or None
        tags = (row.get("tags") or "").strip()
        note = (row.get("note") or "").strip() or None
        if not phone or not phone.isdigit() or len(phone) != 11:
            errors.append(f"第 {i} 行手机号格式不正确")
            continue
        if email and "@" not in email:
            errors.append(f"第 {i} 行邮箱格式不正确")
            continue
        existed = db.query(Customer).filter(Customer.phone == phone).first()
        if existed:
            if duplicate_strategy == "skip":
                skipped += 1
                continue
            existed.display_name = display_name
            existed.email = email
            existed.tags = tags
            existed.note = note
            updated += 1
            continue
        db.add(
            Customer(
                phone=phone,
                display_name=display_name,
                email=email,
                tags=tags,
                note=note,
            )
        )
        created += 1
    db.commit()
    write_operation_log(
        db,
        actor=user,
        category="import",
        action="customers_csv",
        entity="customers",
        entity_id=None,
        detail={
            "total_rows": len(rows),
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "error_count": len(errors),
            "duplicate_strategy": duplicate_strategy,
        },
    )
    return {
        "ok": True,
        "total_rows": len(rows),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "error_count": len(errors),
        "errors": errors[:100],
        "message": "客户档案导入完成",
    }


@router.post("/reservations/import.csv")
def import_reservations_csv(
    duplicate_strategy: str = Query("skip", pattern="^(skip|update)$"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: object = Depends(require_admin),
):
    ensure_assigned_table_ids_column(db)
    table_by_code = {
        str(t.code): int(t.id)
        for t in db.query(DiningTable.id, DiningTable.code).all()
    }
    rows = _read_csv(file)
    created = 0
    updated = 0
    skipped = 0
    errors: list[str] = []
    for i, row in enumerate(rows, start=2):
        customer_name = (row.get("customer_name") or "").strip()
        phone = (row.get("phone") or "").strip()
        reservation_date = (row.get("reservation_date") or "").strip()
        time_slot = (row.get("time_slot") or "").strip()
        party_size_raw = (row.get("party_size") or "").strip()
        flow_status = (
            (row.get("flow_status") or "waiting").strip() or "waiting"
        )
        tags = (row.get("tags") or "").strip()
        note = (row.get("note") or "").strip() or None
        booking_source = (
            (row.get("booking_source") or "admin").strip() or "admin"
        )
        codes = _normalize_table_codes(row.get("assigned_table_codes") or "")
        if not customer_name:
            errors.append(f"第 {i} 行客户姓名不能为空")
            continue
        if phone and (not phone.isdigit() or len(phone) != 11):
            errors.append(f"第 {i} 行手机号格式不正确")
            continue
        if len(reservation_date) != 10 or reservation_date.count("-") != 2:
            errors.append(f"第 {i} 行预订日期格式应为 YYYY-MM-DD")
            continue
        if len(time_slot) != 5 or time_slot.count(":") != 1:
            errors.append(f"第 {i} 行预订时间格式应为 HH:MM")
            continue
        party_size = _parse_int(party_size_raw, "party_size", i)
        if party_size <= 0:
            errors.append(f"第 {i} 行就餐人数需大于 0")
            continue
        table_ids: list[int] = []
        unknown_codes = [x for x in codes if x not in table_by_code]
        if unknown_codes:
            errors.append(
                f"第 {i} 行桌台编号不存在: {','.join(unknown_codes)}"
            )
            continue
        table_ids = [table_by_code[x] for x in codes]
        existed = (
            db.query(Reservation)
            .filter(
                Reservation.phone == phone,
                Reservation.reservation_date == reservation_date,
                Reservation.time_slot == time_slot,
            )
            .first()
        )
        if existed:
            if duplicate_strategy == "skip":
                skipped += 1
                continue
            existed.customer_name = customer_name
            existed.party_size = party_size
            existed.flow_status = flow_status
            existed.tags = tags
            existed.note = note
            existed.booking_source = booking_source
            set_assigned_table_ids(existed, table_ids)
            updated += 1
            continue
        r = Reservation(
            customer_name=customer_name,
            phone=phone,
            reservation_date=reservation_date,
            time_slot=time_slot,
            party_size=party_size,
            flow_status=flow_status,
            tags=tags,
            note=note,
            booking_source=booking_source,
            assigned_table_id=table_ids[0] if table_ids else None,
        )
        set_assigned_table_ids(r, table_ids)
        db.add(r)
        created += 1
    db.commit()
    write_operation_log(
        db,
        actor=user,
        category="import",
        action="reservations_csv",
        entity="reservations",
        entity_id=None,
        detail={
            "total_rows": len(rows),
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "error_count": len(errors),
            "duplicate_strategy": duplicate_strategy,
        },
    )
    return {
        "ok": True,
        "total_rows": len(rows),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "error_count": len(errors),
        "errors": errors[:100],
        "message": "预订记录导入完成",
    }
