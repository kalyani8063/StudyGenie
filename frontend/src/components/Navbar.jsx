import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../state/AuthContext.jsx";
import { useStudy } from "../state/StudyContext.jsx";
import Button from "./ui/Button.jsx";

const pageMeta = {
  "/dashboard": {
    eyebrow: "Overview",
    title: "Dashboard",
  },
  "/recommendation": {
    eyebrow: "Weekly Planner",
    title: "Weekly study planner",
  },
  "/studio": {
    eyebrow: "Lesson Studio",
    title: "PowerPoint lesson summary",
  },
  "/tracker": {
    eyebrow: "Study Tracker",
    title: "Session intelligence",
  },
  "/guide": {
    eyebrow: "Weekly Progress",
    title: "Weekly progress guide",
  },
  "/timer": {
    eyebrow: "Focus",
    title: "Focus timer",
  },
  "/history": {
    eyebrow: "History",
    title: "Activity history",
  },
  "/profile": {
    eyebrow: "Profile",
    title: "Account settings",
  },
};

function Navbar() {
  const location = useLocation();
  const { exportProgress } = useStudy();
  const { isAuthenticated, logout, user } = useAuth();
  const meta = pageMeta[location.pathname] ?? pageMeta["/dashboard"];
  const initials = (user?.full_name ?? "Study Genie")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <header className="topbar">
      <div className="topbar-title">
        <div className="topbar-brand">
          <span className="brand-mark">SG</span>
          <div>
            <strong>StudyGenie</strong>
            <span>{meta.eyebrow}</span>
          </div>
        </div>
        <div>
          <h1>{meta.title}</h1>
        </div>
      </div>

      <div className="topbar-actions">
        <Button className="secondary-button" variant="ghost" onClick={exportProgress}>
          Export progress
        </Button>
        {isAuthenticated ? (
          <>
            <Link className="profile-chip" to="/profile">
              <span className="profile-chip-avatar">{initials || "SG"}</span>
              <span className="profile-chip-copy">
                <strong>{user?.full_name ?? "Study account"}</strong>
                <small>{user?.email ?? "Signed in"}</small>
              </span>
            </Link>
            <Button className="secondary-button" variant="ghost" onClick={logout}>
              Logout
            </Button>
          </>
        ) : (
          <div className="topbar-auth-links">
            <Link className="secondary-link" to="/login">
              Login
            </Link>
            <Link className="secondary-link" to="/register">
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;
