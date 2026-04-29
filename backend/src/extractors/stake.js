/**
 * Stake.com odds-data API (https://docs-odds-data.stake.com/).
 * Returns plain data only; workers persist to odd_infos / scraped_infos.
 */
import { env } from "../config/env.js";
import { insertAlert } from "../db/alertsRepo.js";
import { getComparisonRootUrlForComparisonFixture } from "../db/matchRepo.js";
import { findWebsiteByUrlAny } from "../db/websiteRepo.js";
import { logger } from "../lib/logger.js";

const STAKE_MATCH_API_URL = "https://odds-data.stake.com/sports/basketball/usa/nba/fixtures";
const AUTHORIZATION_HEADER = "X-API-KEY";
const DEFAULT_BASE = "https://odds-data.stake.com";
let rr = 0;

function nbaFixtureUrlFromSlug(slug) {
  const s = String(slug || "").trim().replace(/^\/+/, "");
  if (!s) return "";
  return `https://stake.com/de/sports/basketball/usa/nba/${s}`;
}

export async function extractStakeSportbookMatches(websiteUrl) {
  const site = await findWebsiteByUrlAny(websiteUrl);
  if (!site || Number(site.scrape_type) !== 1) return [];
  const apiKey =
    pickRotatingApiKey(parseApiKeysField(site.api_keys)) || String(env.stakeOddsApiKey || "").trim();
  if (!apiKey) {
    logger.warn("Stake fixtures list: no API key", { websiteUrl });
    return [];
  }
  const res = await fetch(STAKE_MATCH_API_URL, { headers: headers(apiKey) });
  const text = await res.text();
  if (!res.ok) {
    logger.error("Stake odds-data HTTP error", { status: res.status, body: text.slice(0, 200) });
    return [];
  }
  try {
    const data = JSON.parse(text);
    if (!data.fixtures) {
      logger.error("Stake odds-data: no fixtures array");
      return [];
    }
    return data.fixtures.map((item) => ({
      matchName: normalizeFinalMatchName(item.name),
      matchUrl: nbaFixtureUrlFromSlug(item.slug),
      startTime: normalizeStartTime(item.startDate || item.startTime || item.commenceTime || item.date)
    }));
  } catch {
    logger.error("Stake odds-data: invalid JSON");
    return [];
  }
}

export async function extractStakeSportbookDetails(websiteUrl) {
  const slug = stakeSlugFromPageUrl(websiteUrl);
  if (!slug) {
    logger.warn("EXTRACT_SUB stake: could not parse slug from URL.", { websiteUrl });
    return [];
  }
  const site = await resolveStakeWebsiteRowForFixture(websiteUrl);
  if (!site) {
    logger.warn("EXTRACT_SUB stake: no website_infos row for this fixture.", { websiteUrl });
    return [];
  }
  if (Number(site.scrape_type) !== 1) {
    logger.warn("EXTRACT_SUB stake: scrape_type is not API (1); skipping odds-data fetch.", {
      websiteUrl,
      websiteId: site.id
    });
    return [];
  }
  const keys = parseApiKeysField(site.api_keys);
  const apiKey = resolveStakeApiKeyFromWebsite(site, env.stakeOddsApiKey);
  if (!apiKey) {
    logger.warn("EXTRACT_SUB stake: no API key (set api_keys on website or STAKE_ODDS_API_KEY).", {
      websiteUrl,
      websiteId: site.id,
      keyCount: keys.length
    });
    await insertAlert({
      type: "stake_odds_data_error",
      message: "Missing Stake Odds Data API key for this website row.",
      url: websiteUrl
    });
    return [];
  }
  try {
    const payload = await fetchStakeFixturePayload(slug, apiKey);
    return oddRowsFromStakeOddsDataPayload(payload, websiteUrl);
  } catch (error) {
    logger.error("EXTRACT_SUB stake odds-data failed", { websiteUrl, slug, error: error.message });
    await insertAlert({ type: "stake_odds_data_error", message: error.message, url: websiteUrl });
    return [];
  }
}

async function resolveStakeWebsiteRowForFixture(fixturePageUrl) {
  const root = await getComparisonRootUrlForComparisonFixture(fixturePageUrl);
  if (root) {
    const byRoot = await findWebsiteByUrlAny(root);
    if (byRoot) return byRoot;
  }
  return await findWebsiteByUrlAny(fixturePageUrl);
}

