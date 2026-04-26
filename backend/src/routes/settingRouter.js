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
import { syncNbaStakeFixturesToMatchWebsiteInfos } from "../services/stakeNbaSyncService.js";

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
      const rows = await listAllMatchWebsiteInfosWithScrapeStats();
      res.json(rows);
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

  router.post("/stake/sync-nba-fixtures", async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const websiteId = body.websiteId ?? body.website_id;
      const apiKeyOverride =
        typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : "";
      const result = await syncNbaStakeFixturesToMatchWebsiteInfos({
        websiteId,
        apiKeyOverride: apiKeyOverride || undefined
      });
      res.json(result);
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
        const healthy = lastScrapedAt
          ? now - new Date(lastScrapedAt).getTime() <= site.refresh_interval * 1000
          : false;
        const { last_scraped_at: _ls, ...rest } = site;
        return { ...rest, status: healthy ? "ok" : "not_ok", lastScrapedAt: lastScrapedAt || null };
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
