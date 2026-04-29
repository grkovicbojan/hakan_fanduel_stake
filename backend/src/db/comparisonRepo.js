import { env } from "../config/env.js";
import { query } from "./pool.js";

export async function upsertComparedInfo(item) {
  const {
    name,
    baselineMatchUrl,
    comparisonMatchUrl,
    category,
    baselineValue,  
    baselineTimestamp,  
    comparisonValue,
    comparisonTimestamp,
    arbitrage
  } = item;

  await query(
    `INSERT INTO compared_infos (
       name, baseline_match_url, comparison_match_url, category,
       baseline_value, baseline_timestamp, comparison_value, comparison_timestamp, arbitrage, timestamp, updated_time
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
     ON CONFLICT (name, baseline_match_url, comparison_match_url, category)
     DO UPDATE
     SET baseline_value = EXCLUDED.baseline_value,
         comparison_value = EXCLUDED.comparison_value,
         arbitrage = EXCLUDED.arbitrage,
         baseline_timestamp = EXCLUDED.baseline_timestamp,
         comparison_timestamp = EXCLUDED.comparison_timestamp,
         updated_time = NOW()`,
    [name, baselineMatchUrl, comparisonMatchUrl, category, baselineValue, baselineTimestamp, comparisonValue, comparisonTimestamp, arbitrage]
  );
}

export async function getDashboardRows(thresholdPercent = 0) {
  const threshold = Number.isFinite(Number(thresholdPercent))
    ? Math.max(0, Number(thresholdPercent)) + 100
    : 100;
  const timeFilter = env.disableOdds10mDeadline
    ? ""
    : "WHERE updated_time > NOW() - INTERVAL '10 minutes' AND baseline_timestamp > NOW() - INTERVAL '10 minutes'  AND comparison_timestamp > NOW() - INTERVAL '10 minutes'";
  const thresholdFilter = `arbitrage > ${threshold}`;
  const whereClause = timeFilter ? `${timeFilter} AND ${thresholdFilter}` : `WHERE ${thresholdFilter}`;
  const { rows } = await query(
    `SELECT id, name, baseline_match_url, comparison_match_url, category,
            baseline_value, comparison_value, arbitrage, timestamp, updated_time, baseline_timestamp, comparison_timestamp,
            COALESCE(
              (SELECT MIN(mwi.start_time) FROM match_website_infos mwi WHERE mwi.url = compared_infos.baseline_match_url),
              (SELECT MIN(mwi.start_time) FROM match_website_infos mwi WHERE mwi.url = compared_infos.comparison_match_url)
            ) AS start_time
     FROM compared_infos
     ${whereClause}
     ORDER BY arbitrage DESC, updated_time DESC`
  );
  return rows;
}
