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
  /** Shared secret the Chrome extension presents on /api/scrape (X-Extension-Key). */
  extensionApiKey: process.env.EXTENSION_API_KEY || "",
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production-fanduel",
  authJwtSecret: process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET || "change-me-in-production-fanduel",
  authCookieName: process.env.AUTH_COOKIE_NAME || "ww_access_token",
  hubAuthUrl: (process.env.HUB_AUTH_URL || "https://weienwong.online").replace(/\/$/, ""),
  jwtExpireDays: toInt(process.env.JWT_EXPIRE_DAYS, 7),
  appBaseUrl: (process.env.APP_BASE_URL || "https://sport.weienwong.online").replace(/\/$/, ""),
  defaultProjectSlug: process.env.DEFAULT_PROJECT_SLUG || "sportbet",
  extensionApiKeyConfigured: Boolean(process.env.EXTENSION_API_KEY),
  corsOrigins: (process.env.CORS_ORIGINS || "https://sport.weienwong.online,http://localhost:5173")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean),
};

// Values shipped in the README/.env.example. Booting with any of these means the
// signing key is public knowledge, so startup fails rather than serving with it.
const INSECURE_SECRETS = new Set([
  "",
  "change-me-in-production",
  "change-me-in-production-binance",
  "change-me-in-production-fanduel",
  "change-this-session-secret"
]);

// Long enough that an offline attack on the HS256 signature is not worthwhile.
const MIN_SECRET_LENGTH = 32;

export function validateEnv() {
  if (INSECURE_SECRETS.has(env.authJwtSecret)) {
    throw new Error(
      "AUTH_JWT_SECRET is unset or still a placeholder. Set it in .env to the " +
        "same value the hub uses, otherwise anyone can forge a session."
    );
  }
  if (INSECURE_SECRETS.has(env.jwtSecret)) {
    throw new Error("JWT_SECRET is unset or still a placeholder. Set it in .env.");
  }

  for (const [name, value] of [
    ["AUTH_JWT_SECRET", env.authJwtSecret],
    ["JWT_SECRET", env.jwtSecret]
  ]) {
    if (value.length < MIN_SECRET_LENGTH) {
      console.warn(
        `warning: ${name} is only ${value.length} characters; ${MIN_SECRET_LENGTH}+ ` +
          "recommended so the signing key cannot be recovered by offline brute force."
      );
    }
  }
}
