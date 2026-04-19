from datetime import date, timedelta

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

try:
    from .auth import (
        create_access_token,
        get_current_user,
        get_optional_user,
        hash_password,
        verify_password,
    )
    from .ai_engine import generate_recommendation
    from .database import Base, engine, get_db, migrate_database
    from .models import BreakLog, SavedRecommendation, StudentPerformance, StudySession, User
    from .schemas import (
        AuthResponse,
        BreakLogCreate,
        BreakLogResponse,
        RecommendationRequest,
        RecommendationResponse,
        SavedRecommendationCreate,
        SavedRecommendationItem,
        StudySessionCreate,
        StudySessionResponse,
        UserCreate,
        UserLogin,
        UserProfileUpdate,
        UserResponse,
    )
except ImportError:
    from auth import (
        create_access_token,
        get_current_user,
        get_optional_user,
        hash_password,
        verify_password,
    )
    from ai_engine import generate_recommendation
    from database import Base, engine, get_db, migrate_database
    from models import BreakLog, SavedRecommendation, StudentPerformance, StudySession, User
    from schemas import (
        AuthResponse,
        BreakLogCreate,
        BreakLogResponse,
        RecommendationRequest,
        RecommendationResponse,
        SavedRecommendationCreate,
        SavedRecommendationItem,
        StudySessionCreate,
        StudySessionResponse,
        UserCreate,
        UserLogin,
        UserProfileUpdate,
        UserResponse,
    )

# Create database tables for this prototype.
# In a larger project, migrations such as Alembic would usually handle this.
Base.metadata.create_all(bind=engine)
migrate_database()

app = FastAPI(
    title="AI-Driven Study Recommendation System",
    description="A simple FastAPI prototype for study recommendations.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def serialize_saved_recommendation(item: SavedRecommendation) -> SavedRecommendationItem:
    """Return the nested response shape expected by the frontend."""
    return SavedRecommendationItem(
        id=item.id,
        metrics=RecommendationRequest(
            topic=item.topic,
            score=item.score,
            attempts=item.attempts,
            time_spent=item.time_spent,
        ),
        result=RecommendationResponse(
            level=item.level,
            recommendation=item.recommendation,
            reason=item.reason,
        ),
        savedAt=item.created_at,
    )


def summarize_break_logs(
    current_user: User | None,
    db: Session,
    topic: str,
) -> dict[str, float | int | str] | None:
    """Return a short summary of recent break behavior for recommendation tuning."""
    if current_user is None:
        return None

    cutoff_date = date.today() - timedelta(days=14)
    recent_breaks = (
        db.query(BreakLog)
        .filter(BreakLog.user_id == current_user.id)
        .filter(BreakLog.date >= cutoff_date)
        .order_by(BreakLog.date.desc(), BreakLog.id.desc())
        .all()
    )

    if not recent_breaks:
        return None

    normalized_topic = topic.strip().lower()
    topic_breaks = [
        item
        for item in recent_breaks
        if item.topic and item.topic.strip().lower() == normalized_topic
    ]
    relevant_breaks = topic_breaks or recent_breaks[:10]
    total_minutes = sum(item.duration_minutes for item in relevant_breaks)

    return {
        "count": len(relevant_breaks),
        "average_minutes": round(total_minutes / len(relevant_breaks), 1),
        "total_minutes": total_minutes,
        "scope": "topic" if topic_breaks else "recent",
    }


@app.get("/")
def read_root() -> dict[str, str]:
    """Health check endpoint."""
    return {"message": "API running"}


@app.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserCreate, db: Session = Depends(get_db)) -> AuthResponse:
    """Create a new account and return an access token."""
    email = payload.email.strip().lower()
    existing_user = db.query(User).filter(User.email == email).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        age=payload.age,
        education_level=payload.education_level,
        study_goal=payload.study_goal,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthResponse(access_token=create_access_token(user.id), user=user)


@app.post("/auth/login", response_model=AuthResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)) -> AuthResponse:
    """Validate credentials and return an access token."""
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return AuthResponse(access_token=create_access_token(user.id), user=user)


