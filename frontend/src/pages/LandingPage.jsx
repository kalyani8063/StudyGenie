import { Link } from "react-router-dom";

import { useAuth } from "../state/AuthContext.jsx";

const focusAreas = [
  {
    title: "Weekly Planning",
    copy: "Map out the week with day-by-day study tasks you can actually follow through on.",
  },
  {
    title: "Study Tracking",
    copy: "Capture sessions, measure streaks, and see where your week is actually going.",
  },
  {
    title: "Rule-Based Guidance",
    copy: "Turn your planned workload and completed tasks into practical next-step advice.",
  },
];

const productStats = [
  { label: "Faster next steps", value: "3x" },
  { label: "Focused dashboard", value: "1" },
  { label: "Study workflows", value: "4" },
];

function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link className="landing-brand" to="/">
          <span className="brand-mark">SG</span>
          <span>
            <strong>StudyGenie</strong>
            <small>Study with clearer next steps</small>
          </span>
        </Link>

        <nav className="landing-nav" aria-label="Public navigation">
          <Link className="secondary-link" to={isAuthenticated ? "/dashboard" : "/login"}>
            {isAuthenticated ? "Dashboard" : "Login"}
          </Link>
          <Link className="landing-primary-link" to={isAuthenticated ? "/dashboard" : "/register"}>
            {isAuthenticated ? "Open workspace" : "Get started"}
          </Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <img
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80"
            alt="Students studying together around a table"
          />
          <div className="landing-hero-content">
            <p className="eyebrow">Weekly study planner</p>
            <h1>Build sharper study habits with a planner that keeps your week actionable.</h1>
            <p className="landing-lead">
              StudyGenie combines weekly planning, trackable study sessions, and progress-based
              guidance in one focused workspace.
            </p>

            <div className="cta-row">
              <Link className="landing-primary-link" to={isAuthenticated ? "/dashboard" : "/register"}>
                {isAuthenticated ? "Open dashboard" : "Start with StudyGenie"}
              </Link>
              <Link className="secondary-link" to={isAuthenticated ? "/dashboard" : "/login"}>
                {isAuthenticated ? "Continue working" : "Log in"}
              </Link>
            </div>

            <div className="landing-stat-row">
              {productStats.map((item) => (
                <div className="landing-stat-chip" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-heading">
            <p className="eyebrow">Feature highlights</p>
            <h2>Everything you need to move from raw study effort to clear direction.</h2>
          </div>

          <div className="landing-feature-grid">
            {focusAreas.map((item) => (
              <article className="landing-feature" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-band">
          <div className="landing-band-copy">
            <p className="eyebrow">Product flow</p>
            <h2>Arrive on a focused dashboard that already knows what matters next this week.</h2>
            <p>
              Build a weekly plan, log study sessions across the week, and use your progress
              signals to decide the next block of work.
            </p>
            <div className="cta-row">
              <Link className="landing-primary-link" to={isAuthenticated ? "/dashboard" : "/register"}>
                {isAuthenticated ? "View workspace" : "Create workspace"}
              </Link>
              <Link className="secondary-link" to="/guide">
                Preview study guide
              </Link>
            </div>
          </div>

          <img
            src="https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1200&q=80"
            alt="Student writing notes while reviewing study material"
          />
        </section>

        <section className="landing-section landing-cta">
          <div className="landing-section-heading">
            <p className="eyebrow">Ready to ship your next study session</p>
            <h2>Move from landing page to a production-style learning workspace in one step.</h2>
          </div>

          <div className="cta-row">
            <Link className="landing-primary-link" to={isAuthenticated ? "/dashboard" : "/register"}>
              {isAuthenticated ? "Go to dashboard" : "Get started free"}
            </Link>
            {!isAuthenticated && (
              <Link className="secondary-link" to="/login">
                I already use StudyGenie
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;
