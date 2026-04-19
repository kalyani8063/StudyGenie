import os
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent / "studygenie.db"
DATABASE_URL = os.getenv(
    "STUDYGENIE_DATABASE_URL",
    f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}",
)

# check_same_thread is required for SQLite when used with FastAPI dependencies.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def migrate_database() -> None:
    """
    Apply tiny prototype migrations for existing local SQLite databases.

    This keeps older local databases working after adding new columns.
    """
    inspector = inspect(engine)
    if inspector.has_table("StudentPerformance"):
        columns = {
            column["name"] for column in inspector.get_columns("StudentPerformance")
        }
        with engine.begin() as connection:
            if "time_spent" not in columns:
                connection.execute(
                    text(
                        "ALTER TABLE StudentPerformance "
                        "ADD COLUMN time_spent INTEGER NOT NULL DEFAULT 10"
                    )
                )

            if "user_id" not in columns:
                connection.execute(
                    text("ALTER TABLE StudentPerformance ADD COLUMN user_id INTEGER")
                )

    if inspector.has_table("users"):
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        with engine.begin() as connection:
            if "age" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN age INTEGER"))
            if "education_level" not in user_columns:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN education_level VARCHAR")
                )
            if "study_goal" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN study_goal VARCHAR"))

    if inspector.has_table("break_logs"):
        break_columns = {column["name"] for column in inspector.get_columns("break_logs")}
        with engine.begin() as connection:
            if "started_at" not in break_columns:
                connection.execute(text("ALTER TABLE break_logs ADD COLUMN started_at DATETIME"))
            if "ended_at" not in break_columns:
                connection.execute(text("ALTER TABLE break_logs ADD COLUMN ended_at DATETIME"))
            if "study_session_id" not in break_columns:
                connection.execute(text("ALTER TABLE break_logs ADD COLUMN study_session_id INTEGER"))

    if inspector.has_table("study_sessions"):
        session_columns = {column["name"] for column in inspector.get_columns("study_sessions")}
        with engine.begin() as connection:
            if "started_at" not in session_columns:
                connection.execute(text("ALTER TABLE study_sessions ADD COLUMN started_at DATETIME"))
            if "ended_at" not in session_columns:
                connection.execute(text("ALTER TABLE study_sessions ADD COLUMN ended_at DATETIME"))
            if "source" not in session_columns:
                connection.execute(
                    text(
                        "ALTER TABLE study_sessions "
                        "ADD COLUMN source VARCHAR NOT NULL DEFAULT 'manual'"
                    )
                )


def get_db():
    """Provide a database session for each request and close it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
