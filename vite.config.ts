// server/vite.ts
import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---- Vite config (inline, same as your vite.config.ts) ----
const viteConfig = defineConfig(async ({ mode }) => {
  const plugins = [react(), runtimeErrorOverlay()];

  // Only load Cartographer in non-prod Replit environments
  if (mode !== "production" && process.env.REPL_ID !== undefined) {
    const { cartographer } = await import("@replit/vite-plugin-cartographer");
    plugins.push(cartographer());
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": resolve(__dirname, "../client/src"),
        "@shared": resolve(__dirname, "../shared"),
        "@assets": resolve(__dirname, "../attached_assets"),
      },
    },
    // ✅ ORIGINAL behavior: client root is client/, build goes to dist/public
    root: resolve(__dirname, "../client"),
    build: {
      outDir: resolve(__dirname, "../dist/public"),
      emptyOutDir: true,
    },
    server: {
      fs: { strict: true, deny: ["**/.*"] },
    },
  };
});

// ---- Dev helper (unchanged) ----
const viteLogger = createLogger();
function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: express.Express, server: import("http").Server) {
  const serverOptions = { middlewareMode: true, hmr: { server }, allowedHosts: true };
  const vite = await createViteServer({
    ...(await viteConfig({ mode: "development", command: "serve" } as any)),
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(__dirname, "../client/index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// ---- ✅ Production static serving (restored to ../dist/public) ----
export function serveStatic(app: express.Express) {
  // At runtime this file is /httpdocs/server/dist/vite.js
  // We want /httpdocs/dist/public  (one level up from /server/dist)
  const distPath = path.resolve(__dirname, "../../dist/public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}. If needed, build the client so index.html exists.`
    );
  }

  // Serve correct MIME for PWA manifest if requested
  app.use((req, res, next) => {
    if (req.path.endsWith(".webmanifest")) {
      res.setHeader("Content-Type", "application/manifest+json");
    }
    next();
  });

  app.use(express.static(distPath));

  // SPA fallback
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
