const backendPort = Number.parseInt(__BACKEND_PORT__, 10);
const baseUrl = `http://localhost:${backendPort}`;

async function parseJson(response) {
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

export const api = {
  getDashboard: () => fetch(`${baseUrl}/dashboard`).then(parseJson),
  getDashboardWebsites: () => fetch(`${baseUrl}/dashboard/websites`).then(parseJson),
  getLatestScrapedByUrl: (url) =>
    fetch(`${baseUrl}/setting/scraped?url=${encodeURIComponent(url)}`).then(parseJson),
  getWebsiteMatchesByUrl: (url) =>
    fetch(`${baseUrl}/setting/matches?url=${encodeURIComponent(url)}`).then(parseJson),
  getMatchWebsitesOverview: () =>
    fetch(`${baseUrl}/setting/match-websites`).then(parseJson),
  getOddsByMatchUrl: (url) =>
    fetch(`${baseUrl}/setting/odds?url=${encodeURIComponent(url)}`).then(parseJson),
  getSettings: () => fetch(`${baseUrl}/setting`).then(parseJson),
  createSetting: (payload) =>
    fetch(`${baseUrl}/setting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(parseJson),
  updateSetting: (id, payload) =>
    fetch(`${baseUrl}/setting/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(parseJson),
  deleteSetting: (id) =>
    fetch(`${baseUrl}/setting/${id}`, {
      method: "DELETE"
    }),
  getAlerts: ({ page = 1, pageSize = 50 } = {}) =>
    fetch(`${baseUrl}/alert?page=${page}&pageSize=${pageSize}`).then(parseJson)
};
