import { env } from "../config/env.js";
import { query } from "./pool.js";

export async function upsertComparedInfo(item) {
  const {
    name,
    baselineMatchUrl,
    comparisonMatchUrl,
    category,
    baselineValue,
    comparisonValue,
    arbitrage
  } = item;

  await query(
    `INSERT INTO compared_infos (
       name, baseline_match_url, comparison_match_url, category,
       baseline_value, comparison_value, arbitrage, timestamp
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (name, baseline_match_url, comparison_match_url, category)
     DO UPDATE
     SET baseline_value = EXCLUDED.baseline_value,
         comparison_value = EXCLUDED.comparison_value,
         arbitrage = EXCLUDED.arbitrage,
         timestamp = NOW()`,
    [name, baselineMatchUrl, comparisonMatchUrl, category, baselineValue, comparisonValue, arbitrage]
  );
}

export async function getDashboardRows(thresholdPercent = 0) {
  const threshold = Number.isFinite(Number(thresholdPercent))
    ? Math.max(0, Number(thresholdPercent))
    : 0;
  const timeFilter = env.disableOdds10mDeadline
    ? ""
    : "WHERE timestamp > NOW() - INTERVAL '10 minutes'";
  const thresholdFilter = `comparison_value > baseline_value * (1 + ${threshold} / 100.0)`;
  const whereClause = timeFilter ? `${timeFilter} AND ${thresholdFilter}` : `WHERE ${thresholdFilter}`;
  const { rows } = await query(
    `SELECT id, name, baseline_match_url, comparison_match_url, category,
            baseline_value, comparison_value, arbitrage, timestamp
     FROM compared_infos
     ${whereClause}
     ORDER BY arbitrage DESC, timestamp DESC`
  );
  return rows;
}
