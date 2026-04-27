import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function isLocalBackendHost(raw) {
  if (!raw || typeof raw !== "string") return true;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  try {
    const host = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed).hostname.toLowerCase()
      : trimmed.replace(/\/+$/, "").split(":")[0].toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

function useHttpNotHttps(env) {
  const v = String(env.VITE_BACKEND_USE_HTTP || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Dev / preview only: HTTP proxy target for /api, /setting, /dashboard, /alert (and WS target host for /ws).
 * The browser always uses same-origin paths; only Vite reads this.
 */
function backendHttpTarget(mode, envDir) {
  const env = loadEnv(mode, envDir, "");
  const port = Number.parseInt(env.BACKEND_PORT || "4000", 10);
  const raw = String(env.SERVER_IP || "").trim();

  if (isLocalBackendHost(raw)) {
    return `http://127.0.0.1:${port}`;
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (u.port) return u.origin;
      // No port in URL: use default 443/80 (production); do not append BACKEND_PORT.
      const scheme = useHttpNotHttps(env) ? "http" : u.protocol === "http:" ? "http" : "https";
      return `${scheme}://${u.hostname}`;
    } catch {
      return `http://127.0.0.1:${port}`;
    }
  }

  const scheme = useHttpNotHttps(env) ? "http" : "https";
  const host = raw.replace(/^\/+/, "").replace(/\/+$/, "");
  return `${scheme}://${host}`;
}

/** Dev / preview: WebSocket upgrade proxy target (must be ws:// or wss://, not https://). */
function backendWsTarget(mode, envDir) {
  const env = loadEnv(mode, envDir, "");
  const port = Number.parseInt(env.WEBSOCKET_PORT || "4001", 10);
  const raw = String(env.SERVER_IP || "").trim();

  if (isLocalBackendHost(raw)) {
    return `ws://127.0.0.1:${port}`;
  }

  let hostname = "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      hostname = new URL(raw).hostname;
    } catch {
      hostname = "";
    }
  } else {
    hostname = raw.replace(/^\/+/, "").replace(/\/+$/, "").split(":")[0];
  }
  if (!hostname) {
    return `ws://127.0.0.1:${port}`;
  }

  const wss = !useHttpNotHttps(env);
  return `${wss ? "wss" : "ws"}://${hostname}/ws`;
}

const proxy = (mode, envDir) => ({
  "/api": { target: backendHttpTarget(mode, envDir), changeOrigin: true },
  "/setting": { target: backendHttpTarget(mode, envDir), changeOrigin: true },
  "/dashboard": { target: backendHttpTarget(mode, envDir), changeOrigin: true },
  "/alert": { target: backendHttpTarget(mode, envDir), changeOrigin: true },
  "/ws": { target: backendWsTarget(mode, envDir), ws: true, changeOrigin: true }
});

export default defineConfig(({ mode }) => {
  const envDir = "..";
  const env = loadEnv(mode, envDir, "");
  const devHost = env.VITE_DEV_HOST || "127.0.0.1";
  const devPort = Number.parseInt(env.VITE_FRONTEND_PORT || "5173", 10);

  return {
    envDir,
    plugins: [react()],
    define: {
      __BACKEND_PORT__: JSON.stringify(env.BACKEND_PORT || "4000"),
      __WEBSOCKET_PORT__: JSON.stringify(env.WEBSOCKET_PORT || "4001")
    },
    server: {
      host: devHost,
      port: devPort,
      strictPort: true,
      proxy: proxy(mode, envDir)
    },
    preview: {
      host: devHost,
      port: devPort,
      strictPort: true,
      proxy: proxy(mode, envDir)
    }
  };
});
