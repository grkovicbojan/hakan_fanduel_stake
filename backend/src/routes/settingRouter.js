import express from "express";
import {
  createWebsite,
  deleteWebsite,
  listWebsitesWithLastScrape,
  updateWebsite
} from "../db/websiteRepo.js";
import { getScrapedByUrl } from "../db/scrapedRepo.js";
import {
  getMatchWebsiteInfosByWebsite,
  listAllMatchWebsiteInfosWithScrapeStats
} from "../db/matchWebsiteRepo.js";
import { getOddsByUrl } from "../db/oddRepo.js";

function statusFromLastScraped(lastScrapedAt, scrapeIntervalSeconds, nowMs) {
  if (!lastScrapedAt || !Number.isFinite(scrapeIntervalSeconds) || scrapeIntervalSeconds <= 0) {
    return { status: "not_ok", lastScrapedAgoSeconds: null };
  }
  const ts = new Date(lastScrapedAt).getTime();
  if (!Number.isFinite(ts)) {
    return { status: "not_ok", lastScrapedAgoSeconds: null };
  }
  const agoSeconds = Math.max(0, Math.floor((nowMs - ts) / 1000));
  const ok = agoSeconds <= scrapeIntervalSeconds;
  return { status: ok ? "ok" : "not_ok", lastScrapedAgoSeconds: agoSeconds };
}

export function createSettingRouter() {
  const router = express.Router();

  router.get("/scraped", async (req, res, next) => {
    try {
      const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
      if (!url) {
        return res.status(400).json({ message: "Missing url query parameter." });
      }
      const row = await getScrapedByUrl(url);
      res.json(row);
    } catch (error) {
      next(error);
    }
  });

  router.get("/matches", async (req, res, next) => {
    try {
      const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
      if (!url) {
        return res.status(400).json({ message: "Missing url query parameter." });
      }
      const rows = await getMatchWebsiteInfosByWebsite(url);
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.get("/match-websites", async (req, res, next) => {
    try {
      const now = Date.now();
      const rows = await listAllMatchWebsiteInfosWithScrapeStats();
      const mapped = rows.map((row) => {
        const scrapeInterval = Number(row.scrape_interval);
        const { status, lastScrapedAgoSeconds } = statusFromLastScraped(
          row.last_scraped_at,
          scrapeInterval,
          now
        );
        return {
          ...row,
          status,
          lastScrapedAgoSeconds
        };
      });
      res.json(mapped);
    } catch (error) {
      next(error);
    }
  });

  router.get("/odds", async (req, res, next) => {
    try {
      const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
      if (!url) {
        return res.status(400).json({ message: "Missing url query parameter." });
      }
      const rows = await getOddsByUrl(url);
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const websites = await listWebsitesWithLastScrape();
      const now = Date.now();

      const rows = websites.map((site) => {
        const lastScrapedAt = site.last_scraped_at;
        const scrapeInterval = Number(site.scrape_interval);
        const { status, lastScrapedAgoSeconds } = statusFromLastScraped(
          lastScrapedAt,
          scrapeInterval,
          now
        );
        const { last_scraped_at: _ls, ...rest } = site;
        return {
          ...rest,
          status,
          lastScrapedAt: lastScrapedAt || null,
          lastScrapedAgoSeconds
        };
      });
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const created = await createWebsite(req.body);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const updated = await updateWebsite(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const ok = await deleteWebsite(req.params.id);
      if (!ok) {
        return res.status(404).json({ message: "Not found" });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
