import { parentPort } from "node:worker_threads";
import { getScrapedByUrl, upsertScrapedInfo } from "../db/scrapedRepo.js";
import {
  extractDetailFromAPI,
  extractDetailFromWebsite,
  extractMatchFromAPI,
  extractMatchFromWebsite
} from "../extractors/index.js";
import { TaskTypes } from "../orchestrator/taskQueue.js";
import {
  deleteStaleMatches,
  getMatchById,
  markMatchCompared,
  upsertMatchRecord
} from "../db/matchRepo.js";
import { findWebsiteByUrl, findWebsiteByUrlAny, listWebsites, ScrapeTypes } from "../db/websiteRepo.js";
import { getOddsByUrl, upsertOddInfos } from "../db/oddRepo.js";
import { upsertComparedInfo } from "../db/comparisonRepo.js";
import { insertAlert } from "../db/alertsRepo.js";
import { replaceMatchWebsiteInfos, findMainWebsiteByUrl } from "../db/matchWebsiteRepo.js";
import { logger } from "../lib/logger.js";

async function handleExtractMainScrape(task) {
  logger.info("handleExtractMainScrape", { task });
  const websiteUrl = task.note;

  const scraped = await getScrapedByUrl(websiteUrl);
  if (!scraped) {
    logger.warn("EXTRACT_MAIN skipped: no scraped_infos HTML for this URL (extension must POST /api/scrape first).", {
      websiteUrl
    });
    return [];
  }
  return extractMatchFromWebsite(scraped.result, websiteUrl);
}

async function handleExtractMainApi(task) {
  logger.info("handleExtractMainApi", { task });
  const websiteUrl = task.note;
  if (!websiteUrl) {
    logger.warn("EXTRACT_MAIN_API skipped: no website URL provided.", { task });
    return [];
  }
  const matchInfos = await extractMatchFromAPI(websiteUrl);
  console.log("matchInfos", matchInfos);
  const list = Array.isArray(matchInfos) ? matchInfos : [];
  await upsertScrapedInfo({
    url: websiteUrl,
    data: JSON.stringify(list),
    timestamp: new Date().toISOString()
  });
  return list;
}

