import { replaceMatchWebsiteInfos } from "../db/matchWebsiteRepo.js";
import { getWebsiteById, listWebsites } from "../db/websiteRepo.js";
import { parseApiKeysField, pickRotatingApiKey } from "../lib/apiKeyRotation.js";
import { fetchNbaFixturesList } from "../lib/stakeOddsDataClient.js";
import { isStakeHostUrl } from "../lib/stakeHosts.js";
import { env } from "../config/env.js";

/**
 * Pulls NBA fixtures from odds-data.stake.com and repopulates match_website_infos for a Stake site row.
 * @param {{ websiteId?: number | string, apiKeyOverride?: string }} [options]
 */
export async function syncNbaStakeFixturesToMatchWebsiteInfos(options = {}) {
  const sites = await listWebsites();
  let site = null;
  if (options.websiteId != null && options.websiteId !== "") {
    site = await getWebsiteById(options.websiteId);
  }
  if (!site) {
    site = sites.find((w) => isStakeHostUrl(w.url) && Number(w.scrape_type) === 1);
  }
  if (!site) {
    site = sites.find((w) => isStakeHostUrl(w.url));
  }
  if (!site) {
    throw new Error(
      "No Stake row in website_infos. Add a site whose URL is on stake.com, then sync again."
    );
  }
  const keys = parseApiKeysField(site.api_keys);
  const apiKey =
    pickRotatingApiKey(keys) ||
    String(options.apiKeyOverride || "").trim() ||
    env.stakeOddsApiKey;
  if (!apiKey) {
    throw new Error(
      "Missing API key: set api_keys on the Stake website row (scrape_type = API), pass apiKeyOverride, or set STAKE_ODDS_API_KEY."
    );
  }
  const data = await fetchNbaFixturesList(apiKey);
  const fixtures = Array.isArray(data.fixtures) ? data.fixtures : [];
  const rows = fixtures
    .filter((f) => f && f.slug && f.name)
    .map((f) => ({
      name: String(f.name).trim(),
      url: `https://stake.com/de/sports/basketball/usa/nba/${String(f.slug).replace(/^\/+/, "")}`
    }));
  await replaceMatchWebsiteInfos(site.url, rows);
  return { website: site.url, count: rows.length };
}
