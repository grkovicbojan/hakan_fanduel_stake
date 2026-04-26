/**
 * Maps Stake Odds Data API fixture JSON (docs-odds-data.stake.com) into odd_infos rows
 * aligned with FanDuel / legacy Stake category keys (e.g. ToScore19.5+Points:PlayerName).
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
      const over = Number(o.over);
      if (!Number.isFinite(over) || over <= 1) continue;

      const lineStr = formatLineNumber(Number(line));
      const marketType = `${base}${lineStr}+Points`;
      const category = `${marketType}:${player}`;
      const key = `${category}|${over}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ url, category, value: over });
    }
  }

  return out;
}
