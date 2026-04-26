/**
 * Stake.com sportsbook extractor, stake.com
 */
const STAKE_MATCH_API_URL = "https://odds-data.stake.com/sports/basketball/usa/nba/fixtures";
const STAKE_ODDS_API_URL = "https://odds-data.stake.com/fixtures/";
const AUTHORIZATION_HEADER = "X-API-KEY";
let rr = 0;

export async function extractStakeSportbookMatches(websiteUrl) {
    const apiKeys = await getApiKeysFromWebsite(websiteUrl);
    const apiKey = pickRotatingApiKey(apiKeys);
    const res = await fetch(STAKE_MATCH_API_URL, { headers: headers(apiKey) });
    const text = await res.text();
    if (!res.ok) {
        console.error(`Stake odds-data HTTP ${res.status}: ${text.slice(0, 200)}`);
        return [];
    }
    try {
        const data = JSON.parse(text);
        if (!data.fixtures) {
            console.error("Stake odds-data: no fixtures found");
            return [];
        }

        return data.fixtures.map((item) => ({
            matchName: item.name,
            matchUrl: item.slug,
        }));
    } catch {
        console.error("Stake odds-data: invalid JSON");
        return [];
    }
}

export async function extractStakeSportbookDetails(websiteUrl) {
    const slug = stakeSlugFromPageUrl(websiteUrl);
    if (!slug) {
        logger.warn("EXTRACT_SUB stake: could not parse slug from URL.", { websiteUrl });
        return;
    }
    const site = await resolveStakeWebsiteRowForFixture(websiteUrl);
    if (!site) {
        logger.warn("EXTRACT_SUB stake: no website_infos row for this fixture.", { websiteUrl });
        return;
    }
    if (Number(site.scrape_type) !== 1) {
        logger.warn("EXTRACT_SUB stake: scrape_type is not API (1); skipping odds-data fetch.", {
            websiteUrl,
            websiteId: site.id
        });
        return;
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
        return;
    }
    try {
        const payload = await fetchStakeFixturePayload(slug, apiKey);
        const detailed = oddRowsFromStakeOddsDataPayload(payload, websiteUrl);
        await upsertOddInfos(
            detailed.map((item) => ({
                url: item.url,
                category: item.category,
                value: Number(item.value)
            }))
        );
    } catch (error) {
        logger.error("EXTRACT_SUB stake odds-data failed", { websiteUrl, slug, error: error.message });
        await insertAlert({ type: "stake_odds_data_error", message: error.message, url: websiteUrl });
    }
    return;
}


async function resolveStakeWebsiteRowForFixture(fixturePageUrl) {
    const root = await getComparisonRootUrlForComparisonFixture(fixturePageUrl);
    if (root) {
        const byRoot = await findWebsiteByUrl(root);
        if (byRoot) return byRoot;
    }
    return await findWebsiteByUrl(fixturePageUrl);
}

/**
 * Parse multi-key field: comma- and/or newline-separated, trimmed, non-empty entries.
 * @param {string | null | undefined} text
 * @returns {string[]}
 */
export function parseApiKeysField(text) {
    if (text == null || typeof text !== "string") return [];
    return text
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

/** Round-robin pick for rate-limit spread across keys. */
export function pickRotatingApiKey(keys) {
    if (!keys?.length) return "";
    return keys[rr++ % keys.length];
}

/**
 * @param {{ api_keys?: string | null } | null | undefined} site
 * @param {string} [envFallback]
 */
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
