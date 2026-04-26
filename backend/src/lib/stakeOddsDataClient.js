const DEFAULT_BASE = "https://odds-data.stake.com";

function headers(apiKey) {
  const h = {
    Accept: "application/json",
    "User-Agent": "SportBetComparator/1.0"
  };
  const key = String(apiKey || "").trim();
  if (key) {
    h.Authorization = `Bearer ${key}`;
  }
  return h;
}

export async function fetchStakeOddsJson(path, apiKey) {
  const base = (process.env.STAKE_ODDS_DATA_BASE || DEFAULT_BASE).replace(/\/+$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { headers: headers(apiKey) });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Stake odds-data HTTP ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Stake odds-data: invalid JSON");
  }
}

/** @returns {{ sport: string, category: string, tournament: string, fixtures: object[] }} */
export async function fetchNbaFixturesList(apiKey) {
  const path =
    process.env.STAKE_ODDS_FIXTURES_PATH || "/sports/basketball/usa/nba/fixtures";
  return fetchStakeOddsJson(path, apiKey);
}

/** @returns {Promise<object>} Full fixture JSON (fixture, groups, swishMarkets). */
export async function fetchStakeFixturePayload(slug, apiKey) {
  const s = String(slug || "").trim().replace(/^\/+|\/+$/g, "");
  if (!s) throw new Error("Missing fixture slug");
  return fetchStakeOddsJson(`/fixtures/${encodeURIComponent(s)}`, apiKey);
}

/** Last path segment of a Stake sportsbook fixture URL. */
export function stakeSlugFromPageUrl(pageUrl) {
  try {
    const parts = new URL(pageUrl).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}
