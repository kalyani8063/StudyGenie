import { useMemo, useState } from "react";

import Badge from "./ui/Badge.jsx";
import Button from "./ui/Button.jsx";

const levelLabels = {
  critical: "Critical",
  struggling: "Struggling",
  low_engagement: "Low Engagement",
  weak: "Weak",
  medium: "Medium",
  strong: "Strong",
};

function RecommendationCard({ entry, isLoading = false, title = "Study recommendation" }) {
  const [isOpen, setIsOpen] = useState(false);
  const level = entry?.result?.level ?? "medium";
  const tone = useMemo(() => {
    if (["critical", "struggling", "weak"].includes(level)) return "danger";
    if (["medium", "low_engagement"].includes(level)) return "warning";
    if (level === "strong") return "success";
    return "default";
  }, [level]);

  if (!entry) {
    return (
      <article className="recommendation-card">
        <div className="recommendation-header">
          <div className="card-header">
            <span className="card-icon">SG</span>
            <div>
              <p className="section-label">Recommendation</p>
              <h3 className="recommendation-heading">{title}</h3>
            </div>
          </div>
          <Badge tone="default">Waiting</Badge>
        </div>

        <section className="recommendation-section">
          <p className="recommendation-text">
            Start your first study session or complete a planned task to generate a recommendation.
          </p>
        </section>
      </article>
    );
  }

  return (
    <article className="recommendation-card">
      <div className="recommendation-header">
        <div className="card-header">
          <span className="card-icon">SG</span>
          <div>
            <p className="section-label">Recommendation</p>
            <h3 className="recommendation-heading">{title}</h3>
          </div>
        </div>

        <Badge tone={tone}>
          {isLoading ? "Refreshing" : levelLabels[level] ?? level}
        </Badge>
      </div>

      <section className="recommendation-section">
        <p className="section-label">Action</p>
        <p className="recommendation-text">{entry.result.recommendation}</p>
      </section>

      <div className="planner-metric-grid">
        <div className="planner-metric">
          <span className="section-label">Topic</span>
          <strong>{entry.metrics.topic}</strong>
        </div>
        <div className="planner-metric">
          <span className="section-label">Progress score</span>
          <strong>{entry.metrics.score}%</strong>
        </div>
        <div className="planner-metric">
          <span className="section-label">Attempts</span>
          <strong>{entry.metrics.attempts}</strong>
        </div>
        <div className="planner-metric">
          <span className="section-label">Tracked time</span>
          <strong>{entry.metrics.time_spent} min</strong>
        </div>
      </div>

      <div className="recommendation-actions">
        <Button
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          size="sm"
          variant="ghost"
        >
          {isOpen ? "Hide reasoning" : "Why this recommendation?"}
        </Button>
      </div>

      {isOpen ? (
        <section className="recommendation-section recommendation-reason">
          <p className="section-label">Reasoning</p>
          <p className="reason-text">{entry.result.reason}</p>
        </section>
      ) : null}
    </article>
  );
}

export default RecommendationCard;
