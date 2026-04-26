import logging
import sys
from contextlib import asynccontextmanager
from datetime import date, timedelta
from importlib import import_module

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, selectinload

if __package__:
    from .auth import (
        create_access_token,
        get_current_user,
        get_optional_user,
        hash_password,
        verify_password,
    )
    from .ai_engine import StudyAgent
    from .concept_retention import (
        build_concept_retention_overview,
        record_concept_study,
        record_lesson_quiz_attempt,
        sync_lesson_concept_graph,
    )
    from .database import (
        PROJECT_ROOT,
        USING_SQLITE,
        get_db,
        initialize_database_schema,
        validate_database_connection,
    )
    from .models import BreakLog, StudentPerformance, StudySession, User, WeeklyPlan, WeeklyTask
    from .study_tools import build_lesson_summary_from_presentation
    from .schemas import (
        AuthResponse,
        BreakLogCreate,
        BreakLogResponse,
        ConceptNodeItem,
        ConceptStudyLogCreate,
        ConceptRetentionOverviewResponse,
        LessonQuizAttemptCreate,
        PresentationLessonSummaryResponse,
        RecommendationRequest,
        RecommendationResponse,
        StudySessionCreate,
        StudySessionResponse,
        UserCreate,
        UserLogin,
        UserProfileUpdate,
        UserResponse,
        WeeklyPlansState,
        WeeklyPlanPayload,
        WeeklyTaskPayload,
    )
else:
    from auth import (
        create_access_token,
        get_current_user,
        get_optional_user,
        hash_password,
        verify_password,
    )
    from ai_engine import StudyAgent
    from concept_retention import (
        build_concept_retention_overview,
        record_concept_study,
        record_lesson_quiz_attempt,
        sync_lesson_concept_graph,
    )
    from database import (
        PROJECT_ROOT,
        USING_SQLITE,
        get_db,
        initialize_database_schema,
        validate_database_connection,
    )
    from models import BreakLog, StudentPerformance, StudySession, User, WeeklyPlan, WeeklyTask
    from study_tools import build_lesson_summary_from_presentation
    from schemas import (
        AuthResponse,
        BreakLogCreate,
        BreakLogResponse,
        ConceptNodeItem,
        ConceptStudyLogCreate,
        ConceptRetentionOverviewResponse,
        LessonQuizAttemptCreate,
        PresentationLessonSummaryResponse,
        RecommendationRequest,
        RecommendationResponse,
        StudySessionCreate,
        StudySessionResponse,
        UserCreate,
        UserLogin,
        UserProfileUpdate,
        UserResponse,
        WeeklyPlansState,
        WeeklyPlanPayload,
        WeeklyTaskPayload,
    )

logger = logging.getLogger(__name__)


def load_alembic_runtime():
    """Import the installed Alembic package without the local script folder shadowing it."""
    original_path = list(sys.path)
    filtered_path = [
        entry
        for entry in original_path
        if entry not in {"", str(PROJECT_ROOT)}
    ]

    try:
        sys.path[:] = filtered_path
        for module_name in list(sys.modules):
            if module_name == "alembic" or module_name.startswith("alembic."):
                sys.modules.pop(module_name, None)

        alembic_command = import_module("alembic.command")
        alembic_config = import_module("alembic.config")
        return alembic_command, alembic_config.Config
    finally:
        sys.path[:] = original_path


def run_migrations() -> None:
    """Apply all pending Alembic migrations before serving requests."""
    try:
        alembic_command, alembic_config_class = load_alembic_runtime()
        alembic_ini_path = PROJECT_ROOT / "alembic.ini"
        alembic_cfg = alembic_config_class(str(alembic_ini_path))
        alembic_cfg.set_main_option("script_location", str(PROJECT_ROOT / "alembic"))
        alembic_command.upgrade(alembic_cfg, "head")
        logger.info("Alembic migrations applied successfully.")
    except Exception:
        logger.exception("Alembic migration run failed.")
        raise


@asynccontextmanager
async def lifespan(_app: FastAPI):
    validate_database_connection()
    if USING_SQLITE:
        initialize_database_schema()
    else:
        run_migrations()
    yield

app = FastAPI(
    title="StudyGenie",
    description="Study planning, session tracking, and rule-based recommendations.",
    version="1.0.0",
    lifespan=lifespan,
)

LOCAL_DEV_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_DEV_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


def lookup_previous_score(
    current_user: User | None,
    db: Session,
    topic: str,
) -> float | None:
    """Return the previous saved score snapshot for this topic when available."""
    if current_user is None:
        return None

    previous_entry = (
        db.query(StudentPerformance)
        .filter(StudentPerformance.user_id == current_user.id)
        .filter(StudentPerformance.topic == topic.strip())
        .order_by(StudentPerformance.id.desc())
        .first()
    )
    return float(previous_entry.score) if previous_entry else None


