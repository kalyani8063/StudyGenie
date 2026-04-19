import { useNavigate } from "react-router-dom";

import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import {
  formatWeekLabel,
  generateWeeklyRecommendation,
  getPlanForDate,
  getWeeklyDaySections,
  getWeeklyPlanStats,
} from "../lib/weeklyPlanner.js";
import { useStudy } from "../state/StudyContext.jsx";

const priorityTone = {
  high: "danger",
  medium: "warning",
  light: "default",
};

function StudyGuidePage() {
  const navigate = useNavigate();
  const {
    activeTimerTask,
    activeWeeklyPlanId,
    startWeeklyTaskTimer,
    studySessions,
    toggleWeeklyTask,
    weeklyPlans,
  } = useStudy();
  const activePlan =
    weeklyPlans.find((plan) => plan.id === activeWeeklyPlanId) ??
    getPlanForDate(weeklyPlans) ??
    weeklyPlans[0] ??
    null;

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
  const daySections = getWeeklyDaySections(activePlan, studySessions);

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

        <div className="planner-metric-grid">
          <div className="planner-metric">
            <span className="section-label">Completed tasks</span>
            <strong>{stats.completedCount}</strong>
          </div>
          <div className="planner-metric">
            <span className="section-label">Planned minutes</span>
            <strong>{stats.plannedMinutes} min</strong>
          </div>
          <div className="planner-metric">
            <span className="section-label">Completed minutes</span>
            <strong>{stats.completedMinutes} min</strong>
          </div>
          <div className="planner-metric">
            <span className="section-label">Logged minutes</span>
            <strong>{stats.loggedMinutes} min</strong>
          </div>
        </div>
      </Card>

      <Card
        subtitle="Each day keeps its own planned tasks, completed work, and logged study time."
        title="Day-wise weekly progress"
      >
        <div className="weekly-board">
          {daySections.map((day) => (
            <article className="weekly-day-card" key={day.dateKey}>
              <div className="weekly-day-header">
                <div>
                  <strong>{day.label}</strong>
                  <p className="muted-copy">{day.dateKey}</p>
                </div>
                <Badge tone={day.completionRate === 100 && day.tasks.length > 0 ? "success" : "default"}>
                  {day.completedCount}/{day.tasks.length || 0} complete
                </Badge>
              </div>

              <div className="planner-day-summary">
                <span className="topic-pill">{day.plannedMinutes} min planned</span>
                <span className="topic-pill">{day.completedMinutes} min completed</span>
                <span className="topic-pill">{day.loggedMinutes} min logged</span>
              </div>

              <div className="weekly-task-list">
                {day.tasks.length > 0 ? (
                  day.tasks.map((task) => {
                    const isActiveTask =
                      activeTimerTask?.planId === activePlan.id &&
                      activeTimerTask?.taskId === task.id;

                    return (
                      <div
                        className={`planner-task-item${task.completed ? " is-complete" : ""}`}
                        key={task.id}
                      >
                        <label className="planner-task-main">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleWeeklyTask(activePlan.id, task.id)}
                          />
                          <span>
                            <strong>{task.topic}</strong>
                            <small>
                              {task.duration_minutes} min planned | {task.priority} priority
                              {task.notes ? ` | ${task.notes}` : ""}
                            </small>
                          </span>
                        </label>

                        <div className="planner-task-actions planner-task-actions-wrap">
                          <Badge tone={priorityTone[task.priority] ?? "default"}>
                            {task.priority}
                          </Badge>
                          {!task.completed ? (
                            isActiveTask ? (
                              <Button disabled size="sm" variant="secondary">
                                Timer running
                              </Button>
                            ) : (
                              <Button
                                onClick={() => {
                                  startWeeklyTaskTimer(activePlan.id, task.id);
                                  navigate("/tracker");
                                }}
                                size="sm"
                                variant="ghost"
                              >
                                Start timer
                              </Button>
                            )
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="planner-day-empty">
                    <p>No tasks planned for this day.</p>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </Card>
    </section>
  );
}

export default StudyGuidePage;
