import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5050",
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on("error", (err) => {
            // Suppress noisy startup ECONNREFUSED logs while backend is starting
            if ((err as any).code === "ECONNREFUSED") return;
            console.warn("[vite-proxy]", err.message);
          });
        },
      },
    },
  },
});