def serialize_weekly_task(task: WeeklyTask) -> WeeklyTaskPayload:
    return WeeklyTaskPayload(
        id=task.id,
        topic=task.topic,
        day=task.day,
        duration_minutes=task.duration_minutes,
        priority=task.priority,
        notes=task.notes,
        completed=task.completed,
        completed_at=task.completed_at,
        actual_minutes=task.actual_minutes,
        linked_study_session_id=task.linked_study_session_id,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def serialize_weekly_plan(plan: WeeklyPlan) -> WeeklyPlanPayload:
    return WeeklyPlanPayload(
        id=plan.id,
        title=plan.title,
        week_start=plan.week_start,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        tasks=[serialize_weekly_task(task) for task in plan.tasks],
    )


def load_weekly_plans(db: Session, user_id: int) -> list[WeeklyPlan]:
    return (
        db.query(WeeklyPlan)
        .options(selectinload(WeeklyPlan.tasks))
        .filter(WeeklyPlan.user_id == user_id)
        .order_by(WeeklyPlan.week_start.desc(), WeeklyPlan.updated_at.desc(), WeeklyPlan.id.desc())
        .all()
    )


def build_weekly_state(current_user: User, db: Session) -> WeeklyPlansState:
    plans = load_weekly_plans(db, current_user.id)
    known_plan_ids = {plan.id for plan in plans}
    active_plan_id = current_user.active_weekly_plan_id

    if active_plan_id not in known_plan_ids:
        active_plan_id = plans[0].id if plans else None

    return WeeklyPlansState(
        active_weekly_plan_id=active_plan_id,
        plans=[serialize_weekly_plan(plan) for plan in plans],
    )


@app.get("/")
def read_root() -> dict[str, str]:
    """Health check endpoint."""
    return {"message": "API running"}


@app.post("/lessons/presentation-summary", response_model=PresentationLessonSummaryResponse)
async def summarize_presentation_lesson(
    presentation: UploadFile = File(...),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> PresentationLessonSummaryResponse:
    """Read a PPTX lesson deck and return a structured main-points summary."""
    filename = (presentation.filename or "").lower()
    content_type = presentation.content_type or ""
    valid_content_types = {
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/octet-stream",
    }

    if not filename.endswith(".pptx") and content_type not in valid_content_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a .pptx PowerPoint deck.",
        )

    contents = await presentation.read()

    try:
        result = build_lesson_summary_from_presentation(contents)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    saved_lesson_id: int | None = None
    if current_user is not None:
        graph = sync_lesson_concept_graph(
            db,
            current_user,
            result,
            presentation.filename,
        )
        saved_lesson_id = graph.id

        retention_snapshot = build_concept_retention_overview(
            db,
            current_user,
            lesson_graph_ids=[graph.id],
        )
        retained_nodes = {
            item["concept_key"]: item
            for item in retention_snapshot.get("graph_nodes", [])
        }
        result["concepts"] = [
            {
                **concept,
                **{
                    key: value
                    for key, value in retained_nodes.get(concept["concept_key"], {}).items()
                    if key
                    in {
                        "mastery_score",
                        "retention_score",
                        "forgetting_risk",
                        "evidence_count",
                        "status",
                        "insight",
                        "last_reviewed_at",
                    }
                },
            }
            for concept in result.get("concepts", [])
        ]

    result["saved_lesson_id"] = saved_lesson_id

    return PresentationLessonSummaryResponse(**result)


@app.get("/concept-retention", response_model=ConceptRetentionOverviewResponse)
def read_concept_retention(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConceptRetentionOverviewResponse:
    """Return adaptive concept-retention signals for the authenticated user's saved lessons."""
    return ConceptRetentionOverviewResponse(
        **build_concept_retention_overview(
            db,
            current_user,
        )
    )


@app.post("/lesson-concepts/study", response_model=ConceptNodeItem)
def log_lesson_concept_study(
    payload: ConceptStudyLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record focused study time for one concept from Lesson Studio."""
    try:
        snapshot = record_concept_study(
            db,
            current_user,
            payload.lesson_graph_id,
            payload.concept_key.strip(),
            payload.minutes,
            mark_complete=payload.mark_complete,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return snapshot


@app.post("/lesson-quiz-attempts", response_model=ConceptNodeItem)
def create_lesson_quiz_attempt(
    payload: LessonQuizAttemptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record one lesson quiz result so weak concepts can be tracked over time."""
    try:
        snapshot = record_lesson_quiz_attempt(
            db,
            current_user,
            payload.lesson_graph_id,
            payload.concept_key.strip(),
            payload.question,
            payload.score,
            payload.response_label,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return snapshot


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


@app.get("/weekly-plans", response_model=WeeklyPlansState)
def read_weekly_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WeeklyPlansState:
    """Return the authenticated user's saved weekly planner state."""
    return build_weekly_state(current_user, db)


@app.put("/weekly-plans/sync", response_model=WeeklyPlansState)
def sync_weekly_plans(
    payload: WeeklyPlansState,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WeeklyPlansState:
    """Upsert the full weekly planner snapshot for the current user."""
    existing_plans = {
        plan.id: plan for plan in load_weekly_plans(db, current_user.id)
    }
    incoming_plan_ids = {plan.id for plan in payload.plans}
    linked_session_ids = {
        task.linked_study_session_id
        for plan in payload.plans
        for task in plan.tasks
        if task.linked_study_session_id is not None
    }

    allowed_linked_session_ids = {
        item[0]
        for item in (
            db.query(StudySession.id)
            .filter(StudySession.user_id == current_user.id)
            .filter(StudySession.id.in_(linked_session_ids))
            .all()
            if linked_session_ids
            else []
        )
    }

    for plan_payload in payload.plans:
        existing_plan = existing_plans.get(plan_payload.id)

        if existing_plan is None:
            existing_plan = WeeklyPlan(
                id=plan_payload.id,
                user_id=current_user.id,
            )
            db.add(existing_plan)

        existing_plan.title = plan_payload.title.strip() or f"Week of {plan_payload.week_start}"
        existing_plan.week_start = plan_payload.week_start

        if plan_payload.created_at is not None and existing_plan.created_at is None:
            existing_plan.created_at = plan_payload.created_at
        if plan_payload.updated_at is not None:
            existing_plan.updated_at = plan_payload.updated_at

        existing_tasks = {task.id: task for task in existing_plan.tasks}
        incoming_task_ids = {task.id for task in plan_payload.tasks}

        for task_payload in plan_payload.tasks:
            existing_task = existing_tasks.get(task_payload.id)

            if existing_task is None:
                existing_task = WeeklyTask(
                    id=task_payload.id,
                    plan=existing_plan,
                )
                db.add(existing_task)

            existing_task.topic = task_payload.topic.strip()
            existing_task.day = task_payload.day
            existing_task.duration_minutes = task_payload.duration_minutes
            existing_task.priority = task_payload.priority
            existing_task.notes = task_payload.notes.strip() if task_payload.notes else None
            existing_task.completed = task_payload.completed
            existing_task.completed_at = task_payload.completed_at
            existing_task.actual_minutes = task_payload.actual_minutes
            existing_task.linked_study_session_id = (
                task_payload.linked_study_session_id
                if task_payload.linked_study_session_id in allowed_linked_session_ids
                else None
            )
            if task_payload.created_at is not None and existing_task.created_at is None:
                existing_task.created_at = task_payload.created_at
            if task_payload.updated_at is not None:
                existing_task.updated_at = task_payload.updated_at

        for existing_task in list(existing_plan.tasks):
            if existing_task.id not in incoming_task_ids:
                db.delete(existing_task)

    for existing_plan in existing_plans.values():
        if existing_plan.id not in incoming_plan_ids:
            db.delete(existing_plan)

    current_user.active_weekly_plan_id = (
        payload.active_weekly_plan_id
        if payload.active_weekly_plan_id in incoming_plan_ids
        else (payload.plans[0].id if payload.plans else None)
    )

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return build_weekly_state(current_user, db)


@app.post("/recommend", response_model=RecommendationResponse)
def recommend(
    request: RecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> RecommendationResponse:
    """Save a progress snapshot and return a rule-based study recommendation."""
    normalized_topic = request.topic.strip()
    previous_score = lookup_previous_score(current_user, db, normalized_topic)
    break_summary = summarize_break_logs(current_user, db, normalized_topic)
    normalized_request = RecommendationRequest(
        topic=normalized_topic,
        score=request.score,
        attempts=request.attempts,
        time_spent=request.time_spent,
        recent_break_count=request.recent_break_count,
        average_break_minutes=request.average_break_minutes,
        recent_break_minutes=request.recent_break_minutes,
    )
    agent = StudyAgent()
    facts = agent.perceive(
        normalized_request,
        previous_score=previous_score,
        break_summary=break_summary,
    )
    action = agent.decide(
        normalized_request,
        facts,
        break_summary=break_summary,
    )
    recommendation = agent.act(action)

    performance = StudentPerformance(
        topic=normalized_topic,
        score=request.score,
        attempts=request.attempts,
        time_spent=request.time_spent,
        user_id=current_user.id if current_user else None,
    )
    db.add(performance)
    db.commit()
    return recommendation


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
