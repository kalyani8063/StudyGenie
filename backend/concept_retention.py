import math
import re
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session, selectinload

if __package__:
    from .models import (
        BreakLog,
        LessonConceptEdge,
        LessonConceptGraph,
        LessonConceptNode,
        LessonConceptProgress,
        LessonQuizAttempt,
        StudentPerformance,
        StudySession,
        User,
    )
else:
    from models import (
        BreakLog,
        LessonConceptEdge,
        LessonConceptGraph,
        LessonConceptNode,
        LessonConceptProgress,
        LessonQuizAttempt,
        StudentPerformance,
        StudySession,
        User,
    )


TOKEN_PATTERN = re.compile(r"\b[a-zA-Z][a-zA-Z0-9'-]{1,}\b")


def tokenize(text: str | None) -> set[str]:
    return {match.group(0).lower() for match in TOKEN_PATTERN.finditer(text or "")}


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def build_search_text(concept: dict[str, object], lesson_title: str) -> str:
    parts = [
        str(concept.get("name", "")),
        str(concept.get("parent_name", "")),
        lesson_title,
        str(concept.get("summary", "")),
        " ".join(str(item) for item in concept.get("focus_terms", [])),
        " ".join(str(item) for item in concept.get("related_concepts", [])),
    ]
    return " ".join(part for part in parts if part).strip()


def sync_lesson_concept_graph(
    db: Session,
    current_user: User,
    summary: dict[str, object],
    source_name: str | None,
) -> LessonConceptGraph:
    normalized_source_name = source_name.strip() if source_name else None
    existing_graph = (
        db.query(LessonConceptGraph)
        .filter(LessonConceptGraph.user_id == current_user.id)
        .filter(LessonConceptGraph.title == str(summary["title"]))
        .filter(LessonConceptGraph.source_name == normalized_source_name)
        .first()
    )

    if existing_graph is not None:
        db.delete(existing_graph)
        db.flush()

    graph = LessonConceptGraph(
        title=str(summary["title"]),
        overview=str(summary["overview"]),
        source_name=normalized_source_name,
        slide_count=int(summary["slide_count"]),
        user_id=current_user.id,
    )
    db.add(graph)
    db.flush()

    concept_key_map: dict[str, LessonConceptNode] = {}
    for concept in summary.get("concepts", []):
        node = LessonConceptNode(
            lesson_graph_id=graph.id,
            concept_key=str(concept["concept_key"]),
            name=str(concept["name"]),
            kind=str(concept["kind"]),
            parent_name=str(concept["parent_name"]) if concept.get("parent_name") else None,
            summary=str(concept["summary"]),
            difficulty=str(concept["difficulty"]),
            importance=float(concept["importance"]),
            focus_terms=[str(item) for item in concept.get("focus_terms", [])],
            slide_numbers=[int(item) for item in concept.get("slide_numbers", [])],
            related_concepts=[str(item) for item in concept.get("related_concepts", [])],
            search_text=build_search_text(concept, str(summary["title"])).lower(),
        )
        db.add(node)
        concept_key_map[node.concept_key] = node

    db.flush()

    for edge in summary.get("concept_edges", []):
        source_key = str(edge["source_concept_key"])
        target_key = str(edge["target_concept_key"])
        if source_key not in concept_key_map or target_key not in concept_key_map:
            continue

        db.add(
            LessonConceptEdge(
                lesson_graph_id=graph.id,
                source_concept_key=source_key,
                target_concept_key=target_key,
                relation_type=str(edge["relation_type"]),
                weight=float(edge["weight"]),
            )
        )

    db.commit()
    return graph


def get_lesson_concept_or_404(
    db: Session,
    current_user: User,
    lesson_graph_id: int,
    concept_key: str,
) -> tuple[LessonConceptGraph, LessonConceptNode]:
    graph = (
        db.query(LessonConceptGraph)
        .options(selectinload(LessonConceptGraph.concepts))
        .filter(LessonConceptGraph.id == lesson_graph_id)
        .filter(LessonConceptGraph.user_id == current_user.id)
        .first()
    )
    if graph is None:
        raise ValueError("Lesson graph not found for this user.")

    concept = next((item for item in graph.concepts if item.concept_key == concept_key), None)
    if concept is None:
        raise ValueError("Concept not found in that saved lesson.")

    return graph, concept


