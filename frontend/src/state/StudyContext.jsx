import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  createBreakLog,
  createStudySession,
  getBreakLogs,
  getRecommendationHistory,
  getStudySessions,
  saveRecommendation,
} from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";

const StudyContext = createContext(null);

const STORAGE_KEY = "studygenie-dashboard-state";

const defaultState = {
  currentRecommendation: null,
  history: [],
  studySessions: [],
  breakLogs: [],
  weeklyPlans: [],
  activeWeeklyPlanId: null,
  activeTimerTask: null,
  plannerProgress: {},
  darkMode: true,
};

function readStoredState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...defaultState, ...JSON.parse(stored) } : defaultState;
  } catch {
    return defaultState;
  }
}

function buildEntry(result, metrics) {
  return {
    id: crypto.randomUUID(),
    result,
    metrics,
    savedAt: new Date().toISOString(),
  };
}

function normalizeHistoryEntry(entry) {
  return {
    id: entry.id,
    result: entry.result,
    metrics: entry.metrics,
    savedAt: entry.savedAt ?? new Date().toISOString(),
  };
}

function normalizeStudySession(session) {
  return {
    id: session.id,
    topic: session.topic,
    time_spent: Number(session.time_spent),
    date: session.date,
    started_at: session.started_at ?? null,
    ended_at: session.ended_at ?? null,
    source: session.source ?? "manual",
  };
}

function normalizeBreakLog(log) {
  return {
    id: log.id,
    topic: log.topic ?? "",
    duration_minutes: Number(log.duration_minutes),
    break_type: log.break_type,
    date: log.date,
    started_at: log.started_at ?? null,
    ended_at: log.ended_at ?? null,
    study_session_id: log.study_session_id ?? null,
  };
}

function normalizeWeeklyTask(task) {
  return {
    id: task.id,
    topic: task.topic,
    day: task.day,
    duration_minutes: Number(task.duration_minutes),
    priority: task.priority ?? "medium",
    notes: task.notes ?? "",
    completed: Boolean(task.completed),
    completedAt: task.completedAt ?? null,
    actualMinutes: task.actualMinutes != null ? Number(task.actualMinutes) : null,
    linkedStudySessionId: task.linkedStudySessionId ?? null,
    createdAt: task.createdAt ?? new Date().toISOString(),
  };
}

