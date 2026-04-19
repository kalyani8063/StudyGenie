import { useMemo, useState } from "react";

import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import InputField from "../components/ui/InputField.jsx";
import {
  DAY_OPTIONS,
  formatWeekLabel,
  generateWeeklyRecommendation,
  getWeekDates,
  getWeekStart,
  getWeeklyPlanStats,
  groupTasksByDay,
  sortTasks,
} from "../lib/weeklyPlanner.js";
import { useStudy } from "../state/StudyContext.jsx";

const initialWeekMeta = {
  title: "",
  weekStart: getWeekStart(),
};

const initialTaskDraft = {
  topic: "",
  day: "mon",
  duration_minutes: "45",
  priority: "high",
  notes: "",
};

const priorityTone = {
  high: "danger",
  medium: "warning",
  light: "default",
};

function RecommendationPage() {
  const {
    activeWeeklyPlanId,
    addTaskToWeeklyPlan,
    createWeeklyPlan,
    removeTaskFromWeeklyPlan,
    setActiveWeeklyPlan,
    studySessions,
    toggleWeeklyTask,
    weeklyPlans,
  } = useStudy();
  const [weekMeta, setWeekMeta] = useState(initialWeekMeta);
  const [taskDraft, setTaskDraft] = useState(initialTaskDraft);
  const [weekError, setWeekError] = useState("");
  const [taskError, setTaskError] = useState("");

  const activePlan =
    weeklyPlans.find((plan) => plan.id === activeWeeklyPlanId) ?? weeklyPlans[0] ?? null;
  const activeWeekDates = getWeekDates(activePlan?.weekStart ?? weekMeta.weekStart);
  const groupedTasks = useMemo(
    () => groupTasksByDay(activePlan?.tasks ?? []),
    [activePlan],
  );
  const stats = getWeeklyPlanStats(activePlan, studySessions);
  const recommendation = generateWeeklyRecommendation(activePlan, studySessions);

  function handleWeekMetaChange(event) {
    const { name, value } = event.target;
    setWeekMeta((current) => ({ ...current, [name]: value }));
    setWeekError("");
  }

  function handleTaskChange(event) {
    const { name, value } = event.target;
    setTaskDraft((current) => ({ ...current, [name]: value }));
    setTaskError("");
  }

  function handleCreateWeek() {
    if (!weekMeta.weekStart) {
      setWeekError("Choose the Monday that should anchor this study week.");
      return;
    }

    const normalizedWeekStart = getWeekStart(`${weekMeta.weekStart}T00:00:00`);
    const savedPlan = createWeeklyPlan({
      title: weekMeta.title,
      weekStart: normalizedWeekStart,
    });

    setActiveWeeklyPlan(savedPlan.id);
    setWeekMeta({
      title: savedPlan.title,
      weekStart: savedPlan.weekStart,
    });
    setWeekError("");
  }

  function handleSelectPlan(plan) {
    setActiveWeeklyPlan(plan.id);
    setWeekMeta({
      title: plan.title,
      weekStart: plan.weekStart,
    });
  }

  function handleAddTask(event) {
    event.preventDefault();

    if (!activePlan) {
      setTaskError("Create or open a weekly plan before adding tasks.");
      return;
    }

    if (!taskDraft.topic.trim()) {
      setTaskError("Add the topic or task you want to study.");
      return;
    }

    if (!taskDraft.duration_minutes || Number(taskDraft.duration_minutes) < 15) {
      setTaskError("Use a duration of at least 15 minutes.");
      return;
    }

    addTaskToWeeklyPlan(activePlan.id, {
      topic: taskDraft.topic.trim(),
      day: taskDraft.day,
      duration_minutes: Number(taskDraft.duration_minutes),
      priority: taskDraft.priority,
      notes: taskDraft.notes.trim(),
    });

    setTaskDraft((current) => ({
      ...initialTaskDraft,
      day: current.day,
      priority: current.priority,
    }));
    setTaskError("");
  }

  return (
    <section className="recommendation-page weekly-planner-page">
      <div className="page-heading">
        <p className="eyebrow">Weekly Planner</p>
        <h2>Plan your study week, track completed tasks, and get rule-based guidance.</h2>
      </div>

      <div className="recommendation-grid">
        <Card
          subtitle="Start a week first, then keep adding topic blocks to the right days."
          title="Plan setup"
        >
          <div className="input-form">
            <InputField
              helper="Pick the Monday that should anchor this study week."
              label="Week start"
              name="weekStart"
              type="date"
              value={weekMeta.weekStart}
              onChange={handleWeekMetaChange}
            />

            <InputField
              helper="Optional label for the week."
              label="Week title"
              name="title"
              placeholder="Midterm prep week"
              type="text"
              value={weekMeta.title}
              onChange={handleWeekMetaChange}
            />

            <div className="planner-meta-row">
              <span className="topic-pill">{formatWeekLabel(weekMeta.weekStart)}</span>
              <Button onClick={handleCreateWeek}>
                {weeklyPlans.some((plan) => plan.weekStart === weekMeta.weekStart)
                  ? "Open week"
                  : "Create week"}
              </Button>
            </div>

            {weekError ? <p className="error-message">{weekError}</p> : null}
          </div>
        </Card>

        <Card
          subtitle="This recommendation updates automatically from your weekly plan and progress."
          title="Rule-based recommendation"
          action={<Badge tone={recommendation.tone}>{recommendation.title}</Badge>}
        >
          <div className="recommendation-card planner-recommendation-card">
            <section className="recommendation-section">
              <p className="section-label">Next move</p>
              <p className="recommendation-text">{recommendation.recommendation}</p>
            </section>

            <div className="recommendation-divider" />

            <section className="recommendation-section">
              <p className="section-label">Why</p>
              <p className="reason-text">{recommendation.reason}</p>
            </section>

            <div className="planner-metric-grid">
              <div className="planner-metric">
                <span className="section-label">Completion</span>
                <strong>{stats.completionRate}%</strong>
              </div>
              <div className="planner-metric">
                <span className="section-label">Completed tasks</span>
                <strong>{stats.completedCount}</strong>
              </div>
              <div className="planner-metric">
                <span className="section-label">Remaining</span>
                <strong>{stats.remainingCount}</strong>
              </div>
              <div className="planner-metric">
                <span className="section-label">Logged minutes</span>
                <strong>{stats.loggedMinutes} min</strong>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card
        subtitle="Switch between saved weeks and keep progress separate for each one."
        title="Your study weeks"
      >
        {weeklyPlans.length > 0 ? (
          <div className="pill-row">
            {weeklyPlans.map((plan) => (
              <Button
                key={plan.id}
                onClick={() => handleSelectPlan(plan)}
                variant={plan.id === activePlan?.id ? "secondary" : "ghost"}
              >
                {plan.title} ({formatWeekLabel(plan.weekStart)})
              </Button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No weekly plans yet"
            message="Create your first week above, then start adding study tasks day by day."
          />
        )}
      </Card>

      <div className="tracker-grid">
        <Card
          subtitle={
            activePlan
              ? `Add tasks to ${activePlan.title} and spread them across the week.`
              : "Create a week first so tasks have somewhere to go."
          }
          title="Add weekly task"
        >
          {activePlan ? (
            <form className="input-form" onSubmit={handleAddTask}>
              <InputField
                label="Task or topic"
                name="topic"
                placeholder="Calculus derivatives practice"
                type="text"
                value={taskDraft.topic}
                onChange={handleTaskChange}
              />

              <div className="form-grid">
                <label className="field">
                  <span className="field-label">Day</span>
                  <select
                    className="field-input"
                    name="day"
                    value={taskDraft.day}
                    onChange={handleTaskChange}
                  >
                    {DAY_OPTIONS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </label>

                <InputField
                  label="Duration"
                  min="15"
                  name="duration_minutes"
                  placeholder="45"
                  type="number"
                  value={taskDraft.duration_minutes}
                  onChange={handleTaskChange}
                />
              </div>

              <div className="form-grid">
                <label className="field">
                  <span className="field-label">Priority</span>
                  <select
                    className="field-input"
                    name="priority"
                    value={taskDraft.priority}
                    onChange={handleTaskChange}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="light">Light</option>
                  </select>
                </label>

                <InputField
                  label="Notes"
                  multiline
                  name="notes"
                  placeholder="Focus on word problems and past mistakes."
                  value={taskDraft.notes}
                  onChange={handleTaskChange}
                />
              </div>

              <Button type="submit">Add task</Button>
              {taskError ? <p className="error-message">{taskError}</p> : null}
            </form>
          ) : (
            <EmptyState
              title="No active week"
              message="Create or open a week above, then you can start adding study tasks."
            />
          )}
        </Card>

        <Card
          subtitle={
            activePlan
              ? `Tracking progress for ${activePlan.title} (${formatWeekLabel(activePlan.weekStart)}).`
              : "Your weekly summary will show up here once a week is created."
          }
          title="Week summary"
        >
          {activePlan ? (
            <div className="stat-grid compact">
              <div className="stat-card">
                <p>Planned time</p>
                <strong>{stats.plannedMinutes} min</strong>
                <span>Total planned across the week</span>
              </div>
              <div className="stat-card">
                <p>Completed time</p>
                <strong>{stats.completedMinutes} min</strong>
                <span>Minutes from completed tasks</span>
              </div>
              <div className="stat-card">
                <p>Overdue tasks</p>
                <strong>{stats.overdueCount}</strong>
                <span>Tasks scheduled before today</span>
              </div>
              <div className="stat-card">
                <p>Today</p>
                <strong>{stats.todayCount}</strong>
                <span>{stats.todayPendingHighCount} high-priority still pending</span>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No weekly summary yet"
              message="Create a week and add tasks to see progress signals."
            />
          )}
        </Card>
      </div>

      <Card
        subtitle={
          activePlan
            ? "Tick tasks off as you finish them and remove anything you no longer want in the week."
            : "The weekly task board appears after you create a plan."
        }
        title={activePlan ? `${activePlan.title} board` : "Weekly board"}
      >
        {activePlan ? (
          <div className="weekly-board">
            {activeWeekDates.map((day) => {
              const tasks = sortTasks(groupedTasks[day.value] ?? []);

              return (
                <article className="weekly-day-card" key={day.value}>
                  <div className="weekly-day-header">
                    <div>
                      <strong>{day.label}</strong>
                      <p className="muted-copy">{day.dateKey}</p>
                    </div>
                    <span className="topic-pill">{tasks.length} task(s)</span>
                  </div>

                  <div className="weekly-task-list">
                    {tasks.length > 0 ? (
                      tasks.map((task) => (
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
                                {task.duration_minutes} min
                                {task.notes ? ` - ${task.notes}` : ""}
                              </small>
                            </span>
                          </label>

                          <div className="planner-task-actions">
                            <Badge tone={priorityTone[task.priority] ?? "default"}>
                              {task.priority}
                            </Badge>
                            <Button
                              onClick={() => removeTaskFromWeeklyPlan(activePlan.id, task.id)}
                              size="sm"
                              variant="ghost"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="planner-day-empty">
                        <p>No tasks planned for this day.</p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No board yet"
            message="Create a weekly plan first, then this board will split tasks across all seven days."
          />
        )}
      </Card>
    </section>
  );
}

export default RecommendationPage;
