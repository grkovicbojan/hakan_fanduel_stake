import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { getPendingMatchIds } from "./db/matchRepo.js";
import { getMatchWebsiteInfosByWebsite } from "./db/matchWebsiteRepo.js";
import { listApiWebsites } from "./db/websiteRepo.js";
import { insertAlert } from "./db/alertsRepo.js";
import { logger } from "./lib/logger.js";
import { TaskQueue, TaskTypes } from "./orchestrator/taskQueue.js";
import { WorkerPool } from "./orchestrator/workerPool.js";
import { createAlertRouter } from "./routes/alertRouter.js";
import { createApiRouter } from "./routes/apiRouter.js";
import { createDashboardRouter } from "./routes/dashboardRouter.js";
import { createSettingRouter } from "./routes/settingRouter.js";
import { createWsServer } from "./ws/createWsServer.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const queue = new TaskQueue();
const workerCount = Math.max(1, env.cthreadCount);
const workerPool = new WorkerPool({ workerCount, queue });

app.use("/api", createApiRouter({ queue }));
app.use("/setting", createSettingRouter());
app.use("/dashboard", createDashboardRouter());
app.use("/alert", createAlertRouter());

app.use(async (error, req, res, next) => {
  void req;
  void next;
  logger.error("Unhandled route error", { error: error.message });
  await insertAlert({ type: "route_error", message: error.message });
  res.status(500).json({ message: "Internal server error" });
});

async function start() {
  await pool.query("SELECT 1");
  logger.info("Database connected.");

  await workerPool.start();
  logger.info(`Worker pool started with ${workerCount} workers.`);
  // Tasks queued before start() are picked up inside start() → runLoop().
  // If you ever queue tasks after start(), call workerPool.runLoop() again so idle workers pull work.

  setInterval(async () => {
    try {
      const ids = await getPendingMatchIds(1000);
      for (const id of ids) {
        queue.push({
          type: TaskTypes.COMPARE_MATCH_DETAIL,
          note: id
        });
      }
      
      workerPool.runLoop();
    } catch (error) {
      await insertAlert({ type: "scheduler_error", message: error.message });
    }
  }, 1000);

  setInterval(async () => {
    try {
      const apiWebsites = await listApiWebsites();
      for (const website of apiWebsites) {

        console.log("time", Date.now()- website.last_scraped_at);
        queue.push({
          type: TaskTypes.EXTRACT_MAIN_WEBSITE,
          note: website.url
        });

        const matchInfos = await getMatchWebsiteInfosByWebsite(website.url);
        for (const match of matchInfos) {
          queue.push({
            type: TaskTypes.EXTRACT_SUB_WEBSITE,
            note: match.url
          });
        }
      }
      
      workerPool.runLoop();
    } catch (error) {
      await insertAlert({ type: "scheduler_error", message: error.message });
    }
  }, 10000);

  createWsServer(env.websocketPort);

  app.listen(env.backendPort, () => {
    logger.info(`Backend listening on ${env.backendPort}`);
  });
}

start().catch(async (error) => {
  logger.error("Fatal startup error", { error: error.message });
  await insertAlert({ type: "startup_error", message: error.message });
  process.exit(1);
});
