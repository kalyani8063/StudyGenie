import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { formatWeekLabel, getWeeklyPlanStats } from "../lib/weeklyPlanner.js";
import { useStudy } from "../state/StudyContext.jsx";

function HistoryPage() {
  const { studySessions, weeklyPlans } = useStudy();

  return (
    <section className="history-page">
      <div className="page-heading">
        <p className="eyebrow">History</p>
        <h2>Saved weekly plans and their progress signals.</h2>
      </div>

      <Card subtitle="A running archive of your weekly study plans." title="Weekly plan archive">
        {weeklyPlans.length > 0 ? (
          <div className="history-list">
            {weeklyPlans.map((plan) => {
              const stats = getWeeklyPlanStats(plan, studySessions);

              return (
                <article className="history-row" key={plan.id}>
                  <div>
                    <strong>{plan.title}</strong>
                    <span>{formatWeekLabel(plan.weekStart)}</span>
                  </div>
                  <div className="history-metrics">
                    <span>{plan.tasks.length} tasks</span>
                    <span>{stats.completionRate}% complete</span>
                    <span>{stats.loggedMinutes} logged min</span>
                  </div>
                  <span className="level-badge medium">{stats.remainingCount} open</span>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No weekly plans saved"
            message="Create your first weekly plan to start building a useful history."
          />
        )}
      </Card>
    </section>
  );
}

export default HistoryPage;
