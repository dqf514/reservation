/// <reference types="vitest/config" />
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3333,
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/uploads": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  /** 与 dev 一致转发 API，避免 npm run preview 时 /api 打到前端静态服务导致 JSON 解析失败、列表空白 */
  preview: {
    port: 4173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/uploads": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
});
