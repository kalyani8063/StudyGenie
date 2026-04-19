import { Link } from "react-router-dom";

import Card from "../components/Card.jsx";
import TodayPlannedTasksCard from "../components/TodayPlannedTasksCard.jsx";
import WeeklyStudyBarChart from "../components/charts/WeeklyStudyBarChart.jsx";
import Badge from "../components/ui/Badge.jsx";
import {
  formatWeekLabel,
  generateWeeklyRecommendation,
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
  const { activeWeeklyPlanId, studySessions, weeklyPlans } = useStudy();
  const activePlan =
    weeklyPlans.find((plan) => plan.id === activeWeeklyPlanId) ?? weeklyPlans[0] ?? null;
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
            weekly plan is the control center now.
          </h2>
          <p className="muted-copy">
            Map the week, track completed tasks, and use rule-based guidance to decide the
            next study block.
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
          <p className="section-label">Next study move</p>
          <h3>{recommendation.title}</h3>
          <p>{recommendation.recommendation}</p>
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
          <WeeklyStudyBarChart sessions={studySessions} />
        </Card>

        <Card subtitle="Current rule-based recommendation" title="Weekly planner signal">
          <div className="next-action-card">
            <p>{recommendation.reason}</p>
            {activePlan ? (
              <div className="pill-row">
                <span className="topic-pill">{stats.completedCount} complete</span>
                <span className="topic-pill">{stats.overdueCount} overdue</span>
                <span className="topic-pill">{stats.loggedMinutes} logged min</span>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="dashboard-grid">
        <TodayPlannedTasksCard
          emptyMessage="No exact-date task from your weekly planner lands on today yet."
          navigateToTracker
          subtitle="Launch today's scheduled task directly into the study tracker timer."
          title="Today's exact-date tasks"
        />

        <Card subtitle="Keep momentum visible" title="Quick actions">
          <div className="next-action-card">
            <p>{recommendation.recommendation}</p>
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
    </section>
  );
}

export default DashboardPage;
