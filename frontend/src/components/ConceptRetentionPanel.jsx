import Card from "./Card.jsx";
import EmptyState from "./EmptyState.jsx";
import Badge from "./ui/Badge.jsx";
import { useAuth } from "../state/AuthContext.jsx";

function getStatusTone(status) {
  if (status === "at_risk") return "danger";
  if (status === "watch") return "warning";
  return "success";
}

function formatPercent(value) {
  if (value == null) {
    return "--";
  }
  return `${Math.round(Number(value) * 100)}%`;
}

function ConceptRetentionPanel({
  conceptRetention,
  error = "",
  isLoading = false,
  title = "Adaptive concept retention",
  subtitle = "StudyGenie estimates which lesson concepts are holding up and which ones are decaying.",
}) {
  const { isAuthenticated } = useAuth();
  const atRiskConcepts = conceptRetention?.at_risk_concepts ?? [];
  const strongestConcepts = conceptRetention?.strongest_concepts ?? [];
  const emptyTitle = !isAuthenticated
    ? "Sign in to sync lesson graphs"
    : error
      ? "Concept graph unavailable"
      : "No concept graph yet";
  const emptyMessage = !isAuthenticated
    ? "Lesson Studio can process a PowerPoint locally, but the dashboard graph only appears after you sign in and save the lesson to your account."
    : error
      ? error
      : "Open Lesson Studio, upload a PowerPoint deck, and save it to your account to populate this graph.";

  return (
    <Card subtitle={subtitle} title={title}>
      {conceptRetention?.concept_count > 0 ? (
        <div className="concept-panel-stack">
          <div className="planner-metric-grid">
            <div className="planner-metric">
              <span className="section-label">Saved lessons</span>
              <strong>{conceptRetention.lesson_count}</strong>
            </div>
            <div className="planner-metric">
              <span className="section-label">Tracked concepts</span>
              <strong>{conceptRetention.concept_count}</strong>
            </div>
            <div className="planner-metric">
              <span className="section-label">Graph links</span>
              <strong>{conceptRetention.graph_edges.length}</strong>
            </div>
            <div className="planner-metric">
              <span className="section-label">Updated</span>
              <strong>
                {conceptRetention.updated_at
                  ? new Date(conceptRetention.updated_at).toLocaleDateString()
                  : "--"}
              </strong>
            </div>
          </div>

          <div className="studio-grid">
            <section className="concept-column">
              <div className="study-list-row">
                <div>
                  <p className="section-label">At-risk concepts</p>
                  <p className="field-helper">Review these first before they fade further.</p>
                </div>
              </div>

              {atRiskConcepts.length > 0 ? (
                <div className="study-list">
                  {atRiskConcepts.map((concept) => (
                    <article className="study-list-item concept-card" key={concept.concept_key}>
                      <div className="study-list-row">
                        <div className="concept-card-copy">
                          <strong>{concept.name}</strong>
                          <p className="field-helper">
                            {concept.parent_name ? `${concept.parent_name} -> ` : ""}
                            {concept.kind}
                          </p>
                        </div>
                        <Badge tone={getStatusTone(concept.status)}>{concept.status ?? "watch"}</Badge>
                      </div>

                      <div className="study-chip-row">
                        <span className="topic-pill topic-pill-soft">
                          Retention {formatPercent(concept.retention_score)}
                        </span>
                        <span className="topic-pill topic-pill-soft">
                          Risk {formatPercent(concept.forgetting_risk)}
                        </span>
                        <span className="topic-pill topic-pill-soft">
                          Evidence {concept.evidence_count ?? 0}
                        </span>
                      </div>

                      <p className="field-helper">{concept.insight}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No at-risk concepts yet"
                  message="Upload a lesson deck and log study activity to start seeing concept decay signals."
                />
              )}
            </section>

            <section className="concept-column">
              <div className="study-list-row">
                <div>
                  <p className="section-label">Strongest concepts</p>
                  <p className="field-helper">These concepts have the healthiest retention right now.</p>
                </div>
              </div>

              {strongestConcepts.length > 0 ? (
                <div className="study-list">
                  {strongestConcepts.map((concept) => (
                    <article className="study-list-item concept-card concept-card-strong" key={concept.concept_key}>
                      <div className="study-list-row">
                        <div className="concept-card-copy">
                          <strong>{concept.name}</strong>
                          <p className="field-helper">
                            {concept.parent_name ? `${concept.parent_name} -> ` : ""}
                            {concept.kind}
                          </p>
                        </div>
                        <Badge tone={getStatusTone(concept.status)}>{concept.status ?? "strong"}</Badge>
                      </div>

                      <div className="study-chip-row">
                        <span className="topic-pill topic-pill-soft">
                          Mastery {formatPercent(concept.mastery_score)}
                        </span>
                        <span className="topic-pill topic-pill-soft">
                          Retention {formatPercent(concept.retention_score)}
                        </span>
                      </div>

                      <p className="field-helper">{concept.insight}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No stable concepts yet"
                  message="As you reinforce a saved lesson, stronger concepts will show up here."
                />
              )}
            </section>
          </div>

        </div>
      ) : (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      )}

      {conceptRetention?.concept_count > 0 && error ? <p className="error-message">{error}</p> : null}
      {isLoading ? <p className="field-helper">Refreshing concept retention...</p> : null}
    </Card>
  );
}

export default ConceptRetentionPanel;
