import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

const rootDir = process.cwd();
dotenv.config({ path: path.resolve(rootDir, ".env") });

const serverIp = process.env.SERVER_IP || "127.0.0.1";
const backendPort = Number.parseInt(process.env.BACKEND_PORT || "4000", 10);
const apiKey = process.env.EXTENSION_API_KEY || "";

// Production fronts the API on its own https host with no port, so allow an
// explicit override rather than always emitting http://host:port.
const apiBaseOverride = (process.env.EXTENSION_API_BASE || "").trim().replace(/\/+$/, "");

if (!apiKey) {
  console.warn(
    "warning: EXTENSION_API_KEY is empty — POST /api/scrape will reject this extension."
  );
}

const apiBaseExpr = apiBaseOverride
  ? `"${apiBaseOverride}"`
  : "`http://${EXT_CONFIG.serverIp}:${EXT_CONFIG.backendPort}`";

const content = `export const EXT_CONFIG = {
  serverIp: "${serverIp}",
  backendPort: ${backendPort},
  // Shared secret for POST /api/scrape; must match EXTENSION_API_KEY on the backend.
  apiKey: ${JSON.stringify(apiKey)}
};

export const API_BASE = ${apiBaseExpr};
`;

await fs.writeFile(path.resolve(rootDir, "extension/config.js"), content, "utf8");
console.log("extension/config.js synced from root .env");