async function handleExtractMain(task) {
  logger.info("handleExtractMain", { task });
  const websiteUrl = task.note;
  let extractedMatches = [];

  const websiteScrape = await findWebsiteByUrl(websiteUrl, ScrapeTypes.SCRAPE);
  const websiteApi = await findWebsiteByUrl(websiteUrl, ScrapeTypes.API);

  if (websiteScrape) {
    extractedMatches = await handleExtractMainScrape(task);
  } else if (websiteApi) {
    extractedMatches = await handleExtractMainApi(task);
  }

  if (!websiteScrape && !websiteApi) {
    logger.warn("EXTRACT_MAIN skipped: no website_infos row for this URL.", { websiteUrl });
    return;
  }

  if (extractedMatches.length === 0) {
    logger.warn("EXTRACT_MAIN skipped: no matches found for this URL.", {
      websiteUrl
    });
    return;
  }

  console.log("extractedMatches", extractedMatches);

  await replaceMatchWebsiteInfos(
    websiteUrl,
    extractedMatches.map((item) => ({ name: item.matchName, url: item.matchUrl }))
  );

  const validNames = extractedMatches.map((item) => item.matchName);
  await deleteStaleMatches(websiteUrl, validNames);

  const websites = await listWebsites();
  const matchedSite = await findWebsiteByUrlAny(websiteUrl);
  const asBaseline = matchedSite?.type === "B" ? matchedSite : null;
  const baselineComparisons = asBaseline?.comparison_website_list
    ? asBaseline.comparison_website_list.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
  const tabMatchesListed = (tabUrl, listedUrl) => {
    if (!tabUrl || !listedUrl) return false;
    if (tabUrl === listedUrl) return true;
    const root = listedUrl.replace(/\/+$/, "");
    return tabUrl.startsWith(`${root}/`);
  };
  const withComparisonToThis = websites
    .filter((site) => site.type === "B")
    .filter((site) =>
      (site.comparison_website_list || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .some((c) => tabMatchesListed(websiteUrl, c))
    )
    .map((site) => site.url);

  for (const match of extractedMatches) {
    for (const comparisonUrl of baselineComparisons) {
      await upsertMatchRecord({
        baselineUrl: websiteUrl,
        comparisonUrl,
        name: match.matchName,
        baselineMatchUrl: match.matchUrl,
        comparisonMatchUrl: ""
      });
    }

    for (const baselineUrl of withComparisonToThis) {
      await upsertMatchRecord({
        baselineUrl,
        comparisonUrl: websiteUrl,
        name: match.matchName,
        baselineMatchUrl: "",
        comparisonMatchUrl: match.matchUrl
      });
    }
  }
}

async function handleExtractSubScrape(task) {
  const websiteUrl = task.note;
  logger.info("handleExtractSubScrape", { task });
  const scraped = await getScrapedByUrl(websiteUrl);
  if (!scraped) {
    logger.warn("EXTRACT_SUB skipped: no scraped payload for this URL.", { websiteUrl });
    return [];
  }
  const detailed = extractDetailFromWebsite(scraped.result, websiteUrl);
  return Array.isArray(detailed) ? detailed : [];
}

async function handleExtractSubApi(task) {
  const websiteUrl = task.note;
  logger.info("handleExtractSubApi", { task });
  const detailed = await extractDetailFromAPI(websiteUrl);
  const list = Array.isArray(detailed) ? detailed : [];

  logger.info("handleExtractSubApi result", list.length);

  const seen = new Set();

  const duplicates = list.filter(item => {
    if (seen.has(item.category)) {
      return true; // this is a duplicate
    }
    seen.add(item.category);
    return false;
  });

  console.log("duplicates", duplicates);

  await upsertScrapedInfo({
    url: websiteUrl,
    data: JSON.stringify(list),
    timestamp: new Date().toISOString()
  });
  return list;
}

async function handleExtractSub(task) {
  logger.info("handleExtractSub", { task });
  const websiteUrl = task.note;
  let detailed = [];


  const mainWebsite = await findMainWebsiteByUrl(websiteUrl);
  console.log("mainWebsite", mainWebsite);
  const websiteScrape = await findWebsiteByUrl(mainWebsite.website, ScrapeTypes.SCRAPE);
  const websiteApi = await findWebsiteByUrl(mainWebsite.website, ScrapeTypes.API);

  if (websiteScrape) {
    detailed = await handleExtractSubScrape(task);
  } else if (websiteApi) {
    detailed = await handleExtractSubApi(task);
  }

  if (!websiteScrape && !websiteApi) {
    logger.warn("EXTRACT_SUB skipped: no website_infos row for this URL.", { websiteUrl });
    return;
  }

  if (detailed.length === 0) {
    logger.warn("EXTRACT_SUB skipped: no details found for this URL.", { websiteUrl });
    return;
  }

  await upsertOddInfos(
    detailed.map((item) => ({
      url: item.url,
      category: item.category,
      value: Number(item.value)
    }))
  );
}

async function handleCompareMatch(task) {
  const matchInfo = await getMatchById(task.note);
  if (!matchInfo) return;
  const baselineList = await getOddsByUrl(matchInfo.baseline_match_url);
  const comparisonList = await getOddsByUrl(matchInfo.comparison_match_url);

  const byCategory = new Map();
  for (const item of comparisonList) {
    byCategory.set(item.category, item);
  }

  for (const baselineItem of baselineList) {
    const comparisonItem = byCategory.get(baselineItem.category);
    if (!comparisonItem) continue;
    if (baselineItem.value === 0) {
      await insertAlert({
        type: "compare_skip_zero_baseline",
        name: matchInfo.name,
        category: baselineItem.category
      });
      continue;
    }

    logger.info("compare match row", { baselineItem, comparisonItem });

    const arbitrage = (comparisonItem.value / baselineItem.value) * 100;
    await upsertComparedInfo({
      name: matchInfo.name,
      baselineMatchUrl: matchInfo.baseline_match_url,
      comparisonMatchUrl: matchInfo.comparison_match_url,
      category: baselineItem.category,
      baselineValue: baselineItem.value,
      comparisonValue: comparisonItem.value,
      arbitrage
    });
  }

  await markMatchCompared(matchInfo.id);
}

parentPort.on("message", async (task) => {
  try {
    switch (task.type) {
      case TaskTypes.EXTRACT_MAIN_WEBSITE:
        await handleExtractMain(task);
        break;
      case TaskTypes.EXTRACT_SUB_WEBSITE:
        await handleExtractSub(task);
        break;
      case TaskTypes.COMPARE_MATCH_DETAIL:
        await handleCompareMatch(task);
        break;
      default:
        break;
    }
    parentPort.postMessage({ type: "done" });
  } catch (error) {
    parentPort.postMessage({
      type: "error",
      task,
      error: error.message
    });
  }
});
