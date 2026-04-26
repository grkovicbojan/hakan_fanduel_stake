import { query } from "./pool.js";

export async function upsertOddInfos(items) {
  if (!items?.length) return;
  const values = [];
  const placeholders = items
    .map((item, index) => {
      const base = index * 3;
      values.push(item.url, item.category, item.value);
      return `($${base + 1}, $${base + 2}, $${base + 3}, NOW())`;
    })
    .join(", ");
  await query(
    `INSERT INTO odd_infos (url, category, value, timestamp)
     VALUES ${placeholders}
     ON CONFLICT (url, category)
     DO UPDATE SET value = EXCLUDED.value, timestamp = NOW()`,
    values
  );
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
