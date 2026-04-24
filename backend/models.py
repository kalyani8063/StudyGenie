from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

if __package__:
    from .database import Base
else:
    from database import Base


class StudentPerformance(Base):
    """Stores the raw student performance data submitted to /recommend."""

    __tablename__ = "student_performance"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, nullable=False, index=True)
    score = Column(Float, nullable=False)
    attempts = Column(Integer, nullable=False)
    time_spent = Column(Integer, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


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


class WeeklyPlan(Base):
    """Stores a user's weekly study plan and its nested tasks."""

    __tablename__ = "weekly_plans"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    week_start = Column(Date, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    tasks = relationship(
        "WeeklyTask",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="WeeklyTask.created_at",
    )


class WeeklyTask(Base):
    """Stores one planned topic block within a weekly plan."""

    __tablename__ = "weekly_tasks"

    id = Column(String, primary_key=True, index=True)
    plan_id = Column(String, ForeignKey("weekly_plans.id"), nullable=False, index=True)
    topic = Column(String, nullable=False)
    day = Column(String, nullable=False, index=True)
    duration_minutes = Column(Integer, nullable=False)
    priority = Column(String, nullable=False, server_default="medium")
    notes = Column(String, nullable=True)
    completed = Column(Boolean, nullable=False, server_default="0")
    completed_at = Column(DateTime(timezone=True), nullable=True)
    actual_minutes = Column(Integer, nullable=True)
    linked_study_session_id = Column(Integer, ForeignKey("study_sessions.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    plan = relationship("WeeklyPlan", back_populates="tasks")


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
    active_weekly_plan_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
