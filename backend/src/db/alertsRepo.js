import { query } from "./pool.js";

export async function insertAlert(alertData) {
  await query(
    `INSERT INTO alert_infos (alert_data, timestamp)
     VALUES ($1::jsonb, NOW())`,
    [JSON.stringify(alertData)]
  );
}

export async function getAlertsPage(limit = 50, page = 1) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 500));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;

  const [{ rows: countRows }, { rows }] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total FROM alert_infos`),
    query(
      `SELECT id, alert_data, timestamp
       FROM alert_infos
       ORDER BY timestamp DESC
       LIMIT $1 OFFSET $2`,
      [safeLimit, offset]
    )
  ]);

  return {
    rows,
    total: countRows[0]?.total ?? 0,
    page: safePage,
    pageSize: safeLimit
  };
}

export async function getAlerts(limit = 200) {
  const { rows } = await query(
    `SELECT id, alert_data, timestamp
     FROM alert_infos
     ORDER BY timestamp DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}
