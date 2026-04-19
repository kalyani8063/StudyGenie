import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Badge from "../components/ui/Badge.jsx";
import { formatWeekLabel, generateWeeklyRecommendation, getWeeklyPlanStats } from "../lib/weeklyPlanner.js";
import { useStudy } from "../state/StudyContext.jsx";

function StudyGuidePage() {
  const { activeWeeklyPlanId, studySessions, toggleWeeklyTask, weeklyPlans } = useStudy();
  const activePlan =
    weeklyPlans.find((plan) => plan.id === activeWeeklyPlanId) ?? weeklyPlans[0] ?? null;

  if (!activePlan) {
    return (
      <section className="guide-page">
        <div className="page-heading">
          <p className="eyebrow">Weekly Progress</p>
          <h2>Your weekly progress guide appears after you create a study week.</h2>
        </div>
        <Card>
          <EmptyState
            title="No weekly plan yet"
            message="Open the weekly planner first, create a week, and add some tasks."
          />
        </Card>
      </section>
    );
  }

  const stats = getWeeklyPlanStats(activePlan, studySessions);
  const recommendation = generateWeeklyRecommendation(activePlan, studySessions);

  return (
    <section className="guide-page">
      <div className="page-heading">
        <p className="eyebrow">Weekly Progress</p>
        <h2>{activePlan.title}</h2>
      </div>

      <Card
        subtitle={`Tracking ${formatWeekLabel(activePlan.weekStart)} with ${activePlan.tasks.length} planned task(s).`}
        title="Progress guide"
        action={<Badge tone={recommendation.tone}>{recommendation.title}</Badge>}
      >
        <div className="progress-track">
          <span style={{ width: `${stats.completionRate}%` }} />
        </div>
        <p className="muted-copy">{stats.completionRate}% complete</p>

        <div className="checklist">
          {activePlan.tasks.length > 0 ? (
            activePlan.tasks.map((task) => (
              <label className="check-item" key={task.id}>
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleWeeklyTask(activePlan.id, task.id)}
                />
                <span>
                  <strong>
                    {task.topic} ({task.duration_minutes} min)
                  </strong>
                  <small>
                    {task.day.toUpperCase()} • {task.priority} priority
                    {task.notes ? ` • ${task.notes}` : ""}
                  </small>
                </span>
              </label>
            ))
          ) : (
            <EmptyState
              title="No tasks in this week"
              message="Go back to the weekly planner and add a few tasks to start tracking progress."
            />
          )}
        </div>
      </Card>
    </section>
  );
}

export default StudyGuidePage;
