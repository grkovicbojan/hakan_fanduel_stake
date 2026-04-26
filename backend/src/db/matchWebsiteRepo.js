import { query } from "./pool.js";

export async function replaceMatchWebsiteInfos(website, rows) {
  const urls = rows.map((r) => r.url);

  await query(
    `DELETE FROM match_website_infos m
     WHERE m.website = $1
       AND NOT EXISTS (
         SELECT 1 FROM unnest($2::text[]) AS u(url) WHERE u.url = m.url
       )`,
    [website, urls]
  );

  if (!rows.length) return;

  const values = [];
  const placeholders = rows
    .map((row, index) => {
      const base = index * 3;
      values.push(website, row.name, row.url);
      return `($${base + 1}, $${base + 2}, $${base + 3})`;
    })
    .join(", ");

  await query(
    `INSERT INTO match_website_infos (website, name, url)
     VALUES ${placeholders}
     ON CONFLICT (website, url) DO UPDATE
     SET name = EXCLUDED.name,
         timestamp = NOW()`,
    values
  );
}

export async function getMatchWebsiteInfosByWebsite(website) {
  const { rows } = await query(
    `SELECT id, website, name, url, timestamp
     FROM match_website_infos
     WHERE website = $1
     ORDER BY name ASC, url ASC`,
    [website]
  );
  return rows;
}

/** All match_website rows with odd count, last extension scrape time, and parent scrape_interval. */
export async function listAllMatchWebsiteInfosWithScrapeStats() {
  const { rows } = await query(
    `SELECT
       mwi.id,
       mwi.website,
       mwi.name,
       mwi.url,
       mwi.timestamp,
       w.scrape_interval,
       si.timestamp AS last_scraped_at,
       COALESCE(
         (SELECT COUNT(*)::int FROM odd_infos o WHERE o.url = mwi.url),
         0
       ) AS extracted_odd_count
     FROM match_website_infos mwi
     LEFT JOIN website_infos w ON w.url = mwi.website
     LEFT JOIN scraped_infos si ON si.url = mwi.url
     ORDER BY mwi.website ASC, mwi.name ASC, mwi.url ASC`
  );
  return rows;
}
