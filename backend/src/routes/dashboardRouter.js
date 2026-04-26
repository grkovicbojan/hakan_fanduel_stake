import express from "express";
import { env } from "../config/env.js";
import { getDashboardRows } from "../db/comparisonRepo.js";
import { listWebsitesWithActivity } from "../db/websiteRepo.js";

function parseComparisonList(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createDashboardRouter() {
  const router = express.Router();

  router.get("/websites", async (req, res, next) => {
    try {
      const sites = await listWebsitesWithActivity();
      const now = Date.now();
      const websites = sites.map((site) => {
        const lastScrapedAt = site.last_scraped_at;
        const healthy = lastScrapedAt
          ? now - new Date(lastScrapedAt).getTime() <= site.refresh_interval * 1000
          : false;
        return {
          id: site.id,
          url: site.url,
          type: site.type,
          scrape_interval: site.scrape_interval,
          refresh_interval: site.refresh_interval,
          comparison_website_list: site.comparison_website_list,
          comparison_urls: parseComparisonList(site.comparison_website_list),
          lastScrapedAt: lastScrapedAt || null,
          status: healthy ? "ok" : "not_ok",
          match_total: site.match_total,
          match_pending: site.match_pending
        };
      });
      res.json({ total: websites.length, websites });
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const rows = await getDashboardRows();
      res.json({
        rows,
        disableOdds10mDeadline: env.disableOdds10mDeadline
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
