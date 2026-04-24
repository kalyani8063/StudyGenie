import { useMemo, useState } from "react";

import { summarizePresentationLesson } from "../api/client.js";
import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";

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

function normalizeLessonSummary(data) {
  return {
    title: typeof data?.title === "string" ? data.title : "Lesson summary",
    overview: typeof data?.overview === "string" ? data.overview : "",
    keywords: Array.isArray(data?.keywords) ? data.keywords.filter(Boolean) : [],
    sections: Array.isArray(data?.sections)
      ? data.sections.map((section, index) => normalizeSection(section, index))
      : [],
    revise_first: Array.isArray(data?.revise_first)
      ? data.revise_first.map((section, index) => normalizeSection(section, index))
      : [],
    quiz_questions: Array.isArray(data?.quiz_questions)
      ? data.quiz_questions.filter(Boolean)
      : [],
    flashcards: Array.isArray(data?.flashcards)
      ? data.flashcards
          .filter((item) => item?.front && item?.back)
          .map((item) => ({ front: item.front, back: item.back }))
      : [],
    estimated_revision_time:
      typeof data?.estimated_revision_time === "string" ? data.estimated_revision_time : "--",
    slide_count: Number(data?.slide_count ?? 0),
    source_text_length: Number(data?.source_text_length ?? 0),
  };
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

function formatImportance(importance) {
  return `${Math.round(importance * 100)}%`;
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

function StudyToolsPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [openFlashcardIndexes, setOpenFlashcardIndexes] = useState([]);

  const topThreeSections = useMemo(
    () => (result?.revise_first?.length ? result.revise_first.slice(0, 3) : []),
    [result],
  );

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

    try {
      const response = await summarizePresentationLesson(selectedFile);
      setResult(normalizeLessonSummary(response.data));
      setStatusMessage(
        `Processed ${response.data?.slide_count ?? 0} slide(s) from ${selectedFile.name}.`,
      );
    } catch (requestError) {
      setError(describeApiError(requestError, "StudyGenie could not summarize that PowerPoint deck."));
      setResult(null);
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleFlashcard(index) {
    setOpenFlashcardIndexes((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index],
    );
  }

  return (
    <section className="studio-page">
      <div className="page-heading">
        <p className="eyebrow">Lesson Studio</p>
        <h2>Upload a PowerPoint lesson and turn it into a revision guide with structure.</h2>
      </div>

      <div className="studio-grid">
        <Card
          subtitle="StudyGenie reads a .pptx deck, groups related slides into topics, and turns them into revision-ready sections."
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
                  setResult(null);
                  setStatusMessage(file ? `Selected ${file.name}` : "");
                  setError("");
                }}
              />
              <span className="field-helper">
                Use a `.pptx` file. The output focuses on revision flow, not raw slide-by-slide dumping.
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
                  <span className="section-label">Revise first</span>
                  <strong>{topThreeSections[0]?.title ?? "--"}</strong>
                </div>
              </div>

              <Button onClick={() => copyOutline(result)} size="sm" variant="ghost">
                Copy study guide
              </Button>
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
              subtitle="Start with the most repeated and central topics before the lighter sections."
            >
              {topThreeSections.length > 0 ? (
                <div className="study-list">
                  {topThreeSections.map((section, index) => (
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

                      {section.focus_terms.length > 0 ? (
                        <div className="study-detail-stack">
                          <span className="section-label">Focus terms</span>
                          <div className="pill-row">
                            {section.focus_terms.map((term) => (
                              <span className="topic-pill topic-pill-soft" key={`${section.title}-${term}`}>
                                {term}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No priority topics yet"
                  message="Generate a lesson guide to rank the strongest revision topics."
                />
              )}
            </Card>

            <Card title="Keywords" subtitle="Useful terms that appear repeatedly across the lesson.">
              <div className="pill-row">
                {result.keywords.map((keyword) => (
                  <span className="topic-pill" key={keyword}>
                    {keyword}
                  </span>
                ))}
              </div>
            </Card>
          </div>

          <Card
            title="Structured lesson sections"
            subtitle="Each topic groups related slides, highlights subtopics, and compresses the central ideas into revision-ready cards."
          >
            <div className="study-list section-card-list">
              {result.sections.map((section, index) => (
                <details
                  className="study-list-item lesson-section-card"
                  key={`${section.title}-${index}`}
                  open={index === 0}
                >
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
            <Card title="Quiz questions" subtitle="Use these to test whether you can explain the lesson in your own words.">
              {result.quiz_questions.length > 0 ? (
                <div className="study-list">
                  {result.quiz_questions.map((question) => (
                    <article className="study-list-item" key={question}>
                      <p>{question}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No questions yet"
                  message="Generate a lesson guide to build quick self-test prompts."
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