function normalizeWeeklyPlan(plan) {
  return {
    id: plan.id,
    title: plan.title,
    weekStart: plan.weekStart,
    createdAt: plan.createdAt ?? new Date().toISOString(),
    updatedAt: plan.updatedAt ?? plan.createdAt ?? new Date().toISOString(),
    tasks: Array.isArray(plan.tasks) ? plan.tasks.map(normalizeWeeklyTask) : [],
  };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function StudyProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState(readStoredState);

  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    let isActive = true;

    if (!isAuthenticated) {
      const storedState = readStoredState();
      setState((current) => ({
        ...storedState,
        currentRecommendation:
          current.currentRecommendation ?? storedState.currentRecommendation,
      }));
      return undefined;
    }

    async function hydrateStudyData() {
      try {
        const storedState = readStoredState();
        const [historyResponse, sessionsResponse, breakLogsResponse] = await Promise.all([
          getRecommendationHistory(),
          getStudySessions(),
          getBreakLogs(),
        ]);

        if (!isActive) {
          return;
        }

        setState((current) => ({
          ...current,
          history: historyResponse.data.map(normalizeHistoryEntry),
          studySessions: sessionsResponse.data.map(normalizeStudySession),
          breakLogs: breakLogsResponse.data.map(normalizeBreakLog),
          weeklyPlans: storedState.weeklyPlans.map(normalizeWeeklyPlan),
          activeWeeklyPlanId: storedState.activeWeeklyPlanId,
          activeTimerTask: storedState.activeTimerTask ?? null,
        }));
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error("Failed to load study data", error);
      }
    }

    hydrateStudyData();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  function setCurrentRecommendation(result, metrics) {
    setState((current) => ({
      ...current,
      currentRecommendation: buildEntry(result, metrics),
    }));
  }

  async function saveCurrentRecommendation() {
    if (!state.currentRecommendation) {
      return null;
    }

    if (!isAuthenticated) {
      let savedEntry = null;

      setState((current) => {
        if (!current.currentRecommendation) {
          return current;
        }

        savedEntry = current.currentRecommendation;
        return {
          ...current,
          history: [current.currentRecommendation, ...current.history].slice(0, 20),
        };
      });

      return savedEntry;
    }

    const response = await saveRecommendation({
      metrics: state.currentRecommendation.metrics,
      result: state.currentRecommendation.result,
    });
    const savedEntry = normalizeHistoryEntry(response.data);

    setState((current) => ({
      ...current,
      history: [savedEntry, ...current.history].slice(0, 20),
    }));

    return savedEntry;
  }

  async function addStudySession(session) {
    const nextSession = {
      ...session,
      topic: session.topic.trim(),
      time_spent: Number(session.time_spent),
      started_at: session.started_at ?? null,
      ended_at: session.ended_at ?? null,
      source: session.source ?? "manual",
    };

    if (!isAuthenticated) {
      const localSession = {
        ...nextSession,
        id: crypto.randomUUID(),
      };

      setState((current) => ({
        ...current,
        studySessions: [localSession, ...current.studySessions],
      }));

      return localSession;
    }

    const response = await createStudySession(nextSession);
    const savedSession = normalizeStudySession(response.data);

    setState((current) => ({
      ...current,
      studySessions: [savedSession, ...current.studySessions],
    }));

    return savedSession;
  }

  async function addBreakLog(log) {
    const normalizedTopic = log.topic?.trim() ?? "";
    const nextLog = {
      ...log,
      topic: normalizedTopic || null,
      duration_minutes: Number(log.duration_minutes),
      started_at: log.started_at ?? null,
      ended_at: log.ended_at ?? null,
      study_session_id: log.study_session_id ?? null,
    };

    if (!isAuthenticated) {
      const localLog = {
        ...nextLog,
        id: crypto.randomUUID(),
      };

      setState((current) => ({
        ...current,
        breakLogs: [localLog, ...current.breakLogs],
      }));

      return localLog;
    }

    const response = await createBreakLog(nextLog);
    const savedLog = normalizeBreakLog(response.data);

    setState((current) => ({
      ...current,
      breakLogs: [savedLog, ...current.breakLogs],
    }));

    return savedLog;
  }

  function createWeeklyPlan(plan) {
    const now = new Date().toISOString();
    let savedPlan = null;

    setState((current) => {
      const existingPlan =
        current.weeklyPlans.find((item) => item.id === plan.id) ??
        current.weeklyPlans.find((item) => item.weekStart === plan.weekStart);

      savedPlan = normalizeWeeklyPlan({
        id: existingPlan?.id ?? crypto.randomUUID(),
        title: plan.title?.trim() || `Week of ${plan.weekStart}`,
        weekStart: plan.weekStart,
        createdAt: existingPlan?.createdAt ?? now,
        updatedAt: now,
        tasks: existingPlan?.tasks ?? [],
      });

      const weeklyPlans = [
        savedPlan,
        ...current.weeklyPlans.filter((item) => item.id !== savedPlan.id),
      ].sort((left, right) => right.weekStart.localeCompare(left.weekStart));

      return {
        ...current,
        weeklyPlans,
        activeWeeklyPlanId: savedPlan.id,
      };
    });

    return savedPlan;
  }

  function setActiveWeeklyPlan(planId) {
    setState((current) => ({
      ...current,
      activeWeeklyPlanId: planId,
    }));
  }

  function startWeeklyTaskTimer(planId, taskId) {
    setState((current) => ({
      ...current,
      activeWeeklyPlanId: planId,
      activeTimerTask: {
        planId,
        taskId,
        launchedAt: new Date().toISOString(),
      },
    }));
  }

  function clearActiveTimerTask() {
    setState((current) => ({
      ...current,
      activeTimerTask: null,
    }));
  }

  function addTaskToWeeklyPlan(planId, task) {
    let savedTask = null;

    setState((current) => ({
      ...current,
      weeklyPlans: current.weeklyPlans.map((plan) => {
        if (plan.id !== planId) {
          return plan;
        }

        savedTask = normalizeWeeklyTask({
          ...task,
          id: crypto.randomUUID(),
          completed: false,
          completedAt: null,
          actualMinutes: null,
          linkedStudySessionId: null,
          createdAt: new Date().toISOString(),
        });

        return {
          ...plan,
          updatedAt: new Date().toISOString(),
          tasks: [...plan.tasks, savedTask],
        };
      }),
    }));

    return savedTask;
  }

  function toggleWeeklyTask(planId, taskId) {
    setState((current) => ({
      ...current,
      activeTimerTask:
        current.activeTimerTask?.planId === planId && current.activeTimerTask?.taskId === taskId
          ? null
          : current.activeTimerTask,
      weeklyPlans: current.weeklyPlans.map((plan) => {
        if (plan.id !== planId) {
          return plan;
        }

        return {
          ...plan,
          updatedAt: new Date().toISOString(),
          tasks: plan.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  completed: !task.completed,
                  completedAt: !task.completed ? new Date().toISOString() : null,
                  actualMinutes: !task.completed
                    ? task.actualMinutes ?? Number(task.duration_minutes)
                    : task.actualMinutes,
                }
              : task,
          ),
        };
      }),
    }));
  }

  function completeWeeklyTask(planId, taskId, completion = {}) {
    const completedAt = completion.completedAt ?? new Date().toISOString();

    setState((current) => ({
      ...current,
      activeTimerTask:
        current.activeTimerTask?.planId === planId && current.activeTimerTask?.taskId === taskId
          ? null
          : current.activeTimerTask,
      weeklyPlans: current.weeklyPlans.map((plan) => {
        if (plan.id !== planId) {
          return plan;
        }

        return {
          ...plan,
          updatedAt: new Date().toISOString(),
          tasks: plan.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  completed: true,
                  completedAt,
                  actualMinutes:
                    completion.actualMinutes != null
                      ? Number(completion.actualMinutes)
                      : task.actualMinutes ?? Number(task.duration_minutes),
                  linkedStudySessionId: completion.studySessionId ?? task.linkedStudySessionId,
                }
              : task,
          ),
        };
      }),
    }));
  }

  function removeTaskFromWeeklyPlan(planId, taskId) {
    setState((current) => ({
      ...current,
      activeTimerTask:
        current.activeTimerTask?.planId === planId && current.activeTimerTask?.taskId === taskId
          ? null
          : current.activeTimerTask,
      weeklyPlans: current.weeklyPlans.map((plan) => {
        if (plan.id !== planId) {
          return plan;
        }

        return {
          ...plan,
          updatedAt: new Date().toISOString(),
          tasks: plan.tasks.filter((task) => task.id !== taskId),
        };
      }),
    }));
  }

  function togglePlanItem(planKey, itemId) {
    setState((current) => {
      const activeItems = current.plannerProgress[planKey] ?? [];
      const nextItems = activeItems.includes(itemId)
        ? activeItems.filter((id) => id !== itemId)
        : [...activeItems, itemId];

      return {
        ...current,
        plannerProgress: {
          ...current.plannerProgress,
          [planKey]: nextItems,
        },
      };
    });
  }

  function toggleDarkMode() {
    setState((current) => ({
      ...current,
      darkMode: !current.darkMode,
    }));
  }

  function exportProgress() {
    downloadJson("studygenie-progress.json", {
      exportedAt: new Date().toISOString(),
      currentRecommendation: state.currentRecommendation,
      history: state.history,
      studySessions: state.studySessions,
      breakLogs: state.breakLogs,
      activeTimerTask: state.activeTimerTask,
      plannerProgress: state.plannerProgress,
      weeklyPlans: state.weeklyPlans,
      activeWeeklyPlanId: state.activeWeeklyPlanId,
    });
  }

  const value = useMemo(
    () => ({
      ...state,
      setCurrentRecommendation,
      saveCurrentRecommendation,
      addStudySession,
      addBreakLog,
      createWeeklyPlan,
      setActiveWeeklyPlan,
      startWeeklyTaskTimer,
      clearActiveTimerTask,
      addTaskToWeeklyPlan,
      toggleWeeklyTask,
      completeWeeklyTask,
      removeTaskFromWeeklyPlan,
      togglePlanItem,
      toggleDarkMode,
      exportProgress,
    }),
    [state],
  );

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy() {
  const context = useContext(StudyContext);

  if (!context) {
    throw new Error("useStudy must be used inside StudyProvider");
  }

  return context;
}
