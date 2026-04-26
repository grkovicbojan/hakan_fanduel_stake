const wsPort = Number.parseInt(__WEBSOCKET_PORT__, 10);

function wsHost() {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return window.location.hostname;
  }
  return "localhost";
}

/**
 * Dev / preview: WebSocket goes through Vite (`/sportbet-ws` → backend WS port).
 * Production: set `VITE_API_ORIGIN` if API is on another host; otherwise same host + WS path.
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
      socketUrl = `${w}//${u.host}/sportbet-ws`;
    } catch {
      socketUrl = `${proto}//${wsHost()}:${wsPort}`;
    }
  } else if (typeof window !== "undefined") {
    socketUrl = `${proto}//${window.location.host}/sportbet-ws`;
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
