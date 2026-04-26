import { WebSocketServer } from "ws";
import { env } from "../config/env.js";
import { getDashboardRows } from "../db/comparisonRepo.js";
import { logger } from "../lib/logger.js";

export function createWsServer(port) {
  const wss = new WebSocketServer({ port });
  logger.info(`WebSocket listening on ${port}`);

  wss.on("connection", (socket) => {
    const sendRows = async () => {
      const rows = await getDashboardRows();
      socket.send(
        JSON.stringify({
          type: "dashboard:update",
          data: { rows, disableOdds10mDeadline: env.disableOdds10mDeadline }
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
