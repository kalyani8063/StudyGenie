from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, JSON, String, func
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


class LessonConceptGraph(Base):
    """Stores a lesson-level concept graph extracted from an uploaded lesson deck."""

    __tablename__ = "lesson_concept_graphs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    overview = Column(String, nullable=False)
    source_name = Column(String, nullable=True, index=True)
    slide_count = Column(Integer, nullable=False, default=0)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    concepts = relationship(
        "LessonConceptNode",
        back_populates="lesson_graph",
        cascade="all, delete-orphan",
        order_by="LessonConceptNode.id",
    )
    edges = relationship(
        "LessonConceptEdge",
        back_populates="lesson_graph",
        cascade="all, delete-orphan",
        order_by="LessonConceptEdge.id",
    )
    progress_entries = relationship(
        "LessonConceptProgress",
        back_populates="lesson_graph",
        cascade="all, delete-orphan",
        order_by="LessonConceptProgress.updated_at",
    )
    quiz_attempts = relationship(
        "LessonQuizAttempt",
        back_populates="lesson_graph",
        cascade="all, delete-orphan",
        order_by="LessonQuizAttempt.created_at",
    )


class LessonConceptNode(Base):
    """Stores one concept node inside a saved lesson concept graph."""

    __tablename__ = "lesson_concept_nodes"

    id = Column(Integer, primary_key=True, index=True)
    lesson_graph_id = Column(Integer, ForeignKey("lesson_concept_graphs.id"), nullable=False, index=True)
    concept_key = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    kind = Column(String, nullable=False, server_default="section")
    parent_name = Column(String, nullable=True)
    summary = Column(String, nullable=False)
    difficulty = Column(String, nullable=False, server_default="medium")
    importance = Column(Float, nullable=False, default=0.0)
    focus_terms = Column(JSON, nullable=False, default=list)
    slide_numbers = Column(JSON, nullable=False, default=list)
    related_concepts = Column(JSON, nullable=False, default=list)
    search_text = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lesson_graph = relationship("LessonConceptGraph", back_populates="concepts")


class LessonConceptEdge(Base):
    """Stores directed relationships between saved lesson concepts."""

    __tablename__ = "lesson_concept_edges"

    id = Column(Integer, primary_key=True, index=True)
    lesson_graph_id = Column(Integer, ForeignKey("lesson_concept_graphs.id"), nullable=False, index=True)
    source_concept_key = Column(String, nullable=False, index=True)
    target_concept_key = Column(String, nullable=False, index=True)
    relation_type = Column(String, nullable=False, server_default="related")
    weight = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lesson_graph = relationship("LessonConceptGraph", back_populates="edges")


class LessonConceptProgress(Base):
    """Stores user interaction progress for one concept in a lesson graph."""

    __tablename__ = "lesson_concept_progress"

    id = Column(Integer, primary_key=True, index=True)
    lesson_graph_id = Column(Integer, ForeignKey("lesson_concept_graphs.id"), nullable=False, index=True)
    concept_key = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, nullable=False, server_default="not_started")
    study_count = Column(Integer, nullable=False, server_default="0")
    total_study_minutes = Column(Integer, nullable=False, server_default="0")
    quiz_attempt_count = Column(Integer, nullable=False, server_default="0")
    average_quiz_score = Column(Float, nullable=True)
    best_quiz_score = Column(Float, nullable=True)
    last_quiz_score = Column(Float, nullable=True)
    last_studied_at = Column(DateTime(timezone=True), nullable=True)
    last_quizzed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    lesson_graph = relationship("LessonConceptGraph", back_populates="progress_entries")


class LessonQuizAttempt(Base):
    """Stores one quiz attempt submitted from Lesson Studio."""

    __tablename__ = "lesson_quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    lesson_graph_id = Column(Integer, ForeignKey("lesson_concept_graphs.id"), nullable=False, index=True)
    concept_key = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    question = Column(String, nullable=False)
    score = Column(Float, nullable=False)
    response_label = Column(String, nullable=False, server_default="manual")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lesson_graph = relationship("LessonConceptGraph", back_populates="quiz_attempts")
