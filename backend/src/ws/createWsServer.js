import { WebSocketServer } from "ws";
import { env } from "../config/env.js";
import { getDashboardRows } from "../db/comparisonRepo.js";
import { logger } from "../lib/logger.js";

function parseThreshold(raw) {
  const n = Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function wireDashboardWs(wss, sourceLabel) {
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
      if (socket.readyState !== socket.OPEN) return;
      socket.send(
        JSON.stringify({
          type: "dashboard:update",
          data: { rows, threshold, disableOdds10mDeadline: env.disableOdds10mDeadline }
        })
      );
    };

    logger.info("WS client connected", { source: sourceLabel, url: reqUrl, threshold });
    sendRows().catch((error) =>
      logger.error("WS initial send failed", { source: sourceLabel, error: error.message })
    );

    const timer = setInterval(() => {
      sendRows().catch((error) =>
        logger.error("WS periodic send failed", { source: sourceLabel, error: error.message })
      );
    }, 5000);

    socket.on("close", () => {
      clearInterval(timer);
      logger.info("WS client disconnected", { source: sourceLabel, url: reqUrl, threshold });
    });
    socket.on("error", (error) => {
      logger.error("WS socket error", { source: sourceLabel, error: error.message });
    });
  });

  wss.on("error", (error) => {
    logger.error("WebSocket server error", { source: sourceLabel, error: error.message });
  });
}

/**
 * Starts dashboard WS endpoints.
 * - serverPath: WS on backend HTTP server path (default: /ws) for production reverse proxy.
 * - port: optional legacy standalone WS port for dev/proxy setups.
 */
export function createWsServer({ server, serverPath = "/ws", port }) {
  const instances = [];

  if (server) {
    const pathWss = new WebSocketServer({ server, path: serverPath });
    wireDashboardWs(pathWss, `http-server:${serverPath}`);
    instances.push(pathWss);
    logger.info(`WebSocket attached to HTTP server path ${serverPath}`);
  }

  if (Number.isFinite(port) && port > 0) {
    const portWss = new WebSocketServer({ port });
    wireDashboardWs(portWss, `port:${port}`);
    instances.push(portWss);
    logger.info(`WebSocket listening on ${port}`);
  }

  return instances;
}
