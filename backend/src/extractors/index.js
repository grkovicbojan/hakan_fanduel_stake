/**
 * @typedef {{ matchName: string, matchUrl: string }} ExtractedMatch
 */

function siteHostname(siteUrl) {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return "";
  }
}

/** FanDuel NBA-style event slugs use "@" in the label and "-@-" in the path (e.g. raptors @ cavaliers). */
function isFanduelSportsbook(siteUrl) {
  return siteHostname(siteUrl) === "sportsbook.fanduel.com";
}

function isStakeSportsbook(siteUrl) {
  return siteHostname(siteUrl) === "stake.com";
}

/**
 * Best-effort extraction of “matches” (games / events) from scraped sportsbook HTML.
 * Uses (1) JSON inside <script> tags and (2) same-host links as fallbacks.
 *
 * @param {string} html — raw HTML from scraped_infos.result
 * @param {string} websiteUrl — tab URL used for resolving relative links and host filter
 * @returns {ExtractedMatch[]}
 */
export function extractMatchFromWebsite(html, websiteUrl) {
  if (!html || typeof html !== "string" || !websiteUrl) return [];

  if (isFanduelSportsbook(websiteUrl)) {
    return extractFanduelSportbookMatches(html, websiteUrl);
  }

  return [];
}

export function extractMatchFromAPI(websiteUrl) {
  if (!websiteUrl || typeof websiteUrl !== "string") return [];
  if (isStakeSportsbook(websiteUrl)) {
    return extractStakeSportbookMatches(websiteUrl);
  }
  return [];
}

export function extractDetailFromWebsite(html, websiteUrl) {
  if (!html || typeof html !== "string") return [];
  if (isFanduelSportsbook(websiteUrl)) {
    return extractFanduelSportbookDetails(html, websiteUrl);
  }
  return [];
}
export function extractDetailFromAPI(websiteUrl) {
  if (!websiteUrl || typeof websiteUrl !== "string") return [];
  if (isStakeSportsbook(websiteUrl)) {
    return extractStakeSportbookDetails(websiteUrl);
  }
  return [];
}

function extractFanduelSportbookDetails(html, websiteUrl) {
  const out = [];
  const seen = new Set();
  const labelRe = /aria-label="([^",]+),\s*([^",]+),\s*([+-]\d+)(?:\s*Odds)?"/gi;
  let m;

  while ((m = labelRe.exec(html))) {
    const marketType = normalizeDetailToken(m[1]);
    const playerName = normalizeDetailToken(m[2]);
    const value = Number.parseInt(m[3], 10);
    if (!marketType || !playerName || Number.isNaN(value)) continue;
    if (!looksLikePlayerName(playerName)) continue;

    const category = `${marketType}:${playerName}`;
    const key = `${category}|${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: websiteUrl, category, value });
  }

  // Locale-safe fallback: parse raw aria-label attributes and normalize DE/EN market text.
  const ariaLabelAttrRe = /aria-label="([^"]+)"/gi;
  while ((m = ariaLabelAttrRe.exec(html))) {
    const parsed = parseFanduelAriaLabel(m[1]);
    if (!parsed) continue;
    const key = `${parsed.category}|${parsed.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      url: websiteUrl,
      category: parsed.category,
      value: parsed.value
    });
  }

  return out;
}

function parseFanduelAriaLabel(rawLabel) {
  const decoded = decodeHtmlEntities(String(rawLabel || "")).trim();
  if (!decoded) return null;

  const parts = decoded
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;

  const oddToken = parts[parts.length - 1];
  const oddMatch = oddToken.match(/([+-]\d+|\d+(?:[.,]\d+)?)(?:\s*(?:odds|quote|quoten))?$/i);
  if (!oddMatch) return null;
  const value = Number.parseFloat(oddMatch[1].replace(",", "."));
  if (Number.isNaN(value)) return null;

  const playerName = normalizeDetailToken(parts[parts.length - 2]);
  if (!looksLikePlayerName(playerName)) return null;

  const marketRaw = parts.slice(0, -2).join(", ");
  const marketType = normalizeFanduelMarketToken(marketRaw);
  if (!marketType) return null;

  return { category: `${marketType}:${playerName}`, value };
}

function normalizeFanduelMarketToken(raw) {
  const text = decodeHtmlEntities(String(raw || ""))
    .trim()
    .replace(/\s+/g, " ");
  if (!text) return "";

  // Canonicalize common localized "To Score X+ Points" variants to one stable key.
  const toScoreMatch = text.match(
    /(to\s*score|punkte?\s*erzielen|erzielt?\s*punkte?)\s*(\d+(?:[.,]\d+)?)\+\s*(points?|punkte?)?/i
  );
  if (toScoreMatch) {
    const line = Number.parseFloat(toScoreMatch[2].replace(",", "."));
    if (!Number.isNaN(line)) {
      return `ToScore${formatLineNumber(line)}+Points`;
    }
  }

  return normalizeDetailToken(text);
}

function formatLineNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(value).replace(/\.?0+$/, "");
}

function decodeHtmlEntities(s) {
  return String(s || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}
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
