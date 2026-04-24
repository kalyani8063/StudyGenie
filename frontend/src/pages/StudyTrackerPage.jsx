import { useEffect, useState } from "react";

import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import SessionTimerCard from "../components/SessionTimerCard.jsx";
import StatCard from "../components/StatCard.jsx";
import TodayPlannedTasksCard from "../components/TodayPlannedTasksCard.jsx";
import StudyTimeCharts from "../components/charts/StudyTimeCharts.jsx";
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

function readStoredValue(storageKey, fallbackValue) {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? { ...fallbackValue, ...JSON.parse(stored) } : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function StudyTrackerPage() {
  const { addStudySession, breakLogs, studySessions } = useStudy();
  const [session, setSession] = useState(() => readStoredValue(TRACKER_FORM_KEY, initialSession));
  const [filters, setFilters] = useState(() =>
    readStoredValue(TRACKER_FILTERS_KEY, { topic: "", date: "" }),
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
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

  useEffect(() => {
    localStorage.setItem(TRACKER_FORM_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    localStorage.setItem(TRACKER_FILTERS_KEY, JSON.stringify(filters));
  }, [filters]);

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

  return (
    <section className="tracker-page">
      <div className="page-heading">
        <p className="eyebrow">Study Tracker</p>
        <h2>Track study sessions with filters, summaries, and topic-level insight.</h2>
      </div>

      <SessionTimerCard
        subtitle="Use the large timer here to track each study block, then log the break between sessions for better weekly planning."
        title="Study session timer"
      />

      <TodayPlannedTasksCard
        emptyMessage="Create a weekly plan for this week and assign tasks to today if you want them to show up here."
        title="Today's planner tasks"
      />

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
