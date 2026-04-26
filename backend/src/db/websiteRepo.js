import { query } from "./pool.js";

export const ScrapeTypes = {
  SCRAPE: 0, // scrape the website manually
  API: 1 // use the API to scrape the website
};

/** API-mode sites whose last scrape (per scraped_infos, same URL rules as dashboard) is absent or older than 10s. */
export async function listApiWebsites() {
  const { rows } = await query(
    `SELECT w.url
     FROM website_infos w
     LEFT JOIN LATERAL (
       SELECT MAX(si.timestamp) AS last_scraped_at
       FROM scraped_infos si
       WHERE si.url = w.url
          OR si.url LIKE rtrim(w.url, '/') || '/%'
          OR rtrim(w.url, '/') LIKE rtrim(si.url, '/') || '/%'
     ) ls ON true
     WHERE w.scrape_type = $1
       AND (ls.last_scraped_at IS NULL OR ls.last_scraped_at < NOW() - INTERVAL '1000 seconds')
     ORDER BY w.id DESC`,
    [ScrapeTypes.API]
  );
  return rows;
}

/** API keys string for the longest-prefix website_infos row with scrape_type = API. */
export async function getApiKeysFromWebsite(url) {
  const site = await findWebsiteByUrlAny(url);
  if (!site || Number(site.scrape_type) !== ScrapeTypes.API) return "";
  return String(site.api_keys ?? "");
}

/** Longest-prefix match ignoring scrape_type (baseline wiring / Stake resolution). */
export async function findWebsiteByUrlAny(url) {
  if (!url || typeof url !== "string") return null;
  const { rows } = await query(
    `SELECT *
     FROM website_infos
     WHERE url = $1
        OR $1 LIKE rtrim(url, '/') || '/%'
     ORDER BY length(url) DESC
     LIMIT 1`,
    [url]
  );
  return rows[0] || null;
}

export async function listWebsites() {
  const { rows } = await query(
    `SELECT id, url, type, scrape_interval, refresh_interval, comparison_website_list,
            scrape_type, api_keys, created_at, updated_at
     FROM website_infos
     ORDER BY id DESC`
  );
  return rows;
}

/** Same columns as listWebsites plus last scrape time matched by URL prefix rules (see scrapedRepo). */
export async function listWebsitesWithLastScrape() {
  const { rows } = await query(
    `SELECT
       w.id,
       w.url,
       w.type,
       w.scrape_interval,
       w.refresh_interval,
       w.comparison_website_list,
       w.scrape_type,
       w.api_keys,
       w.created_at,
       w.updated_at,
       ls.last_scraped_at
     FROM website_infos w
     LEFT JOIN LATERAL (
       SELECT MAX(si.timestamp) AS last_scraped_at
       FROM scraped_infos si
       WHERE si.url = w.url
          OR si.url LIKE rtrim(w.url, '/') || '/%'
          OR rtrim(w.url, '/') LIKE rtrim(si.url, '/') || '/%'
     ) ls ON true
     ORDER BY w.id DESC`
  );
  return rows;
}

/** One row per website with last scrape time and match activity (for dashboard / overview). */
export async function listWebsitesWithActivity() {
  const { rows } = await query(
    `SELECT
       w.id,
       w.url,
       w.type,
       w.scrape_interval,
       w.refresh_interval,
       w.comparison_website_list,
       w.scrape_type,
       w.api_keys,
       w.created_at,
       w.updated_at,
       ls.last_scraped_at,
       (SELECT COUNT(*)::int FROM match_infos m
        WHERE m.baseline_url = w.url OR m.comparison_url = w.url) AS match_total,
       (SELECT COUNT(*)::int FROM match_infos m
        WHERE (m.baseline_url = w.url OR m.comparison_url = w.url) AND m.status = 0) AS match_pending
     FROM website_infos w
     LEFT JOIN LATERAL (
       SELECT MAX(si.timestamp) AS last_scraped_at
       FROM scraped_infos si
       WHERE si.url = w.url
          OR si.url LIKE rtrim(w.url, '/') || '/%'
          OR rtrim(w.url, '/') LIKE rtrim(si.url, '/') || '/%'
     ) ls ON true
     ORDER BY w.id DESC`
  );
  return rows;
}

function normalizeScrapeType(value) {
  const n = Number(value);
  return n === 1 ? 1 : 0;
}

export async function createWebsite(payload) {
  const {
    url,
    type = "B",
    scrapeInterval = 10,
    refreshInterval = 300,
    comparisonWebsiteList = "",
    scrapeType: scrapeTypeIn,
    scrape_type,
    apiKeys: apiKeysIn,
    api_keys
  } = payload;
  const scrapeType = normalizeScrapeType(scrapeTypeIn ?? scrape_type ?? 0);
  const apiKeys = String(apiKeysIn ?? api_keys ?? "");
  const { rows } = await query(
    `INSERT INTO website_infos (url, type, scrape_interval, refresh_interval, comparison_website_list, scrape_type, api_keys, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING *`,
    [url, type, scrapeInterval, refreshInterval, comparisonWebsiteList, scrapeType, apiKeys]
  );
  return rows[0];
}

export async function updateWebsite(id, payload) {
  const {
    url,
    type,
    scrapeInterval,
    refreshInterval,
    comparisonWebsiteList,
    scrapeType: scrapeTypeIn,
    scrape_type,
    apiKeys: apiKeysIn,
    api_keys
  } = payload;
  const scrapeType =
    scrapeTypeIn !== undefined && scrapeTypeIn !== null
      ? normalizeScrapeType(scrapeTypeIn)
      : scrape_type !== undefined && scrape_type !== null
        ? normalizeScrapeType(scrape_type)
        : null;
  const apiKeys =
    apiKeysIn !== undefined && apiKeysIn !== null
      ? String(apiKeysIn)
      : api_keys !== undefined && api_keys !== null
        ? String(api_keys)
        : null;
  const { rows } = await query(
    `UPDATE website_infos
     SET url = COALESCE($2, url),
         type = COALESCE($3, type),
         scrape_interval = COALESCE($4, scrape_interval),
         refresh_interval = COALESCE($5, refresh_interval),
         comparison_website_list = COALESCE($6, comparison_website_list),
         scrape_type = COALESCE($7, scrape_type),
         api_keys = COALESCE($8, api_keys),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, url, type, scrapeInterval, refreshInterval, comparisonWebsiteList, scrapeType, apiKeys]
  );
  return rows[0] || null;
}

export async function deleteWebsite(id) {
  const result = await query(`DELETE FROM website_infos WHERE id = $1`, [id]);
  return result.rowCount > 0;
}

/** Resolve website row when the tab URL is the configured URL or a path under it (longest prefix wins). */
export async function findWebsiteByUrl(url, scrapeType = ScrapeTypes.SCRAPE) {
  const { rows } = await query(
    `SELECT *
     FROM website_infos
     WHERE (url = $1 OR $1 LIKE rtrim(url, '/') || '/%')
       AND scrape_type = $2
     ORDER BY length(url) DESC
     LIMIT 1`,
    [url, scrapeType]
  );
  return rows[0] || null;
}

export async function getWebsiteById(id) {
  const { rows } = await query(`SELECT * FROM website_infos WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] || null;
}
