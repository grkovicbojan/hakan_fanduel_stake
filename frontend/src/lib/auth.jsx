import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

function apiOrigin() {
  return import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, "") || "";
}

export function AuthProvider({ slug, children }) {
  const [user, setUser] = useState(null);
  const [linkRequired, setLinkRequired] = useState(null);
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
        const err = new Error(data.message || data.detail || res.statusText);
        err.code = data.code;
        err.email = data.email;
        throw err;
      }
      return data;
    },
    [apiBase]
  );

  const refreshUser = useCallback(async () => {
    try {
      const data = await authFetch("/auth/me");
      setUser(data);
      setLinkRequired(null);
      return data;
    } catch (error) {
      setUser(null);
      setLinkRequired(error.code === "link_required" ? { email: error.email } : null);
      throw error;
    }
  }, [authFetch]);

  const signIn = useCallback(async (email, password) => {
    try {
      const data = await authFetch("/auth/login", { method: "POST", json: { email, password } });
      setUser(data.user);
      setLinkRequired(null);
      return data.user;
    } catch (error) {
      if (error.code === "link_required") setLinkRequired({ email: error.email });
      throw error;
    }
  }, [authFetch]);

  const signUp = useCallback(async (email, password) => {
    try {
      const data = await authFetch("/auth/register", { method: "POST", json: { email, password } });
      setUser(data.user);
      setLinkRequired(null);
      return data.user;
    } catch (error) {
      if (error.code === "link_required") setLinkRequired({ email: error.email });
      throw error;
    }
  }, [authFetch]);

  const linkLegacyAccount = useCallback(async (password) => {
    await authFetch("/auth/link", { method: "POST", json: { password } });
    return refreshUser();
  }, [authFetch, refreshUser]);

  const logout = useCallback(async () => {
    await authFetch("/auth/logout", { method: "POST" });
    setUser(null);
    setLinkRequired(null);
  }, [authFetch]);

  const sendInvite = useCallback(
    async (email) => authFetch("/invites", { method: "POST", json: { email } }),
    [authFetch]
  );

  useEffect(() => {
    refreshUser()
      .catch(() => {})
      .finally(() => setBooting(false));
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      slug,
      user,
      linkRequired,
      setUser,
      logout,
      signIn,
      signUp,
      linkLegacyAccount,
      refreshUser,
      sendInvite,
      authFetch,
      booting,
      isAuthenticated: Boolean(user),
    }),
    [slug, user, linkRequired, logout, signIn, signUp, linkLegacyAccount, refreshUser, sendInvite, authFetch, booting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const DEFAULT_PROJECT_SLUG = "sportbet";
