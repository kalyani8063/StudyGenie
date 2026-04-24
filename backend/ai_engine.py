import logging

if __package__:
    from .schemas import RecommendationRequest, RecommendationResponse
else:
    from schemas import RecommendationRequest, RecommendationResponse


logger = logging.getLogger(__name__)


FORWARD_RULES = [
    {
        "name": "critical_score_implies_help",
        "if": ["critical_score"],
        "then": ["low_score", "needs_help", "critical_attention"],
    },
    {
        "name": "low_score_implies_help",
        "if": ["low_score"],
        "then": ["needs_help"],
    },
    {
        "name": "needs_help_with_attempts_implies_struggling",
        "if": ["needs_help", "high_attempts"],
        "then": ["struggling"],
    },
    {
        "name": "needs_help_with_low_time_implies_low_engagement",
        "if": ["needs_help", "low_time"],
        "then": ["low_engagement"],
    },
    {
        "name": "improving_implies_positive_trend",
        "if": ["improving"],
        "then": ["positive_trend"],
    },
    {
        "name": "positive_trend_with_effort_implies_recovery",
        "if": ["positive_trend", "strong_time_investment"],
        "then": ["strong_recovery"],
    },
    {
        "name": "high_score_with_effort_implies_mastery",
        "if": ["high_score", "strong_time_investment"],
        "then": ["mastery"],
    },
    {
        "name": "balanced_breaks_imply_steady_pacing",
        "if": ["balanced_breaks"],
        "then": ["steady_pacing"],
    },
    {
        "name": "short_breaks_imply_fatigue_risk",
        "if": ["short_breaks"],
        "then": ["fatigue_risk"],
    },
    {
        "name": "long_breaks_imply_momentum_risk",
        "if": ["long_breaks"],
        "then": ["momentum_risk"],
    },
    {
        "name": "struggling_with_fatigue_implies_at_risk",
        "if": ["struggling", "fatigue_risk"],
        "then": ["at_risk"],
    },
    {
        "name": "mastery_with_steady_pacing_implies_confident_progress",
        "if": ["mastery", "steady_pacing"],
        "then": ["confident_progress"],
    },
    {
        "name": "medium_score_with_effort_implies_building_consistency",
        "if": ["medium_score", "strong_time_investment"],
        "then": ["building_consistency"],
    },
]


def score_delta(current_score: float, previous_score: float | None) -> float | None:
    if previous_score is None:
        return None
    return round(current_score - previous_score, 1)


def describe_break_pattern(
    break_summary: dict[str, float | int | str] | None,
) -> tuple[str, str]:
    if break_summary is None or int(break_summary.get("count", 0)) == 0:
        return ("", "")

    scope = "this topic" if break_summary.get("scope") == "topic" else "recent sessions"
    average_break = float(break_summary.get("average_minutes", 0))
    total_break = float(break_summary.get("total_minutes", 0))

    if average_break < 5:
        return (
            " Add a 5-10 minute recovery break between study blocks.",
            f" Breaks for {scope} have been very short, which can increase fatigue.",
        )

    if average_break > 20 or total_break >= 90:
        return (
            " Keep breaks shorter so they do not drain your study momentum.",
            f" Breaks for {scope} have been longer than ideal, so momentum may be dropping.",
        )

    return (
        " Your recent break pacing looks balanced, so keep that rhythm going.",
        f" Break pacing for {scope} has stayed in a healthy range.",
    )


def build_response(
    *,
    level: RecommendationResponse.__annotations__["level"],
    recommendation: str,
    reason: str,
    break_summary: dict[str, float | int | str] | None,
) -> RecommendationResponse:
    recommendation_suffix, reason_suffix = describe_break_pattern(break_summary)
    return RecommendationResponse(
        level=level,
        recommendation=f"{recommendation}{recommendation_suffix}",
        reason=f"{reason}{reason_suffix}",
    )


def build_facts_from_request(
    request: RecommendationRequest,
    previous_score: float | None = None,
    break_summary: dict[str, float | int | str] | None = None,
) -> dict[str, bool]:
    delta = score_delta(request.score, previous_score)
    average_break = (
        float(break_summary.get("average_minutes", 0))
        if break_summary is not None and int(break_summary.get("count", 0)) > 0
        else None
    )
    total_break = (
        float(break_summary.get("total_minutes", 0))
        if break_summary is not None and int(break_summary.get("count", 0)) > 0
        else 0
    )

    return {
        "critical_score": request.score < 35,
        "low_score": request.score < 60,
        "medium_score": 60 <= request.score < 80,
        "high_score": request.score >= 85,
        "high_attempts": request.attempts >= 4,
        "low_time": request.time_spent < 45,
        "strong_time_investment": request.time_spent >= 60,
        "improving": delta is not None and delta >= 12 and request.score >= 65,
        "short_breaks": average_break is not None and average_break < 5,
        "long_breaks": average_break is not None and (average_break > 20 or total_break >= 90),
        "balanced_breaks": average_break is not None and 5 <= average_break <= 20 and total_break < 90,
    }


def forward_chain(
    facts: dict[str, bool],
    rules: list[dict[str, list[str] | str]],
) -> tuple[dict[str, bool], set[str], list[dict[str, list[str] | str]]]:
    inferred: set[str] = set()
    fired_rules: list[dict[str, list[str] | str]] = []
    changed = True

    while changed:
        changed = False
        for rule in rules:
            if all(facts.get(condition, False) for condition in rule["if"]):
                new_conclusions = [
                    conclusion
                    for conclusion in rule["then"]
                    if not facts.get(conclusion, False)
                ]
                if not new_conclusions:
                    continue

                for conclusion in new_conclusions:
                    facts[conclusion] = True
                    inferred.add(conclusion)

                fired_rules.append(rule)
                changed = True

    return facts, inferred, fired_rules


