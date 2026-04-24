import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  createBreakLog,
  createStudySession,
  getBreakLogs,
  getRecommendation,
  getStudySessions,
  getWeeklyPlansState,
  syncWeeklyPlansState,
} from "../api/client.js";
import { getPlanForDate, getWeekDates } from "../lib/weeklyPlanner.js";
import { useAuth } from "./AuthContext.jsx";

const StudyContext = createContext(null);

const STORAGE_KEY = "studygenie-dashboard-state";

const defaultState = {
  currentRecommendation: null,
  studySessions: [],
  breakLogs: [],
  weeklyPlans: [],
  activeWeeklyPlanId: null,
  activeTimerTask: null,
};

function readStoredState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...defaultState, ...JSON.parse(stored) } : defaultState;
  } catch {
    return defaultState;
  }
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
    completedAt: task.completedAt ?? task.completed_at ?? null,
    actualMinutes:
      task.actualMinutes != null
        ? Number(task.actualMinutes)
        : task.actual_minutes != null
          ? Number(task.actual_minutes)
          : null,
    linkedStudySessionId: task.linkedStudySessionId ?? task.linked_study_session_id ?? null,
    createdAt: task.createdAt ?? task.created_at ?? new Date().toISOString(),
    updatedAt: task.updatedAt ?? task.updated_at ?? task.createdAt ?? task.created_at ?? null,
  };
}

