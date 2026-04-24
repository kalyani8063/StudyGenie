import { NavLink } from "react-router-dom";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/recommendation", label: "Weekly Planner", icon: "spark" },
  { to: "/studio", label: "Lesson Studio", icon: "studio" },
  { to: "/tracker", label: "Study Tracker", icon: "calendar" },
  { to: "/guide", label: "Weekly Progress", icon: "guide" },
];

function SidebarIcon({ icon }) {
  const paths = {
    dashboard: "M4 5h7v6H4zm9 0h7v10h-7zM4 13h7v6H4zm9 4h7v2h-7z",
    spark: "m12 3 2.2 4.8L19 10l-4.8 2.2L12 17l-2.2-4.8L5 10l4.8-2.2Z",
    studio: "M4 6h16M4 12h10M4 18h16M18 10l2 2-2 2",
    calendar: "M7 3v2M17 3v2M4 8h16M6 5h12a2 2 0 0 1 2 2v11H4V7a2 2 0 0 1 2-2Z",
    guide: "M6 5.5A2.5 2.5 0 0 1 8.5 3H20v15H8.5A2.5 2.5 0 0 0 6 20.5Zm0 0V20.5M9 7h7M9 11h7",
  };

  return (
    <svg aria-hidden="true" className="nav-icon-svg" viewBox="0 0 24 24" fill="none">
      <path d={paths[icon]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">SG</span>
        <div>
          <strong>StudyGenie</strong>
          <span>Weekly study workspace</span>
        </div>
      </div>

      <nav className="side-nav" aria-label="Primary navigation">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="nav-icon">
              <SidebarIcon icon={link.icon} />
            </span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p className="sidebar-footer-label">Workspace</p>
        <p>Weekly planning, progress tracking, and study sessions live here.</p>
      </div>
    </aside>
  );
}

export default Sidebar;
