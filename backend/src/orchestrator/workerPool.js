import path from "node:path";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger.js";
import { insertAlert } from "../db/alertsRepo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WorkerPool {
  constructor({ workerCount, queue }) {
    this.workerCount = workerCount;
    this.queue = queue;
    this.workers = [];
    this.idleWorkers = [];
  }

  async start() {
    const workerScript = path.resolve(__dirname, "../workers/compareWorker.js");
    for (let index = 0; index < this.workerCount; index += 1) {
      const worker = new Worker(workerScript);
      worker.on("message", (message) => this.onMessage(worker, message));
      worker.on("error", async (error) => {
        logger.error("Worker crashed", { error: error.message });
        await insertAlert({ type: "worker_error", message: error.message, worker: index });
        this.idleWorkers.push(worker);
      });
      worker.on("exit", (code) => {
        logger.warn(`Worker exited with code ${code}`);
      });
      this.workers.push(worker);
      this.idleWorkers.push(worker);
    }
    this.runLoop();
  }

  async onMessage(worker, message) {
    if (message?.type === "error") {
      await insertAlert({ type: "task_error", message: message.error, task: message.task });
    }
    this.idleWorkers.push(worker);
    this.runLoop();
  }

  runLoop() {
    while (this.idleWorkers.length > 0) {
      const task = this.queue.pop();
      if (!task) {
        break;
      }
      const worker = this.idleWorkers.pop();
      worker.postMessage(task);
    }
  }
}
