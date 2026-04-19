from pathlib import Path
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.exceptions import InconsistentVersionWarning
from sklearn.model_selection import train_test_split

try:
    from .schemas import RecommendationRequest, RecommendationResponse
except ImportError:
    from schemas import RecommendationRequest, RecommendationResponse

MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"
RANDOM_STATE = 42

_model: RandomForestClassifier | None = None


def apply_rules(
    score: float,
    attempts: int,
    time_spent: int,
) -> RecommendationResponse | None:
    """
    Apply expert-system rules before falling back to the ML model.

    Returning None means no rule matched and the ML model should be used.
    """
    # Rule 1: Very low scores need immediate attention regardless of other data.
    if score < 30:
        return RecommendationResponse(
            level="critical",
            recommendation="Immediate revision required. Focus on fundamentals.",
            reason="Rule-based override: extremely low score",
        )

    # Rule 2: Repeated attempts with a low score suggest the student is struggling.
    if attempts >= 4 and score < 50:
        return RecommendationResponse(
            level="struggling",
            recommendation="Revise concepts and practice step-by-step problems",
            reason="Rule-based override: high attempts with low score indicates difficulty",
        )

    # Rule 3: Low study time with a weak score suggests low engagement.
    if time_spent < 20 and score < 60:
        return RecommendationResponse(
            level="low_engagement",
            recommendation="Increase study time and review concepts thoroughly",
            reason="Rule-based override: low study time detected",
        )

    return None


def generate_synthetic_data(row_count: int = 400) -> pd.DataFrame:
    """
    Generate synthetic student performance data for the prototype ML model.

    Labels follow the same academic rule that started the prototype:
    score < 40 is weak, 40-70 is medium, and above 70 is strong.
    """
    if not 300 <= row_count <= 500:
        raise ValueError("row_count must be between 300 and 500")

    rng = np.random.default_rng(RANDOM_STATE)

    scores = rng.integers(0, 101, size=row_count)
    attempts = rng.integers(1, 6, size=row_count)
    time_spent = rng.integers(10, 121, size=row_count)

    labels = np.where(scores < 40, "weak", np.where(scores <= 70, "medium", "strong"))

    return pd.DataFrame(
        {
            "score": scores,
            "attempts": attempts,
            "time_spent": time_spent,
            "label": labels,
        }
    )


def train_model() -> RandomForestClassifier:
    """Train the RandomForest model once and save it to disk."""
    data = generate_synthetic_data()
    features = data[["score", "attempts", "time_spent"]]
    labels = data["label"]

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=labels,
    )

    model = RandomForestClassifier(
        n_estimators=100,
        random_state=RANDOM_STATE,
    )
    model.fit(x_train, y_train)

    accuracy = model.score(x_test, y_test)
    print(f"Model accuracy: {accuracy:.2f}")

    joblib.dump(model, MODEL_PATH)
    return model


def load_model() -> RandomForestClassifier:
    """
    Load the saved model, training it only if model.pkl does not exist yet.

    The loaded model is cached in memory so API requests reuse the same model.
    """
    global _model

    if _model is not None:
        return _model

    if MODEL_PATH.exists():
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", InconsistentVersionWarning)
                _model = joblib.load(MODEL_PATH)
        except InconsistentVersionWarning:
            _model = train_model()
    else:
        _model = train_model()

    return _model


def build_reason(prediction: str, request: RecommendationRequest) -> str:
    """Create a short, explainable reason for the model prediction."""
    if request.score < 40:
        score_note = "low score"
    elif request.score <= 70:
        score_note = "moderate score"
    else:
        score_note = "high score"

    attempt_note = "high attempts" if request.attempts >= 4 else "few attempts"
    time_note = "long study time" if request.time_spent >= 75 else "short study time"

    return f"Predicted as {prediction} because of {score_note}, {attempt_note}, and {time_note}."


def resolve_break_summary(
    request: RecommendationRequest,
    break_summary: dict[str, float | int | str] | None,
) -> dict[str, float | int | str] | None:
    """Use backend-derived break data first, then fall back to the request payload."""
    if break_summary is not None:
        return break_summary

    if request.recent_break_count is None or request.average_break_minutes is None:
        return None

    return {
        "count": request.recent_break_count,
        "average_minutes": request.average_break_minutes,
        "total_minutes": request.recent_break_minutes or 0,
        "scope": "recent",
    }


def add_break_guidance(
    recommendation: str,
    break_summary: dict[str, float | int | str] | None,
) -> str:
    """Append pacing advice when recent break habits look unbalanced."""
    if break_summary is None or int(break_summary.get("count", 0)) == 0:
        return recommendation

    average_break = float(break_summary.get("average_minutes", 0))
    total_break = float(break_summary.get("total_minutes", 0))

    if average_break < 5:
        return f"{recommendation} Add a 5-10 minute recovery break between blocks."

    if average_break > 20 or total_break >= 90:
        return f"{recommendation} Keep breaks shorter so they do not eat into study momentum."

    return recommendation


def append_break_reason(
    reason: str,
    break_summary: dict[str, float | int | str] | None,
) -> str:
    """Append pacing context to an existing reason string."""
    if break_summary is None or int(break_summary.get("count", 0)) == 0:
        return reason

    scope = "this topic" if break_summary.get("scope") == "topic" else "recent sessions"
    average_break = float(break_summary.get("average_minutes", 0))
    total_break = float(break_summary.get("total_minutes", 0))

    if average_break < 5:
        return (
            f"{reason} Break logs for {scope} show very short pauses, which can increase fatigue "
            "and reduce retention."
        )

    if average_break > 20 or total_break >= 90:
        return (
            f"{reason} Break logs for {scope} are on the long side, so focus momentum may be "
            "dropping between blocks."
        )

    return f"{reason} Break logs for {scope} show a balanced pacing pattern."


def build_reason_with_breaks(
    prediction: str,
    request: RecommendationRequest,
    break_summary: dict[str, float | int | str] | None,
) -> str:
    """Extend the model reason with break pacing insight when available."""
    return append_break_reason(build_reason(prediction, request), break_summary)


def generate_recommendation(
    request: RecommendationRequest,
    break_summary: dict[str, float | int | str] | None = None,
) -> RecommendationResponse:
    """Apply expert rules first, then use ML prediction if no rule matches."""
    resolved_break_summary = resolve_break_summary(request, break_summary)
    rule_result = apply_rules(
        score=request.score,
        attempts=request.attempts,
        time_spent=request.time_spent,
    )
    if rule_result is not None:
        return RecommendationResponse(
            level=rule_result.level,
            recommendation=add_break_guidance(
                rule_result.recommendation,
                resolved_break_summary,
            ),
            reason=append_break_reason(
                rule_result.reason,
                resolved_break_summary,
            ),
        )

    model = load_model()
    features = pd.DataFrame(
        [
            {
                "score": request.score,
                "attempts": request.attempts,
                "time_spent": request.time_spent,
            }
        ]
    )
    prediction = model.predict(features)[0]

    recommendations = {
        "weak": "Revise basics and watch beginner videos",
        "medium": "Practice more problems and revise concepts",
        "strong": "Try advanced problems and mock tests",
    }

    return RecommendationResponse(
        level=prediction,
        recommendation=add_break_guidance(recommendations[prediction], resolved_break_summary),
        reason=build_reason_with_breaks(prediction, request, resolved_break_summary),
    )


# Load the model once when the module is imported by FastAPI.
load_model()
