import { createContext, useCallback, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);
const TOKEN_PREFIX = "sportbet_token_";

function apiOrigin() {
  return import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, "") || "";
}

export function AuthProvider({ slug, children }) {
  const storageKey = `${TOKEN_PREFIX}${slug}`;
  const [token, setTokenState] = useState(() => localStorage.getItem(storageKey) || "");
  const [user, setUser] = useState(null);
  const apiBase = `${apiOrigin()}/p/${slug}`;

  const setToken = useCallback(
    (value) => {
      if (value) localStorage.setItem(storageKey, value);
      else localStorage.removeItem(storageKey);
      setTokenState(value || "");
    },
    [storageKey]
  );

  const authFetch = useCallback(
    async (path, options = {}) => {
      const headers = { ...(options.headers || {}) };
      if (options.json) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.json);
        delete options.json;
      }
      if (token) headers.Authorization = `Bearer ${token}`;
      let res;
      try {
        res = await fetch(`${apiBase}${path}`, { ...options, headers });
      } catch {
        throw new Error(
          apiOrigin()
            ? "Cannot reach the API server. Check that the backend is running."
            : "Cannot reach the API server. Start the backend or check your proxy settings."
        );
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.detail || res.statusText);
      return data;
    },
    [apiBase, token]
  );

  const login = useCallback(
    async (email, password) => {
      const data = await authFetch("/auth/login", { method: "POST", json: { email, password } });
      setToken(data.token);
      setUser(data.user);
      return data.user;
    },
    [authFetch, setToken]
  );

  const register = useCallback(
    async (email, password) => {
      const data = await authFetch("/auth/register", {
        method: "POST",
        json: { email, password },
      });
      setToken(data.token);
      setUser(data.user);
      return data.user;
    },
    [authFetch, setToken]
  );

  const logout = useCallback(() => {
    setToken("");
    setUser(null);
  }, [setToken]);

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    const data = await authFetch("/auth/me");
    setUser(data);
    return data;
  }, [authFetch, token]);

  const sendInvite = useCallback(
    async (email) => authFetch("/invites", { method: "POST", json: { email } }),
    [authFetch]
  );

  const value = useMemo(
    () => ({
      slug,
      token,
      user,
      login,
      register,
      logout,
      refreshUser,
      sendInvite,
      authFetch,
      isAuthenticated: Boolean(token),
    }),
    [slug, token, user, login, register, logout, refreshUser, sendInvite, authFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const DEFAULT_PROJECT_SLUG = "sportbet";