def get_or_create_concept_progress(
    db: Session,
    current_user: User,
    lesson_graph_id: int,
    concept_key: str,
) -> LessonConceptProgress:
    progress = (
        db.query(LessonConceptProgress)
        .filter(LessonConceptProgress.user_id == current_user.id)
        .filter(LessonConceptProgress.lesson_graph_id == lesson_graph_id)
        .filter(LessonConceptProgress.concept_key == concept_key)
        .first()
    )
    if progress is not None:
        return progress

    progress = LessonConceptProgress(
        lesson_graph_id=lesson_graph_id,
        concept_key=concept_key,
        user_id=current_user.id,
    )
    db.add(progress)
    db.flush()
    return progress


def topic_alignment(topic: str | None, concept: LessonConceptNode) -> float:
    if not topic:
        return 0.0

    lowered_topic = topic.strip().lower()
    if not lowered_topic:
        return 0.0

    if concept.name.lower() in lowered_topic:
        return 1.0

    topic_tokens = tokenize(topic)
    if not topic_tokens:
        return 0.0

    name_tokens = tokenize(concept.name)
    parent_tokens = tokenize(concept.parent_name or "")
    lesson_tokens = tokenize(concept.lesson_graph.title if concept.lesson_graph else "")
    concept_tokens = tokenize(concept.search_text)

    name_overlap = len(topic_tokens & name_tokens) / max(1, len(name_tokens))
    if name_overlap > 0:
        return clamp(0.68 + name_overlap * 0.32, 0.0, 1.0)

    concept_overlap = len(topic_tokens & concept_tokens) / max(1, len(concept_tokens))
    if concept_overlap > 0:
        return clamp(0.42 + concept_overlap * 0.42, 0.0, 0.95)

    parent_overlap = len(topic_tokens & parent_tokens) / max(1, len(parent_tokens))
    lesson_overlap = len(topic_tokens & lesson_tokens) / max(1, len(lesson_tokens))
    fallback_overlap = max(parent_overlap, lesson_overlap)
    if fallback_overlap > 0:
        return clamp(0.2 + fallback_overlap * 0.28, 0.0, 0.5)

    return 0.0


