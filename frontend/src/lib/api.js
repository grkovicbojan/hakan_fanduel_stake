/**
 * Browser-side API client. It does not import `vite.config.js` (that file only runs in Node when you start Vite).
 *
 * Two modes:
 * 1) `VITE_API_ORIGIN` set at build time → requests go to that origin (production / split API host).
 * 2) Otherwise → relative URLs (`/setting`, `/dashboard`, …). In **dev/preview**, Vite proxies to the backend
 *    (`SERVER_IP`: local uses `BACKEND_PORT`; a full `https://api.example.com` URL uses default 443, no `:port`).
 *    In **production**, nginx (or similar) should proxy those paths to your backend domain, or set `VITE_API_ORIGIN`.
 *
 * `__BACKEND_PORT__` comes from Vite `define` in `vite.config.js` and is only used by `absoluteBaseUrl()` helpers.
 */
const backendPort = Number.parseInt(__BACKEND_PORT__, 10);

/**
 * Optional absolute API origin. If empty, use same-origin paths (works with Vite proxy or nginx proxy).
 */
function baseUrl() {
  const origin =
    typeof import.meta.env.VITE_API_ORIGIN === "string" ? import.meta.env.VITE_API_ORIGIN.trim() : "";
  if (origin) return origin.replace(/\/+$/, "");
  return "";
}

function apiHost() {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return window.location.hostname;
  }
  return "localhost";
}

function absoluteBase() {
  return `http://${apiHost()}:${backendPort}`;
}

async function parseJson(response) {
  if (!response.ok) {
    if (response.status === 401) {
      // Backend answers with { message, redirect } pointing at the hub sign-in.
      const body = await response.json().catch(() => null);
      if (body?.redirect && typeof window !== "undefined") {
        window.location.href = body.redirect;
      }
      throw new Error(body?.message || "Authentication required");
    }
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function url(path) {
  const b = baseUrl();
  return b ? `${b}${path}` : path;
}

/**
 * Every operator endpoint below is hub-authenticated, so the shared
 * `ww_access_token` cookie has to ride along — including cross-origin when
 * `VITE_API_ORIGIN` points at the API subdomain, since the cookie is scoped to
 * `.weienwong.online`.
 */
function apiFetch(path, options = {}) {
  return fetch(url(path), { credentials: "include", ...options });
}

export const api = {
  getDashboard: ({ threshold = 0 } = {}) =>
    apiFetch(`/dashboard?threshold=${encodeURIComponent(Math.max(0, Number(threshold) || 0))}`).then(
      parseJson
    ),
  getDashboardWebsites: () => apiFetch("/dashboard/websites").then(parseJson),
  getLatestScrapedByUrl: (u) =>
    apiFetch(`/setting/scraped?url=${encodeURIComponent(u)}`).then(parseJson),
  getWebsiteMatchesByUrl: (u) =>
    apiFetch(`/setting/matches?url=${encodeURIComponent(u)}`).then(parseJson),
  getMatchWebsitesOverview: () => apiFetch("/setting/match-websites").then(parseJson),
  getOddsByMatchUrl: (u) =>
    apiFetch(`/setting/odds?url=${encodeURIComponent(u)}`).then(parseJson),
  getSettings: () => apiFetch("/setting").then(parseJson),
  createSetting: (payload) =>
    apiFetch("/setting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(parseJson),
  updateSetting: (id, payload) =>
    apiFetch(`/setting/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(parseJson),
  deleteSetting: (id) =>
    apiFetch(`/setting/${id}`, {
      method: "DELETE"
    }),
  getAlerts: ({ page = 1, pageSize = 50 } = {}) =>
    apiFetch(`/alert?page=${page}&pageSize=${pageSize}`).then(parseJson),
  /** When not using Vite proxy, call backend directly (e.g. quick scripts). */
  absoluteBaseUrl: () => absoluteBase()
};
