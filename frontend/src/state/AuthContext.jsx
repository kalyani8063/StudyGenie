import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  getProfile,
  loginUser,
  registerUser,
  updateProfile,
} from "../api/client.js";

const AuthContext = createContext(null);
const AUTH_KEY = "studygenie-auth";

function readAuth() {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    return stored ? JSON.parse(stored) : { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readAuth);

  useEffect(() => {
    if (auth.token && auth.user) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  }, [auth]);

  async function register(payload) {
    const response = await registerUser(payload);
    const nextAuth = {
      token: response.data.access_token,
      user: response.data.user,
    };
    setAuth(nextAuth);
    return nextAuth;
  }

  async function login(payload) {
    const response = await loginUser(payload);
    const nextAuth = {
      token: response.data.access_token,
      user: response.data.user,
    };
    setAuth(nextAuth);
    return nextAuth;
  }

  async function refreshProfile() {
    const response = await getProfile();
    setAuth((current) => ({
      ...current,
      user: response.data,
    }));
    return response.data;
  }

  async function saveProfile(payload) {
    const response = await updateProfile(payload);
    setAuth((current) => ({
      ...current,
      user: response.data,
    }));
    return response.data;
  }

  function logout() {
    setAuth({ token: null, user: null });
  }

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(auth.token),
      token: auth.token,
      user: auth.user,
      login,
      logout,
      refreshProfile,
      register,
      saveProfile,
    }),
    [auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
