// server/app.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module"; // 👈 allow require in ESM
const require = createRequire(import.meta.url);

const app = express();

app.set("trust proxy", true);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Health
app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || "development" });
});

/**
 * Mount API routes with a hard guard.
 * If any router import crashes at load time, we keep the app alive and expose a clear error at /api/*
 */
let routesMounted = false;
try {
  // NOTE: esbuild will rewrite this during bundling; no .ts/.js extension needed.
  // We avoid `import routes from "./routes"` so that load-time errors are catchable.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("./routes");
  const routes = mod.default ?? mod;
  app.use("/api", routes);
  routesMounted = true;
  console.log("[ChefSire] API routes mounted");
} catch (err) {
  console.error("[ChefSire] Failed to load API routes:", err);
  app.all("/api/*", (_req: Request, res: Response) => {
    res.status(503).json({
      error: "API routes failed to load",
      hint:
        process.env.NODE_ENV === "production"
          ? "Check server logs for the exact router that failed to initialize."
          : String(err),
    });
  });
}

// Optional API banner (at /api)
app.get("/api", (_req, res) => {
  res.json({
    name: "ChefSire API",
    status: routesMounted ? "running" : "degraded",
    timestamp: new Date().toISOString(),
  });
});

// Serve built client at ../dist/public (App Root is /httpdocs/server)
const clientDir = path.resolve(process.cwd(), "../dist/public");
const hasClient = fs.existsSync(clientDir);

if (hasClient) {
  app.use(
    express.static(clientDir, {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    })
  );
}

// SPA fallback for any non-API route
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (!hasClient) {
    return res
      .status(200)
      .send("Client bundle not found. Build UI with `npm run build` to populate /httpdocs/dist/public.");
  }
  res.sendFile(path.join(clientDir, "index.html"));
});

// FINAL: 404 for unknown API paths (only if routes mounted)
if (routesMounted) {
  app.all("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ error: "API endpoint not found" });
  });
}

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const isProd = process.env.NODE_ENV === "production";
  const message = err instanceof Error ? err.message : "Unknown error";
  const stack = err instanceof Error ? err.stack : undefined;

  if (!isProd) console.error("[ERROR]", err);

  res.status(500).json({
    error: "Internal Server Error",
    message: isProd ? "An unexpected error occurred." : message,
    ...(isProd ? {} : { stack }),
  });
});

export default app;
