import { useEffect, useMemo, useState } from "react";

import { createLessonQuizAttempt } from "../api/client.js";
import { useAuth } from "../state/AuthContext.jsx";
import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import SessionTimerCard from "../components/SessionTimerCard.jsx";
import StatCard from "../components/StatCard.jsx";
import TodayPlannedTasksCard from "../components/TodayPlannedTasksCard.jsx";
import StudyTimeCharts from "../components/charts/StudyTimeCharts.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import InputField from "../components/ui/InputField.jsx";
import { useStudy } from "../state/StudyContext.jsx";

function getLocalDateString(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const initialSession = {
  topic: "",
  time_spent: "",
  date: getLocalDateString(),
};

const TRACKER_FORM_KEY = "studygenie-tracker-form";
const TRACKER_FILTERS_KEY = "studygenie-tracker-filters";
const LESSON_STUDIO_STORAGE_KEY = "studygenie-lesson-studio";

function readStoredValue(storageKey, fallbackValue) {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? { ...fallbackValue, ...JSON.parse(stored) } : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function readStoredLessonStudio() {
  try {
    const raw = localStorage.getItem(LESSON_STUDIO_STORAGE_KEY);
    if (!raw) {
      return {
        quizResponses: {},
        result: null,
        statusMessage: "",
      };
    }

    const parsed = JSON.parse(raw);
    return {
      quizResponses:
        parsed?.quizResponses && typeof parsed.quizResponses === "object"
          ? parsed.quizResponses
          : {},
      result: parsed?.result ?? null,
      statusMessage: typeof parsed?.statusMessage === "string" ? parsed.statusMessage : "",
    };
  } catch {
    return {
      quizResponses: {},
      result: null,
      statusMessage: "",
    };
  }
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatPercent(value) {
  if (value == null) {
    return "--";
  }

  return `${Math.round(Number(value) * 100)}%`;
}

function formatSlideRange(slideNumbers = []) {
  if (!slideNumbers.length) {
    return "Slides unavailable";
  }

  const sorted = [...slideNumbers].sort((left, right) => left - right);
  if (sorted[0] === sorted[sorted.length - 1]) {
    return `Slide ${sorted[0]}`;
  }

  return `Slides ${sorted[0]}-${sorted[sorted.length - 1]}`;
}

function normalizeLessonSlide(slide) {
  const slideNumber = Number(slide?.slide_number);

  return {
    slide_number: Number.isFinite(slideNumber) && slideNumber >= 1 ? slideNumber : 0,
    title:
      typeof slide?.title === "string" && slide.title.trim()
        ? slide.title
        : Number.isFinite(slideNumber) && slideNumber >= 1
          ? `Slide ${slideNumber}`
          : "Slide",
    points: Array.isArray(slide?.points) ? slide.points.filter(Boolean) : [],
    text: typeof slide?.text === "string" ? slide.text : "",
  };
}

function findConceptForLabel(concepts = [], label) {
  const normalizedLabel = label?.trim().toLowerCase();
  if (!normalizedLabel) {
    return null;
  }

  return (
    concepts.find((concept) => concept.name?.trim().toLowerCase() === normalizedLabel) ??
    concepts.find((concept) => concept.parent_name?.trim().toLowerCase() === normalizedLabel) ??
    concepts.find((concept) => concept.name?.trim().toLowerCase().includes(normalizedLabel)) ??
    null
  );
}

function mergeConceptSnapshot(summary, nextConcept) {
  if (!summary || !nextConcept?.concept_key) {
    return summary;
  }

  return {
    ...summary,
    concepts: (summary.concepts ?? []).map((concept) =>
      concept.concept_key === nextConcept.concept_key ? nextConcept : concept,
    ),
  };
}

function buildLocalConceptSnapshot(concept, updates = {}) {
  const next = {
    ...concept,
    ...updates,
  };

  if (updates.studyMinutes != null) {
    next.study_count = Number(concept.study_count ?? 0) + 1;
    next.total_study_minutes =
      Number(concept.total_study_minutes ?? 0) + Number(updates.studyMinutes);
    next.study_status = updates.markComplete === false ? "in_progress" : "studied";
    next.evidence_count = Number(concept.evidence_count ?? 0) + 1;
    next.mastery_score = clamp(Number(concept.mastery_score ?? 0.35) + 0.08, 0.05, 0.98);
    next.retention_score = clamp(Number(concept.retention_score ?? 0.28) + 0.12, 0.02, 0.99);
    next.forgetting_risk = clamp(
      Number(concept.forgetting_risk ?? concept.importance ?? 0.45) - 0.12,
      0.01,
      0.99,
    );
    next.status = next.retention_score >= 0.72 ? "strong" : "watch";
    next.insight = `${concept.name} has a tracked study block now, so its retention signal has been strengthened.`;
    next.last_reviewed_at = new Date().toISOString();
  }

  if (updates.quizScore != null) {
    const previousAttemptCount = Number(concept.quiz_attempt_count ?? 0);
    const previousAverage = Number(concept.average_quiz_score ?? 0);
    const nextAttemptCount = previousAttemptCount + 1;
    const nextAverage =
      (previousAverage * previousAttemptCount + Number(updates.quizScore)) /
      Math.max(1, nextAttemptCount);

    next.quiz_attempt_count = nextAttemptCount;
    next.average_quiz_score = Number(nextAverage.toFixed(1));
    next.best_quiz_score = Math.max(
      Number(concept.best_quiz_score ?? 0),
      Number(updates.quizScore),
    );
    next.study_status =
      Number(updates.quizScore) >= 80
        ? "studied"
        : Number(updates.quizScore) >= 45
          ? "in_progress"
          : concept.study_status ?? "not_started";
    next.status =
      Number(updates.quizScore) >= 80
        ? "strong"
        : Number(updates.quizScore) >= 45
          ? "watch"
          : "at_risk";
    next.mastery_score = clamp(
      Number(concept.mastery_score ?? 0.3) + Number(updates.quizScore) / 400,
      0.05,
      0.98,
    );
    next.retention_score = clamp(Number(updates.quizScore) / 100, 0.02, 0.99);
    next.forgetting_risk = clamp(
      Number(concept.importance ?? 0.5) * (1 - next.retention_score),
      0.01,
      0.99,
    );
    next.evidence_count = Number(concept.evidence_count ?? 0) + 1;
    next.insight =
      Number(updates.quizScore) >= 80
        ? `${concept.name} scored strongly in the tracker quiz, so confidence is rising.`
        : `${concept.name} needs another pass because the latest tracker quiz result was below full confidence.`;
    next.last_reviewed_at = new Date().toISOString();
  }

  return next;
}

function buildTrackerQuizItems(context) {
  if (!context) {
    return [];
  }

  const title = context.section?.title ?? context.concept?.name ?? context.topic;
  const referenceAnswer =
    [
      context.section?.summary,
      ...(context.section?.key_points ?? []).slice(0, 2),
    ]
      .filter(Boolean)
      .join(" ") || "Review the lesson summary and explain the topic in your own words.";
  const promptSeed = [
    context.section?.subtopics?.[0]
      ? `How do ${context.section.subtopics[0]} and ${title} connect in the lesson?`
      : null,
    context.section?.key_points?.[0]
      ? `How would you explain ${title} using the idea: ${context.section.key_points[0].replace(/\.$/, "")}?`
      : null,
    `What is the main idea behind ${title}, and where would you apply it?`,
  ].filter(Boolean);

  const stableKey = String(context.concept?.concept_key ?? title ?? "lesson-topic")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return promptSeed.slice(0, 3).map((question, index) => ({
    concept_key: context.concept?.concept_key ?? null,
    concept_name: context.concept?.name ?? title,
    id: `tracker-quiz-${stableKey}-${index + 1}`,
    question,
    reference_answer: referenceAnswer,
  }));
}

function getRelevantLessonSlides(summary, context) {
  if (!summary || !context) {
    return [];
  }

  const slides = Array.isArray(summary.slides)
    ? summary.slides.map(normalizeLessonSlide).filter((slide) => slide.slide_number >= 1)
    : [];

  if (!slides.length) {
    return [];
  }

  const targetSlideNumbers = new Set(
    [
      ...(context.section?.slide_numbers ?? []),
      ...(context.concept?.slide_numbers ?? []),
    ]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 1),
  );

  if (targetSlideNumbers.size > 0) {
    return slides.filter((slide) => targetSlideNumbers.has(slide.slide_number));
  }

  return slides.slice(0, 6);
}

function getLessonTopicContext(summary, topic) {
  const normalizedTopic = topic?.trim().toLowerCase();
  if (!summary || !normalizedTopic) {
    return null;
  }

  const sections = Array.isArray(summary.sections) ? summary.sections : [];
  const concepts = Array.isArray(summary.concepts) ? summary.concepts : [];
  const section =
    sections.find((item) => item.title?.trim().toLowerCase() === normalizedTopic) ??
    sections.find((item) => item.title?.trim().toLowerCase().includes(normalizedTopic)) ??
    sections.find((item) =>
      (item.subtopics ?? []).some((subtopic) => subtopic.trim().toLowerCase() === normalizedTopic),
    ) ??
    sections.find((item) =>
      (item.subtopics ?? []).some((subtopic) => subtopic.trim().toLowerCase().includes(normalizedTopic)),
    ) ??
    null;

  const concept =
    findConceptForLabel(concepts, section?.title ?? topic) ??
    findConceptForLabel(concepts, topic) ??
    findConceptForLabel(concepts, section?.subtopics?.[0]) ??
    null;

  const resolvedSection =
    section ??
    sections.find(
      (item) =>
        item.title?.trim().toLowerCase() ===
        String(concept?.parent_name ?? concept?.name ?? "").trim().toLowerCase(),
    ) ??
    null;

  if (!resolvedSection && !concept) {
    return null;
  }

  return {
    concept,
    lessonTitle: summary.title ?? "Lesson guide",
    lessonSlides: getRelevantLessonSlides(summary, {
      concept,
      section: resolvedSection,
    }),
    savedLessonId:
      Number.isFinite(Number(summary.saved_lesson_id)) && Number(summary.saved_lesson_id) > 0
        ? Number(summary.saved_lesson_id)
        : null,
    section: resolvedSection,
    topic: topic.trim(),
  };
}

function getScoreTone(score) {
  if (score >= 80) return "success";
  if (score >= 45) return "warning";
  return "danger";
}

function StudyTrackerPage() {
  const storedLessonStudio = useMemo(() => readStoredLessonStudio(), []);
  const { isAuthenticated } = useAuth();
  const {
    activeTimerTask,
    addStudySession,
    breakLogs,
    refreshConceptRetention,
    studySessions,
    weeklyPlans,
  } = useStudy();
  const [session, setSession] = useState(() => readStoredValue(TRACKER_FORM_KEY, initialSession));
  const [filters, setFilters] = useState(() =>
    readStoredValue(TRACKER_FILTERS_KEY, { topic: "", date: "" }),
  );
  const [lessonStudio, setLessonStudio] = useState(storedLessonStudio);
  const [lessonFlow, setLessonFlow] = useState(null);
  const [error, setError] = useState("");
  const [lessonError, setLessonError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isScoringQuizId, setIsScoringQuizId] = useState("");
  const totalTime = studySessions.reduce(
    (total, item) => total + Number(item.time_spent),
    0,
  );
  const mostStudiedTopic =
    Object.entries(
      studySessions.reduce((acc, item) => {
        acc[item.topic] = (acc[item.topic] ?? 0) + Number(item.time_spent);
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None yet";
  const totalBreakTime = breakLogs.reduce(
    (total, item) => total + Number(item.duration_minutes),
    0,
  );
  const averageBreak =
    breakLogs.length > 0 ? Math.round(totalBreakTime / breakLogs.length) : 0;
  const filteredSessions = studySessions.filter((item) => {
    const matchesTopic = filters.topic
      ? item.topic.toLowerCase().includes(filters.topic.toLowerCase())
      : true;
    const matchesDate = filters.date ? item.date === filters.date : true;
    return matchesTopic && matchesDate;
  });
  const activeTaskPlan =
    weeklyPlans.find((plan) => plan.id === activeTimerTask?.planId) ?? null;
  const activePlannedTask =
    activeTaskPlan?.tasks.find((task) => task.id === activeTimerTask?.taskId) ?? null;
  const activeLessonContext = useMemo(
    () => getLessonTopicContext(lessonStudio.result, activePlannedTask?.topic ?? session.topic),
    [activePlannedTask?.topic, lessonStudio.result, session.topic],
  );
  const visibleLessonContext = lessonFlow ?? activeLessonContext;
  const lessonConfidenceScore = useMemo(() => {
    if (!lessonFlow?.quizItems?.length) {
      return null;
    }

    const answers = lessonFlow.quizItems
      .map((item) => lessonStudio.quizResponses?.[item.id]?.score)
      .filter((score) => typeof score === "number");

    if (answers.length === 0) {
      return null;
    }

    return Math.round(answers.reduce((total, score) => total + score, 0) / answers.length);
  }, [lessonFlow, lessonStudio.quizResponses]);

  useEffect(() => {
    localStorage.setItem(TRACKER_FORM_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    localStorage.setItem(TRACKER_FILTERS_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem(LESSON_STUDIO_STORAGE_KEY, JSON.stringify(lessonStudio));
  }, [lessonStudio]);

  function handleChange(event) {
    const { name, value } = event.target;
    setSession((current) => ({ ...current, [name]: value }));
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function formatBreakWindow(item) {
    if (!item.started_at || !item.ended_at) {
      return item.date;
    }

    const start = new Date(item.started_at);
    const end = new Date(item.ended_at);
    const startLabel = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(start);
    const endLabel = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(end);

    return `${startLabel} - ${endLabel}`;
  }

  function formatSessionWindow(item) {
    if (!item.started_at || !item.ended_at) {
      return item.source === "timer" ? "Timer log" : "Manual entry";
    }

    const start = new Date(item.started_at);
    const end = new Date(item.ended_at);
    const startLabel = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(start);
    const endLabel = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(end);

    return `${startLabel} - ${endLabel}`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      await addStudySession({
        topic: session.topic.trim(),
        time_spent: Number(session.time_spent),
        date: session.date,
      });
      setSession(initialSession);
      localStorage.removeItem(TRACKER_FORM_KEY);
    } catch {
      setError("Could not save the study session.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateLessonStudio(nextResult, nextQuizResponses = lessonStudio.quizResponses) {
    setLessonStudio((current) => ({
      ...current,
      quizResponses: nextQuizResponses,
      result: nextResult,
    }));
  }

  function handleLessonFocusSaved(payload) {
    const context = getLessonTopicContext(lessonStudio.result, payload.session?.topic);
    if (!context) {
      setLessonFlow(null);
      return;
    }

    let nextResult = lessonStudio.result;
    let nextConcept = context.concept;

    if (context.concept) {
      nextConcept = buildLocalConceptSnapshot(context.concept, {
        markComplete: true,
        studyMinutes: payload.trackedMinutes,
      });
      nextResult = mergeConceptSnapshot(lessonStudio.result, nextConcept);
    }

    const nextLessonFlow = {
      ...context,
      completedAt: payload.completedAt,
      concept: nextConcept,
      quizItems: buildTrackerQuizItems({
        ...context,
        concept: nextConcept,
      }),
      topic: payload.session?.topic ?? context.topic,
      trackedMinutes: payload.trackedMinutes,
    };
    const nextQuizResponses = { ...(lessonStudio.quizResponses ?? {}) };
    nextLessonFlow.quizItems.forEach((item) => {
      delete nextQuizResponses[item.id];
    });

    updateLessonStudio(nextResult, nextQuizResponses);

    setLessonError("");
    setLessonFlow(nextLessonFlow);
  }

  async function handleLessonQuizScore(item, responseLabel, score) {
    if (!lessonFlow) {
      return;
    }

    setLessonError("");
    setIsScoringQuizId(item.id);

    try {
      let nextResult = lessonStudio.result;
      let nextConcept = lessonFlow.concept;

      if (lessonFlow.savedLessonId && item.concept_key && isAuthenticated) {
        const response = await createLessonQuizAttempt({
          lesson_graph_id: lessonFlow.savedLessonId,
          concept_key: item.concept_key,
          question: item.question,
          response_label: responseLabel,
          score,
        });
        nextConcept = response.data;
        nextResult = mergeConceptSnapshot(lessonStudio.result, response.data);
        refreshConceptRetention();
      } else if (lessonFlow.concept) {
        nextConcept = buildLocalConceptSnapshot(lessonFlow.concept, { quizScore: score });
        nextResult = mergeConceptSnapshot(lessonStudio.result, nextConcept);
      }

      const nextQuizResponses = {
        ...(lessonStudio.quizResponses ?? {}),
        [item.id]: {
          answeredAt: new Date().toISOString(),
          conceptKey: item.concept_key,
          responseLabel,
          score,
        },
      };

      updateLessonStudio(nextResult, nextQuizResponses);
      setLessonFlow((current) =>
        current
          ? {
              ...current,
              concept: nextConcept ?? current.concept,
            }
          : current,
      );
    } catch {
      setLessonError("The tracker quiz could not be saved right now.");
    } finally {
      setIsScoringQuizId("");
    }
  }

  return (
    <section className="tracker-page">
      <div className="page-heading">
        <p className="eyebrow">Study Tracker</p>
        <h2>Track study sessions with filters, summaries, and topic-level insight.</h2>
      </div>

      <SessionTimerCard
        onFocusSaved={handleLessonFocusSaved}
        subtitle="Use the large timer here to track each study block, then log the break between sessions for better weekly planning."
        title="Study session timer"
      />

      <TodayPlannedTasksCard
        emptyMessage="Create a weekly plan for this week and assign tasks to today if you want them to show up here."
        title="Today's planner tasks"
      />

      {visibleLessonContext ? (
        <div className="tracker-grid">
          <Card
            subtitle="Lesson Studio topics launched through the timer now stay in the tracker flow with their slide range, summary, and revision clues."
            title="Lesson topic in focus"
          >
            <div className="study-output-stack">
              <section className="recommendation-section">
                <p className="section-label">Lesson deck</p>
                <p className="recommendation-text">{visibleLessonContext.lessonTitle}</p>
                <p className="field-helper">
                  The tracker currently shows the generated lesson guide and slide range from your PPT deck for this topic.
                </p>
              </section>

              <section className="recommendation-section">
                <p className="section-label">Current topic</p>
                <p className="recommendation-text">
                  {visibleLessonContext.section?.title ??
                    visibleLessonContext.concept?.name ??
                    visibleLessonContext.topic}
                </p>
                <p className="field-helper">
                  {formatSlideRange(
                    visibleLessonContext.section?.slide_numbers ??
                      visibleLessonContext.concept?.slide_numbers ??
                      [],
                  )}
                </p>
              </section>

              {visibleLessonContext.section?.summary ? (
                <p className="recommendation-text">{visibleLessonContext.section.summary}</p>
              ) : null}

              {visibleLessonContext.section?.subtopics?.length ? (
                <div className="study-detail-stack">
                  <span className="section-label">Subtopics</span>
                  <div className="pill-row">
                    {visibleLessonContext.section.subtopics.map((subtopic) => (
                      <span className="topic-pill topic-pill-soft" key={`tracker-subtopic-${subtopic}`}>
                        {subtopic}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {visibleLessonContext.section?.key_points?.length ? (
                <div className="study-detail-stack">
                  <span className="section-label">Key points</span>
                  <div className="study-list">
                    {visibleLessonContext.section.key_points.slice(0, 3).map((point) => (
                      <article className="study-list-item concept-card" key={`tracker-point-${point}`}>
                        <p className="field-helper">{point}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {visibleLessonContext.lessonSlides?.length ? (
                <div className="study-detail-stack">
                  <span className="section-label">PPT study view</span>
                  <p className="field-helper">
                    These are the extracted slides for the active lesson topic, so you can study directly here while the timer is running.
                  </p>
                  <div className="study-list">
                    {visibleLessonContext.lessonSlides.map((slide) => (
                      <article className="study-list-item lesson-section-card" key={`tracker-slide-${slide.slide_number}`}>
                        <div className="study-list-row">
                          <strong>{slide.title}</strong>
                          <Badge tone="default">Slide {slide.slide_number}</Badge>
                        </div>
                        {slide.points.length > 0 ? (
                          <div className="study-detail-stack">
                            <span className="section-label">Slide points</span>
                            <div className="study-list">
                              {slide.points.map((point, index) => (
                                <article className="study-list-item" key={`tracker-slide-${slide.slide_number}-point-${index}`}>
                                  <p className="field-helper">{point}</p>
                                </article>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="field-helper">{slide.text}</p>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ) : activePlannedTask ? (
                <p className="field-helper">
                  No extracted slide content is available for this topic yet. Regenerate the lesson guide if this PPT was uploaded before slide viewing was added.
                </p>
              ) : null}

              {lessonFlow?.trackedMinutes ? (
                <p className="success-message">
                  Session completed for {lessonFlow.topic}. Use the self-check on the right to generate your confidence score.
                </p>
              ) : activePlannedTask ? (
                <p className="field-helper">
                  Start or finish the timer for this lesson task, then StudyGenie will unlock the post-study quiz here.
                </p>
              ) : null}
            </div>
          </Card>

          <Card
            subtitle="After a lesson timer finishes, score yourself here so StudyGenie can estimate how confident you are on this topic."
            title="Post-study confidence quiz"
          >
            {lessonFlow?.quizItems?.length ? (
              <div className="study-output-stack">
                <div className="study-list-row">
                  <div>
                    <p className="section-label">Confidence score</p>
                    <p className="field-helper">Based on your self-check for this topic.</p>
                  </div>
                  <Badge tone={lessonConfidenceScore != null ? getScoreTone(lessonConfidenceScore) : "default"}>
                    {lessonConfidenceScore != null ? `${lessonConfidenceScore}% confidence` : "Not scored"}
                  </Badge>
                </div>

                <div className="study-list">
                  {lessonFlow.quizItems.map((item) => {
                    const response = lessonStudio.quizResponses?.[item.id];

                    return (
                      <article className="study-list-item concept-card" key={item.id}>
                        <div className="study-list-row">
                          <div className="concept-card-copy">
                            <strong>{item.concept_name}</strong>
                            <p className="field-helper">{item.question}</p>
                          </div>
                          {response ? (
                            <Badge tone={getScoreTone(response.score)}>{response.score}%</Badge>
                          ) : (
                            <Badge tone="default">Pending</Badge>
                          )}
                        </div>

                        <div className="recommendation-actions">
                          <Button
                            disabled={Boolean(isScoringQuizId) && isScoringQuizId !== item.id}
                            loading={isScoringQuizId === item.id}
                            onClick={() => handleLessonQuizScore(item, "not_yet", 0)}
                            size="sm"
                            variant="ghost"
                          >
                            Not yet
                          </Button>
                          <Button
                            disabled={Boolean(isScoringQuizId) && isScoringQuizId !== item.id}
                            loading={isScoringQuizId === item.id}
                            onClick={() => handleLessonQuizScore(item, "partial", 50)}
                            size="sm"
                            variant="secondary"
                          >
                            Partly
                          </Button>
                          <Button
                            disabled={Boolean(isScoringQuizId) && isScoringQuizId !== item.id}
                            loading={isScoringQuizId === item.id}
                            onClick={() => handleLessonQuizScore(item, "strong", 100)}
                            size="sm"
                          >
                            I knew it
                          </Button>
                        </div>

                        <p className="field-helper">{item.reference_answer}</p>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState
                title="No lesson quiz yet"
                message="Launch a Lesson Studio topic in the tracker and finish its timer block to generate the post-study confidence quiz here."
              />
            )}
            {lessonError ? <p className="error-message">{lessonError}</p> : null}
          </Card>
        </div>
      ) : null}

      <div className="stat-grid compact">
        <StatCard label="Total Time" value={`${totalTime} min`} helper="All sessions" />
        <StatCard
          label="Most Studied Topic"
          value={mostStudiedTopic}
          helper="Based on total minutes"
          tone="success"
        />
        <StatCard label="Break Time" value={`${totalBreakTime} min`} helper="Saved break logs" />
        <StatCard
          label="Avg Break"
          value={breakLogs.length > 0 ? `${averageBreak} min` : "0 min"}
          helper="Across recent breaks"
          tone="warning"
        />
      </div>

      <div className="tracker-grid">
        <Card subtitle="Capture one session at a time." title="Add study session">
          <form className="input-form" onSubmit={handleSubmit}>
            <InputField
              label="Topic"
              name="topic"
              placeholder="Calculus"
              type="text"
              value={session.topic}
              onChange={handleChange}
            />

            <InputField
              label="Time spent"
              min="1"
              name="time_spent"
              placeholder="40"
              type="number"
              value={session.time_spent}
              onChange={handleChange}
            />

            <InputField
              label="Date"
              name="date"
              type="date"
              value={session.date}
              onChange={handleChange}
            />

            <Button loading={isSaving} type="submit">
              {isSaving ? "Saving session" : "Add study session"}
            </Button>
          </form>
          {error ? <p className="error-message">{error}</p> : null}
        </Card>

        <Card
          subtitle="Breaks saved by the timer appear here and can support future planning decisions."
          title="Recent breaks"
        >
          {breakLogs.length > 0 ? (
            <div className="session-list">
              {breakLogs.slice(0, 6).map((item) => (
                <div className="session-row" key={item.id}>
                  <div>
                    <strong>{item.topic || "General break"}</strong>
                    <p className="muted-copy">
                      {formatBreakWindow(item)} - {item.break_type} break
                    </p>
                  </div>
                  <span className="topic-pill">{item.duration_minutes} min</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No breaks saved yet"
              message="Run the timer in break mode to capture rest periods between study blocks."
            />
          )}
        </Card>
      </div>

      <div className="tracker-grid">
        <Card subtitle="Filter by topic or date." title="Study sessions">
          <div className="tracker-filters">
            <InputField
              label="Topic filter"
              name="topic"
              placeholder="Filter by topic"
              type="text"
              value={filters.topic}
              onChange={handleFilterChange}
            />
            <InputField
              label="Date filter"
              name="date"
              type="date"
              value={filters.date}
              onChange={handleFilterChange}
            />
          </div>

          {filteredSessions.length > 0 ? (
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Logged From</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.slice(0, 8).map((item) => (
                    <tr key={item.id}>
                      <td>{item.topic}</td>
                      <td>{item.date}</td>
                      <td>{item.time_spent} min</td>
                      <td>{formatSessionWindow(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No matching sessions"
              message="Add a study session or adjust the filters to see results."
            />
          )}
        </Card>

        <Card subtitle="Topic mix and daily breakdown." title="Study time insights">
          {studySessions.length > 0 ? (
            <StudyTimeCharts sessions={studySessions} />
          ) : (
            <EmptyState
              title="Charts are waiting"
              message="Your per-topic and daily breakdowns appear after you log time."
            />
          )}
        </Card>
      </div>
    </section>
  );
}

export default StudyTrackerPage;
