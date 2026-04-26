import { useEffect, useMemo, useState } from "react";

import {
  createLessonQuizAttempt,
  logLessonConceptStudy,
  summarizePresentationLesson,
} from "../api/client.js";
import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import { getPlanForDate, getWeekStart } from "../lib/weeklyPlanner.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useStudy } from "../state/StudyContext.jsx";

const LESSON_STUDIO_STORAGE_KEY = "studygenie-lesson-studio";

function describeApiError(requestError, fallbackMessage) {
  const detail = requestError?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object") {
          const location = Array.isArray(item.loc) ? item.loc.join(" -> ") : null;
          const message = typeof item.msg === "string" ? item.msg : "Invalid input";
          return location ? `${location}: ${message}` : message;
        }

        return "";
      })
      .filter(Boolean)
      .join(" | ");
  }

  if (typeof requestError?.message === "string" && requestError.message.trim()) {
    return requestError.message;
  }

  return fallbackMessage;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function getLocalDateString(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalPlannerDay(value = new Date()) {
  const day = new Date(value).getDay();

  if (day === 0) {
    return "sun";
  }

  return ["mon", "tue", "wed", "thu", "fri", "sat"][day - 1] ?? "mon";
}

function normalizeSection(section, index) {
  return {
    title:
      typeof section?.title === "string" && section.title.trim()
        ? section.title
        : `Section ${index + 1}`,
    subtopics: Array.isArray(section?.subtopics) ? section.subtopics.filter(Boolean) : [],
    summary:
      typeof section?.summary === "string" && section.summary.trim()
        ? section.summary
        : "Summary unavailable.",
    key_points: Array.isArray(section?.key_points) ? section.key_points.filter(Boolean) : [],
    difficulty: ["easy", "medium", "hard"].includes(section?.difficulty)
      ? section.difficulty
      : "medium",
    importance:
      Number.isFinite(Number(section?.importance)) && Number(section.importance) >= 0
        ? Math.min(1, Math.max(0, Number(section.importance)))
        : 0,
    focus_terms: Array.isArray(section?.focus_terms) ? section.focus_terms.filter(Boolean) : [],
    slide_numbers: Array.isArray(section?.slide_numbers)
      ? section.slide_numbers.filter((value) => Number.isFinite(Number(value))).map(Number)
      : [],
  };
}

function normalizeConcept(concept) {
  return {
    concept_key: concept.concept_key,
    name: concept.name,
    kind: concept.kind ?? "section",
    parent_name: concept.parent_name ?? null,
    summary: concept.summary ?? "",
    difficulty: concept.difficulty ?? "medium",
    importance: Number(concept.importance ?? 0),
    focus_terms: Array.isArray(concept.focus_terms) ? concept.focus_terms.filter(Boolean) : [],
    slide_numbers: Array.isArray(concept.slide_numbers)
      ? concept.slide_numbers.filter((value) => Number.isFinite(Number(value))).map(Number)
      : [],
    related_concepts: Array.isArray(concept.related_concepts)
      ? concept.related_concepts.filter(Boolean)
      : [],
    mastery_score: concept.mastery_score != null ? Number(concept.mastery_score) : null,
    retention_score: concept.retention_score != null ? Number(concept.retention_score) : null,
    forgetting_risk: concept.forgetting_risk != null ? Number(concept.forgetting_risk) : null,
    evidence_count: concept.evidence_count != null ? Number(concept.evidence_count) : null,
    status: concept.status ?? null,
    insight: concept.insight ?? "",
    last_reviewed_at: concept.last_reviewed_at ?? null,
    study_status: concept.study_status ?? "not_started",
    study_count: concept.study_count != null ? Number(concept.study_count) : 0,
    total_study_minutes:
      concept.total_study_minutes != null ? Number(concept.total_study_minutes) : 0,
    quiz_attempt_count:
      concept.quiz_attempt_count != null ? Number(concept.quiz_attempt_count) : 0,
    average_quiz_score:
      concept.average_quiz_score != null ? Number(concept.average_quiz_score) : null,
    best_quiz_score: concept.best_quiz_score != null ? Number(concept.best_quiz_score) : null,
  };
}

function normalizeLessonSummary(data) {
  return {
    title: typeof data?.title === "string" ? data.title : "Lesson summary",
    overview: typeof data?.overview === "string" ? data.overview : "",
    keywords: Array.isArray(data?.keywords) ? data.keywords.filter(Boolean) : [],
    slides: Array.isArray(data?.slides)
      ? data.slides
          .filter((slide) => Number.isFinite(Number(slide?.slide_number)))
          .map((slide) => ({
            slide_number: Number(slide.slide_number),
            title:
              typeof slide?.title === "string" && slide.title.trim()
                ? slide.title
                : `Slide ${Number(slide.slide_number)}`,
            points: Array.isArray(slide?.points) ? slide.points.filter(Boolean) : [],
            text: typeof slide?.text === "string" ? slide.text : "",
          }))
      : [],
    sections: Array.isArray(data?.sections)
      ? data.sections.map((section, index) => normalizeSection(section, index))
      : [],
    revise_first: Array.isArray(data?.revise_first)
      ? data.revise_first.map((section, index) => normalizeSection(section, index))
      : [],
    quiz_questions: Array.isArray(data?.quiz_questions) ? data.quiz_questions.filter(Boolean) : [],
    flashcards: Array.isArray(data?.flashcards)
      ? data.flashcards
          .filter((item) => item?.front && item?.back)
          .map((item) => ({ front: item.front, back: item.back }))
      : [],
    concepts: Array.isArray(data?.concepts) ? data.concepts.map(normalizeConcept) : [],
    concept_edges: Array.isArray(data?.concept_edges)
      ? data.concept_edges
          .filter((item) => item?.source_concept_key && item?.target_concept_key)
          .map((item) => ({
            source_concept_key: item.source_concept_key,
            target_concept_key: item.target_concept_key,
            source_name: item.source_name,
            target_name: item.target_name,
            relation_type: item.relation_type ?? "related",
            weight: Number(item.weight ?? 0),
          }))
      : [],
    saved_lesson_id: Number.isFinite(Number(data?.saved_lesson_id))
      ? Number(data.saved_lesson_id)
      : null,
    estimated_revision_time:
      typeof data?.estimated_revision_time === "string" ? data.estimated_revision_time : "--",
    slide_count: Number(data?.slide_count ?? 0),
    source_text_length: Number(data?.source_text_length ?? 0),
  };
}

function readStoredLessonStudio() {
  try {
    const raw = localStorage.getItem(LESSON_STUDIO_STORAGE_KEY);
    if (!raw) {
      return {
        result: null,
        statusMessage: "",
        quizResponses: {},
      };
    }

    const parsed = JSON.parse(raw);
    return {
      result: parsed?.result ? normalizeLessonSummary(parsed.result) : null,
      statusMessage: typeof parsed?.statusMessage === "string" ? parsed.statusMessage : "",
      quizResponses:
        parsed?.quizResponses && typeof parsed.quizResponses === "object"
          ? parsed.quizResponses
          : {},
    };
  } catch {
    return {
      result: null,
      statusMessage: "",
      quizResponses: {},
    };
  }
}

function getDifficultyTone(difficulty) {
  if (difficulty === "hard") return "danger";
  if (difficulty === "medium") return "warning";
  return "success";
}

function getImportanceTone(importance) {
  if (importance >= 0.8) return "danger";
  if (importance >= 0.6) return "warning";
  return "default";
}

function getConceptStatusTone(status) {
  if (status === "at_risk") return "danger";
  if (status === "watch") return "warning";
  return "success";
}

function getStudyStatusTone(status) {
  if (status === "studied") return "success";
  if (status === "in_progress") return "warning";
  return "default";
}

function formatImportance(importance) {
  return `${Math.round(importance * 100)}%`;
}

function formatPercent(value) {
  if (value == null) {
    return "--";
  }
  return `${Math.round(Number(value) * 100)}%`;
}

function getImportanceLabel(importance) {
  if (importance >= 0.8) return "Revise now";
  if (importance >= 0.6) return "High value";
  if (importance >= 0.4) return "Worth revising";
  return "Support topic";
}

function formatSlideRange(slideNumbers) {
  if (!slideNumbers.length) {
    return "Slides unavailable";
  }

  const sorted = [...slideNumbers].sort((left, right) => left - right);
  if (sorted[0] === sorted[sorted.length - 1]) {
    return `Slide ${sorted[0]}`;
  }

  return `Slides ${sorted[0]}-${sorted[sorted.length - 1]}`;
}

function findConceptForLabel(concepts, label) {
  const normalizedLabel = label?.trim().toLowerCase();
  if (!normalizedLabel) {
    return null;
  }

  return (
    concepts.find((concept) => concept.name.trim().toLowerCase() === normalizedLabel) ??
    concepts.find((concept) => concept.parent_name?.trim().toLowerCase() === normalizedLabel) ??
    concepts.find((concept) => concept.name.trim().toLowerCase().includes(normalizedLabel)) ??
    null
  );
}

function buildInteractiveQuiz(summary) {
  if (!summary) {
    return [];
  }

  const sourceSections = summary.revise_first.length > 0 ? summary.revise_first : summary.sections;
  return summary.quiz_questions.slice(0, 4).map((question, index) => {
    const section = sourceSections[index % Math.max(1, sourceSections.length)] ?? sourceSections[0];
    const concept =
      findConceptForLabel(summary.concepts, section?.title) ??
      findConceptForLabel(summary.concepts, section?.subtopics?.[0]) ??
      summary.concepts[index] ??
      null;

    const answerParts = [
      section?.summary,
      section?.key_points?.[0],
      section?.key_points?.[1],
    ].filter(Boolean);

    return {
      id: `quiz-${index + 1}-${concept?.concept_key ?? section?.title ?? "general"}`,
      question,
      concept_key: concept?.concept_key ?? null,
      concept_name: concept?.name ?? section?.title ?? "Lesson concept",
      reference_answer: answerParts.join(" ") || "Review the connected section summary and key points.",
    };
  });
}

function resolveQuizConcept(summary, quizItem) {
  if (!summary || !quizItem) {
    return null;
  }

  if (quizItem.concept_key) {
    const directMatch = summary.concepts.find(
      (concept) => concept.concept_key === quizItem.concept_key,
    );
    if (directMatch) {
      return directMatch;
    }
  }

  return (
    findConceptForLabel(summary.concepts, quizItem.concept_name) ??
    summary.concepts.find((concept) =>
      concept.summary?.trim().toLowerCase() === quizItem.reference_answer?.trim().toLowerCase(),
    ) ??
    null
  );
}

function mergeConceptSnapshot(summary, nextConcept) {
  if (!summary || !nextConcept?.concept_key) {
    return summary;
  }

  return {
    ...summary,
    concepts: summary.concepts.map((concept) =>
      concept.concept_key === nextConcept.concept_key ? normalizeConcept(nextConcept) : concept,
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
    next.total_study_minutes = Number(concept.total_study_minutes ?? 0) + Number(updates.studyMinutes);
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
    next.insight = `${concept.name} has a logged study block now, so its retention signal has been strengthened locally.`;
    next.last_reviewed_at = new Date().toISOString();
  }

  if (updates.quizScore != null) {
    const previousAttemptCount = Number(concept.quiz_attempt_count ?? 0);
    const previousAverage = Number(concept.average_quiz_score ?? 0);
    const nextAttemptCount = previousAttemptCount + 1;
    const nextAverage =
      (previousAverage * previousAttemptCount + Number(updates.quizScore)) / Math.max(1, nextAttemptCount);
    next.quiz_attempt_count = nextAttemptCount;
    next.average_quiz_score = Number(nextAverage.toFixed(1));
    next.best_quiz_score = Math.max(Number(concept.best_quiz_score ?? 0), Number(updates.quizScore));
    next.study_status =
      Number(updates.quizScore) >= 80
        ? "studied"
        : Number(updates.quizScore) >= 45
          ? "in_progress"
          : concept.study_status ?? "not_started";
    next.status =
      Number(updates.quizScore) >= 80 ? "strong" : Number(updates.quizScore) >= 45 ? "watch" : "at_risk";
    next.mastery_score = clamp(Number(concept.mastery_score ?? 0.3) + Number(updates.quizScore) / 400, 0.05, 0.98);
    next.retention_score = clamp(Number(updates.quizScore) / 100, 0.02, 0.99);
    next.forgetting_risk = clamp((Number(concept.importance ?? 0.5) * (1 - next.retention_score)), 0.01, 0.99);
    next.evidence_count = Number(concept.evidence_count ?? 0) + 1;
    next.insight =
      Number(updates.quizScore) >= 80
        ? `${concept.name} scored strongly in the quick quiz, so it is no longer a weak concept.`
        : `${concept.name} needs another pass because the latest quiz result was below full confidence.`;
    next.last_reviewed_at = new Date().toISOString();
  }

  return normalizeConcept(next);
}

function StudyToolsPage() {
  const storedStudio = useMemo(() => readStoredLessonStudio(), []);
  const { isAuthenticated } = useAuth();
  const {
    activeWeeklyPlanId,
    addStudySession,
    addTaskToWeeklyPlan,
    createWeeklyPlan,
    refreshConceptRetention,
    setActiveWeeklyPlan,
    weeklyPlans,
  } = useStudy();
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState(storedStudio.result);
  const [statusMessage, setStatusMessage] = useState(storedStudio.statusMessage);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingConceptKey, setIsSavingConceptKey] = useState("");
  const [isScoringQuizId, setIsScoringQuizId] = useState("");
  const [openFlashcardIndexes, setOpenFlashcardIndexes] = useState([]);
  const [quizResponses, setQuizResponses] = useState(storedStudio.quizResponses);

  const topThreeSections = useMemo(
    () => (result?.revise_first?.length ? result.revise_first.slice(0, 3) : []),
    [result],
  );
  const interactiveQuiz = useMemo(() => buildInteractiveQuiz(result), [result]);
  const weakLessonConcepts = useMemo(() => {
    if (!result?.concepts?.length) {
      return [];
    }

    return [...result.concepts]
      .sort((left, right) => {
        const leftPriority =
          (left.average_quiz_score != null ? 100 - left.average_quiz_score : 0) +
          (left.forgetting_risk ?? 0) * 100;
        const rightPriority =
          (right.average_quiz_score != null ? 100 - right.average_quiz_score : 0) +
          (right.forgetting_risk ?? 0) * 100;
        return rightPriority - leftPriority;
      })
      .slice(0, 4);
  }, [result]);

  useEffect(() => {
    localStorage.setItem(
      LESSON_STUDIO_STORAGE_KEY,
      JSON.stringify({
        result,
        statusMessage,
        quizResponses,
      }),
    );
  }, [quizResponses, result, statusMessage]);

  async function copyOutline(summary) {
    const content = [
      summary.title,
      "",
      "Overview",
      summary.overview,
      "",
      `Estimated revision time: ${summary.estimated_revision_time}`,
      "",
      "Revise First",
      ...summary.revise_first.map(
        (section, index) =>
          `${index + 1}. ${section.title} (${formatImportance(section.importance)}, ${section.difficulty})`,
      ),
      "",
      "Sections",
      ...summary.sections.flatMap((section) => [
        `${section.title}`,
        section.subtopics.length ? `Subtopics: ${section.subtopics.join(", ")}` : "",
        `${section.summary}`,
        section.focus_terms.length ? `Focus terms: ${section.focus_terms.join(", ")}` : "",
        ...section.key_points.map((point) => `- ${point}`),
        "",
      ]),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(content);
      setStatusMessage("Lesson guide copied to clipboard.");
      setError("");
    } catch {
      setError("StudyGenie could not copy the lesson guide.");
    }
  }

  async function handleGenerateSummary() {
    if (!selectedFile) {
      setError("Choose a .pptx deck first so StudyGenie can summarize it.");
      return;
    }

    setError("");
    setStatusMessage("");
    setIsGenerating(true);
    setOpenFlashcardIndexes([]);
    setQuizResponses({});

    try {
      const response = await summarizePresentationLesson(selectedFile);
      const summary = normalizeLessonSummary(response.data);
      setResult(summary);
      if (response.data?.saved_lesson_id) {
        setStatusMessage(
          `Processed ${response.data?.slide_count ?? 0} slide(s) from ${selectedFile.name} and saved the lesson to your adaptive concept graph.`,
        );
      } else if (isAuthenticated) {
        setStatusMessage(
          `Processed ${response.data?.slide_count ?? 0} slide(s) from ${selectedFile.name}, but the lesson was not saved to your adaptive concept graph.`,
        );
      } else {
        setStatusMessage(
          `Processed ${response.data?.slide_count ?? 0} slide(s) from ${selectedFile.name}. Sign in to save this lesson to the dashboard's adaptive concept graph.`,
        );
      }
      if (response.data?.saved_lesson_id) {
        refreshConceptRetention();
      }
    } catch (requestError) {
      setError(describeApiError(requestError, "StudyGenie could not summarize that PowerPoint deck."));
      setResult(null);
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleFlashcard(index) {
    setOpenFlashcardIndexes((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  }

  function getOrCreatePlanForLesson() {
    const activePlan =
      weeklyPlans.find((plan) => plan.id === activeWeeklyPlanId) ??
      getPlanForDate(weeklyPlans) ??
      weeklyPlans[0] ??
      null;

    if (activePlan) {
      return activePlan;
    }

    const createdPlan = createWeeklyPlan({
      title: "Lesson Studio plan",
      weekStart: getWeekStart(),
    });
    setActiveWeeklyPlan(createdPlan.id);
    return createdPlan;
  }

  async function handleAddConceptToPlanner(item) {
    const topic =
      typeof item?.name === "string" && item.name.trim()
        ? item.name.trim()
        : typeof item?.title === "string" && item.title.trim()
          ? item.title.trim()
          : "";

    if (!topic) {
      setError("StudyGenie could not determine which revision topic to add.");
      return;
    }

    const plan = getOrCreatePlanForLesson();
    const lessonNote = result?.title ? `From Lesson Studio: ${result.title}` : "From Lesson Studio";
    const alreadyPlanned = (plan.tasks ?? []).some(
      (task) =>
        !task.completed &&
        task.topic === topic &&
        task.day === getLocalPlannerDay() &&
        (task.notes ?? "") === lessonNote,
    );

    if (alreadyPlanned) {
      setStatusMessage(`${topic} is already queued in today's weekly planner.`);
      setError("");
      return;
    }

    addTaskToWeeklyPlan(plan.id, {
      topic,
      day: getLocalPlannerDay(),
      duration_minutes: 45,
      priority: "high",
      notes: lessonNote,
    });
    setStatusMessage(`${topic} was added to your weekly planner.`);
    setError("");
  }

  async function handleLogConceptStudy(concept, minutes = 25, markComplete = true) {
    if (!result) {
      return;
    }

    setIsSavingConceptKey(concept.concept_key);
    setError("");

    try {
      if (isAuthenticated && result.saved_lesson_id) {
        const response = await logLessonConceptStudy({
          lesson_graph_id: result.saved_lesson_id,
          concept_key: concept.concept_key,
          minutes,
          mark_complete: markComplete,
        });
        setResult((current) => mergeConceptSnapshot(current, response.data));
        refreshConceptRetention();
      } else {
        await addStudySession({
          topic: concept.name,
          time_spent: minutes,
          date: getLocalDateString(),
        });
        setResult((current) =>
          mergeConceptSnapshot(current, buildLocalConceptSnapshot(concept, { markComplete, studyMinutes: minutes })),
        );
      }

      setStatusMessage(`${concept.name} was logged as a ${minutes}-minute study block.`);
    } catch (requestError) {
      setError(describeApiError(requestError, "StudyGenie could not save that concept study log."));
    } finally {
      setIsSavingConceptKey("");
    }
  }

  async function handleQuizScore(quizItem, responseLabel, score) {
    if (!result) {
      return;
    }

    setIsScoringQuizId(quizItem.id);
    setError("");

    try {
      let nextConceptSnapshot = null;
      const currentConcept = resolveQuizConcept(result, quizItem);

      if (isAuthenticated && result.saved_lesson_id && currentConcept?.concept_key) {
        const response = await createLessonQuizAttempt({
          lesson_graph_id: result.saved_lesson_id,
          concept_key: currentConcept.concept_key,
          question: quizItem.question,
          score,
          response_label: responseLabel,
        });
        nextConceptSnapshot = response.data;
        setResult((current) => mergeConceptSnapshot(current, nextConceptSnapshot));
        refreshConceptRetention();
      } else if (currentConcept) {
        nextConceptSnapshot = buildLocalConceptSnapshot(currentConcept, { quizScore: score });
        setResult((current) => mergeConceptSnapshot(current, nextConceptSnapshot));
      }

      setQuizResponses((current) => ({
        ...current,
        [quizItem.id]: {
          score,
          responseLabel,
          answeredAt: new Date().toISOString(),
          conceptKey: currentConcept?.concept_key ?? quizItem.concept_key ?? null,
        },
      }));
      setStatusMessage(
        currentConcept
          ? `Quiz result recorded for ${quizItem.concept_name}.`
          : `Quiz response saved for ${quizItem.concept_name}. Regenerate this lesson guide to fully link the prompt to a concept.`,
      );
    } catch (requestError) {
      setError(describeApiError(requestError, "StudyGenie could not record that quiz result."));
    } finally {
      setIsScoringQuizId("");
    }
  }

  return (
    <section className="studio-page">
      <div className="page-heading">
        <p className="eyebrow">Lesson Studio</p>
        <h2>Upload a PowerPoint lesson and turn it into a persistent, trackable revision guide.</h2>
      </div>

      <div className="studio-grid">
        <Card
          subtitle="StudyGenie reads a .pptx deck, groups related slides into topics, and keeps the generated guide available even after you leave this page."
          title="1. Upload lesson deck"
        >
          <div className="input-form">
            <label className="field">
              <span className="field-label">PowerPoint file</span>
              <input
                accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                className="field-input file-input"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  setStatusMessage(file ? `Selected ${file.name}` : statusMessage);
                  setError("");
                }}
              />
              <span className="field-helper">
                Use a `.pptx` file. The current generated lesson stays saved locally so it does not disappear on navigation.
              </span>
            </label>

            <div className="recommendation-actions">
              <Button loading={isGenerating} onClick={handleGenerateSummary}>
                {isGenerating ? "Building study guide" : "Generate smart lesson guide"}
              </Button>
              <Badge tone={result ? "success" : "default"}>{result ? "Ready" : "Waiting"}</Badge>
            </div>

            {statusMessage ? <p className="success-message">{statusMessage}</p> : null}
            {error ? <p className="error-message">{error}</p> : null}
          </div>
        </Card>

        <Card
          subtitle="See the lesson title, estimated revision time, and the highest-priority topics first."
          title="2. Review plan"
        >
          {result ? (
            <div className="study-output-stack">
              <section className="recommendation-section">
                <p className="section-label">Lesson title</p>
                <p className="recommendation-text">{result.title}</p>
              </section>

              <div className="planner-metric-grid lesson-review-grid">
                <div className="planner-metric">
                  <span className="section-label">Slides used</span>
                  <strong>{result.slide_count}</strong>
                </div>
                <div className="planner-metric">
                  <span className="section-label">Extracted text</span>
                  <strong>{result.source_text_length}</strong>
                </div>
                <div className="planner-metric">
                  <span className="section-label">Revision time</span>
                  <strong>{result.estimated_revision_time}</strong>
                </div>
                <div className="planner-metric">
                  <span className="section-label">Topics found</span>
                  <strong>{result.sections.length}</strong>
                </div>
                <div className="planner-metric planner-metric-wide">
                  <span className="section-label">Persistence</span>
                  <strong>{result.saved_lesson_id ? "Saved to account" : "Saved in this browser"}</strong>
                </div>
              </div>

              <Button onClick={() => copyOutline(result)} size="sm" variant="ghost">
                Copy study guide
              </Button>
              <p className="field-helper">
                {result.saved_lesson_id
                  ? "This lesson is saved to your account, so it can feed the dashboard's adaptive concept graph."
                  : "This lesson is only stored in this browser right now. Sign in before generating to sync it to the dashboard graph."}
              </p>
            </div>
          ) : (
            <EmptyState
              title="No lesson guide yet"
              message="Upload a .pptx lesson deck and StudyGenie will build a structured revision guide here."
            />
          )}
        </Card>
      </div>

      {result ? (
        <div className="result-stack">
          <Card title="Lesson overview" subtitle="A compressed explanation of what the lesson is mainly about.">
            <p className="recommendation-text">{result.overview}</p>
          </Card>

          <div className="studio-grid">
            <Card
              title="Revise first"
              subtitle="Start with the most repeated and central topics, then log study or add them into your weekly planner."
            >
              {topThreeSections.length > 0 ? (
                <div className="study-list">
                  {topThreeSections.map((section, index) => {
                    const concept = findConceptForLabel(result.concepts, section.title);
                    return (
                      <article className="study-list-item study-priority-item" key={`revise-${section.title}`}>
                        <div className="study-priority-topline">
                          <span className="study-priority-rank">{String(index + 1).padStart(2, "0")}</span>
                          <div className="study-priority-copy">
                            <strong>{section.title}</strong>
                            <p className="field-helper">{formatSlideRange(section.slide_numbers)}</p>
                          </div>
                          <div className="study-chip-row">
                            <Badge tone={getImportanceTone(section.importance)}>
                              {formatImportance(section.importance)} importance
                            </Badge>
                            <Badge tone={getDifficultyTone(section.difficulty)}>
                              {section.difficulty}
                            </Badge>
                            {concept?.study_status ? (
                              <Badge tone={getStudyStatusTone(concept.study_status)}>
                                {concept.study_status.replace("_", " ")}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <p className="recommendation-text">{section.summary}</p>

                        <div className="importance-meter">
                          <div className="importance-meter-header">
                            <span className="section-label">{getImportanceLabel(section.importance)}</span>
                            <strong>{formatImportance(section.importance)}</strong>
                          </div>
                          <div className="progress-track">
                            <span style={{ width: `${Math.round(section.importance * 100)}%` }} />
                          </div>
                        </div>

                        <div className="recommendation-actions">
                          <Button
                            disabled={!concept}
                            loading={isSavingConceptKey === concept?.concept_key}
                            onClick={() => concept && handleLogConceptStudy(concept, 25, true)}
                            size="sm"
                          >
                            Log 25 min study
                          </Button>
                          <Button
                            onClick={() => handleAddConceptToPlanner(concept ?? section)}
                            size="sm"
                            variant="ghost"
                          >
                            Add to planner
                          </Button>
                        </div>

                        {section.subtopics.length > 0 ? (
                          <div className="study-detail-stack">
                            <span className="section-label">Subtopics</span>
                            <div className="pill-row">
                              {section.subtopics.map((subtopic) => (
                                <span className="topic-pill topic-pill-soft" key={`${section.title}-${subtopic}`}>
                                  {subtopic}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No priority topics yet"
                  message="Generate a lesson guide to rank the strongest revision topics."
                />
              )}
            </Card>

            <Card title="Weak concepts from this lesson" subtitle="Quiz scores and retention risk bring the weakest concepts to the top here.">
              {weakLessonConcepts.length > 0 ? (
                <div className="study-list">
                  {weakLessonConcepts.map((concept) => (
                    <article className="study-list-item concept-card" key={`weak-${concept.concept_key}`}>
                      <div className="study-list-row">
                        <div className="concept-card-copy">
                          <strong>{concept.name}</strong>
                          <p className="field-helper">{concept.parent_name || concept.kind}</p>
                        </div>
                        <Badge tone={getConceptStatusTone(concept.status)}>{concept.status ?? "watch"}</Badge>
                      </div>

                      <div className="study-chip-row">
                        <span className="topic-pill topic-pill-soft">
                          Quiz {concept.average_quiz_score != null ? `${Math.round(concept.average_quiz_score)}%` : "--"}
                        </span>
                        <span className="topic-pill topic-pill-soft">
                          Risk {formatPercent(concept.forgetting_risk)}
                        </span>
                      </div>

                      <p className="field-helper">{concept.insight || "This concept needs more reinforcement."}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No weak concepts yet"
                  message="Once you study and score quiz prompts, Lesson Studio will rank the weaker concepts here."
                />
              )}
            </Card>
          </div>

          <div className="studio-grid">
            <Card
              title="Adaptive concept retention graph"
              subtitle="Each concept can now be studied directly, added to the planner, and tracked with an explicit study status."
            >
              {result.concepts.length > 0 ? (
                <div className="study-list">
                  {result.concepts.map((concept) => (
                    <article className="study-list-item concept-card" key={concept.concept_key}>
                      <div className="study-list-row">
                        <div className="concept-card-copy">
                          <strong>{concept.name}</strong>
                          <p className="field-helper">
                            {concept.parent_name ? `${concept.parent_name} -> ` : ""}
                            {concept.kind}
                          </p>
                        </div>
                        <div className="study-chip-row">
                          <Badge tone={getDifficultyTone(concept.difficulty)}>{concept.difficulty}</Badge>
                          <Badge tone={getStudyStatusTone(concept.study_status)}>
                            {concept.study_status.replace("_", " ")}
                          </Badge>
                          {concept.status ? (
                            <Badge tone={getConceptStatusTone(concept.status)}>{concept.status}</Badge>
                          ) : null}
                        </div>
                      </div>

                      <p className="field-helper">{concept.summary}</p>

                      <div className="study-chip-row">
                        <span className="topic-pill topic-pill-soft">
                          Importance {formatPercent(concept.importance)}
                        </span>
                        <span className="topic-pill topic-pill-soft">
                          Retention {formatPercent(concept.retention_score)}
                        </span>
                        <span className="topic-pill topic-pill-soft">
                          Studied {concept.study_count} time(s)
                        </span>
                        <span className="topic-pill topic-pill-soft">
                          Quiz {concept.average_quiz_score != null ? `${Math.round(concept.average_quiz_score)}%` : "--"}
                        </span>
                      </div>

                      <div className="recommendation-actions">
                        <Button
                          loading={isSavingConceptKey === concept.concept_key}
                          onClick={() => handleLogConceptStudy(concept, 25, true)}
                          size="sm"
                        >
                          Log 25 min study
                        </Button>
                        <Button
                          loading={isSavingConceptKey === concept.concept_key}
                          onClick={() => handleLogConceptStudy(concept, 15, false)}
                          size="sm"
                          variant="secondary"
                        >
                          Mark in progress
                        </Button>
                        <Button onClick={() => handleAddConceptToPlanner(concept)} size="sm" variant="ghost">
                          Add to planner
                        </Button>
                      </div>

                      {concept.related_concepts.length > 0 ? (
                        <div className="study-detail-stack">
                          <span className="section-label">Connected to</span>
                          <div className="pill-row">
                            {concept.related_concepts.map((item) => (
                              <span className="topic-pill topic-pill-soft" key={`${concept.concept_key}-${item}`}>
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {concept.insight ? <p className="field-helper">{concept.insight}</p> : null}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No concept graph yet"
                  message="Generate a lesson guide first and StudyGenie will surface its concept nodes here."
                />
              )}
            </Card>

            <Card
              title="Concept links"
              subtitle="These edges show how the lesson moves from major sections into subtopics and supporting ideas."
            >
              {result.concept_edges.length > 0 ? (
                <div className="study-list">
                  {result.concept_edges.map((edge, index) => (
                    <article className="study-list-item concept-edge-item" key={`${edge.source_concept_key}-${edge.target_concept_key}-${index}`}>
                      <div className="study-list-row">
                        <strong>
                          {edge.source_name} {"->"} {edge.target_name}
                        </strong>
                        <Badge tone="default">{edge.relation_type}</Badge>
                      </div>
                      <div className="importance-meter">
                        <div className="importance-meter-header">
                          <span className="section-label">Connection weight</span>
                          <strong>{formatPercent(edge.weight)}</strong>
                        </div>
                        <div className="progress-track">
                          <span style={{ width: `${Math.round(edge.weight * 100)}%` }} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No concept links yet"
                  message="Once the lesson is processed, its section-to-subtopic links will appear here."
                />
              )}
            </Card>
          </div>

          <Card
            title="Structured lesson sections"
            subtitle="Each topic groups related slides, highlights subtopics, and compresses the central ideas into revision-ready cards."
          >
            <div className="study-list section-card-list">
              {result.sections.map((section, index) => (
                <details className="study-list-item lesson-section-card" key={`${section.title}-${index}`} open={index === 0}>
                  <summary className="lesson-section-summary">
                    <div className="lesson-section-summary-main">
                      <strong>{section.title}</strong>
                      <p className="field-helper">{formatSlideRange(section.slide_numbers)}</p>
                      {section.subtopics.length > 0 ? (
                        <div className="lesson-section-subtopics">
                          {section.subtopics.slice(0, 3).map((subtopic) => (
                            <span className="topic-pill topic-pill-soft" key={`${section.title}-summary-${subtopic}`}>
                              {subtopic}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="study-chip-row">
                      <Badge tone={getDifficultyTone(section.difficulty)}>{section.difficulty}</Badge>
                      <Badge tone={getImportanceTone(section.importance)}>
                        {formatImportance(section.importance)} {getImportanceLabel(section.importance)}
                      </Badge>
                    </div>
                  </summary>

                  <div className="lesson-section-body">
                    <p className="recommendation-text">{section.summary}</p>

                    {section.subtopics.length > 0 ? (
                      <div className="study-detail-stack">
                        <span className="section-label">Topic flow</span>
                        <p className="field-helper">
                          {section.title}
                          {" -> "}
                          {section.subtopics.join(" -> ")}
                        </p>
                      </div>
                    ) : null}

                    <div className="importance-meter">
                      <div className="importance-meter-header">
                        <span className="section-label">Importance</span>
                        <strong>
                          {formatImportance(section.importance)} - {getImportanceLabel(section.importance)}
                        </strong>
                      </div>
                      <div className="progress-track">
                        <span style={{ width: `${Math.round(section.importance * 100)}%` }} />
                      </div>
                    </div>

                    {section.focus_terms.length > 0 ? (
                      <div className="study-detail-stack">
                        <span className="section-label">Focus terms</span>
                        <div className="pill-row">
                          {section.focus_terms.map((term) => (
                            <span className="topic-pill topic-pill-soft" key={`${section.title}-term-${term}`}>
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {section.key_points.length > 0 ? (
                      <div className="study-detail-stack">
                        <span className="section-label">Key points</span>
                        <div className="study-points-list">
                          {section.key_points.map((point) => (
                            <p className="field-helper study-bullet" key={`${section.title}-${point}`}>
                              {point}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          </Card>

          <div className="studio-grid">
            <Card title="Interactive quiz" subtitle="Score each prompt after you answer it. The result is recorded and weak concepts move up automatically.">
              {interactiveQuiz.length > 0 ? (
                <div className="study-list">
                  {interactiveQuiz.map((item) => {
                    const response = quizResponses[item.id];
                    return (
                      <article className="study-list-item concept-card" key={item.id}>
                        <div className="study-list-row">
                          <div className="concept-card-copy">
                            <strong>{item.concept_name}</strong>
                            <p className="field-helper">{item.question}</p>
                          </div>
                          {response ? (
                            <Badge tone={response.score >= 80 ? "success" : response.score >= 45 ? "warning" : "danger"}>
                              {response.score}%
                            </Badge>
                          ) : (
                            <Badge tone="default">Not scored</Badge>
                          )}
                        </div>

                        <div className="recommendation-actions">
                          <Button
                            loading={isScoringQuizId === item.id}
                            onClick={() => handleQuizScore(item, "not_yet", 0)}
                            size="sm"
                            variant="ghost"
                          >
                            Not yet
                          </Button>
                          <Button
                            loading={isScoringQuizId === item.id}
                            onClick={() => handleQuizScore(item, "partial", 50)}
                            size="sm"
                            variant="secondary"
                          >
                            Partly
                          </Button>
                          <Button
                            loading={isScoringQuizId === item.id}
                            onClick={() => handleQuizScore(item, "strong", 100)}
                            size="sm"
                          >
                            I knew it
                          </Button>
                        </div>

                        {response ? (
                          <div className="study-detail-stack">
                            <span className="section-label">Reference answer</span>
                            <p className="field-helper">{item.reference_answer}</p>
                          </div>
                        ) : (
                          <p className="field-helper">
                            Answer it first in your own words, then score yourself to record whether this concept is weak or strong.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No quiz yet"
                  message="Generate a lesson guide to build trackable quiz prompts."
                />
              )}
            </Card>

            <Card title="Flashcards" subtitle="Tap each card to reveal a compact answer for quick revision rounds.">
              {result.flashcards.length > 0 ? (
                <div className="flashcard-grid">
                  {result.flashcards.map((card, index) => {
                    const isOpen = openFlashcardIndexes.includes(index);
                    return (
                      <button
                        className={`flashcard-item flashcard-toggle${isOpen ? " is-open" : ""}`}
                        key={`${card.front}-${index}`}
                        onClick={() => toggleFlashcard(index)}
                        type="button"
                      >
                        <span className="section-label">{isOpen ? "Answer" : "Prompt"}</span>
                        <p className="flashcard-front">{isOpen ? card.back : card.front}</p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No flashcards yet"
                  message="Generate a lesson guide to create fast revision cards."
                />
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default StudyToolsPage;
