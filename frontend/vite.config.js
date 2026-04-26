import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  envDir: "..",
  plugins: [react()],
  define: {
    __BACKEND_PORT__: JSON.stringify(process.env.BACKEND_PORT || "4000"),
    __WEBSOCKET_PORT__: JSON.stringify(process.env.WEBSOCKET_PORT || "4001")
  },
  server: {
    host: "0.0.0.0",
    port: 5173
  }
});
