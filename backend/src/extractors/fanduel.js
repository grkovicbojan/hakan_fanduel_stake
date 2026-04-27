/**
 * Fanduel sportsbook extractor, sportsbook.fanduel.com
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

function isFanduelSportsbook(siteUrl) {
    return siteHostname(siteUrl) === "sportsbook.fanduel.com";
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
        return false;
    } catch {
        return false;
    }
}

/**
 * FanDuel JSON-LD often uses host-only paths (no scheme), e.g.
 * "sportsbook.fanduel.com/basketball/nba/team-a-@-team-b-35521856".
 */
function normalizePotentialMatchUrl(raw, siteUrl) {
    const t = String(raw || "").trim();
    if (!t) return null;
    if (/^https?:\/\//i.test(t)) {
        try {
            return new URL(t).href;
        } catch {
            return null;
        }
    }
    if (/^sportsbook\.fanduel\.com\//i.test(t)) {
        try {
            return new URL(`https://${t}`).href;
        } catch {
            return null;
        }
    }
    if (t.startsWith("//")) {
        try {
            return new URL(`https:${t}`).href;
        } catch {
            return null;
        }
    }
    try {
        return new URL(t, siteUrl).href;
    } catch {
        return null;
    }
}


export function extractFanduelSportbookMatches(html, websiteUrl) {
    const fromJson = extractFromScriptJson(html, websiteUrl);
    const fromAnchors = extractFromAnchors(html, websiteUrl);
    const merged = dedupeMatches([...fromJson, ...fromAnchors]);
    const filtered = applySiteSpecificFilters(merged, websiteUrl);
    const result = dedupeByCanonicalMatchUrl(filtered);
    return result;
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
    return rows;
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
            map.set(canon, { matchUrl: canon, matchName: nm || "" });
        }
    }
    return [...map.values()];
}

function extractFromScriptJson(html, siteUrl) {
    const out = [];
    const body = String(html || "").trim();

    // Some extension payloads are raw JSON-LD arrays/objects (no <script> wrapper).
    if ((body.startsWith("{") || body.startsWith("[")) && body.length <= 4_000_000) {
        try {
            const parsed = JSON.parse(body);
            walkJsonForMatches(parsed, 0, siteUrl, out, new WeakSet());
            return out;
        } catch {
            // continue to script tag scan fallback
        }
    }

    const scriptTag = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = scriptTag.exec(html))) {
        const scriptBody = m[1].trim();
        if (!scriptBody.startsWith("{") && !scriptBody.startsWith("[")) continue;
        if (scriptBody.length > 4_000_000) continue;
        try {
            const parsed = JSON.parse(scriptBody);
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


/**
 * Pull candidate objects from parsed JSON (embedded in HTML).
 * Looks for sibling-like fields: a display name + a URL (absolute or FanDuel host-only) on the same host.
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
        if (URL_KEYS.has(k)) {
            const abs = normalizePotentialMatchUrl(t, siteUrl);
            if (abs && sameHost(abs, siteUrl) && !IGNORE_PATH.test(new URL(abs).pathname)) {
                url = abs;
            }
        }
    }

    if (name && url && !IGNORE_PATH.test(new URL(url).pathname)) {
        out.push({ matchName: name, matchUrl: url });
    }

    if (typeof node === "object") {
        for (const v of Object.values(node)) walkJsonForMatches(v, depth + 1, siteUrl, out, stack);
    }
}


function canonicalizeMatchUrl(url) {
    if (!url || typeof url !== "string") return "";
    try {
        const u = new URL(url);
        u.search = "";
        u.hash = "";
        let host = u.hostname.toLowerCase();
        if (host.startsWith("www.")) host = host.slice(4);
        let path = u.pathname.replace(/\/+$/, "") || "/";
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


export function extractFanduelSportbookDetails(html, websiteUrl) {
    const out = [];
    const seen = new Set();
    const ariaLabelAttrRe = /aria-label="([^"]+)"/gi;
    let m;
    let currentMarketContext = "";
    while ((m = ariaLabelAttrRe.exec(html))) {
        const raw = decodeHtmlEntities(String(m[1] || "")).trim();
        if (!raw) continue;

        const parsed = parseFanduelAriaLabel(raw, currentMarketContext);
        if (parsed?.kind === "market_header") {
            currentMarketContext = parsed.market;
            continue;
        }
        if (!parsed || parsed.kind !== "selection") continue;

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

function parseFanduelAriaLabel(rawLabel, currentMarketContext) {
    const label = String(rawLabel || "").trim();
    if (!label) return null;

    // Group headers like "Player Points", used as context for rows such as:
    // "Victor Wembanyama, Over 26.5, +100 Odds"
    if (!/odds|over|under|,| - /i.test(label)) {
        const market = marketPrefixFromLabel(label);
        if (!market) return null;
        return { kind: "market_header", market };
    }

    // Form 1: "Victor Wembanyama, Over 26.5, +100 Odds"
    const overUnderRow = label.match(
        /^([^,]+),\s*(Over|Under)\s*([0-9]+(?:[.,][0-9]+)?),\s*([+-]?\d+)(?:\s*Odds)?$/i
    );
    if (overUnderRow) {
        const playerRaw = overUnderRow[1];
        const line = Number.parseFloat(overUnderRow[3].replace(",", "."));
        const value = Number.parseInt(overUnderRow[4], 10);
        const player = normalizeDetailToken(playerRaw);
        const marketPrefix = marketPrefixFromLabel(currentMarketContext);
        if (!marketPrefix || !looksLikePlayerName(player) || Number.isNaN(line) || Number.isNaN(value)) {
            return null;
        }
        return {
            kind: "selection",
            category: `${marketPrefix}${formatLineNumber(line)}+Points:${player}`,
            value
        };
    }

    // Form 2: "Stephon Castle - Alt Points, 10.5 Over, -750 Odds"
    const dashRow = label.match(
        /^(.+?)\s*-\s*([^,]+),\s*([0-9]+(?:[.,][0-9]+)?)\s*(Over|Under),\s*([+-]?\d+)(?:\s*Odds)?$/i
    );
    if (dashRow) {
        const playerRaw = dashRow[1];
        const marketRaw = dashRow[2];
        const line = Number.parseFloat(dashRow[3].replace(",", "."));
        const value = Number.parseInt(dashRow[5], 10);
        const player = normalizeDetailToken(playerRaw);
        const marketPrefix = marketPrefixFromLabel(marketRaw);
        if (!marketPrefix || !looksLikePlayerName(player) || Number.isNaN(line) || Number.isNaN(value)) {
            return null;
        }
        return {
            kind: "selection",
            category: `${marketPrefix}${formatLineNumber(line)}+Points:${player}`,
            value
        };
    }

    return null;
}

function marketPrefixFromLabel(raw) {
    const text = decodeHtmlEntities(String(raw || ""))
        .trim()
        .replace(/\s+/g, " ");
    if (!text) return "";
    return normalizeDetailToken(text.replace(/[^\w\s+.-]/g, ""));
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
