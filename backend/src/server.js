import cors from "cors";
import express from "express";
import { env, validateEnv } from "./config/env.js";
import { pool } from "./db/pool.js";
import { getPendingMatchIds } from "./db/matchRepo.js";
import { getMatchWebsiteInfosByWebsite } from "./db/matchWebsiteRepo.js";
import { listApiWebsites } from "./db/websiteRepo.js";
import { insertAlert } from "./db/alertsRepo.js";
import { logger } from "./lib/logger.js";
import { TaskQueue, TaskTypes } from "./orchestrator/taskQueue.js";
import { WorkerPool } from "./orchestrator/workerPool.js";
import { initAuthSchema } from "./auth/store.js";
import { createAuthRouter, requireAuth } from "./routes/auth.js";
import { createApiRouter } from "./routes/apiRouter.js";
import { createDashboardRouter } from "./routes/dashboardRouter.js";
import { createSettingRouter } from "./routes/settingRouter.js";
import { createAlertRouter } from "./routes/alertRouter.js";
import { createWsServer } from "./ws/createWsServer.js";

validateEnv();

const app = express();
app.use(
  cors({
    origin: env.corsOrigins.length === 1 ? env.corsOrigins[0] : env.corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "20mb" }));

const queue = new TaskQueue();
const workerCount = Math.max(1, env.cthreadCount);
const workerPool = new WorkerPool({ workerCount, queue });

app.use("/p/:slug", createAuthRouter());
// /api/scrape carries its own extension-key guard (see createApiRouter); the
// operator surfaces below are hub-authenticated. /setting in particular returns
// each site's api_keys, so it must never be reachable anonymously.
app.use("/api", createApiRouter({ queue }));
app.use("/setting", requireAuth, createSettingRouter());
app.use("/dashboard", requireAuth, createDashboardRouter());
app.use("/alert", requireAuth, createAlertRouter());

app.use(async (error, req, res, next) => {
  void req;
  void next;
  logger.error("Unhandled route error", { error: error.message });
  await insertAlert({ type: "route_error", message: error.message });
  res.status(500).json({ message: "Internal server error" });
});

async function start() {
  await pool.query("SELECT 1");
  await initAuthSchema();
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
  }, 10000);

  setInterval(async () => {
    try {
      const apiWebsites = await listApiWebsites();
      
      for (const website of apiWebsites) {
        if( !website.last_scraped_at || Date.now() - website.last_scraped_at < website.scrape_interval * 1000) {
          continue;
        }

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

  const httpServer = app.listen(env.backendPort, () => {
    logger.info(`Backend listening on ${env.backendPort}`);
  });
  const wsPort = Number.isFinite(env.websocketPort) ? env.websocketPort : 0;
  createWsServer({
    server: httpServer,
    serverPath: "/ws",
    // Keep standalone WS port for local/Vite proxy compatibility.
    port: wsPort > 0 && wsPort !== env.backendPort ? wsPort : undefined
  });
}

start().catch(async (error) => {
  logger.error("Fatal startup error", { error: error.message });
  await insertAlert({ type: "startup_error", message: error.message });
  process.exit(1);
});
