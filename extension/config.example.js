// Template for extension/config.js — the real file is generated and gitignored.
// Populate it with:  npm run sync:extension-config
// (reads SERVER_IP / BACKEND_PORT / EXTENSION_API_KEY / EXTENSION_API_BASE from the root .env)
export const EXT_CONFIG = {
  serverIp: "127.0.0.1",
  backendPort: 4000,
  // Shared secret for POST /api/scrape; must match EXTENSION_API_KEY on the backend.
  apiKey: ""
};

export const API_BASE = `http://${EXT_CONFIG.serverIp}:${EXT_CONFIG.backendPort}`;
