import { useEffect, useState } from "react";

import Card from "./Card.jsx";
import Button from "./ui/Button.jsx";
import InputField from "./ui/InputField.jsx";
import { useStudy } from "../state/StudyContext.jsx";

const TIMER_PRESETS = {
  focus: [
    { label: "25 min", minutes: 25 },
    { label: "50 min", minutes: 50 },
    { label: "90 min", minutes: 90 },
  ],
  break: [
    { label: "5 min", minutes: 5 },
    { label: "10 min", minutes: 10 },
    { label: "15 min", minutes: 15 },
  ],
};

function formatTime(seconds) {
  const safeSeconds = Math.max(seconds, 0);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function getLocalDateString(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getBreakType(minutes) {
  return minutes >= 15 ? "long" : "short";
}

function getTrackedMinutes(elapsedSeconds, fallbackMinutes) {
  if (elapsedSeconds <= 0) {
    return fallbackMinutes;
  }

  return Math.max(1, Math.ceil(elapsedSeconds / 60));
}

function SessionTimerCard({
  className = "",
  subtitle = "Track a study block or break and save it automatically when the timer completes.",
  title = "Session timer",
}) {
  const {
    activeTimerTask,
    addBreakLog,
    addStudySession,
    clearActiveTimerTask,
    completeWeeklyTask,
    studySessions,
    weeklyPlans,
  } = useStudy();
  const [timerMode, setTimerMode] = useState("focus");
  const [topic, setTopic] = useState("");
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [startedAt, setStartedAt] = useState(null);
  const [lastCompletedFocus, setLastCompletedFocus] = useState(null);
  const [pausedFocusState, setPausedFocusState] = useState(null);

  const activeTaskPlan =
    weeklyPlans.find((plan) => plan.id === activeTimerTask?.planId) ?? null;
  const activePlannedTask =
    activeTaskPlan?.tasks.find((task) => task.id === activeTimerTask?.taskId) ?? null;
  const activeTaskKey =
    activeTaskPlan && activePlannedTask
      ? `${activeTaskPlan.id}:${activePlannedTask.id}`
      : "";

  const totalSeconds = selectedMinutes * 60;
  const elapsedSeconds = totalSeconds - secondsLeft;
  const progress = totalSeconds > 0 ? Math.round((elapsedSeconds / totalSeconds) * 100) : 0;
  const latestStudySession = studySessions[0] ?? null;
  const linkedSession = lastCompletedFocus ?? latestStudySession;
  const linkedTopic = topic.trim() || linkedSession?.topic || pausedFocusState?.topic || "";
  const normalizedLinkedTopic = linkedSession?.topic?.trim().toLowerCase() ?? "";
  const canLinkBreakToSession =
    Boolean(linkedSession) &&
    (!topic.trim() || topic.trim().toLowerCase() === normalizedLinkedTopic);
  const trackedMinutes = getTrackedMinutes(elapsedSeconds, selectedMinutes);
  const targetLabel = `${selectedMinutes} min target`;
  const canSaveCurrentRun = Boolean(startedAt) && elapsedSeconds > 0;
  const isGuidedTaskMode = Boolean(activePlannedTask);
  const isTaskLocked = isGuidedTaskMode || Boolean(pausedFocusState);

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || secondsLeft !== 0) {
      return;
    }

    setIsRunning(false);
    void handleCompletion();
  }, [isRunning, secondsLeft]);

  useEffect(() => {
    if (!activeTimerTask) {
      return;
    }

    if (!activePlannedTask) {
      clearActiveTimerTask();
      return;
    }

    const taskMinutes = Math.max(1, Number(activePlannedTask.duration_minutes) || 25);

    setTimerMode("focus");
    setTopic(activePlannedTask.topic);
    setSelectedMinutes(taskMinutes);
    setSecondsLeft(taskMinutes * 60);
    setStartedAt(new Date().toISOString());
    setPausedFocusState(null);
    setIsRunning(true);
    setMessage(`Timer started for ${activePlannedTask.topic}. Use pause or take a break anytime.`);
  }, [activeTaskKey]);

  function restorePausedFocus(nextMessage) {
    if (!pausedFocusState) {
      return;
    }

    setTimerMode("focus");
    setTopic(pausedFocusState.topic);
    setSelectedMinutes(pausedFocusState.selectedMinutes);
    setSecondsLeft(pausedFocusState.secondsLeft);
    setStartedAt(pausedFocusState.startedAt);
    setPausedFocusState(null);
    setIsRunning(false);
    setMessage(nextMessage);
  }

  async function handleCompletion() {
    setIsSaving(true);
    setMessage("");

    try {
      const effectiveStartedAt =
        startedAt ?? new Date(Date.now() - totalSeconds * 1000).toISOString();
      const completedAt = new Date().toISOString();

      if (timerMode === "focus") {
        const resolvedTopic = activePlannedTask?.topic ?? topic.trim();

        if (!resolvedTopic) {
          setMessage("Focus block finished. Add a topic so completed study sessions can be saved.");
          return;
        }

        const savedSession = await addStudySession({
          topic: resolvedTopic,
          time_spent: trackedMinutes,
          date: getLocalDateString(completedAt),
          started_at: effectiveStartedAt,
          ended_at: completedAt,
          source: "timer",
        });

        if (activePlannedTask && activeTaskPlan) {
          completeWeeklyTask(activeTaskPlan.id, activePlannedTask.id, {
            actualMinutes: trackedMinutes,
            completedAt,
            studySessionId: savedSession.id,
          });
          setMessage(`Completed ${resolvedTopic} and logged ${trackedMinutes} minute(s).`);
          setLastCompletedFocus(savedSession);
          setTimerMode("focus");
          setTopic("");
          setSelectedMinutes(25);
          setSecondsLeft(25 * 60);
          setStartedAt(null);
          return;
        }

        setMessage(`Logged ${trackedMinutes} minute(s) of study for ${resolvedTopic}.`);
        setLastCompletedFocus(savedSession);
        setTimerMode("break");
        setSelectedMinutes(5);
        setSecondsLeft(5 * 60);
        setStartedAt(null);
        return;
      }

      const breakTopic = pausedFocusState?.topic || linkedTopic || null;
      await addBreakLog({
        topic: breakTopic,
        duration_minutes: trackedMinutes,
        break_type: getBreakType(trackedMinutes),
        date: getLocalDateString(completedAt),
        started_at: effectiveStartedAt,
        ended_at: completedAt,
        study_session_id: canLinkBreakToSession ? linkedSession?.id ?? null : null,
      });

      if (pausedFocusState) {
        restorePausedFocus(
          breakTopic
            ? `Break logged. Resume ${breakTopic} when you are ready.`
            : "Break logged. Resume your study task when you are ready.",
        );
        return;
      }

      setMessage(
        breakTopic
          ? `Logged a ${trackedMinutes}-minute ${getBreakType(trackedMinutes)} break after ${breakTopic}.`
          : `Logged a ${trackedMinutes}-minute ${getBreakType(trackedMinutes)} break for future planning insights.`,
      );
      setTimerMode("focus");
      setSelectedMinutes(25);
      setSecondsLeft(25 * 60);
      setStartedAt(null);
      setLastCompletedFocus(null);
    } catch {
      setMessage(
        timerMode === "focus"
          ? "The timer finished, but the study session could not be saved."
          : "The timer finished, but the break log could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function chooseMode(nextMode) {
    if (isTaskLocked) {
      return;
    }

    const nextMinutes = TIMER_PRESETS[nextMode][0].minutes;
    setTimerMode(nextMode);
    setSelectedMinutes(nextMinutes);
    setSecondsLeft(nextMinutes * 60);
    setIsRunning(false);
    setStartedAt(null);
    setMessage("");
  }

  function choosePreset(minutes) {
    if (isTaskLocked && timerMode === "focus") {
      return;
    }

    setSelectedMinutes(minutes);
    setSecondsLeft(minutes * 60);
    setIsRunning(false);
    setStartedAt(null);
    setMessage("");
  }

  function resetTimer() {
    setSecondsLeft(selectedMinutes * 60);
    setIsRunning(false);
    setStartedAt(null);
    setMessage("");
  }

  function handleRunningToggle() {
    setIsRunning((current) => {
      if (!current && !startedAt) {
        setStartedAt(new Date().toISOString());
      }

      return !current;
    });
  }

  function handleTimedBreak() {
    if (timerMode !== "focus") {
      return;
    }

    const nextMinutes = TIMER_PRESETS.break[0].minutes;
    const pausedTopic = activePlannedTask?.topic ?? topic.trim();

    setPausedFocusState({
      selectedMinutes,
      secondsLeft,
      startedAt,
      topic: pausedTopic,
    });
    setTimerMode("break");
    setSelectedMinutes(nextMinutes);
    setSecondsLeft(nextMinutes * 60);
    setStartedAt(new Date().toISOString());
    setIsRunning(true);
    setMessage(
      pausedTopic
        ? `Break timer started. ${pausedTopic} is paused for now.`
        : "Break timer started. Your focus timer is paused for now.",
    );
  }

  return (
    <Card className={`session-timer-card ${className}`.trim()} subtitle={subtitle} title={title}>
      <div className="timer-layout">
        <div className="timer-face timer-face-large">
          <p className="timer-mode-label">
            {timerMode === "focus" ? "Study block" : "Break block"}
          </p>
          <span>{formatTime(secondsLeft)}</span>
          <p className="muted-copy">
            Tracked {formatTime(elapsedSeconds)} | {targetLabel}
          </p>
          <div className="progress-track timer-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="muted-copy">{progress}% complete</p>
        </div>

        <div className="timer-controls">
          <div className="preset-row">
            <Button
              disabled={isTaskLocked}
              onClick={() => chooseMode("focus")}
              variant={timerMode === "focus" ? "primary" : "ghost"}
            >
              Study timer
            </Button>
            <Button
              disabled={isTaskLocked}
              onClick={() => chooseMode("break")}
              variant={timerMode === "break" ? "primary" : "ghost"}
            >
              Break timer
            </Button>
          </div>

          <InputField
            disabled={isTaskLocked}
            helper={
              isGuidedTaskMode
                ? "This timer is currently linked to a weekly planner task."
                : "Used when the timer saves the finished study block or links a break to the latest session."
            }
            label="Topic"
            placeholder="Physics revision"
            type="text"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          />

          <div className="preset-row">
            {TIMER_PRESETS[timerMode].map((preset) => (
              <Button
                disabled={isTaskLocked && timerMode === "focus"}
                key={`${timerMode}-${preset.minutes}`}
                onClick={() => choosePreset(preset.minutes)}
                variant={selectedMinutes === preset.minutes ? "secondary" : "ghost"}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="preset-row">
            <Button disabled={isSaving} onClick={handleRunningToggle}>
              {isRunning ? "Pause" : "Start"}
            </Button>
            <Button
              className="secondary-button"
              disabled={!canSaveCurrentRun || isSaving}
              onClick={() => {
                setIsRunning(false);
                void handleCompletion();
              }}
              variant="secondary"
            >
              Finish &amp; save
            </Button>
            <Button
              className="secondary-button"
              disabled={isSaving}
              onClick={resetTimer}
              variant="ghost"
            >
              Reset
            </Button>
            {timerMode === "focus" ? (
              <Button disabled={isSaving} onClick={handleTimedBreak} variant="ghost">
                Take break
              </Button>
            ) : null}
            {timerMode === "break" && pausedFocusState ? (
              <Button
                disabled={isSaving}
                onClick={() =>
                  restorePausedFocus(
                    pausedFocusState.topic
                      ? `Back to ${pausedFocusState.topic}. Resume when you are ready.`
                      : "Break closed. Resume your study task when you are ready.",
                  )
                }
                variant="ghost"
              >
                Return to task
              </Button>
            ) : null}
          </div>

          {isGuidedTaskMode ? (
            <p className="muted-copy">
              Completing this focus block will mark <strong>{activePlannedTask.topic}</strong> done
              in your weekly planner and send it to weekly progress automatically.
            </p>
          ) : null}

          {timerMode === "break" && linkedTopic ? (
            <p className="muted-copy">
              This break will be saved against <strong>{linkedTopic}</strong> so your pacing data
              stays tied to the study session it follows when possible.
            </p>
          ) : null}

          <p className="timer-caption">
            Planned tasks can launch this timer directly from the dashboard or tracker. Focus runs
            save study sessions, timed breaks can pause an active task, and finished planned tasks
            flow into the weekly progress view automatically.
          </p>
          {message ? <p className="success-message">{message}</p> : null}
        </div>
      </div>
    </Card>
  );
}

export default SessionTimerCard;
