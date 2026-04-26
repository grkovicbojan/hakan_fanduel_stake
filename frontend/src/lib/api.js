const backendPort = Number.parseInt(__BACKEND_PORT__, 10);

/**
 * Same-origin paths in dev / preview (Vite proxies to the backend).
 * Optional build-time `VITE_API_ORIGIN` (e.g. https://api.example.com) for split deployments.
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
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function url(path) {
  const b = baseUrl();
  return b ? `${b}${path}` : path;
}

export const api = {
  getDashboard: () => fetch(url("/dashboard")).then(parseJson),
  getDashboardWebsites: () => fetch(url("/dashboard/websites")).then(parseJson),
  getLatestScrapedByUrl: (u) =>
    fetch(`${url("/setting/scraped")}?url=${encodeURIComponent(u)}`).then(parseJson),
  getWebsiteMatchesByUrl: (u) =>
    fetch(`${url("/setting/matches")}?url=${encodeURIComponent(u)}`).then(parseJson),
  getMatchWebsitesOverview: () => fetch(url("/setting/match-websites")).then(parseJson),
  getOddsByMatchUrl: (u) =>
    fetch(`${url("/setting/odds")}?url=${encodeURIComponent(u)}`).then(parseJson),
  getSettings: () => fetch(url("/setting")).then(parseJson),
  createSetting: (payload) =>
    fetch(url("/setting"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(parseJson),
  updateSetting: (id, payload) =>
    fetch(url(`/setting/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(parseJson),
  deleteSetting: (id) =>
    fetch(url(`/setting/${id}`), {
      method: "DELETE"
    }),
  getAlerts: ({ page = 1, pageSize = 50 } = {}) =>
    fetch(`${url("/alert")}?page=${page}&pageSize=${pageSize}`).then(parseJson),
  getIntegrations: () => fetch(url("/setting/integrations")).then(parseJson),
  putIntegrations: (payload) =>
    fetch(url("/setting/integrations"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(parseJson),
  postStakeSyncNbaFixtures: (apiKey) =>
    fetch(url("/setting/stake/sync-nba-fixtures"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiKey ? { apiKey } : {})
    }).then(parseJson),
  /** When not using Vite proxy, call backend directly (e.g. quick scripts). */
  absoluteBaseUrl: () => absoluteBase()
};
