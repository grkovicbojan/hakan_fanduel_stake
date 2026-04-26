import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, "../../../.env");

dotenv.config({ path: rootEnvPath });

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBool = (value, fallback = false) => {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

export const env = {
  serverIp: process.env.SERVER_IP || "127.0.0.1",
  backendPort: toInt(process.env.BACKEND_PORT, 4000),
  websocketPort: toInt(process.env.WEBSOCKET_PORT, 4001),
  cthreadCount: toInt(process.env.CTHREAD_COUNT, 4),
  dbHost: process.env.DB_HOST || "127.0.0.1",
  dbPort: toInt(process.env.DB_PORT, 5432),
  dbName: process.env.DB_NAME || "sportbet",
  dbUser: process.env.DB_USER || "postgres",
  dbPassword: process.env.DB_PASSWORD || "postgres",
  /** When true, compared_infos queries for the dashboard / WebSocket omit the “last 10 minutes” filter. */
  disableOdds10mDeadline: toBool(process.env.DISABLE_ODDS_10M_DEADLINE, false),
  /** Directory for `app-*.log` and `html/` dumps (default: backend/logs). */
  logDir: process.env.LOG_DIR?.trim()
    ? path.resolve(process.env.LOG_DIR)
    : path.resolve(__dirname, "../../logs"),
  /** Optional: used if server-side Stake GraphQL is added later; extension reads this via sync:extension-config. */
  stakeAccessToken: process.env.STAKE_ACCESS_TOKEN?.trim() || ""
};
