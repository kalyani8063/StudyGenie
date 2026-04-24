from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class RecommendationRequest(BaseModel):
    """Input data for a student's performance on a topic."""

    topic: str = Field(..., min_length=1, description="Study topic name")
    score: float = Field(..., ge=0, le=100, description="Score from 0 to 100")
    attempts: int = Field(..., ge=1, le=30, description="Number of focused attempts made")
    time_spent: int = Field(
        ...,
        ge=1,
        le=2000,
        description="Study time spent in minutes",
    )
    recent_break_count: int | None = Field(default=None, ge=0, le=200)
    average_break_minutes: float | None = Field(default=None, ge=0, le=240)
    recent_break_minutes: int | None = Field(default=None, ge=0, le=2000)


class RecommendationResponse(BaseModel):
    """Recommendation returned by the API."""

    level: Literal[
        "weak",
        "medium",
        "strong",
        "critical",
        "struggling",
        "low_engagement",
    ]
    recommendation: str
    reason: str


class LessonSectionItem(BaseModel):
    """One clustered lesson section derived from one or more related slides."""

    title: str
    subtopics: list[str] = Field(default_factory=list)
    summary: str
    key_points: list[str]
    difficulty: Literal["easy", "medium", "hard"]
    importance: float = Field(..., ge=0, le=1)
    focus_terms: list[str] = Field(default_factory=list)
    slide_numbers: list[int] = Field(default_factory=list)


class FlashcardItem(BaseModel):
    """One quick revision flashcard generated from lesson content."""

    front: str
    back: str


class PresentationLessonSummaryResponse(BaseModel):
    """Structured high-level summary generated from a PPTX lesson deck."""

    title: str
    overview: str
    keywords: list[str]
    sections: list[LessonSectionItem]
    revise_first: list[LessonSectionItem]
    quiz_questions: list[str]
    flashcards: list[FlashcardItem]
    estimated_revision_time: str
    slide_count: int
    source_text_length: int


class UserCreate(BaseModel):
    """Registration payload for a new student account."""

    full_name: str = Field(..., min_length=2)
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=6)
    age: int | None = Field(default=None, ge=5, le=100)
    education_level: str | None = None
    study_goal: str | None = None


class UserLogin(BaseModel):
    """Login payload."""

    email: str
    password: str


class UserProfileUpdate(BaseModel):
    """Editable profile fields."""

    full_name: str | None = Field(default=None, min_length=2)
    age: int | None = Field(default=None, ge=5, le=100)
    education_level: str | None = None
    study_goal: str | None = None


class UserResponse(BaseModel):
    """User profile returned to the frontend."""

    id: int
    full_name: str
    email: str
    age: int | None
    education_level: str | None
    study_goal: str | None
    active_weekly_plan_id: str | None
    created_at: datetime | None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    """Authentication response with token and user profile."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class StudySessionCreate(BaseModel):
    """Payload for creating a study session."""

    topic: str = Field(..., min_length=1)
    time_spent: int = Field(..., ge=1, le=600)
    date: date
    started_at: datetime | None = None
    ended_at: datetime | None = None
    source: Literal["manual", "timer"] = "manual"


class StudySessionResponse(BaseModel):
    """Study session returned to the frontend."""

    id: int
    topic: str
    time_spent: int
    date: date
    started_at: datetime | None = None
    ended_at: datetime | None = None
    source: Literal["manual", "timer"] = "manual"
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class BreakLogCreate(BaseModel):
    """Payload for creating a break log."""

    topic: str | None = Field(default=None, min_length=1)
    duration_minutes: int = Field(..., ge=1, le=180)
    break_type: Literal["short", "long"]
    date: date
    started_at: datetime | None = None
    ended_at: datetime | None = None
    study_session_id: int | None = Field(default=None, ge=1)


class BreakLogResponse(BaseModel):
    """Break log returned to the frontend."""

    id: int
    topic: str | None
    duration_minutes: int
    break_type: Literal["short", "long"]
    date: date
    started_at: datetime | None = None
    ended_at: datetime | None = None
    study_session_id: int | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class WeeklyTaskPayload(BaseModel):
    """A persisted task inside a weekly study plan."""

    id: str = Field(..., min_length=1)
    topic: str = Field(..., min_length=1)
    day: Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    duration_minutes: int = Field(..., ge=15, le=600)
    priority: Literal["high", "medium", "light"] = "medium"
    notes: str | None = None
    completed: bool = False
    completed_at: datetime | None = None
    actual_minutes: int | None = Field(default=None, ge=1, le=600)
    linked_study_session_id: int | None = Field(default=None, ge=1)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class WeeklyPlanPayload(BaseModel):
    """A persisted weekly plan and its nested tasks."""

    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    week_start: date
    created_at: datetime | None = None
    updated_at: datetime | None = None
    tasks: list[WeeklyTaskPayload] = Field(default_factory=list)


class WeeklyPlansState(BaseModel):
    """Authenticated planner snapshot for one user."""

    active_weekly_plan_id: str | None = None
    plans: list[WeeklyPlanPayload] = Field(default_factory=list)