def format_reason_trace(
    fired_rules: list[dict[str, list[str] | str]],
    selected_fact: str | None,
) -> str:
    if fired_rules:
        trace = "; ".join(
            f"{' + '.join(rule['if'])} -> {', '.join(rule['then'])}" for rule in fired_rules
        )
        return f"Derived from facts: {trace}."

    if selected_fact:
        return f"Derived from facts: {selected_fact}."

    return "Derived from facts: baseline_progress."


def choose_action(
    request: RecommendationRequest,
    facts: dict[str, bool],
    fired_rules: list[dict[str, list[str] | str]],
    break_summary: dict[str, float | int | str] | None = None,
) -> RecommendationResponse:
    reason_prefix = ""

    if facts.get("critical_attention"):
        reason_prefix = format_reason_trace(fired_rules, "critical_score")
        return build_response(
            level="critical",
            recommendation=(
                f"Pause new topics in {request.topic} and spend the next session rebuilding the "
                "core concepts with worked examples."
            ),
            reason=(
                f"{reason_prefix} The score is {request.score:.0f}, so fundamentals need "
                "attention before harder practice will pay off."
            ),
            break_summary=break_summary,
        )

    if facts.get("at_risk") or facts.get("struggling"):
        reason_prefix = format_reason_trace(fired_rules, "struggling")
        return build_response(
            level="struggling",
            recommendation=(
                f"Slow {request.topic} down into step-by-step review and correct recent mistakes "
                "before attempting another full block."
            ),
            reason=(
                f"{reason_prefix} Multiple attempts with weak progress indicate repetition without "
                "enough correction."
            ),
            break_summary=break_summary,
        )

    if facts.get("low_engagement"):
        reason_prefix = format_reason_trace(fired_rules, "low_engagement")
        return build_response(
            level="low_engagement",
            recommendation=(
                f"Increase your next {request.topic} session to 45-60 focused minutes and finish "
                "one planned task completely."
            ),
            reason=(
                f"{reason_prefix} The current score is being limited more by shallow time "
                "investment than by lack of attempts."
            ),
            break_summary=break_summary,
        )

    if facts.get("confident_progress") or facts.get("mastery") or facts.get("strong_recovery"):
        reason_prefix = format_reason_trace(
            fired_rules,
            "confident_progress" if facts.get("confident_progress") else "mastery",
        )
        return build_response(
            level="strong",
            recommendation=(
                f"You are in a strong place on {request.topic}. Use the next session for harder "
                "questions, timed recall, or a short mock test."
            ),
            reason=(
                f"{reason_prefix} The score and time investment show strong understanding and a "
                "healthy study rhythm."
            ),
            break_summary=break_summary,
        )

    if facts.get("needs_help"):
        reason_prefix = format_reason_trace(fired_rules, "needs_help")
        return build_response(
            level="weak",
            recommendation=(
                f"Stay with {request.topic}, review the gaps from the last session, and complete "
                "one clear practice set before moving on."
            ),
            reason=(
                f"{reason_prefix} The foundation is still shaky, so the next study block should "
                "focus on basics instead of new material."
            ),
            break_summary=break_summary,
        )

    reason_prefix = format_reason_trace(
        fired_rules,
        "building_consistency" if facts.get("building_consistency") else "medium_score",
    )
    return build_response(
        level="medium",
        recommendation=(
            f"You are building momentum in {request.topic}. Keep the next study block focused on "
            "one unfinished task and close it fully."
        ),
        reason=(
            f"{reason_prefix} Progress is real but still partial, so consolidation is the best "
            "next move."
        ),
        break_summary=break_summary,
    )


class StudyAgent:
    def __init__(self, rules: list[dict[str, list[str] | str]] | None = None):
        self.rules = rules or FORWARD_RULES
        self.last_action: RecommendationResponse | None = None

    def perceive(
        self,
        request: RecommendationRequest,
        previous_score: float | None = None,
        break_summary: dict[str, float | int | str] | None = None,
    ) -> dict[str, bool]:
        return build_facts_from_request(
            request,
            previous_score=previous_score,
            break_summary=break_summary,
        )

    def decide(
        self,
        request: RecommendationRequest,
        facts: dict[str, bool],
        break_summary: dict[str, float | int | str] | None = None,
    ) -> RecommendationResponse:
        updated_facts, inferred, fired_rules = forward_chain(dict(facts), self.rules)
        logger.info(
            "StudyAgent inferred facts for topic=%s fired_rules=%s inferred=%s true_facts=%s",
            request.topic,
            [str(rule["name"]) for rule in fired_rules],
            sorted(inferred),
            sorted(fact for fact, value in updated_facts.items() if value),
        )
        action = choose_action(
            request,
            updated_facts,
            fired_rules,
            break_summary=break_summary,
        )
        self.last_action = action
        return action

    def act(self, action: RecommendationResponse) -> RecommendationResponse:
        self.last_action = action
        return action


def generate_recommendation(
    request: RecommendationRequest,
    previous_score: float | None = None,
    break_summary: dict[str, float | int | str] | None = None,
) -> RecommendationResponse:
    agent = StudyAgent()
    facts = agent.perceive(
        request,
        previous_score=previous_score,
        break_summary=break_summary,
    )
    action = agent.decide(
        request,
        facts,
        break_summary=break_summary,
    )
    return agent.act(action)
