import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import App from "./App.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import FocusTimerPage from "./pages/FocusTimerPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import RecommendationPage from "./pages/RecommendationPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import StudyGuidePage from "./pages/StudyGuidePage.jsx";
import StudyTrackerPage from "./pages/StudyTrackerPage.jsx";
import { AuthProvider } from "./state/AuthContext.jsx";
import { StudyProvider } from "./state/StudyContext.jsx";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <StudyProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route
              element={
                <ProtectedRoute>
                  <App />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="recommendation" element={<RecommendationPage />} />
              <Route path="tracker" element={<StudyTrackerPage />} />
              <Route path="guide" element={<StudyGuidePage />} />
              <Route path="timer" element={<FocusTimerPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
        </BrowserRouter>
      </StudyProvider>
    </AuthProvider>
  </React.StrictMode>,
);
