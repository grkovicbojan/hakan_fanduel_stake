import express from "express";
import { TaskTypes } from "../orchestrator/taskQueue.js";
import { upsertScrapedInfo } from "../db/scrapedRepo.js";
import { findWebsiteByUrl } from "../db/websiteRepo.js";
import { getUniqueMatchUrlsForWebsite } from "../db/matchRepo.js";

export function createApiRouter({ queue }) {
  const router = express.Router();

  router.post("/health", async (req, res) => {
    console.log("health check", req.body);
    res.json({ data: "ok" });
  });

  router.post("/scrape", async (req, res, next) => {
    try {
      const { type, url, data, timestamp } = req.body;
      if (!type || !url || !data || !timestamp) {
        return res.status(400).json({ result: "invalid", message: "Missing required fields." });
      }

      const record = await upsertScrapedInfo({
        url,
        data,
        timestamp: new Date(timestamp).toISOString()
      });

      if (!record) {
        return res.json({ result: "invalid" });
      }

      if (type === "M") {
        queue.push({ type: TaskTypes.EXTRACT_MAIN_WEBSITE, note: url });
      } else if (type === "S") {
        queue.push({ type: TaskTypes.EXTRACT_SUB_WEBSITE, note: url });
      }

      if (type === "S") {
        return res.json({ result: "ok" });
      }

      const website = await findWebsiteByUrl(url);
      const urls = await getUniqueMatchUrlsForWebsite(url);
      return res.json({
        result: "ok",
        intervals: {
          scrapeInterval: website?.scrape_interval ?? 10,
          refreshInterval: website?.refresh_interval ?? 300
        },
        urls
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
