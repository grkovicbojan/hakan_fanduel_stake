const wsPort = Number.parseInt(__WEBSOCKET_PORT__, 10);

export function createDashboardSocket(onMessage) {
  const socket = new WebSocket(`ws://localhost:${wsPort}`);
  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "dashboard:update") {
      onMessage(payload.data);
    }
  };
  return socket;
}
