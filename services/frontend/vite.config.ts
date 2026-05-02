/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  plugins: [react()],
  root: ".",
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    preserveSymlinks: true,
    dedupe: ["react", "react-dom"],
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router-dom") || id.includes("react-dom") || id.includes("scheduler") || id.includes("/react/")) return "react-vendor";
          if (id.includes("radix-ui") || id.includes("cmdk") || id.includes("react-resizable-panels")) return "ui-vendor";
          if (id.includes("lucide-react")) return "icon-vendor";
          if (id.includes("highlight.js") || id.includes("react-markdown") || id.includes("remark-gfm")) return "content-vendor";
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
    setupFiles: ["src/test-setup/setup.ts"],
  },
});
