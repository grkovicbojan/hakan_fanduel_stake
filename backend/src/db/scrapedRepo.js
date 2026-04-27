import { query } from "./pool.js";

export async function upsertScrapedInfo({ url, data, timestamp }) {
  const { rows } = await query(
    `INSERT INTO scraped_infos (url, result, timestamp)
     VALUES ($1, $2, $3)
     ON CONFLICT (url)
     DO UPDATE SET
       result = EXCLUDED.result,
       timestamp = EXCLUDED.timestamp
     WHERE scraped_infos.timestamp < EXCLUDED.timestamp
     RETURNING *`,
    [url, data, timestamp]
  );
  return rows[0] || null;
}

/** Latest scrape row for this website config URL (handles root vs /navigation/... tab URLs). */
export async function getScrapedByUrl(siteUrl) {
  console.log("siteUrl", siteUrl);
  const u = siteUrl?.trim();
  console.log("u", u);
  if (!u) return null;
  const { rows } = await query(
    `SELECT si.*
     FROM scraped_infos si
     WHERE si.url = $1
        OR si.url LIKE rtrim($1, '/') || '/%'
        OR rtrim($1, '/') LIKE rtrim(si.url, '/') || '/%'
     ORDER BY si.timestamp DESC NULLS LAST
     LIMIT 1`,
    [u]
  );
  return rows[0] || null;
}
