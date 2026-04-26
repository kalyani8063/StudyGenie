import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  createBreakLog,
  createStudySession,
  getConceptRetention,
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
  conceptRetention: null,
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

function normalizeConceptNode(node) {
  return {
    concept_key: node.concept_key,
    name: node.name,
    kind: node.kind ?? "section",
    parent_name: node.parent_name ?? null,
    summary: node.summary ?? "",
    difficulty: node.difficulty ?? "medium",
    importance: Number(node.importance ?? 0),
    focus_terms: Array.isArray(node.focus_terms) ? node.focus_terms.filter(Boolean) : [],
    slide_numbers: Array.isArray(node.slide_numbers)
      ? node.slide_numbers.filter((value) => Number.isFinite(Number(value))).map(Number)
      : [],
    related_concepts: Array.isArray(node.related_concepts)
      ? node.related_concepts.filter(Boolean)
      : [],
    mastery_score: node.mastery_score != null ? Number(node.mastery_score) : null,
    retention_score: node.retention_score != null ? Number(node.retention_score) : null,
    forgetting_risk: node.forgetting_risk != null ? Number(node.forgetting_risk) : null,
    evidence_count: node.evidence_count != null ? Number(node.evidence_count) : null,
    status: node.status ?? null,
    insight: node.insight ?? "",
    last_reviewed_at: node.last_reviewed_at ?? null,
    study_status: node.study_status ?? "not_started",
    study_count: node.study_count != null ? Number(node.study_count) : 0,
    total_study_minutes:
      node.total_study_minutes != null ? Number(node.total_study_minutes) : 0,
    quiz_attempt_count:
      node.quiz_attempt_count != null ? Number(node.quiz_attempt_count) : 0,
    average_quiz_score:
      node.average_quiz_score != null ? Number(node.average_quiz_score) : null,
    best_quiz_score: node.best_quiz_score != null ? Number(node.best_quiz_score) : null,
  };
}

function normalizeConceptEdge(edge) {
  return {
    source_concept_key: edge.source_concept_key,
    target_concept_key: edge.target_concept_key,
    source_name: edge.source_name,
    target_name: edge.target_name,
    relation_type: edge.relation_type ?? "related",
    weight: Number(edge.weight ?? 0),
  };
}

function normalizeConceptRetention(payload) {
  if (!payload) {
    return null;
  }

  return {
    lesson_count: Number(payload.lesson_count ?? 0),
    concept_count: Number(payload.concept_count ?? 0),
    updated_at: payload.updated_at ?? null,
    at_risk_concepts: Array.isArray(payload.at_risk_concepts)
      ? payload.at_risk_concepts.map(normalizeConceptNode)
      : [],
    strongest_concepts: Array.isArray(payload.strongest_concepts)
      ? payload.strongest_concepts.map(normalizeConceptNode)
      : [],
    graph_nodes: Array.isArray(payload.graph_nodes)
      ? payload.graph_nodes.map(normalizeConceptNode)
      : [],
    graph_edges: Array.isArray(payload.graph_edges)
      ? payload.graph_edges.map(normalizeConceptEdge)
      : [],
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

function isLessonStudioTask(task) {
  return (task?.notes ?? "").startsWith("From Lesson Studio:");
}

function getWeeklyTaskDuplicateKey(task) {
  return [
    normalizeTopic(task?.topic ?? ""),
    task?.day ?? "",
    Number(task?.duration_minutes ?? 0),
    task?.priority ?? "medium",
    (task?.notes ?? "").trim(),
  ].join("|");
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
  const [conceptRetentionMeta, setConceptRetentionMeta] = useState({
    isLoading: false,
    error: "",
  });
  const [pendingRecommendationTopic, setPendingRecommendationTopic] = useState("");
  const [conceptRefreshTick, setConceptRefreshTick] = useState(0);
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
        conceptRetention: null,
      }));
      lastSyncedWeeklyStateRef.current = "";
      setHasHydratedAccountData(true);
      return undefined;
    }

    async function hydrateStudyData() {
      try {
        const storedState = readStoredState();
        const storedWeeklyPlans = storedState.weeklyPlans.map(normalizeWeeklyPlan);
        const [sessionsResponse, breakLogsResponse, weeklyStateResponse, conceptRetentionResponse] =
          await Promise.all([
            getStudySessions(),
            getBreakLogs(),
            getWeeklyPlansState(),
            getConceptRetention(),
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
          conceptRetention: normalizeConceptRetention(conceptRetentionResponse.data),
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

    if (!isAuthenticated || !hasHydratedAccountData) {
      setConceptRetentionMeta({ isLoading: false, error: "" });
      return undefined;
    }

    async function refreshConceptRetention() {
      setConceptRetentionMeta({ isLoading: true, error: "" });

      try {
        const response = await getConceptRetention();
        if (!isActive) {
          return;
        }

        setState((current) => ({
          ...current,
          conceptRetention: normalizeConceptRetention(response.data),
        }));
        setConceptRetentionMeta({ isLoading: false, error: "" });
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error("Failed to load concept retention", error);
        setConceptRetentionMeta({
          isLoading: false,
          error: "Could not refresh concept retention right now.",
        });
      }
    }

    void refreshConceptRetention();

    return () => {
      isActive = false;
    };
  }, [conceptRefreshTick, hasHydratedAccountData, isAuthenticated]);

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
        if (isAuthenticated) {
          queueConceptRetentionRefresh();
        }
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
    isAuthenticated,
    pendingRecommendationTopic,
    state.activeWeeklyPlanId,
    state.breakLogs,
    state.studySessions,
    state.weeklyPlans,
  ]);

  function queueRecommendation(topic = "") {
    setPendingRecommendationTopic(topic);
  }

  function queueConceptRetentionRefresh() {
    setConceptRefreshTick((current) => current + 1);
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

    if (isAuthenticated) {
      queueConceptRetentionRefresh();
    }

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

    if (isAuthenticated) {
      queueConceptRetentionRefresh();
    }

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

        const normalizedCandidate = normalizeWeeklyTask({
          ...task,
          id: crypto.randomUUID(),
          completed: false,
          completedAt: null,
          actualMinutes: null,
          linkedStudySessionId: null,
          createdAt: new Date().toISOString(),
        });

        const existingDuplicate = isLessonStudioTask(normalizedCandidate)
          ? plan.tasks.find(
              (existingTask) =>
                !existingTask.completed &&
                isLessonStudioTask(existingTask) &&
                getWeeklyTaskDuplicateKey(existingTask) ===
                  getWeeklyTaskDuplicateKey(normalizedCandidate),
            ) ?? null
          : null;

        if (existingDuplicate) {
          savedTask = existingDuplicate;
          return plan;
        }

        savedTask = normalizedCandidate;

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
      conceptRetention: state.conceptRetention,
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
      conceptRetentionMeta,
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
      refreshConceptRetention: queueConceptRetentionRefresh,
      exportProgress,
    }),
    [conceptRetentionMeta, recommendationMeta, state],
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
