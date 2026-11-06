from contextlib import asynccontextmanager
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import UPLOAD_DIR
from .database import Base, engine, SessionLocal
from .backup_scheduler import start_backup_scheduler
from .promotion_sms_sender import start_promotion_sms_worker, stop_promotion_sms_worker
from .table_schema_compat import ensure_table_type_column
from .routers import (
    auto_confirm_settings,
    floor_policy_settings,
    admin_bookings,
    admin_customers,
    admin_dashboard,
    admin_deposits,
    admin_tables,
    admin_users,
    admin_promotions,
    admin_promotion_sms,
    auth,
    branding,
    floor,
    home,
    maintenance,
    admin_logs,
    operating_periods,
    reservations,
    sms_settings,
    uploads,
)
from . import seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    # 旧库兼容：新增列需显式 ALTER（create_all 不会给已存在的表加列）
    _db = SessionLocal()
    try:
        ensure_table_type_column(_db)
    finally:
        _db.close()
    seed.run_seed()
    stop_event = threading.Event()
    start_backup_scheduler(stop_event)
    start_promotion_sms_worker()
    yield
    stop_promotion_sms_worker()
    stop_event.set()


app = FastAPI(title="餐厅预订管理 API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(home.router)
app.include_router(branding.router)
app.include_router(operating_periods.router)
app.include_router(reservations.router)
app.include_router(floor.router)
app.include_router(uploads.router)
app.include_router(maintenance.router)
app.include_router(admin_logs.router)
app.include_router(admin_dashboard.router)
app.include_router(admin_tables.router)
app.include_router(admin_bookings.router)
app.include_router(admin_customers.router)
app.include_router(admin_deposits.router)
app.include_router(admin_users.router)
app.include_router(admin_promotions.router)
app.include_router(admin_promotion_sms.router)
app.include_router(sms_settings.router)
app.include_router(auto_confirm_settings.router)
app.include_router(floor_policy_settings.router)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/api/health")
def health():
    return {"ok": True}
