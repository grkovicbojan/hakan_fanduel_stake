import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const HUB_AUTH_URL = "https://weienwong.online";

function apiOrigin() {
  return import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, "") || "";
}

export function AuthProvider({ slug, children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const apiBase = `${apiOrigin()}/p/${slug}`;

  const authFetch = useCallback(
    async (path, options = {}) => {
      const headers = { ...(options.headers || {}) };
      if (options.json) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.json);
        delete options.json;
      }
      let res;
      try {
        res = await fetch(`${apiBase}${path}`, {
          ...options,
          headers,
          credentials: "include",
        });
      } catch {
        throw new Error(
          apiOrigin()
            ? "Cannot reach the API server. Check that the backend is running."
            : "Cannot reach the API server. Start the backend or check your proxy settings."
        );
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const isSessionProbe = path === "/auth/me";
        if (data.redirect && !isSessionProbe) {
          window.location.href = data.redirect.includes("return_to=")
            ? data.redirect
            : `${data.redirect}${data.redirect.includes("?") ? "&" : "?"}return_to=${encodeURIComponent(window.location.href)}`;
          throw new Error("Redirecting to hub sign in…");
        }
        throw new Error(data.message || data.detail || res.statusText);
      }
      return data;
    },
    [apiBase]
  );

  const refreshUser = useCallback(async () => {
    const data = await authFetch("/auth/me");
    setUser(data);
    return data;
  }, [authFetch]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${HUB_AUTH_URL}/api/identity/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (_) {
      /* ignore */
    }
    setUser(null);
  }, []);

  const sendInvite = useCallback(
    async (email) => authFetch("/invites", { method: "POST", json: { email } }),
    [authFetch]
  );

  useEffect(() => {
    refreshUser()
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, [refreshUser]);

  const hubLoginUrl = `${HUB_AUTH_URL}/login?return_to=${encodeURIComponent(window.location.href)}`;
  const hubRegisterUrl = `${HUB_AUTH_URL}/register?return_to=${encodeURIComponent(window.location.href)}`;

  const value = useMemo(
    () => ({
      slug,
      user,
      setUser,
      logout,
      refreshUser,
      sendInvite,
      authFetch,
      hubLoginUrl,
      hubRegisterUrl,
      hubAuthUrl: HUB_AUTH_URL,
      booting,
      isAuthenticated: Boolean(user),
    }),
    [slug, user, logout, refreshUser, sendInvite, authFetch, hubLoginUrl, hubRegisterUrl, booting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const DEFAULT_PROJECT_SLUG = "sportbet";
