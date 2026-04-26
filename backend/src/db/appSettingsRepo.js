import { query } from "./pool.js";

const STAKE_ODDS_API_KEY = "stake_odds_api_key";

export async function getAppSetting(key) {
  const { rows } = await query(`SELECT value FROM app_settings WHERE key = $1 LIMIT 1`, [key]);
  return rows[0]?.value ?? "";
}

export async function setAppSetting(key, value) {
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
}

export async function getStakeOddsApiKey() {
  const v = await getAppSetting(STAKE_ODDS_API_KEY);
  return String(v || "").trim();
}

export async function setStakeOddsApiKey(value) {
  await setAppSetting(STAKE_ODDS_API_KEY, String(value ?? "").trim());
}
