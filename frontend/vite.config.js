import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/** Dev / preview: proxy API + WS through the Vite port so one origin works (helps VPNs / firewalls). */
function backendHttpTarget(mode, envDir) {
  const env = loadEnv(mode, envDir, "");
  const serverIp = Number.parseInt(env.SERVER_IP); 
  return `https://${serverIp}`;
}

function backendWsTarget(mode, envDir) {
  const env = loadEnv(mode, envDir, "");
  const serverIp = Number.parseInt(env.SERVER_IP);
  return `https://${serverIp}/ws`;
}

const proxy = (mode, envDir) => ({
  "/api": { target: backendHttpTarget(mode, envDir), changeOrigin: true },
  "/setting": { target: backendHttpTarget(mode, envDir), changeOrigin: true },
  "/dashboard": { target: backendHttpTarget(mode, envDir), changeOrigin: true },
  "/alert": { target: backendHttpTarget(mode, envDir), changeOrigin: true },
  "/sportbet-ws": { target: backendWsTarget(mode, envDir), ws: true, changeOrigin: true }
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
