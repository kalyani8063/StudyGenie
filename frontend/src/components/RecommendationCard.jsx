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

function RecommendationCard({ onSave, result, saveDisabled = false }) {
  const level = result?.level ?? "medium";
  const [isOpen, setIsOpen] = useState(false);
  const tone = useMemo(() => {
    if (["critical", "struggling", "weak"].includes(level)) return "danger";
    if (["medium", "low_engagement"].includes(level)) return "warning";
    if (level === "strong") return "success";
    return "default";
  }, [level]);

  return (
    <article className="recommendation-card">
      <div className="recommendation-header">
        <div className="card-header">
          <span className="card-icon">AI</span>
          <div>
            <p className="section-label">Recommendation</p>
            <h3 className="recommendation-heading">Priority review</h3>
          </div>
        </div>

        <Badge tone={tone}>{levelLabels[level] ?? level}</Badge>
      </div>

      <section className="recommendation-section">
        <p className="section-label">Action</p>
        <p className="recommendation-text">{result.recommendation}</p>
      </section>

      <div className="recommendation-divider" />

      <div className="recommendation-actions">
        {onSave ? (
          <Button onClick={onSave} size="sm" variant="secondary" disabled={saveDisabled}>
            Save recommendation
          </Button>
        ) : null}
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
          <p className="reason-text">{result.reason}</p>
        </section>
      ) : null}
    </article>
  );
}

export default RecommendationCard;
