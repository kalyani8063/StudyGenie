import { Outlet } from "react-router-dom";

import Navbar from "./components/Navbar.jsx";
import Sidebar from "./components/Sidebar.jsx";

function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="content-shell">
        <Navbar />
        <main className="page-shell">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default App;