def average(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def to_datetime(value: datetime | date | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    return datetime.combine(value, datetime.min.time(), tzinfo=timezone.utc)


def build_concept_insight(
    *,
    concept: LessonConceptNode,
    days_since_review: int,
    evidence_count: int,
    retention_score: float,
    break_average: float | None,
) -> str:
    if evidence_count == 0:
        return (
            f"{concept.name} has not been reinforced yet, so StudyGenie is treating it as an "
            "early review candidate."
        )

    if retention_score < 0.42:
        if days_since_review >= 5:
            return f"{concept.name} has been quiet for {days_since_review} day(s), so recall may be fading."
        return f"{concept.name} has weak recent evidence, so a targeted review block is likely worth it."

    if break_average is not None and break_average < 5:
        return f"{concept.name} has study evidence, but very short breaks may be reducing retention quality."

    if retention_score >= 0.72:
        return f"{concept.name} is holding up well based on recent review evidence and lesson coverage."

    return f"{concept.name} looks stable for now, but a short review would keep it from drifting."


def analyze_concept(
    concept: LessonConceptNode,
    study_sessions: list[StudySession],
    break_logs: list[BreakLog],
    performances: list[StudentPerformance],
    progress: LessonConceptProgress | None = None,
) -> dict[str, object]:
    session_hits: list[tuple[StudySession, float]] = []
    for session in study_sessions:
        relevance = topic_alignment(session.topic, concept)
        if relevance > 0:
            session_hits.append((session, relevance))

    performance_hits: list[tuple[StudentPerformance, float]] = []
    for performance in performances:
        relevance = topic_alignment(performance.topic, concept)
        if relevance > 0:
            performance_hits.append((performance, relevance))

    break_hits: list[tuple[BreakLog, float]] = []
    for break_log in break_logs:
        relevance = topic_alignment(break_log.topic, concept)
        if relevance > 0:
            break_hits.append((break_log, relevance))

    weighted_minutes = sum(session.time_spent * weight for session, weight in session_hits)
    session_count = len(session_hits)
    weighted_scores = [performance.score * weight for performance, weight in performance_hits]
    score_weight_total = sum(weight for _performance, weight in performance_hits)
    score_signal = (
        sum(weighted_scores) / max(1.0, score_weight_total) / 100
        if score_weight_total > 0
        else None
    )
    weighted_attempts = (
        sum(performance.attempts * weight for performance, weight in performance_hits)
        / max(1.0, score_weight_total)
        if score_weight_total > 0
        else None
    )
    break_average = average([break_log.duration_minutes for break_log, _weight in break_hits])
    progress_minutes = int(progress.total_study_minutes) if progress is not None else 0
    progress_study_count = int(progress.study_count) if progress is not None else 0
    progress_quiz_attempt_count = int(progress.quiz_attempt_count) if progress is not None else 0
    average_quiz_score = (
        float(progress.average_quiz_score)
        if progress is not None and progress.average_quiz_score is not None
        else None
    )
    best_quiz_score = (
        float(progress.best_quiz_score)
        if progress is not None and progress.best_quiz_score is not None
        else None
    )

    time_signal = clamp((weighted_minutes + progress_minutes) / 240, 0.0, 1.0)
    session_signal = clamp((session_count + progress_study_count) / 4, 0.0, 1.0)
    break_adjustment = 0.0
    if break_average is not None:
        if 5 <= break_average <= 20:
            break_adjustment = 0.06
        elif break_average < 5:
            break_adjustment = -0.08
        else:
            break_adjustment = -0.05

    quiz_score_signal = average_quiz_score / 100 if average_quiz_score is not None else None
    if score_signal is not None and quiz_score_signal is not None:
        score_component = clamp((score_signal * 0.6) + (quiz_score_signal * 0.4), 0.0, 1.0)
    elif score_signal is not None:
        score_component = score_signal
    elif quiz_score_signal is not None:
        score_component = quiz_score_signal
    else:
        score_component = clamp(0.26 + time_signal * 0.4, 0.0, 0.72)
    struggle_penalty = 0.0
    if weighted_attempts is not None and score_signal is not None:
        if weighted_attempts >= 4 and score_signal < 0.65:
            struggle_penalty = 0.08
        elif weighted_attempts >= 2 and score_signal < 0.55:
            struggle_penalty = 0.05

    mastery_score = clamp(
        0.14
        + float(concept.importance) * 0.22
        + score_component * 0.34
        + time_signal * 0.16
        + session_signal * 0.08
        + break_adjustment
        + min(progress_quiz_attempt_count, 4) * 0.02
        - struggle_penalty,
        0.05,
        0.98,
    )

    review_candidates = [
        to_datetime(session.started_at or session.ended_at or session.date)
        for session, _weight in session_hits
    ]
    if progress is not None:
        review_candidates.append(to_datetime(progress.last_studied_at))
        review_candidates.append(to_datetime(progress.last_quizzed_at))
    review_candidates = [candidate for candidate in review_candidates if candidate is not None]
    last_reviewed_at = max(review_candidates, default=to_datetime(concept.created_at))
    days_since_review = (
        max(0, (datetime.now(timezone.utc) - last_reviewed_at).days)
        if last_reviewed_at is not None
        else 7
    )

    difficulty_factor = {"easy": 0.038, "medium": 0.052, "hard": 0.067}.get(
        concept.difficulty,
        0.052,
    )
    low_evidence_penalty = 0.018 if session_count == 0 and progress_study_count == 0 else 0.0
    break_decay_penalty = 0.016 if break_average is not None and break_average < 5 else 0.0
    decay_rate = max(
        0.02,
        difficulty_factor
        + low_evidence_penalty
        + break_decay_penalty
        - min(session_count + progress_study_count, 4) * 0.004,
    )
    retention_score = clamp(mastery_score * math.exp(-decay_rate * days_since_review), 0.02, 0.99)
    forgetting_risk = clamp(float(concept.importance) * (1 - retention_score), 0.01, 0.99)

    status = "strong"
    if forgetting_risk >= 0.5 or retention_score < 0.36:
        status = "at_risk"
    elif forgetting_risk >= 0.28 or retention_score < 0.62:
        status = "watch"

    evidence_count = session_count + len(performance_hits) + progress_study_count + progress_quiz_attempt_count
    insight = build_concept_insight(
        concept=concept,
        days_since_review=days_since_review,
        evidence_count=evidence_count,
        retention_score=retention_score,
        break_average=break_average,
    )

    return {
        "concept_key": concept.concept_key,
        "name": concept.name,
        "kind": concept.kind,
        "parent_name": concept.parent_name,
        "summary": concept.summary,
        "difficulty": concept.difficulty,
        "importance": round(float(concept.importance), 2),
        "focus_terms": [str(item) for item in (concept.focus_terms or [])],
        "slide_numbers": [int(item) for item in (concept.slide_numbers or [])],
        "related_concepts": [str(item) for item in (concept.related_concepts or [])],
        "mastery_score": round(mastery_score, 2),
        "retention_score": round(retention_score, 2),
        "forgetting_risk": round(forgetting_risk, 2),
        "evidence_count": evidence_count,
        "status": status,
        "insight": insight,
        "last_reviewed_at": last_reviewed_at,
        "study_status": progress.status if progress is not None else "not_started",
        "study_count": progress_study_count,
        "total_study_minutes": progress_minutes,
        "quiz_attempt_count": progress_quiz_attempt_count,
        "average_quiz_score": round(average_quiz_score, 1) if average_quiz_score is not None else None,
        "best_quiz_score": round(best_quiz_score, 1) if best_quiz_score is not None else None,
    }


def build_concept_retention_overview(
    db: Session,
    current_user: User,
    lesson_graph_ids: list[int] | None = None,
) -> dict[str, object]:
    graph_query = (
        db.query(LessonConceptGraph)
        .options(
            selectinload(LessonConceptGraph.concepts),
            selectinload(LessonConceptGraph.edges),
        )
        .filter(LessonConceptGraph.user_id == current_user.id)
        .order_by(LessonConceptGraph.updated_at.desc(), LessonConceptGraph.id.desc())
    )

    if lesson_graph_ids:
        graph_query = graph_query.filter(LessonConceptGraph.id.in_(lesson_graph_ids))

    graphs = graph_query.all()
    if not graphs:
        return {
            "lesson_count": 0,
            "concept_count": 0,
            "updated_at": None,
            "at_risk_concepts": [],
            "strongest_concepts": [],
            "graph_nodes": [],
            "graph_edges": [],
        }

    study_sessions = (
        db.query(StudySession)
        .filter(StudySession.user_id == current_user.id)
        .order_by(StudySession.date.desc(), StudySession.id.desc())
        .all()
    )
    break_logs = (
        db.query(BreakLog)
        .filter(BreakLog.user_id == current_user.id)
        .order_by(BreakLog.date.desc(), BreakLog.id.desc())
        .all()
    )
    performances = (
        db.query(StudentPerformance)
        .filter(StudentPerformance.user_id == current_user.id)
        .order_by(StudentPerformance.id.desc())
        .all()
    )
    progress_entries = (
        db.query(LessonConceptProgress)
        .filter(LessonConceptProgress.user_id == current_user.id)
        .all()
    )
    progress_lookup = {
        (entry.lesson_graph_id, entry.concept_key): entry
        for entry in progress_entries
    }

    analyzed_nodes: list[dict[str, object]] = []
    node_lookup: dict[str, dict[str, object]] = {}
    for graph in graphs:
        for concept in graph.concepts:
            analyzed = analyze_concept(
                concept,
                study_sessions,
                break_logs,
                performances,
                progress_lookup.get((graph.id, concept.concept_key)),
            )
            analyzed_nodes.append(analyzed)
            node_lookup[concept.concept_key] = analyzed

    analyzed_edges: list[dict[str, object]] = []
    for graph in graphs:
        for edge in graph.edges:
            source = node_lookup.get(edge.source_concept_key)
            target = node_lookup.get(edge.target_concept_key)
            if not source or not target:
                continue
            analyzed_edges.append(
                {
                    "source_concept_key": edge.source_concept_key,
                    "target_concept_key": edge.target_concept_key,
                    "source_name": source["name"],
                    "target_name": target["name"],
                    "relation_type": edge.relation_type,
                    "weight": round(float(edge.weight), 2),
                }
            )

    at_risk_concepts = sorted(
        analyzed_nodes,
        key=lambda node: (node["forgetting_risk"], node["importance"], node["retention_score"]),
        reverse=True,
    )[:6]
    strongest_concepts = sorted(
        analyzed_nodes,
        key=lambda node: (node["retention_score"], node["mastery_score"], node["importance"]),
        reverse=True,
    )[:6]
    updated_at = max((graph.updated_at or graph.created_at for graph in graphs), default=None)

    return {
        "lesson_count": len(graphs),
        "concept_count": len(analyzed_nodes),
        "updated_at": updated_at,
        "at_risk_concepts": at_risk_concepts,
        "strongest_concepts": strongest_concepts,
        "graph_nodes": analyzed_nodes,
        "graph_edges": analyzed_edges,
    }


def get_concept_snapshot(
    db: Session,
    current_user: User,
    lesson_graph_id: int,
    concept_key: str,
) -> dict[str, object]:
    overview = build_concept_retention_overview(db, current_user, lesson_graph_ids=[lesson_graph_id])
    concept = next(
        (item for item in overview["graph_nodes"] if item["concept_key"] == concept_key),
        None,
    )
    if concept is None:
        raise ValueError("Updated concept snapshot could not be found.")
    return concept


def record_concept_study(
    db: Session,
    current_user: User,
    lesson_graph_id: int,
    concept_key: str,
    minutes: int,
    mark_complete: bool = True,
) -> dict[str, object]:
    _graph, concept = get_lesson_concept_or_404(db, current_user, lesson_graph_id, concept_key)
    progress = get_or_create_concept_progress(db, current_user, lesson_graph_id, concept_key)
    now = datetime.now(timezone.utc)
    progress.study_count = int(progress.study_count or 0) + 1
    progress.total_study_minutes = int(progress.total_study_minutes or 0) + int(minutes)
    progress.last_studied_at = now
    progress.status = "studied" if mark_complete else "in_progress"

    db.add(
        StudySession(
            topic=concept.name,
            time_spent=int(minutes),
            date=now.date(),
            started_at=now,
            ended_at=now,
            source="manual",
            user_id=current_user.id,
        )
    )
    db.add(progress)
    db.commit()
    return get_concept_snapshot(db, current_user, lesson_graph_id, concept_key)


def record_lesson_quiz_attempt(
    db: Session,
    current_user: User,
    lesson_graph_id: int,
    concept_key: str,
    question: str,
    score: float,
    response_label: str,
) -> dict[str, object]:
    _graph, concept = get_lesson_concept_or_404(db, current_user, lesson_graph_id, concept_key)
    progress = get_or_create_concept_progress(db, current_user, lesson_graph_id, concept_key)
    now = datetime.now(timezone.utc)

    previous_attempts = int(progress.quiz_attempt_count or 0)
    previous_average = float(progress.average_quiz_score or 0)
    next_attempt_count = previous_attempts + 1
    next_average = ((previous_average * previous_attempts) + float(score)) / max(1, next_attempt_count)

    progress.quiz_attempt_count = next_attempt_count
    progress.average_quiz_score = round(next_average, 2)
    progress.best_quiz_score = max(float(progress.best_quiz_score or 0), float(score))
    progress.last_quiz_score = float(score)
    progress.last_quizzed_at = now
    if score >= 80:
        progress.status = "studied"
    elif score >= 45 and (progress.status or "not_started") == "not_started":
        progress.status = "in_progress"

    db.add(
        LessonQuizAttempt(
            lesson_graph_id=lesson_graph_id,
            concept_key=concept_key,
            user_id=current_user.id,
            question=question.strip(),
            score=float(score),
            response_label=response_label,
        )
    )
    db.add(
        StudentPerformance(
            topic=concept.name,
            score=float(score),
            attempts=1,
            time_spent=10,
            user_id=current_user.id,
        )
    )
    db.add(progress)
    db.commit()
    return get_concept_snapshot(db, current_user, lesson_graph_id, concept_key)
