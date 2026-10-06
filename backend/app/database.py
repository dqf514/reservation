from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import StaticPool

from .config import DATABASE_URL


class Base(DeclarativeBase):
    pass


_connect_args = {"check_same_thread": False}
# :memory: 默认每连接独立空库，与 lifespan/seed 不同连接会导致「no such table」
if ":memory:" in DATABASE_URL:
    engine = create_engine(
        DATABASE_URL,
        connect_args=_connect_args,
        poolclass=StaticPool,
        echo=False,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args=_connect_args,
        echo=False,
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
