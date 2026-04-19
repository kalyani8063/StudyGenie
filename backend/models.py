from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, func

try:
    from .database import Base
except ImportError:
    from database import Base


class StudentPerformance(Base):
    """Stores the raw student performance data submitted to /recommend."""

    __tablename__ = "StudentPerformance"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, nullable=False, index=True)
    score = Column(Float, nullable=False)
    attempts = Column(Integer, nullable=False)
    time_spent = Column(Integer, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class SavedRecommendation(Base):
    """Stores recommendation cards explicitly saved by authenticated users."""

    __tablename__ = "saved_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, nullable=False, index=True)
    score = Column(Float, nullable=False)
    attempts = Column(Integer, nullable=False)
    time_spent = Column(Integer, nullable=False)
    level = Column(String, nullable=False, index=True)
    recommendation = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StudySession(Base):
    """Stores manually logged or timer-generated study sessions."""

    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, nullable=False, index=True)
    time_spent = Column(Integer, nullable=False)
    date = Column(Date, nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    source = Column(String, nullable=False, server_default="manual")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BreakLog(Base):
    """Stores break periods taken between study blocks."""

    __tablename__ = "break_logs"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, nullable=True, index=True)
    duration_minutes = Column(Integer, nullable=False)
    break_type = Column(String, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    study_session_id = Column(Integer, ForeignKey("study_sessions.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    """Stores registered users and profile details."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    age = Column(Integer, nullable=True)
    education_level = Column(String, nullable=True)
    study_goal = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