@app.get("/profile", response_model=UserResponse)
def read_profile(current_user: User = Depends(get_current_user)) -> User:
    """Return the logged-in user's profile."""
    return current_user


@app.put("/profile", response_model=UserResponse)
def update_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Update editable profile details for the logged-in user."""
    update_data = payload.model_dump(exclude_unset=True)

    if "full_name" in update_data and update_data["full_name"]:
        update_data["full_name"] = update_data["full_name"].strip()

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@app.post("/recommend", response_model=RecommendationResponse)
def recommend(
    request: RecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> RecommendationResponse:
    """Save student performance data and return a study recommendation."""
    performance = StudentPerformance(
        topic=request.topic,
        score=request.score,
        attempts=request.attempts,
        time_spent=request.time_spent,
        user_id=current_user.id if current_user else None,
    )
    db.add(performance)
    db.commit()
    db.refresh(performance)

    break_summary = summarize_break_logs(current_user, db, request.topic)
    return generate_recommendation(request, break_summary=break_summary)


@app.get("/recommendations/history", response_model=list[SavedRecommendationItem])
def read_recommendation_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SavedRecommendationItem]:
    """Return saved recommendation cards for the current user."""
    items = (
        db.query(SavedRecommendation)
        .filter(SavedRecommendation.user_id == current_user.id)
        .order_by(SavedRecommendation.created_at.desc(), SavedRecommendation.id.desc())
        .all()
    )
    return [serialize_saved_recommendation(item) for item in items]


@app.post(
    "/recommendations/history",
    response_model=SavedRecommendationItem,
    status_code=status.HTTP_201_CREATED,
)
def save_recommendation(
    payload: SavedRecommendationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedRecommendationItem:
    """Persist a saved recommendation for the current user."""
    item = SavedRecommendation(
        topic=payload.metrics.topic,
        score=payload.metrics.score,
        attempts=payload.metrics.attempts,
        time_spent=payload.metrics.time_spent,
        level=payload.result.level,
        recommendation=payload.result.recommendation,
        reason=payload.result.reason,
        user_id=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_saved_recommendation(item)


@app.get("/study-sessions", response_model=list[StudySessionResponse])
def read_study_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[StudySession]:
    """Return study sessions logged by the current user."""
    return (
        db.query(StudySession)
        .filter(StudySession.user_id == current_user.id)
        .order_by(StudySession.date.desc(), StudySession.id.desc())
        .all()
    )


@app.post(
    "/study-sessions",
    response_model=StudySessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_study_session(
    payload: StudySessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudySession:
    """Create a study session for the current user."""
    session = StudySession(
        topic=payload.topic.strip(),
        time_spent=payload.time_spent,
        date=payload.date,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        source=payload.source,
        user_id=current_user.id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@app.get("/break-logs", response_model=list[BreakLogResponse])
def read_break_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[BreakLog]:
    """Return break logs recorded by the current user."""
    return (
        db.query(BreakLog)
        .filter(BreakLog.user_id == current_user.id)
        .order_by(BreakLog.date.desc(), BreakLog.id.desc())
        .all()
    )


@app.post("/break-logs", response_model=BreakLogResponse, status_code=status.HTTP_201_CREATED)
def create_break_log(
    payload: BreakLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BreakLog:
    """Persist a short or long break so future recommendations can use pacing data."""
    topic = payload.topic.strip() if payload.topic else None
    linked_session = None

    if payload.study_session_id is not None:
        linked_session = (
            db.query(StudySession)
            .filter(StudySession.id == payload.study_session_id)
            .filter(StudySession.user_id == current_user.id)
            .first()
        )

        if linked_session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Study session not found for this break log",
            )

    resolved_topic = topic or (linked_session.topic if linked_session else None)

    item = BreakLog(
        topic=resolved_topic,
        duration_minutes=payload.duration_minutes,
        break_type=payload.break_type,
        date=payload.date,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        study_session_id=linked_session.id if linked_session else None,
        user_id=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