function normalizeWeeklyPlan(plan) {
  return {
    id: plan.id,
    title: plan.title,
    weekStart: plan.weekStart ?? plan.week_start,
    createdAt: plan.createdAt ?? plan.created_at ?? new Date().toISOString(),
    updatedAt:
      plan.updatedAt ??
      plan.updated_at ??
      plan.createdAt ??
      plan.created_at ??
      new Date().toISOString(),
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

function normalizeTopic(value) {
  return value.trim().toLowerCase();
}

function serializeWeeklyTask(task) {
  return {
    id: task.id,
    topic: task.topic.trim(),
    day: task.day,
    duration_minutes: Number(task.duration_minutes),
    priority: task.priority ?? "medium",
    notes: task.notes?.trim() || null,
    completed: Boolean(task.completed),
    completed_at: task.completedAt ?? null,
    actual_minutes: task.actualMinutes != null ? Number(task.actualMinutes) : null,
    linked_study_session_id: task.linkedStudySessionId ?? null,
    created_at: task.createdAt ?? null,
    updated_at: task.updatedAt ?? null,
  };
}

function buildWeeklyPlansPayload(weeklyPlans, activeWeeklyPlanId) {
  return {
    active_weekly_plan_id: activeWeeklyPlanId ?? null,
    plans: weeklyPlans.map((plan) => ({
      id: plan.id,
      title: plan.title.trim(),
      week_start: plan.weekStart,
      created_at: plan.createdAt ?? null,
      updated_at: plan.updatedAt ?? null,
      tasks: plan.tasks.map(serializeWeeklyTask),
    })),
  };
}

function getWeeklyStateSignature(weeklyPlans, activeWeeklyPlanId) {
  return JSON.stringify(buildWeeklyPlansPayload(weeklyPlans, activeWeeklyPlanId));
}

function getReferencePlan(weeklyPlans, activeWeeklyPlanId) {
  return (
    weeklyPlans.find((plan) => plan.id === activeWeeklyPlanId) ??
    getPlanForDate(weeklyPlans) ??
    weeklyPlans[0] ??
    null
  );
}

function buildPlanRange(plan) {
  if (!plan) {
    return null;
  }

  const weekDates = getWeekDates(plan.weekStart);
  return {
    start: weekDates[0].dateKey,
    end: weekDates[6].dateKey,
  };
}

function isWithinRange(dateKey, range) {
  if (!range) {
    return true;
  }
  return dateKey >= range.start && dateKey <= range.end;
}

function deriveRecommendationPayload({
  topic,
  studySessions,
  breakLogs,
  weeklyPlans,
  activeWeeklyPlanId,
}) {
  const referencePlan = getReferencePlan(weeklyPlans, activeWeeklyPlanId);
  const planRange = buildPlanRange(referencePlan);
  const latestSession = studySessions[0] ?? null;

  const resolvedTopic =
    topic?.trim() ||
    latestSession?.topic?.trim() ||
    referencePlan?.tasks.find((task) => !task.completed)?.topic?.trim() ||
    referencePlan?.tasks[0]?.topic?.trim() ||
    "";

  if (!resolvedTopic) {
    return null;
  }

  const normalizedTopic = normalizeTopic(resolvedTopic);
  const topicSessions = studySessions.filter((session) => {
    if (normalizeTopic(session.topic) !== normalizedTopic) {
      return false;
    }

    return isWithinRange(session.date, planRange);
  });

  if (topicSessions.length === 0) {
    return null;
  }

  const topicTasks =
    referencePlan?.tasks.filter((task) => normalizeTopic(task.topic) === normalizedTopic) ?? [];
  const completedTopicTasks = topicTasks.filter((task) => task.completed);
  const attempts = Math.max(1, topicSessions.length);
  const timeSpent = topicSessions.reduce(
    (total, session) => total + Number(session.time_spent),
    0,
  );
  const plannedTopicMinutes = topicTasks.reduce(
    (total, task) => total + Number(task.duration_minutes),
    0,
  );
  const actualTopicMinutes = completedTopicTasks.reduce(
    (total, task) => total + Number(task.actualMinutes ?? task.duration_minutes),
    0,
  );

  let score = 0;
  if (topicTasks.length > 0) {
    const completionScore = (completedTopicTasks.length / topicTasks.length) * 100;
    const timeCoverage =
      plannedTopicMinutes > 0 ? Math.min(1, timeSpent / plannedTopicMinutes) * 20 : 0;
    score = Math.min(100, Math.round(completionScore * 0.8 + timeCoverage));
  } else {
    score = Math.min(92, 35 + Math.round(timeSpent / 4) + Math.min(attempts, 5) * 4);
  }

  const topicBreakLogs = breakLogs.filter((log) => {
    if (!log.topic) {
      return false;
    }

    if (normalizeTopic(log.topic) !== normalizedTopic) {
      return false;
    }

    return isWithinRange(log.date, planRange);
  });
  const relevantBreakLogs = topicBreakLogs.length > 0 ? topicBreakLogs : breakLogs.slice(0, 10);
  const recentBreakCount = relevantBreakLogs.length;
  const recentBreakMinutes = relevantBreakLogs.reduce(
    (total, log) => total + Number(log.duration_minutes),
    0,
  );
  const averageBreakMinutes =
    recentBreakCount > 0 ? Number((recentBreakMinutes / recentBreakCount).toFixed(1)) : null;

  return {
    topic: resolvedTopic,
    score,
    attempts,
    time_spent: timeSpent,
    recent_break_count: recentBreakCount,
    average_break_minutes: averageBreakMinutes,
    recent_break_minutes: recentBreakMinutes,
    derived: {
      topicTaskCount: topicTasks.length,
      completedTopicTaskCount: completedTopicTasks.length,
      plannedTopicMinutes,
      actualTopicMinutes,
    },
  };
}

export function StudyProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState(readStoredState);
  const [hasHydratedAccountData, setHasHydratedAccountData] = useState(false);
  const [recommendationMeta, setRecommendationMeta] = useState({
    isLoading: false,
    error: "",
  });
  const [pendingRecommendationTopic, setPendingRecommendationTopic] = useState("");
  const lastSyncedWeeklyStateRef = useRef("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    let isActive = true;
    setHasHydratedAccountData(false);

    if (!isAuthenticated) {
      const storedState = readStoredState();
      setState((current) => ({
        ...storedState,
        currentRecommendation:
          current.currentRecommendation ?? storedState.currentRecommendation,
      }));
      lastSyncedWeeklyStateRef.current = "";
      setHasHydratedAccountData(true);
      return undefined;
    }

    async function hydrateStudyData() {
      try {
        const storedState = readStoredState();
        const storedWeeklyPlans = storedState.weeklyPlans.map(normalizeWeeklyPlan);
        const [sessionsResponse, breakLogsResponse, weeklyStateResponse] = await Promise.all([
          getStudySessions(),
          getBreakLogs(),
          getWeeklyPlansState(),
        ]);

        if (!isActive) {
          return;
        }

        let weeklyPlans = weeklyStateResponse.data.plans.map(normalizeWeeklyPlan);
        let activeWeeklyPlanId =
          weeklyStateResponse.data.active_weekly_plan_id ?? weeklyPlans[0]?.id ?? null;

        if (weeklyPlans.length === 0 && storedWeeklyPlans.length > 0) {
          const syncResponse = await syncWeeklyPlansState(
            buildWeeklyPlansPayload(storedWeeklyPlans, storedState.activeWeeklyPlanId),
          );

          if (!isActive) {
            return;
          }

          weeklyPlans = syncResponse.data.plans.map(normalizeWeeklyPlan);
          activeWeeklyPlanId =
            syncResponse.data.active_weekly_plan_id ?? weeklyPlans[0]?.id ?? null;
        }

        lastSyncedWeeklyStateRef.current = getWeeklyStateSignature(
          weeklyPlans,
          activeWeeklyPlanId,
        );

        setState((current) => ({
          ...current,
          studySessions: sessionsResponse.data.map(normalizeStudySession),
          breakLogs: breakLogsResponse.data.map(normalizeBreakLog),
          weeklyPlans,
          activeWeeklyPlanId,
          activeTimerTask: storedState.activeTimerTask ?? null,
        }));
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error("Failed to load study data", error);
      } finally {
        if (isActive) {
          setHasHydratedAccountData(true);
        }
      }
    }

    hydrateStudyData();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !hasHydratedAccountData) {
      return undefined;
    }

    const currentSignature = getWeeklyStateSignature(
      state.weeklyPlans,
      state.activeWeeklyPlanId,
    );

    if (currentSignature === lastSyncedWeeklyStateRef.current) {
      return undefined;
    }

    let isActive = true;

    async function persistWeeklyState() {
      try {
        const response = await syncWeeklyPlansState(
          buildWeeklyPlansPayload(state.weeklyPlans, state.activeWeeklyPlanId),
        );

        if (!isActive) {
          return;
        }

        const weeklyPlans = response.data.plans.map(normalizeWeeklyPlan);
        const activeWeeklyPlanId =
          response.data.active_weekly_plan_id ?? weeklyPlans[0]?.id ?? null;
        const nextSignature = getWeeklyStateSignature(weeklyPlans, activeWeeklyPlanId);
        lastSyncedWeeklyStateRef.current = nextSignature;

        if (nextSignature !== currentSignature) {
          setState((current) => ({
            ...current,
            weeklyPlans,
            activeWeeklyPlanId,
          }));
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error("Failed to sync weekly plans", error);
      }
    }

    void persistWeeklyState();

    return () => {
      isActive = false;
    };
  }, [
    hasHydratedAccountData,
    isAuthenticated,
    state.activeWeeklyPlanId,
    state.weeklyPlans,
  ]);

  useEffect(() => {
    let isActive = true;

    if (!pendingRecommendationTopic) {
      return undefined;
    }

    async function refreshRecommendation() {
      const payload = deriveRecommendationPayload({
        topic: pendingRecommendationTopic,
        studySessions: state.studySessions,
        breakLogs: state.breakLogs,
        weeklyPlans: state.weeklyPlans,
        activeWeeklyPlanId: state.activeWeeklyPlanId,
      });

      if (!payload) {
        if (!isActive) {
          return;
        }

        setRecommendationMeta({ isLoading: false, error: "" });
        setPendingRecommendationTopic("");
        return;
      }

      setRecommendationMeta({ isLoading: true, error: "" });

      try {
        const response = await getRecommendation({
          topic: payload.topic,
          score: payload.score,
          attempts: payload.attempts,
          time_spent: payload.time_spent,
          recent_break_count: payload.recent_break_count,
          average_break_minutes: payload.average_break_minutes,
          recent_break_minutes: payload.recent_break_minutes,
        });

        if (!isActive) {
          return;
        }

        setState((current) => ({
          ...current,
          currentRecommendation: {
            metrics: payload,
            result: response.data,
            generatedAt: new Date().toISOString(),
          },
        }));
        setRecommendationMeta({ isLoading: false, error: "" });
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error("Failed to refresh recommendation", error);
        setRecommendationMeta({
          isLoading: false,
          error: "Could not refresh recommendation right now.",
        });
      } finally {
        if (isActive) {
          setPendingRecommendationTopic("");
        }
      }
    }

    void refreshRecommendation();

    return () => {
      isActive = false;
    };
  }, [
    pendingRecommendationTopic,
    state.activeWeeklyPlanId,
    state.breakLogs,
    state.studySessions,
    state.weeklyPlans,
  ]);

  function queueRecommendation(topic = "") {
    setPendingRecommendationTopic(topic);
  }

  async function addStudySession(session, options = {}) {
    const nextSession = {
      ...session,
      topic: session.topic.trim(),
      time_spent: Number(session.time_spent),
      started_at: session.started_at ?? null,
      ended_at: session.ended_at ?? null,
      source: session.source ?? "manual",
    };

    let savedSession = null;

    if (!isAuthenticated) {
      savedSession = {
        ...nextSession,
        id: crypto.randomUUID(),
      };
    } else {
      const response = await createStudySession(nextSession);
      savedSession = normalizeStudySession(response.data);
    }

    setState((current) => ({
      ...current,
      studySessions: [savedSession, ...current.studySessions],
    }));

    if (options.refreshRecommendation !== false) {
      queueRecommendation(savedSession.topic);
    }

    return savedSession;
  }

  async function addBreakLog(log, options = {}) {
    const normalizedTopic = log.topic?.trim() ?? "";
    const nextLog = {
      ...log,
      topic: normalizedTopic || null,
      duration_minutes: Number(log.duration_minutes),
      started_at: log.started_at ?? null,
      ended_at: log.ended_at ?? null,
      study_session_id: log.study_session_id ?? null,
    };

    let savedLog = null;

    if (!isAuthenticated) {
      savedLog = {
        ...nextLog,
        id: crypto.randomUUID(),
      };
    } else {
      const response = await createBreakLog(nextLog);
      savedLog = normalizeBreakLog(response.data);
    }

    setState((current) => ({
      ...current,
      breakLogs: [savedLog, ...current.breakLogs],
    }));

    if (options.refreshRecommendation && savedLog.topic) {
      queueRecommendation(savedLog.topic);
    }

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

  function toggleWeeklyTask(planId, taskId, options = {}) {
    let recommendationTopic = "";

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
          tasks: plan.tasks.map((task) => {
            if (task.id !== taskId) {
              return task;
            }

            recommendationTopic = task.topic;
            return {
              ...task,
              completed: !task.completed,
              completedAt: !task.completed ? new Date().toISOString() : null,
              actualMinutes: !task.completed
                ? task.actualMinutes ?? Number(task.duration_minutes)
                : task.actualMinutes,
            };
          }),
        };
      }),
    }));

    if (options.refreshRecommendation !== false && recommendationTopic) {
      queueRecommendation(recommendationTopic);
    }
  }

  function completeWeeklyTask(planId, taskId, completion = {}, options = {}) {
    const completedAt = completion.completedAt ?? new Date().toISOString();
    let recommendationTopic = "";

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
          tasks: plan.tasks.map((task) => {
            if (task.id !== taskId) {
              return task;
            }

            recommendationTopic = task.topic;
            return {
              ...task,
              completed: true,
              completedAt,
              actualMinutes:
                completion.actualMinutes != null
                  ? Number(completion.actualMinutes)
                  : task.actualMinutes ?? Number(task.duration_minutes),
              linkedStudySessionId: completion.studySessionId ?? task.linkedStudySessionId,
            };
          }),
        };
      }),
    }));

    if (options.refreshRecommendation !== false && recommendationTopic) {
      queueRecommendation(recommendationTopic);
    }
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

  function exportProgress() {
    downloadJson("studygenie-progress.json", {
      exportedAt: new Date().toISOString(),
      currentRecommendation: state.currentRecommendation,
      studySessions: state.studySessions,
      breakLogs: state.breakLogs,
      activeTimerTask: state.activeTimerTask,
      weeklyPlans: state.weeklyPlans,
      activeWeeklyPlanId: state.activeWeeklyPlanId,
    });
  }

  const value = useMemo(
    () => ({
      ...state,
      recommendationMeta,
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
      refreshRecommendation: queueRecommendation,
      exportProgress,
    }),
    [recommendationMeta, state],
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
