import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  let auth = null;

  try {
    const storedAuth = localStorage.getItem("studygenie-auth");
    auth = storedAuth ? JSON.parse(storedAuth) : null;
  } catch {
    localStorage.removeItem("studygenie-auth");
  }

  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }

  return config;
});

export function getRecommendation(payload) {
  return apiClient.post("/recommend", payload);
}

export function registerUser(payload) {
  return apiClient.post("/auth/register", payload);
}

export function loginUser(payload) {
  return apiClient.post("/auth/login", payload);
}

export function getProfile() {
  return apiClient.get("/profile");
}

export function updateProfile(payload) {
  return apiClient.put("/profile", payload);
}

export function getRecommendationHistory() {
  return apiClient.get("/recommendations/history");
}

export function saveRecommendation(payload) {
  return apiClient.post("/recommendations/history", payload);
}

export function getStudySessions() {
  return apiClient.get("/study-sessions");
}

export function createStudySession(payload) {
  return apiClient.post("/study-sessions", payload);
}

export function getBreakLogs() {
  return apiClient.get("/break-logs");
}

export function createBreakLog(payload) {
  return apiClient.post("/break-logs", payload);
}

export default apiClient;
