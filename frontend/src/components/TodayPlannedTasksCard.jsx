import { useNavigate } from "react-router-dom";

import Card from "./Card.jsx";
import EmptyState from "./EmptyState.jsx";
import Badge from "./ui/Badge.jsx";
import Button from "./ui/Button.jsx";
import {
  formatDateKey,
  getPlanForDate,
  getTasksForDate,
  sortTasks,
} from "../lib/weeklyPlanner.js";
import { useStudy } from "../state/StudyContext.jsx";

const priorityTone = {
  high: "danger",
  medium: "warning",
  light: "default",
};

function formatTaskStatus(task) {
  if (!task.completedAt) {
    return "Ready to start";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(task.completedAt));
}

function TodayPlannedTasksCard({
  emptyMessage = "No planner tasks are scheduled for today yet.",
  navigateToTracker = false,
  subtitle = "Only tasks whose planned weekday maps to today's exact calendar date appear here.",
  title = "Today's planned tasks",
}) {
  const navigate = useNavigate();
  const { activeTimerTask, startWeeklyTaskTimer, weeklyPlans } = useStudy();
  const todayKey = formatDateKey(new Date());
  const todayPlan = getPlanForDate(weeklyPlans, todayKey);
  const todayTasks = sortTasks(getTasksForDate(todayPlan, todayKey));

  function handleLaunch(taskId) {
    if (!todayPlan) {
      return;
    }

    startWeeklyTaskTimer(todayPlan.id, taskId);

    if (navigateToTracker) {
      navigate("/tracker");
    }
  }

  return (
    <Card
      subtitle={
        todayPlan
          ? `${subtitle} ${todayPlan.title} is active for ${todayKey}.`
          : subtitle
      }
      title={title}
    >
      {todayPlan && todayTasks.length > 0 ? (
        <div className="weekly-task-list">
          {todayTasks.map((task) => {
            const isActiveTask =
              activeTimerTask?.planId === todayPlan.id && activeTimerTask?.taskId === task.id;

            return (
              <div className={`planner-task-item${task.completed ? " is-complete" : ""}`} key={task.id}>
                <div className="planner-task-main planner-task-main-static">
                  <span>
                    <strong>{task.topic}</strong>
                    <small>
                      {todayKey} | {task.duration_minutes} min planned
                      {task.notes ? ` | ${task.notes}` : ""}
                    </small>
                  </span>
                </div>

                <div className="planner-task-actions planner-task-actions-wrap">
                  <Badge tone={priorityTone[task.priority] ?? "default"}>{task.priority}</Badge>
                  {task.completed ? (
                    <Badge tone="success">Completed {formatTaskStatus(task)}</Badge>
                  ) : isActiveTask ? (
                    <Button disabled size="sm" variant="secondary">
                      Timer running
                    </Button>
                  ) : (
                    <Button onClick={() => handleLaunch(task.id)} size="sm">
                      Complete with timer
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Nothing scheduled for today" message={emptyMessage} />
      )}
    </Card>
  );
}

export default TodayPlannedTasksCard;
