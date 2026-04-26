import { query } from "./pool.js";

export async function upsertOddInfos(items) {
  for (const item of items) {
    await query(
      `INSERT INTO odd_infos (url, category, value, timestamp)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (url, category)
       DO UPDATE SET value = EXCLUDED.value, timestamp = NOW()`,
      [item.url, item.category, item.value]
    );
  }
}

export async function getOddsByUrl(url) {
  const { rows } = await query(
    `SELECT url, category, value, timestamp
     FROM odd_infos
     WHERE url = $1`,
    [url]
  );
  return rows;
}
