from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class RecommendationRequest(BaseModel):
    """Input data for a student's performance on a topic."""

    topic: str = Field(..., min_length=1, description="Study topic name")
    score: float = Field(..., ge=0, le=100, description="Score from 0 to 100")
    attempts: int = Field(..., ge=1, le=5, description="Number of attempts made")
    time_spent: int = Field(
        ...,
        ge=10,
        le=120,
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


class SavedRecommendationCreate(BaseModel):
    """Payload used when the user chooses to save a recommendation card."""

    metrics: RecommendationRequest
    result: RecommendationResponse


class SavedRecommendationItem(BaseModel):
    """Saved recommendation returned to the frontend."""

    id: int
    metrics: RecommendationRequest
    result: RecommendationResponse
    savedAt: datetime | None = None


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
