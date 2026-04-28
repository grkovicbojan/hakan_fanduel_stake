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

function parseApiOrigin(raw) {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return null;
  try {
    return new URL(t);
  } catch {
    // Allow shorthand values like "api.example.com" in env.
    try {
      return new URL(`https://${t}`);
    } catch {
      return null;
    }
  }
}

/**
 * Production: serve the app and proxy `/setting`, `/ws`, etc. to the backend domain (no port in URL if using TLS defaults).
 */
export function createDashboardSocket(onMessage, threshold = 0) {
  const origin = parseApiOrigin(import.meta.env.VITE_API_ORIGIN);
  const proto =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const thresholdParam = `threshold=${encodeURIComponent(Math.max(0, Number(threshold) || 0))}`;
  const wsPathWithQuery = `${WS_PATH}?${thresholdParam}`;
  let socketUrl;
  if (origin) {
    const w = origin.protocol === "https:" ? "wss:" : "ws:";
    socketUrl = `${w}//${origin.host}${wsPathWithQuery}`;
  } else if (typeof window !== "undefined") {
    socketUrl = `${proto}//${window.location.host}${wsPathWithQuery}`;
  } else {
    socketUrl = `ws://${wsHost()}:${wsPort}${wsPathWithQuery}`;
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
