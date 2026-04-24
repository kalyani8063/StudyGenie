import { useEffect, useMemo, useRef, useState } from "react";

import { useStudy } from "../state/StudyContext.jsx";
import Card from "./Card.jsx";
import Button from "./ui/Button.jsx";
import InputField from "./ui/InputField.jsx";

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

const TIMER_STORAGE_KEY = "studygenie-session-timer";

const defaultTimerState = {
  timerMode: "focus",
  topic: "",
  selectedMinutes: 25,
  remainingSeconds: 25 * 60,
  isRunning: false,
  message: "",
  startedAt: null,
  runEndsAt: null,
  lastCompletedFocus: null,
  pausedFocusState: null,
  linkedTaskKey: "",
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

function normalizeTimerState(value) {
  if (!value || typeof value !== "object") {
    return defaultTimerState;
  }

  return {
    ...defaultTimerState,
    ...value,
    selectedMinutes: Math.max(1, Number(value.selectedMinutes ?? defaultTimerState.selectedMinutes)),
    remainingSeconds: Math.max(
      0,
      Number(value.remainingSeconds ?? defaultTimerState.remainingSeconds),
    ),
    isRunning: Boolean(value.isRunning),
    message: typeof value.message === "string" ? value.message : "",
    topic: typeof value.topic === "string" ? value.topic : "",
    startedAt: value.startedAt ?? null,
    runEndsAt: value.runEndsAt ?? null,
    lastCompletedFocus: value.lastCompletedFocus ?? null,
    pausedFocusState: value.pausedFocusState ?? null,
    linkedTaskKey: typeof value.linkedTaskKey === "string" ? value.linkedTaskKey : "",
  };
}

function readStoredTimerState() {
  try {
    const stored = localStorage.getItem(TIMER_STORAGE_KEY);
    return stored ? normalizeTimerState(JSON.parse(stored)) : defaultTimerState;
  } catch {
    return defaultTimerState;
  }
}

function getSecondsLeft(timerState, nowMs = Date.now()) {
  if (!timerState.isRunning || !timerState.runEndsAt) {
    return Math.max(0, Number(timerState.remainingSeconds));
  }

  const endTime = new Date(timerState.runEndsAt).getTime();
  if (Number.isNaN(endTime)) {
    return Math.max(0, Number(timerState.remainingSeconds));
  }

  return Math.max(0, Math.ceil((endTime - nowMs) / 1000));
}

function createRunEnd(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
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
  const [timerState, setTimerState] = useState(readStoredTimerState);
  const [isSaving, setIsSaving] = useState(false);
  const [tick, setTick] = useState(() => Date.now());
  const isCompletingRef = useRef(false);

  const activeTaskPlan =
    weeklyPlans.find((plan) => plan.id === activeTimerTask?.planId) ?? null;
  const activePlannedTask =
    activeTaskPlan?.tasks.find((task) => task.id === activeTimerTask?.taskId) ?? null;
  const activeTaskKey =
    activeTaskPlan && activePlannedTask
      ? `${activeTaskPlan.id}:${activePlannedTask.id}`
      : "";

  const secondsLeft = getSecondsLeft(timerState, tick);
  const totalSeconds = timerState.selectedMinutes * 60;
  const elapsedSeconds = totalSeconds - secondsLeft;
  const progress = totalSeconds > 0 ? Math.round((elapsedSeconds / totalSeconds) * 100) : 0;
  const latestStudySession = studySessions[0] ?? null;
  const linkedSession = timerState.lastCompletedFocus ?? latestStudySession;
  const linkedTopic =
    timerState.topic.trim() ||
    linkedSession?.topic ||
    timerState.pausedFocusState?.topic ||
    "";
  const normalizedLinkedTopic = linkedSession?.topic?.trim().toLowerCase() ?? "";
  const canLinkBreakToSession =
    Boolean(linkedSession) &&
    (!timerState.topic.trim() ||
      timerState.topic.trim().toLowerCase() === normalizedLinkedTopic);
  const trackedMinutes = getTrackedMinutes(elapsedSeconds, timerState.selectedMinutes);
  const targetLabel = `${timerState.selectedMinutes} min target`;
  const canSaveCurrentRun = Boolean(timerState.startedAt) && elapsedSeconds > 0;
  const isGuidedTaskMode = Boolean(activePlannedTask);
  const isTaskLocked = isGuidedTaskMode || Boolean(timerState.pausedFocusState);

  const applyTimerState = useMemo(
    () => (updater) => {
      setTimerState((current) => {
        const nextState =
          typeof updater === "function" ? updater(current) : { ...current, ...updater };
        return normalizeTimerState(nextState);
      });
    },
    [],
  );

  useEffect(() => {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timerState));
  }, [timerState]);

  useEffect(() => {
    if (!timerState.isRunning) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [timerState.isRunning]);

  useEffect(() => {
    setTick(Date.now());
  }, [timerState.isRunning, timerState.runEndsAt]);

  useEffect(() => {
    if (!timerState.isRunning || secondsLeft !== 0 || isCompletingRef.current) {
      return;
    }

    isCompletingRef.current = true;
    applyTimerState({
      isRunning: false,
      remainingSeconds: 0,
      runEndsAt: null,
    });
    void handleCompletion();
  }, [applyTimerState, secondsLeft, timerState.isRunning]);

  useEffect(() => {
    if (!activeTimerTask) {
      return;
    }

    if (!activePlannedTask) {
      clearActiveTimerTask();
      return;
    }

    if (timerState.linkedTaskKey === activeTaskKey) {
      return;
    }

    const taskMinutes = Math.max(1, Number(activePlannedTask.duration_minutes) || 25);
    const startedAt = new Date().toISOString();

    applyTimerState({
      timerMode: "focus",
      topic: activePlannedTask.topic,
      selectedMinutes: taskMinutes,
      remainingSeconds: taskMinutes * 60,
      isRunning: true,
      startedAt,
      runEndsAt: createRunEnd(taskMinutes * 60),
      pausedFocusState: null,
      linkedTaskKey: activeTaskKey,
      message: `Timer started for ${activePlannedTask.topic}. Use pause or take a break anytime.`,
    });
  }, [
    activePlannedTask,
    activeTaskKey,
    activeTimerTask,
    applyTimerState,
    clearActiveTimerTask,
    timerState.linkedTaskKey,
  ]);

  function restorePausedFocus(nextMessage) {
    if (!timerState.pausedFocusState) {
      return;
    }

    applyTimerState((current) => ({
      ...current,
      timerMode: "focus",
      topic: current.pausedFocusState.topic,
      selectedMinutes: current.pausedFocusState.selectedMinutes,
      remainingSeconds: current.pausedFocusState.remainingSeconds,
      startedAt: current.pausedFocusState.startedAt,
      runEndsAt: null,
      isRunning: false,
      pausedFocusState: null,
      linkedTaskKey: current.pausedFocusState.linkedTaskKey ?? current.linkedTaskKey,
      message: nextMessage,
    }));
  }

  async function handleCompletion() {
    setIsSaving(true);

    try {
      const effectiveStartedAt =
        timerState.startedAt ??
        new Date(Date.now() - timerState.selectedMinutes * 60 * 1000).toISOString();
      const completedAt = new Date().toISOString();

      if (timerState.timerMode === "focus") {
        const resolvedTopic = activePlannedTask?.topic ?? timerState.topic.trim();

        if (!resolvedTopic) {
          applyTimerState({
            message:
              "Focus block finished. Add a topic so completed study sessions can be saved.",
          });
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

          applyTimerState({
            ...defaultTimerState,
            message: `Completed ${resolvedTopic} and logged ${trackedMinutes} minute(s).`,
            lastCompletedFocus: savedSession,
          });
          return;
        }

        applyTimerState({
          ...defaultTimerState,
          timerMode: "break",
          selectedMinutes: 5,
          remainingSeconds: 5 * 60,
          lastCompletedFocus: savedSession,
          message: `Logged ${trackedMinutes} minute(s) of study for ${resolvedTopic}.`,
        });
        return;
      }

      const breakTopic = timerState.pausedFocusState?.topic || linkedTopic || null;
      await addBreakLog({
        topic: breakTopic,
        duration_minutes: trackedMinutes,
        break_type: getBreakType(trackedMinutes),
        date: getLocalDateString(completedAt),
        started_at: effectiveStartedAt,
        ended_at: completedAt,
        study_session_id: canLinkBreakToSession ? linkedSession?.id ?? null : null,
      });

      if (timerState.pausedFocusState) {
        restorePausedFocus(
          breakTopic
            ? `Break logged. Resume ${breakTopic} when you are ready.`
            : "Break logged. Resume your study task when you are ready.",
        );
        return;
      }

      applyTimerState({
        ...defaultTimerState,
        message: breakTopic
          ? `Logged a ${trackedMinutes}-minute ${getBreakType(trackedMinutes)} break after ${breakTopic}.`
          : `Logged a ${trackedMinutes}-minute ${getBreakType(trackedMinutes)} break for future planning insights.`,
      });
    } catch {
      applyTimerState({
        message:
          timerState.timerMode === "focus"
            ? "The timer finished, but the study session could not be saved."
            : "The timer finished, but the break log could not be saved.",
      });
    } finally {
      isCompletingRef.current = false;
      setIsSaving(false);
    }
  }

  function chooseMode(nextMode) {
    if (isTaskLocked) {
      return;
    }

    const nextMinutes = TIMER_PRESETS[nextMode][0].minutes;
    applyTimerState((current) => ({
      ...current,
      timerMode: nextMode,
      selectedMinutes: nextMinutes,
      remainingSeconds: nextMinutes * 60,
      isRunning: false,
      startedAt: null,
      runEndsAt: null,
      message: "",
    }));
  }

  function choosePreset(minutes) {
    if (isTaskLocked && timerState.timerMode === "focus") {
      return;
    }

    applyTimerState((current) => ({
      ...current,
      selectedMinutes: minutes,
      remainingSeconds: minutes * 60,
      isRunning: false,
      startedAt: null,
      runEndsAt: null,
      message: "",
    }));
  }

  function resetTimer() {
    applyTimerState((current) => ({
      ...current,
      remainingSeconds: current.selectedMinutes * 60,
      isRunning: false,
      startedAt: null,
      runEndsAt: null,
      message: "",
    }));
  }

  function handleRunningToggle() {
    if (timerState.isRunning) {
      applyTimerState((current) => ({
        ...current,
        isRunning: false,
        remainingSeconds: getSecondsLeft(current, Date.now()),
        runEndsAt: null,
      }));
      return;
    }

    const currentSecondsLeft = Math.max(1, secondsLeft);
    applyTimerState((current) => ({
      ...current,
      isRunning: true,
      startedAt: current.startedAt ?? new Date().toISOString(),
      remainingSeconds: currentSecondsLeft,
      runEndsAt: createRunEnd(currentSecondsLeft),
    }));
  }

  function handleTimedBreak() {
    if (timerState.timerMode !== "focus") {
      return;
    }

    const nextMinutes = TIMER_PRESETS.break[0].minutes;
    const pausedTopic = activePlannedTask?.topic ?? timerState.topic.trim();

    applyTimerState((current) => ({
      ...current,
      pausedFocusState: {
        selectedMinutes: current.selectedMinutes,
        remainingSeconds: secondsLeft,
        startedAt: current.startedAt,
        topic: pausedTopic,
        linkedTaskKey: current.linkedTaskKey,
      },
      timerMode: "break",
      selectedMinutes: nextMinutes,
      remainingSeconds: nextMinutes * 60,
      startedAt: new Date().toISOString(),
      runEndsAt: createRunEnd(nextMinutes * 60),
      isRunning: true,
      message: pausedTopic
        ? `Break timer started. ${pausedTopic} is paused for now.`
        : "Break timer started. Your focus timer is paused for now.",
    }));
  }

  return (
    <Card className={`session-timer-card ${className}`.trim()} subtitle={subtitle} title={title}>
      <div className="timer-layout">
        <div className="timer-face timer-face-large">
          <p className="timer-mode-label">
            {timerState.timerMode === "focus" ? "Study block" : "Break block"}
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
              variant={timerState.timerMode === "focus" ? "primary" : "ghost"}
            >
              Study timer
            </Button>
            <Button
              disabled={isTaskLocked}
              onClick={() => chooseMode("break")}
              variant={timerState.timerMode === "break" ? "primary" : "ghost"}
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
            value={timerState.topic}
            onChange={(event) =>
              applyTimerState({
                topic: event.target.value,
              })
            }
          />

          <div className="preset-row">
            {TIMER_PRESETS[timerState.timerMode].map((preset) => (
              <Button
                disabled={isTaskLocked && timerState.timerMode === "focus"}
                key={`${timerState.timerMode}-${preset.minutes}`}
                onClick={() => choosePreset(preset.minutes)}
                variant={timerState.selectedMinutes === preset.minutes ? "secondary" : "ghost"}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="preset-row">
            <Button disabled={isSaving} onClick={handleRunningToggle}>
              {timerState.isRunning ? "Pause" : "Start"}
            </Button>
            <Button
              className="secondary-button"
              disabled={!canSaveCurrentRun || isSaving}
              onClick={() => {
                applyTimerState({
                  isRunning: false,
                  remainingSeconds: secondsLeft,
                  runEndsAt: null,
                });
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
            {timerState.timerMode === "focus" ? (
              <Button disabled={isSaving} onClick={handleTimedBreak} variant="ghost">
                Take break
              </Button>
            ) : null}
            {timerState.timerMode === "break" && timerState.pausedFocusState ? (
              <Button
                disabled={isSaving}
                onClick={() =>
                  restorePausedFocus(
                    timerState.pausedFocusState.topic
                      ? `Back to ${timerState.pausedFocusState.topic}. Resume when you are ready.`
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

          {timerState.timerMode === "break" && linkedTopic ? (
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
          {timerState.message ? <p className="success-message">{timerState.message}</p> : null}
        </div>
      </div>
    </Card>
  );
}

export default SessionTimerCard;
