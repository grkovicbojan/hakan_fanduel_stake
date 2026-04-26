export const EXT_CONFIG = {
  serverIp: "127.0.0.1",
  backendPort: 4000
};

export const API_BASE = `http://${EXT_CONFIG.serverIp}:${EXT_CONFIG.backendPort}`;

/** Optional: Stake.com Settings → Security → API Tokens (sent as x-access-token on GraphQL). */
export const STAKE_ACCESS_TOKEN = "";
