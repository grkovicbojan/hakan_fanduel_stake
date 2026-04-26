/**
 * Maps Stake GraphQL sport event payload (from extension) into odd rows
 * compatible with FanDuel-style category keys used by the comparison worker.
 *
 * Envelope shape (written into scraped_infos.result as JSON):
 * { stakeGraphqlV1: true, fixtureUrl: string, event: { id, name, markets?, groups? } }
 */

function normalizeDetailToken(s) {
  return String(s || "")
    .trim()
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, "");
}

function looksLikePlayerName(s) {
  if (!s || s.length < 3 || s.length > 40) return false;
  if (/^(Over|Under|Yes|No|Home|Away)$/i.test(s)) return false;
  return /^[A-Za-z.'-]+$/.test(s);
}

function normalizeStakeMarketToken(s) {
  const raw = String(s || "")
    .trim()
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
  if (!raw) return "";

  const m = raw.match(
    /^(To\s*Score|Points|Rebounds?|Assists?|Steals?|Blocks?|Made\s*Threes?|Threes?\s*scored|Points\s*\+\s*Rebounds|Points\s*\+\s*Assists|Points\s*\+\s*Assists\s*\+\s*Rebounds|Assists\s*\+\s*Rebounds)\s*(\d+(?:\.\d+)?)\+\s*(?:Points?)?$/i
  );
  if (!m) return raw.replace(/\s+/g, "");

  const baseLabel = m[1].replace(/\s+/g, " ").trim().toLowerCase();
  const labelMap = {
    "to score": "ToScore",
    points: "ToScore",
    rebounds: "Rebounds",
    assists: "Assists",
    steals: "Steals",
    blocks: "Blocks",
    "made threes": "MadeThrees",
    "threes scored": "ThreesScored",
    "points + rebounds": "Points+Rebounds",
    "points + assists": "Points+Assists",
    "points + assists + rebounds": "Points+Assists+Rebounds",
    "assists + rebounds": "Assists+Rebounds"
  };
  const label = labelMap[baseLabel] || m[1].replace(/\s+/g, "");
  const line = m[2];
  return `${label}${line}+Points`;
}

function guessPlayerFromMarketName(marketName) {
  const t = String(marketName || "").trim();
  if (!t) return "";
  const parts = t.split(/\s*[–—-]\s*/).map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    if (looksLikePlayerName(first.replace(/\s+/g, ""))) return first;
    const last = parts[parts.length - 1];
    if (looksLikePlayerName(last.replace(/\s+/g, ""))) return last;
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const maybe = words.slice(0, 2).join(" ");
    if (looksLikePlayerName(maybe.replace(/\s+/g, ""))) return maybe;
  }
  return "";
}

function extractLineFromMarketName(marketName) {
  const t = String(marketName || "");
  const m = t.match(/(\d+(?:\.\d+)?)\s*\+\s*(?:points?|punkte?)?/i);
  if (m) return m[1];
  const m2 = t.match(/(?:over|under|über|uber)\s+(\d+(?:\.\d+)?)/i);
  if (m2) return m2[1];
  return "";
}

function inferMarketLabelFromName(marketName) {
  const key = String(marketName || "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (/to\s*score|punkte?\s*erzielen/.test(key)) return "To Score";
  if (/points\s*\+\s*assists\s*\+\s*rebounds/.test(key)) return "Points + Assists + Rebounds";
  if (/points\s*\+\s*rebounds/.test(key)) return "Points + Rebounds";
  if (/points\s*\+\s*assists/.test(key)) return "Points + Assists";
  if (/assists\s*\+\s*rebounds/.test(key)) return "Assists + Rebounds";
  if (/threes?\s*scored|made\s*threes?|dreier/.test(key)) return "Threes scored";
  if (/\brebounds?\b/.test(key) && !/points/.test(key)) return "Rebounds";
  if (/\bassists?\b/.test(key) && !/points/.test(key)) return "Assists";
  if (/\bsteals?\b/.test(key)) return "Steals";
  if (/\bblocks?\b/.test(key)) return "Blocks";
  if (/\bpoints\b|\bpunkte\b/.test(key)) return "Points";
  return "To Score";
}

function collectMarketsFromEvent(event) {
  if (!event || typeof event !== "object") return [];
  const out = [];
  if (Array.isArray(event.markets)) out.push(...event.markets);
  if (Array.isArray(event.groups)) {
    for (const g of event.groups) {
      if (g && Array.isArray(g.markets)) out.push(...g.markets);
    }
  }
  return out;
}

function parseOddsNumber(raw) {
  if (raw == null) return NaN;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).trim().replace(",", ".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * @param {unknown} envelope
 * @param {string} websiteUrl
 * @returns {{ url: string, category: string, value: number }[]}
 */
export function oddRowsFromStakeGraphqlEnvelope(envelope, websiteUrl) {
  if (!envelope || typeof envelope !== "object" || envelope.stakeGraphqlV1 !== true) return [];
  const event = envelope.event;
  if (!event || typeof event !== "object") return [];

  const url = typeof websiteUrl === "string" && websiteUrl ? websiteUrl : String(envelope.fixtureUrl || "");
  const markets = collectMarketsFromEvent(event);
  const out = [];
  const seen = new Set();

  for (const market of markets) {
    if (!market || typeof market !== "object") continue;
    const marketName = String(market.name || market.title || "").trim();
    if (!marketName) continue;
    const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];
    const over = outcomes.find((o) => o && /^(over|über|uber)$/i.test(String(o.name || "").trim()));
    if (!over) continue;
    const value = parseOddsNumber(over.odds ?? over.price ?? over.trueOdds);
    if (Number.isNaN(value) || value <= 0) continue;

    let playerName = guessPlayerFromMarketName(marketName);
    if (!playerName && market.templatePlayerName) playerName = String(market.templatePlayerName).trim();
    if (!playerName) continue;

    const line = extractLineFromMarketName(marketName);
    if (!line) continue;

    const label = inferMarketLabelFromName(marketName);
    const marketType = normalizeStakeMarketToken(`${label} ${line}+ Points`);
    if (!marketType) continue;

    const category = `${marketType}:${normalizeDetailToken(playerName)}`;
    const key = `${category}|${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, category, value });
  }

  return out;
}
