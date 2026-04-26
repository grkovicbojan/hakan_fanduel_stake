import { query } from "./pool.js";

export async function listWebsites() {
  const { rows } = await query(
    `SELECT id, url, type, scrape_interval, refresh_interval, comparison_website_list, created_at, updated_at
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

export async function createWebsite(payload) {
  const { url, type = "B", scrapeInterval = 10, refreshInterval = 300, comparisonWebsiteList = "" } = payload;
  const { rows } = await query(
    `INSERT INTO website_infos (url, type, scrape_interval, refresh_interval, comparison_website_list, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING *`,
    [url, type, scrapeInterval, refreshInterval, comparisonWebsiteList]
  );
  return rows[0];
}

export async function updateWebsite(id, payload) {
  const { url, type, scrapeInterval, refreshInterval, comparisonWebsiteList } = payload;
  const { rows } = await query(
    `UPDATE website_infos
     SET url = COALESCE($2, url),
         type = COALESCE($3, type),
         scrape_interval = COALESCE($4, scrape_interval),
         refresh_interval = COALESCE($5, refresh_interval),
         comparison_website_list = COALESCE($6, comparison_website_list),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, url, type, scrapeInterval, refreshInterval, comparisonWebsiteList]
  );
  return rows[0] || null;
}

export async function deleteWebsite(id) {
  const result = await query(`DELETE FROM website_infos WHERE id = $1`, [id]);
  return result.rowCount > 0;
}

/** Resolve website row when the tab URL is the configured URL or a path under it (longest prefix wins). */
export async function findWebsiteByUrl(url) {
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
