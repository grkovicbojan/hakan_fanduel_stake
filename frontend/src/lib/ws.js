/** Same-origin path the browser uses; nginx or Vite proxy forwards to the real WS server. */
const WS_PATH = "/ws";

/**
 * Dashboard WebSocket helper. Does not read `vite.config.js` at runtime.
 *
 * Connects to `ws(s)://<page-host>/ws` (no port in production when using 443). In **vite dev/preview**,
 * `server.proxy` maps `/ws` → `ws://127.0.0.1:WEBSOCKET_PORT` (see `vite.config.js`).
 *
 * With `VITE_API_ORIGIN` (API on another host), WS is `wss://that-host/ws` (same path on the API origin).
 *
 * `__WEBSOCKET_PORT__` is only a fallback when there is no `window`.
 */
const wsPort = Number.parseInt(__WEBSOCKET_PORT__, 10);

function wsHost() {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return window.location.hostname;
  }
  return "localhost";
}

/**
 * Production: serve the app and proxy `/setting`, `/ws`, etc. to the backend domain (no port in URL if using TLS defaults).
 */
export function createDashboardSocket(onMessage) {
  const origin =
    typeof import.meta.env.VITE_API_ORIGIN === "string" ? import.meta.env.VITE_API_ORIGIN.trim() : "";
  const proto =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  let socketUrl;
  if (origin) {
    try {
      const u = new URL(origin);
      const w = u.protocol === "https:" ? "wss:" : "ws:";
      socketUrl = `${w}//${u.host}${WS_PATH}`;
    } catch {
      socketUrl = `${proto}//${wsHost()}:${wsPort}`;
    }
  } else if (typeof window !== "undefined") {
    socketUrl = `${proto}//${window.location.host}${WS_PATH}`;
  } else {
    socketUrl = `ws://${wsHost()}:${wsPort}`;
  }

  const socket = new WebSocket(socketUrl);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "dashboard:update") {
      onMessage(payload.data);
    }
  };
  return socket;
}
