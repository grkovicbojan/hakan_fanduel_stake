import { replaceMatchWebsiteInfos } from "../db/matchWebsiteRepo.js";
import { listWebsites } from "../db/websiteRepo.js";
import { fetchNbaFixturesList } from "../lib/stakeOddsDataClient.js";
import { isStakeHostUrl } from "../lib/stakeHosts.js";

/**
 * Pulls NBA fixtures from odds-data.stake.com and repopulates match_website_infos for the first Stake site row.
 * @param {string} apiKey
 */
export async function syncNbaStakeFixturesToMatchWebsiteInfos(apiKey) {
  const data = await fetchNbaFixturesList(apiKey);
  const fixtures = Array.isArray(data.fixtures) ? data.fixtures : [];
  const sites = await listWebsites();
  const stakeRoot = sites.find((w) => isStakeHostUrl(w.url));
  if (!stakeRoot) {
    throw new Error(
      "No Stake row in website_infos. Add a site whose URL is on stake.com, then sync again."
    );
  }
  const rows = fixtures
    .filter((f) => f && f.slug && f.name)
    .map((f) => ({
      name: String(f.name).trim(),
      url: `https://stake.com/de/sports/basketball/usa/nba/${String(f.slug).replace(/^\/+/, "")}`
    }));
  await replaceMatchWebsiteInfos(stakeRoot.url, rows);
  return { website: stakeRoot.url, count: rows.length };
}
