/**
 * @typedef {{ matchName: string, matchUrl: string }} ExtractedMatch
 */

const NAME_KEYS = new Set([
  "name",
  "title",
  "eventName",
  "matchName",
  "competitionName",
  "eventTitle",
  "displayName",
  "label"
]);
const URL_KEYS = new Set(["url", "href", "link", "deepLink", "eventUrl", "canonicalUrl", "webUrl"]);

/** Paths that are almost never a single “match” row we want to track. */
const IGNORE_PATH = /navigation|account|login|register|promo|help|static|assets|\.(js|css|map|ico|png|jpg|svg)(\?|$)/i;

/** Paths that often indicate a concrete event / game / market page. */
const MATCH_PATH_HINT =
  /\/(event|events|game|games|fixture|fixtures|contest|competition|match|sb\/|sport\/|sports\/|league\/|nba\/|ncaab\/|wnba\/)/i;

function siteHostname(siteUrl) {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return "";
  }
}

function resolveHref(siteUrl, href) {
  if (!href || href.startsWith("javascript:") || href === "#") return null;
  try {
    return new URL(href, siteUrl).href;
  } catch {
    return null;
  }
}

function sameHost(a, siteUrl) {
  try {
    const ha = new URL(a).hostname.toLowerCase();
    const hs = new URL(siteUrl).hostname.toLowerCase();
    if (ha === hs) return true;
    if (isStakeHostname(ha) && isStakeHostname(hs)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Pull candidate objects from parsed JSON (embedded in HTML).
 * Looks for sibling-like fields: a display name + an absolute http(s) URL on the same host.
 */
function walkJsonForMatches(node, depth, siteUrl, out, stack) {
  if (depth > 35 || node == null) return;
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") return;

  if (typeof node === "object") {
    if (stack.has(node)) return;
    stack.add(node);
  }

  if (Array.isArray(node)) {
    for (const item of node) walkJsonForMatches(item, depth + 1, siteUrl, out, stack);
    return;
  }

  let name;
  let url;
  for (const [k, v] of Object.entries(node)) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t) continue;
    if (NAME_KEYS.has(k) && t.length > 1 && t.length < 220 && !/^https?:\/\//i.test(t)) {
      if (!name || t.length > name.length) name = t;
    }
    if (URL_KEYS.has(k) && /^https?:\/\//i.test(t) && sameHost(t, siteUrl)) {
      if (!IGNORE_PATH.test(new URL(t).pathname)) url = t;
    }
  }

  if (name && url && !IGNORE_PATH.test(new URL(url).pathname)) {
    out.push({ matchName: name, matchUrl: url });
  }

  if (typeof node === "object") {
    for (const v of Object.values(node)) walkJsonForMatches(v, depth + 1, siteUrl, out, stack);
  }
}

function extractFromScriptJson(html, siteUrl) {
  const out = [];
  const scriptTag = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptTag.exec(html))) {
    const body = m[1].trim();
    if (!body.startsWith("{") && !body.startsWith("[")) continue;
    if (body.length > 4_000_000) continue;
    try {
      const parsed = JSON.parse(body);
      walkJsonForMatches(parsed, 0, siteUrl, out, new WeakSet());
    } catch {
      /* not JSON */
    }
  }
  return out;
}

function extractFromAnchors(html, siteUrl) {
  const host = siteHostname(siteUrl);
  if (!host) return [];

  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  const out = [];
  const seen = new Set();
  let m;
  while ((m = hrefRe.exec(html))) {
    const abs = resolveHref(siteUrl, m[1]);
    if (!abs || seen.has(abs)) continue;
    if (!sameHost(abs, siteUrl)) continue;
    const { pathname } = new URL(abs);
    if (IGNORE_PATH.test(pathname)) continue;
    if (pathname.length < 12) continue;
    if (!MATCH_PATH_HINT.test(pathname) && !/\/[A-Za-z0-9_-]{10,}\b/.test(pathname)) continue;

    seen.add(abs);
    const segment =
      pathname
        .replace(/\/+$/, "")
        .split("/")
        .filter(Boolean)
        .pop() || "event";
    const matchName = decodeURIComponent(segment.replace(/[-_]+/g, " ").slice(0, 120));
    out.push({ matchName, matchUrl: abs });
  }
  return out;
}

function dedupeMatches(rows) {
  const byUrl = new Map();
  for (const row of rows) {
    const u = row.matchUrl;
    if (!u) continue;
    const prev = byUrl.get(u);
    if (!prev) byUrl.set(u, row);
  }
  return [...byUrl.values()];
}

/** Same logical event: strip query/hash, lowercase host, drop www, Stake strips /{ll}/ before /sports/. */
function canonicalizeMatchUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    let path = u.pathname.replace(/\/+$/, "") || "/";
    if (host === "stake.com") {
      path = normalizeStakePathname(path).replace(/\/+$/, "") || "/";
      if (path.startsWith("/sports/")) {
        return `https://stake.com/de${path}`;
      }
      return `https://stake.com${path}`;
    }
    return `https://${host}${path}`;
  } catch {
    return url.trim();
  }
}

/** Collapse rows that differ only by locale prefix, www, utm params, hash, trailing slash. */
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