export function parseApiKeysField(text) {
  if (text == null || typeof text !== "string") return [];
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function pickRotatingApiKey(keys) {
  if (!keys?.length) return "";
  return keys[rr++ % keys.length];
}

export function resolveStakeApiKeyFromWebsite(site, envFallback) {
  const keys = parseApiKeysField(site?.api_keys ?? "");
  const picked = pickRotatingApiKey(keys);
  if (picked) return picked;
  return String(envFallback ?? "").trim();
}

function headers(apiKey) {
  const h = {
    Accept: "application/json",
    "User-Agent": "SportBetComparator/1.0"
  };
  const key = String(apiKey || "").trim();
  if (key) {
    h[AUTHORIZATION_HEADER] = key;
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

export async function fetchNbaFixturesList(apiKey) {
  const path =
    process.env.STAKE_ODDS_FIXTURES_PATH || "/sports/basketball/usa/nba/fixtures";
  return fetchStakeOddsJson(path, apiKey);
}

export async function fetchStakeFixturePayload(slug, apiKey) {
  const s = String(slug || "").trim().replace(/^\/+|\/+$/g, "");
  if (!s) throw new Error("Missing fixture slug");
  return fetchStakeOddsJson(`/fixtures/${encodeURIComponent(s)}`, apiKey);
}

export function stakeSlugFromPageUrl(pageUrl) {
  try {
    const parts = new URL(pageUrl).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}

/**
 * Maps Stake Odds Data API fixture JSON (docs-odds-data.stake.com) into odd_infos rows
 * aligned with FanDuel / legacy Stake category keys.
 *
 * Primary source: `swishMarkets.playerProps[]` with outcomes `{ line, over, under }`.
 */

function normalizeDetailToken(s) {
    return String(s || "")
      .trim()
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, "");
  }
  
  function formatLineNumber(value) {
    if (Number.isInteger(value)) return String(value);
    return String(value).replace(/\.?0+$/, "");
  }
  
  /** @param {string} marketName swish marketName e.g. "points", "points+assists" */
  function marketTypeFromSwishName(marketName) {
    const key = String(marketName || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    const map = {
      points: "ToScore",
      assists: "Assists",
      rebounds: "Rebounds",
      threesmade: "MadeThrees",
      steals: "Steals",
      blocks: "Blocks",
      "points+assists": "Points+Assists",
      "points+rebounds": "Points+Rebounds",
      "points+assists+rebounds": "Points+Assists+Rebounds",
      "assists+rebounds": "Assists+Rebounds"
    };
    return map[key] || null;
  }
  
  const SWISH_MARKET_SKIP =
    /first|scorer|quarter|half|^fg|^ft|^two|^three|attempted|double|triple|free|turnover|match|team|steals\+blocks|rebounds\+assists|points\+rebounds\+assists/i;
  
  /**
   * @typedef {{ fixture?: object, groups?: object[], swishMarkets?: object }} StakeFixturePayload
   */
  
  /**
   * @param {StakeFixturePayload} payload
   * @param {string} fixturePageUrl canonical stake match URL stored in DB / odd_infos
   * @returns {{ url: string, category: string, value: number }[]}
   */
  export function oddRowsFromStakeOddsDataPayload(payload, fixturePageUrl) {
    if (!payload || typeof payload !== "object") return [];
    const url = typeof fixturePageUrl === "string" && fixturePageUrl ? fixturePageUrl : "";
    if (!url) return [];
  
    const out = [];
    const seen = new Set();
    const swish = payload.swishMarkets;
    const props = swish && typeof swish === "object" ? swish.playerProps : null;
    if (!Array.isArray(props)) return out;
  
    for (const row of props) {
      if (!row || typeof row !== "object") continue;
      const marketName = String(row.marketName || "");
      if (!marketName || SWISH_MARKET_SKIP.test(marketName)) continue;
      const base = marketTypeFromSwishName(marketName);
      if (!base) continue;
  
      const player = normalizeDetailToken(String(row.competitorName || ""));
      if (!player || player.length < 2) continue;
  
      const outcomes = Array.isArray(row.outcomes) ? row.outcomes : [];
      for (const o of outcomes) {
        if (!o || typeof o !== "object") continue;
        const line = o.line;
        if (line == null || Number.isNaN(Number(line))) continue;
        const lineStr = formatLineNumber(Number(line));
        const marketType = `${base}`;
        const pushOutcome = (side, oddValue) => {
          const odd = Number(oddValue);
          if (!Number.isFinite(odd) || odd <= 1) return;
          const category = `${marketType}-${side}-${lineStr}+Points:${player}`;
          const key = `${category}|${odd}`;
          if (seen.has(key)) return;
          seen.add(key);
          out.push({ url, category, value: odd });
        };
        pushOutcome("Over", o.over);
        pushOutcome("Under", o.under);
      }
    }
  
    return out;
  }
  
  function normalizeFinalMatchName(matchName) {
    if (!matchName || typeof matchName !== "string") return "";
    let s = matchName.trim();
    // 1) remove leading/trailing numeric tokens around the matchup label
    s = s.replace(/^\d+\s+/, "").replace(/\s+\d+$/, "");
    // 2) remove spaces
    s = s.replace(/\s+/g, "");
    // 3) unify separator to "-"
    s = s.replace(/@/g, "-");

    const idx = s.indexOf("-");
    if (idx < 0) return s.toLowerCase();

    // 4) left/right around separator are team names; 5) sort and rebuild
    const teamA = s.slice(0, idx).toLowerCase();
    const teamB = s.slice(idx + 1).toLowerCase();
    if (!teamA || !teamB) return s.toLowerCase();
    return [teamA, teamB].sort((a, b) => a.localeCompare(b)).join("-");
}

function normalizeStartTime(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return null;
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  const d = new Date(t);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}
