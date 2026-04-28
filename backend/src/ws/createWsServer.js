import { WebSocketServer } from "ws";
import { env } from "../config/env.js";
import { getDashboardRows } from "../db/comparisonRepo.js";
import { logger } from "../lib/logger.js";

export function createWsServer(port) {
  const wss = new WebSocketServer({ port });
  logger.info(`WebSocket listening on ${port}`);

  const parseThreshold = (raw) => {
    const n = Number.parseFloat(String(raw ?? ""));
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, n);
  };

  wss.on("connection", (socket, request) => {
    const reqUrl = request?.url || "/ws";
    const threshold = (() => {
      try {
        const parsed = new URL(reqUrl, "http://localhost");
        return parseThreshold(parsed.searchParams.get("threshold"));
      } catch {
        return 0;
      }
    })();

    const sendRows = async () => {
      const rows = await getDashboardRows(threshold);
      socket.send(
        JSON.stringify({
          type: "dashboard:update",
          data: { rows, threshold, disableOdds10mDeadline: env.disableOdds10mDeadline }
        })
      );
    };
    sendRows().catch((error) => logger.error("WS initial send failed", { error: error.message }));

    const timer = setInterval(() => {
      sendRows().catch((error) => logger.error("WS periodic send failed", { error: error.message }));
    }, 5000);

    socket.on("close", () => clearInterval(timer));
  });

  return wss;
}
