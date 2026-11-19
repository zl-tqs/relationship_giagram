/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

function localAnalysisDebugPlugin(): Plugin {
  return {
    name: "local-analysis-debug",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__debug/local-analysis", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 5_000_000) req.destroy();
        });
        req.on("end", () => {
          try {
            const outputDir = resolve(process.cwd(), "..", "resources", "text_log");
            const snapshot = JSON.parse(body) as unknown;
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const outputPath = resolve(outputDir, `local-analysis-${stamp}.json`);
            mkdirSync(outputDir, { recursive: true });
            writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), "utf8");
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, path: outputPath }));
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, message: "invalid snapshot" }));
          }
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), localAnalysisDebugPlugin()],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    testTimeout: 15000,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 40,
            },
            {
              name: "antd-vendor",
              test: /node_modules[\\/](antd|@ant-design|@rc-component|rc-[^\\/]+)[\\/]/,
              priority: 30,
              maxSize: 400 * 1024,
            },
            {
              name: "flow-vendor",
              test: /node_modules[\\/](@xyflow|d3-[^\\/]+|zustand)[\\/]/,
              priority: 30,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
}));
