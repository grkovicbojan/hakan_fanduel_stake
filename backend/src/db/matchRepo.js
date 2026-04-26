import { query } from "./pool.js";

export async function getPendingMatchIds(limit = 500) {
  const { rows } = await query(
    `SELECT id
     FROM match_infos
     WHERE status = 0
       AND baseline_url <> ''
       AND comparison_url <> ''
       AND name <> ''
       AND baseline_match_url <> ''
       AND comparison_match_url <> ''
     ORDER BY timestamp DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((row) => row.id);
}

export async function getMatchById(id) {
  const { rows } = await query(
    `SELECT * FROM match_infos WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function markMatchCompared(id) {
  await query(
    `UPDATE match_infos
     SET status = 1, timestamp = NOW()
     WHERE id = $1`,
    [id]
  );
}

export async function deleteStaleMatches(siteUrl, validNames) {
  if (validNames.length === 0) {
    await query(
      `DELETE FROM match_infos
       WHERE baseline_url = $1 OR comparison_url = $1`,
      [siteUrl]
    );
    return;
  }
  await query(
    `DELETE FROM match_infos
     WHERE (baseline_url = $1 OR comparison_url = $1)
       AND NOT (name = ANY($2::text[]))`,
    [siteUrl, validNames]
  );
}

export async function upsertMatchRecord(match) {
  const {
    baselineUrl,
    comparisonUrl,
    name,
    baselineMatchUrl,
    comparisonMatchUrl
  } = match;

  await query(
    `INSERT INTO match_infos (baseline_url, comparison_url, name, baseline_match_url, comparison_match_url, status, timestamp)
     VALUES ($1, $2, $3, $4, $5, 0, NOW())
     ON CONFLICT (baseline_url, comparison_url, name) DO NOTHING`,
    [baselineUrl, comparisonUrl, name, baselineMatchUrl, comparisonMatchUrl]
  );

  await query(
    `UPDATE match_infos
     SET baseline_match_url = CASE WHEN $4 <> '' THEN $4 ELSE baseline_match_url END,
         comparison_match_url = CASE WHEN $5 <> '' THEN $5 ELSE comparison_match_url END,
         status = 0,
         timestamp = NOW()
     WHERE baseline_url = $1
       AND comparison_url = $2
       AND name = $3
       AND (
         ($4 <> '' AND baseline_match_url IS DISTINCT FROM $4)
         OR
         ($5 <> '' AND comparison_match_url IS DISTINCT FROM $5)
       )`,
    [baselineUrl, comparisonUrl, name, baselineMatchUrl, comparisonMatchUrl]
  );
}

export async function getUniqueMatchUrlsForWebsite(url) {
  const { rows } = await query(
    `SELECT DISTINCT baseline_match_url AS match_url
     FROM match_infos
     WHERE baseline_url = $1 AND baseline_match_url <> ''
     UNION
     SELECT DISTINCT comparison_match_url AS match_url
     FROM match_infos
     WHERE comparison_url = $1 AND comparison_match_url <> ''`,
    [url]
  );
  return rows.map((row) => row.match_url);
}

/** Distinct Stake fixture page URLs used as comparison sides (backend Odds Data API polling). */
export async function listDistinctStakeComparisonFixtureUrls(limit = 500) {
  const { rows } = await query(
    `SELECT DISTINCT comparison_match_url AS url
     FROM match_infos
     WHERE comparison_match_url <> ''
       AND (comparison_match_url ILIKE '%stake.com%' OR comparison_match_url ILIKE '%stake.de%')
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => r.url).filter(Boolean);
}
