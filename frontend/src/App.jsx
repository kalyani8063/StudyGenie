import { Outlet } from "react-router-dom";

import AppErrorBoundary from "./components/AppErrorBoundary.jsx";
import Navbar from "./components/Navbar.jsx";
import Sidebar from "./components/Sidebar.jsx";

function App() {
  return (
    <AppErrorBoundary>
      <div className="app-shell">
        <Sidebar />
        <div className="content-shell">
          <Navbar />
          <main className="page-shell">
            <Outlet />
          </main>
        </div>
      </div>
    </AppErrorBoundary>
  );
}

export default App;
