import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { insertAlert } from "./db/alertsRepo.js";
import { getPendingMatchIds, listDistinctStakeComparisonFixtureUrls } from "./db/matchRepo.js";
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

  // queue.push({
  //   type: TaskTypes.EXTRACT_MAIN_WEBSITE,
  //   note: "https://sportsbook.fanduel.com/navigation/nba"
  // });
  // queue.push({
  //   type: TaskTypes.EXTRACT_MAIN_WEBSITE,
  //   note: "https://sports.tipico.de/de/alle/basketball/usa/nba"
  // });
  // queue.push({
  //   type: TaskTypes.EXTRACT_MAIN_WEBSITE,
  //   note: "https://stake.com/de/sports/basketball/usa/nba"
  // });
  // queue.push({
  //   type: TaskTypes.EXTRACT_SUB_WEBSITE,
  //   note: "https://sportsbook.fanduel.com/basketball/nba/phoenix-suns-@-oklahoma-city-thunder-35510136"
  // });

  // queue.push({
  //   type: TaskTypes.EXTRACT_SUB_WEBSITE,
  //   note: "https://stake.com/de/sports/basketball/usa/nba/46467340-oklahoma-city-thunder-w8"
  // });

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
      const stakeUrls = await listDistinctStakeComparisonFixtureUrls(400);
      for (const u of stakeUrls) {
        queue.push({ type: TaskTypes.EXTRACT_SUB_WEBSITE, note: u });
      }
      if (stakeUrls.length) workerPool.runLoop();
    } catch (error) {
      await insertAlert({ type: "stake_odds_poll_error", message: error.message });
    }
  }, env.stakeOddsPollIntervalMs);

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
