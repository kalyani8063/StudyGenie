import logging
import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base, sessionmaker

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv(*_args, **_kwargs):
        return False


logger = logging.getLogger(__name__)
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
LOCAL_SQLITE_PATH = BACKEND_DIR / "studygenie-local.db"

load_dotenv(BACKEND_DIR / ".env")


def normalize_database_url(raw_url: str) -> str:
    """Map common Postgres URLs to a SQLAlchemy psycopg URL."""
    if raw_url.startswith("sqlite:"):
        return raw_url

    if raw_url.startswith("postgres://"):
        return raw_url.replace("postgres://", "postgresql+psycopg://", 1)

    if raw_url.startswith("postgresql://") and "+psycopg" not in raw_url:
        return raw_url.replace("postgresql://", "postgresql+psycopg://", 1)

    return raw_url


def enrich_database_url(raw_url: str) -> str:
    """
    Add safe connection defaults for hosted Postgres providers.

    Supabase commonly expects SSL, and a shorter timeout prevents startup from
    looking hung when the database is blocked or unreachable.
    """
    if raw_url.startswith("sqlite:"):
        return raw_url

    parts = urlsplit(raw_url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.setdefault("sslmode", "require")
    query.setdefault("connect_timeout", os.getenv("STUDYGENIE_DB_CONNECT_TIMEOUT", "8"))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def build_local_sqlite_url() -> str:
    return f"sqlite:///{LOCAL_SQLITE_PATH.as_posix()}"


def should_use_local_database() -> bool:
    return os.getenv("STUDYGENIE_USE_LOCAL_DB", "").strip().lower() in {"1", "true", "yes", "on"}


DATABASE_URL = os.getenv("STUDYGENIE_DATABASE_URL", build_local_sqlite_url())

if should_use_local_database():
    DATABASE_URL = build_local_sqlite_url()

DATABASE_URL = normalize_database_url(DATABASE_URL)
DATABASE_URL = enrich_database_url(DATABASE_URL)
USING_SQLITE = DATABASE_URL.startswith("sqlite:")

if USING_SQLITE:
    LOCAL_SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)

engine_kwargs: dict[str, object] = {
    "pool_pre_ping": True,
}

if USING_SQLITE:
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine: Engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def validate_database_connection() -> None:
    """Fail fast when the configured database is unreachable or credentials are invalid."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        logger.info("Database connection validated successfully.")
    except SQLAlchemyError as exc:
        logger.exception("Database connection validation failed.")
        raise RuntimeError(
            "Failed to connect to the configured database. "
            "Check STUDYGENIE_DATABASE_URL, SSL requirements, and whether Python is allowed "
            "to open outbound connections to the Supabase Postgres host."
        ) from exc


def initialize_database_schema() -> None:
    """Create local SQLite tables on first launch so data persists on disk."""
    if not USING_SQLITE:
        return

    if __package__:
        from . import models  # noqa: F401
    else:
        import models  # noqa: F401

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    missing_tables = [
        table
        for table_name, table in Base.metadata.tables.items()
        if table_name not in existing_tables
    ]
    if missing_tables:
        Base.metadata.create_all(bind=engine, tables=missing_tables)
    logger.info("SQLite schema ensured at %s", LOCAL_SQLITE_PATH)


def get_db():
    """Provide a database session for each request and close it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