function dedupeByCanonicalMatchUrl(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r?.matchUrl || typeof r.matchUrl !== "string") continue;
    const canon = canonicalizeMatchUrl(r.matchUrl);
    if (!canon) continue;
    const nm = normalizeFinalMatchName(r.matchName);
    const prev = map.get(canon);
    if (!prev) {
      map.set(canon, { matchUrl: canon, matchName: nm || prev?.matchName || "" });
    }
  }
  return [...map.values()];
}

function isStakeHostname(host) {
  if (!host || typeof host !== "string") return false;
  const h = host.toLowerCase();
  return h === "stake.com" || h === "www.stake.com" || h.endsWith(".stake.com");
}

/** Tab is on stake.com (or www). */
function isStakeSite(siteUrl) {
  return isStakeHostname(siteHostname(siteUrl));
}

/** Output URL for Stake DE sports hub: always https://stake.com/de/sports/… (locale stripped then /de re-applied). */
function stakeDeSportsGermanFixtureUrl(url) {
  try {
    const u = new URL(url);
    if (!isStakeHostname(u.hostname)) return url;
    u.search = "";
    u.hash = "";
    const path = normalizeStakePathname(u.pathname).replace(/\/+$/, "") || "/";
    return `https://stake.com/de${path}`;
  } catch {
    return url;
  }
}

/** /de/sports/... → /sports/... (Stake locale prefix before sports) */
function normalizeStakePathname(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && /^[a-z]{2}$/i.test(parts[0]) && parts[1] === "sports") {
    return `/${parts.slice(1).join("/")}`;
  }
  return `/${parts.join("/")}`.replace(/\/+/g, "/") || "/";
}

/** Fixture row: …/sports/…/ & last segment `46467331-team-slug` */
function isStakeFixtureUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (!isStakeHostname(u.hostname)) return false;
    const norm = normalizeStakePathname(u.pathname);
    if (!/\/sports\//i.test(norm)) return false;
    const seg = norm.split("/").filter(Boolean).pop() || "";
    return /^\d{5,}-[a-z0-9-]+$/i.test(seg);
  } catch {
    return false;
  }
}

/**
 * stake.com (any entry path/locale): numeric-id fixture links only, one row per game.
 * Always canonicalize to `https://stake.com/de/sports/...` for one unified Stake workflow.
 */
function filterStakeMatches(rows) {
  const byCanon = new Map();
  for (const r of rows) {
    if (!r.matchUrl || !isStakeFixtureUrl(r.matchUrl)) continue;
    const canon = stakeDeSportsGermanFixtureUrl(r.matchUrl);
    const nm = typeof r.matchName === "string" ? r.matchName.trim() : "";
    const prev = byCanon.get(canon);
    if (!prev) {
      byCanon.set(canon, { matchUrl: canon, matchName: nm || prev?.matchName || "" });
    }
  }
  return [...byCanon.values()];
}

/** FanDuel NBA-style event slugs use "@" in the label and "-@-" in the path (e.g. raptors @ cavaliers). */
function isFanduelSportsbook(siteUrl) {
  return siteHostname(siteUrl) === "sportsbook.fanduel.com";
}

function isTipicoSports(siteUrl) {
  return siteHostname(siteUrl) === "sports.tipico.de";
}

/** e.g. /de/event/705220610 — numeric event id in path */
function isTipicoEventUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (u.hostname !== "sports.tipico.de") return false;
    return /\/event\/\d+/.test(u.pathname);
  } catch {
    return false;
  }
}

/** e.g. "Cleveland Cavaliers - Toronto Raptors" (Tipico SEO / link titles) */
function isTipicoMatchName(name) {
  if (!name || typeof name !== "string") return false;
  const t = name.trim();
  if (t.length < 8 || t.length > 220) return false;
  return /\s-\s/.test(t);
}

function applySiteSpecificFilters(rows, siteUrl) {
  if (isFanduelSportsbook(siteUrl)) {
    return rows.filter(
      (r) =>
        typeof r.matchName === "string" &&
        typeof r.matchUrl === "string" &&
        r.matchName.includes("@") &&
        r.matchUrl.includes("@")
    );
  }
  if (isTipicoSports(siteUrl)) {
    return rows.filter(
      (r) =>
        typeof r.matchName === "string" &&
        typeof r.matchUrl === "string" &&
        isTipicoEventUrl(r.matchUrl) &&
        isTipicoMatchName(r.matchName)
    );
  }
  if (isStakeSite(siteUrl)) {
    return filterStakeMatches(rows);
  }
  return rows;
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

  const fromJson = extractFromScriptJson(html, websiteUrl);
  const fromAnchors = extractFromAnchors(html, websiteUrl);
  const merged = dedupeMatches([...fromJson, ...fromAnchors]);
  const filtered = applySiteSpecificFilters(merged, websiteUrl);
  const result = dedupeByCanonicalMatchUrl(filtered);

  return result;
}

export function extractDetailFromWebsite(html, websiteUrl) {
  if (!html || typeof html !== "string") return [];
  if (isStakeSite(websiteUrl)) {
    return [];
  }
  if (isFanduelSportsbook(websiteUrl)) {
    return extractFanduelSportbookDetails(html, websiteUrl);
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
