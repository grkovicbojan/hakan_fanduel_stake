import express from "express";
import { getAlertsPage } from "../db/alertsRepo.js";

export function createAlertRouter() {
  const router = express.Router();
  router.get("/", async (req, res, next) => {
    try {
      const page = Number.parseInt(req.query.page, 10) || 1;
      const pageSize = Number.parseInt(req.query.pageSize, 10) || 50;
      const payload = await getAlertsPage(pageSize, page);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
