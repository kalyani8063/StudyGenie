import { Link } from "react-router-dom";

import Card from "../components/Card.jsx";
import ConceptRetentionPanel from "../components/ConceptRetentionPanel.jsx";
import EmptyState from "../components/EmptyState.jsx";
import RecommendationCard from "../components/RecommendationCard.jsx";
import TodayPlannedTasksCard from "../components/TodayPlannedTasksCard.jsx";
import WeeklyStudyBarChart from "../components/charts/WeeklyStudyBarChart.jsx";
import Badge from "../components/ui/Badge.jsx";
import {
  formatWeekLabel,
  generateWeeklyRecommendation,
  getPlanForDate,
  getWeeklyPlanStats,
} from "../lib/weeklyPlanner.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useStudy } from "../state/StudyContext.jsx";

function getStreak(sessions) {
  const dates = new Set(sessions.map((session) => session.date));
  let streak = 0;
  const cursor = new Date();

  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function DashboardPage() {
  const { user } = useAuth();
  const {
    activeWeeklyPlanId,
    conceptRetention,
    conceptRetentionMeta,
    currentRecommendation,
    recommendationMeta,
    studySessions,
    weeklyPlans,
  } = useStudy();
  const activePlan =
    weeklyPlans.find((plan) => plan.id === activeWeeklyPlanId) ??
    getPlanForDate(weeklyPlans) ??
    weeklyPlans[0] ??
    null;
  const totalStudyTime = studySessions.reduce(
    (total, session) => total + Number(session.time_spent),
    0,
  );
  const streak = getStreak(studySessions);
  const stats = getWeeklyPlanStats(activePlan, studySessions);
  const recommendation = generateWeeklyRecommendation(activePlan, studySessions);

  return (
    <section className="dashboard-page">
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">StudyGenie overview</p>
          <h2>
            Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}. Your
            study flow is live now.
          </h2>
          <p className="muted-copy">
            Build a week, log real sessions, and let the dashboard update your totals,
            progress, and recommendation as you go.
          </p>
          <div className="cta-row">
            <Link className="landing-primary-link" to="/recommendation">
              Open weekly planner
            </Link>
            <Link className="secondary-link" to="/tracker">
              Log session
            </Link>
          </div>
        </div>
        <div className="dashboard-hero-panel">
          {currentRecommendation ? (
            <>
              <p className="section-label">Next study move</p>
              <h3>{currentRecommendation.result.level}</h3>
              <p>{currentRecommendation.result.recommendation}</p>
            </>
          ) : (
            <>
              <p className="section-label">Next study move</p>
              <h3>Start your first session</h3>
              <p>Once you log study time, the dashboard will surface a live recommendation here.</p>
            </>
          )}
        </div>
      </div>

      <div className="dashboard-summary-grid">
        <article className="summary-card">
          <span className="section-label">Total study time</span>
          <strong>{totalStudyTime} min</strong>
          <p>{studySessions.length} session(s) logged</p>
        </article>
        <article className="summary-card">
          <span className="section-label">Active week</span>
          <strong>{activePlan ? formatWeekLabel(activePlan.weekStart) : "--"}</strong>
          <p>{activePlan ? activePlan.title : "Create your first weekly plan"}</p>
        </article>
        <article className="summary-card">
          <span className="section-label">Weekly progress</span>
          <div className="summary-badge-row">
            <Badge tone={recommendation.tone}>{stats.completionRate}% complete</Badge>
          </div>
          <p>{activePlan ? `${stats.remainingCount} task(s) still open` : "No weekly plan yet"}</p>
        </article>
        <article className="summary-card">
          <span className="section-label">Study streak</span>
          <strong>{streak} day{streak === 1 ? "" : "s"}</strong>
          <p>Daily momentum based on logged sessions</p>
        </article>
      </div>

      <div className="dashboard-grid">
        <Card subtitle="Last 7 days" title="Weekly study time">
          {studySessions.length > 0 ? (
            <WeeklyStudyBarChart sessions={studySessions} />
          ) : (
            <EmptyState
              title="No chart data yet"
              message="Start your first study session to see the weekly graph fill in."
            />
          )}
        </Card>

        <RecommendationCard
          entry={currentRecommendation}
          isLoading={recommendationMeta.isLoading}
          title="Live study recommendation"
        />
      </div>

      <div className="dashboard-grid">
        <TodayPlannedTasksCard
          emptyMessage="No exact-date task from your weekly planner lands on today yet."
          excludeLessonStudioTasks
          navigateToTracker
          subtitle="Launch today's scheduled task directly into the study tracker timer. Lesson Studio revision blocks now live in the tracker flow instead of this dashboard list."
          title="Today's exact-date tasks"
        />

        <Card subtitle="Keep momentum visible" title="Quick actions">
          <div className="next-action-card">
            <p>
              {studySessions.length > 0
                ? recommendation.recommendation
                : "Start your first study session to turn on live dashboard insights."}
            </p>
            <div className="cta-row">
              <Link className="landing-primary-link" to="/recommendation">
                Open weekly planner
              </Link>
              <Link className="secondary-link" to="/guide">
                Open weekly progress
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <ConceptRetentionPanel
        conceptRetention={conceptRetention}
        error={conceptRetentionMeta.error}
        isLoading={conceptRetentionMeta.isLoading}
        subtitle="Upload lessons in Lesson Studio, then watch concept-level forgetting risk update from your real study behavior."
        title="Adaptive concept retention graph"
      />
      {recommendationMeta.error ? <p className="error-message">{recommendationMeta.error}</p> : null}
    </section>
  );
}

export default DashboardPage;
