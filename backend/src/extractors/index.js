/**
 * @typedef {{ matchName: string, matchUrl: string }} ExtractedMatch
 */

import { isStakeHostUrl } from "../lib/stakeHosts.js";
import { extractFanduelSportbookMatches, extractFanduelSportbookDetails } from "./fanduel.js";
import { extractStakeSportbookMatches, extractStakeSportbookDetails } from "./stake.js";

function siteHostname(siteUrl) {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return "";
  }
}

/** FanDuel NBA-style event slugs use "@" in the label and "-@-" in the path (e.g. raptors @ cavaliers). */
function isFanduelSportsbook(siteUrl) {
  return siteHostname(siteUrl) === "sportsbook.fanduel.com";
}

function isStakeSportsbook(siteUrl) {
  return isStakeHostUrl(siteUrl);
}

/**
 * Best-effort extraction of “matches” (games / events) from scraped sportsbook HTML.
 * Uses (1) JSON inside <script> tags and (2) same-host links as fallbacks.
 *
 * @param {string} html — raw HTML from scraped_infos.result
 * @param {string} websiteUrl — tab URL used for resolving relative links and host filter
 * @returns {ExtractedMatch[]}
 */
export function extractMatchFromWebsite(html, websiteUrl) {
  if (!html || typeof html !== "string" || !websiteUrl) return [];

  if (isFanduelSportsbook(websiteUrl)) {
    return extractFanduelSportbookMatches(html, websiteUrl);
  }

  return [];
}

export async function extractMatchFromAPI(websiteUrl) {
  if (!websiteUrl || typeof websiteUrl !== "string") return [];
  if (isStakeSportsbook(websiteUrl)) {
    return extractStakeSportbookMatches(websiteUrl);
  }
  return [];
}

export function extractDetailFromWebsite(html, websiteUrl) {
  if (!html || typeof html !== "string") return [];
  if (isFanduelSportsbook(websiteUrl)) {
    return extractFanduelSportbookDetails(html, websiteUrl);
  }
  return [];
}

export async function extractDetailFromAPI(websiteUrl) {
  if (!websiteUrl || typeof websiteUrl !== "string") return [];
  if (isStakeSportsbook(websiteUrl)) {
    return extractStakeSportbookDetails(websiteUrl);
  }
  return [];
}
