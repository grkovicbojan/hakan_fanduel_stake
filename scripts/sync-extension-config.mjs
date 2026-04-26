import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

const rootDir = process.cwd();
dotenv.config({ path: path.resolve(rootDir, ".env") });

const serverIp = process.env.SERVER_IP || "127.0.0.1";
const backendPort = Number.parseInt(process.env.BACKEND_PORT || "4000", 10);

const content = `export const EXT_CONFIG = {
  serverIp: "${serverIp}",
  backendPort: ${backendPort}
};

export const API_BASE = \`http://\${EXT_CONFIG.serverIp}:\${EXT_CONFIG.backendPort}\`;
`;

await fs.writeFile(path.resolve(rootDir, "extension/config.js"), content, "utf8");
console.log("extension/config.js synced from root .env");
