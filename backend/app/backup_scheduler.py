from __future__ import annotations

import threading
from datetime import datetime

from sqlalchemy.orm import Session

from .config import BASE_DIR, DATA_DIR
from .database import SessionLocal
from .log_util import write_operation_log
from .models import BackupPlanSettings


def _get_or_create_settings(db: Session) -> BackupPlanSettings:
    row = db.get(BackupPlanSettings, 1)
    if row:
        return row
    row = BackupPlanSettings(id=1)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _backup_db_file() -> str | None:
    src = DATA_DIR / "app.db"
    if not src.exists():
        return None
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = BASE_DIR / f"app-backup-{stamp}.db"
    import shutil

    shutil.copy2(src, dst)
    return dst.name


def _cleanup_old_backups(keep_last: int) -> None:
    keep = max(1, min(int(keep_last or 1), 3650))
    files = sorted(
        [p for p in BASE_DIR.glob("app-backup-*.db") if p.is_file()],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for p in files[keep:]:
        try:
            p.unlink(missing_ok=True)
        except Exception:
            pass


def start_backup_scheduler(stop_event: threading.Event) -> threading.Thread:
    def loop():
        while not stop_event.is_set():
            try:
                db: Session = SessionLocal()
                try:
                    s = _get_or_create_settings(db)
                    if s.enabled:
                        hm = (s.daily_time_hm or "03:00").strip()
                        now = datetime.now()
                        today = now.strftime("%Y-%m-%d")
                        if s.last_run_date != today and now.strftime("%H:%M") == hm:
                            backup_file = _backup_db_file()
                            if backup_file:
                                s.last_run_date = today
                                db.add(s)
                                db.commit()
                                _cleanup_old_backups(s.keep_last)
                                write_operation_log(
                                    db,
                                    actor=None,
                                    category="maintenance",
                                    action="auto_backup_db",
                                    entity="db",
                                    entity_id=None,
                                    detail={
                                        "backup_file": backup_file,
                                        "keep_last": s.keep_last,
                                        "daily_time_hm": hm,
                                    },
                                )
                finally:
                    db.close()
            except Exception:
                pass
            stop_event.wait(20)

    t = threading.Thread(target=loop, name="backup-scheduler", daemon=True)
    t.start()
    return t
