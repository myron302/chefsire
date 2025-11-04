// server/app.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";

const app = express();
app.set("trust proxy", true);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// --- Health ---
app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || "development" });
});

/**
 * Mount /api in a way that cannot crash the process.
 * We mount a stub first; then we *attempt* to load the real routers.
 * If loading fails, the stub returns 503 + a diagnostic. Frontend still serves.
 */
const api = express.Router();
let apiLoaded = false;
let apiLoadError: Error | null = null;

// Diagnostic always available
api.get("/_diag", (_req, res) => {
  res.json({
    status: apiLoaded ? "ok" : "degraded",
    error: apiLoadError ? (apiLoadError.message || String(apiLoadError)) : null,
    timestamp: new Date().toISOString(),
  });
});

// Fallback banner for "/api" root when degraded
api.get("/", (_req, res) => {
  res.json({
    name: "ChefSire API",
    status: apiLoaded ? "running" : "degraded",
    timestamp: new Date().toISOString(),
  });
});

// Stub handler that only triggers while degraded
api.use((req, res, next) => {
  if (apiLoaded) return next();
  res.status(503).json({
    error: "API routes failed to load",
    hint: "Check server logs for the exact router that failed to initialize.",
    path: req.path,
  });
});

// Mount the /api router now (stubbed for the moment)
app.use("/api", api);

// Try to attach real routers without crashing the app
(async () => {
  try {
    // NOTE: esbuild bundles this. If it throws during module init, we stay degraded.
    const routesMod = await import("./routes");
    const realRoutes = routesMod.default;
    if (!realRoutes) throw new Error("routes/index.ts did not export default router");

    // Once loaded, let requests flow to real routes
    api.use(realRoutes);
    apiLoaded = true;
    apiLoadError = null;
    console.log("[ChefSire] API routes mounted successfully.");
  } catch (e: any) {
    apiLoaded = false;
    apiLoadError = e instanceof Error ? e : new Error(String(e));
    console.error("[ChefSire] Failed to mount API routes:\n", apiLoadError?.stack || apiLoadError?.message || e);
  }
})();

// --- Static client (../dist/public) ---
const clientDir = path.resolve(process.cwd(), "../dist/public");
const hasClient = fs.existsSync(clientDir);
if (hasClient) {
  app.use(
    express.static(clientDir, {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );
}

// SPA fallback (but never swallow /api/*)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (!hasClient) {
    return res
      .status(200)
      .send("Client bundle not found. Build UI with `npm run build` to populate /httpdocs/dist/public.");
  }
  res.sendFile(path.join(clientDir, "index.html"));
});

// FINAL: 404 for unknown API endpoints (only after real routes are mounted)
app.all("/api/*", (_req: Request, res: Response) => {
  // If degraded, the stub above already responded with 503; this line is for the healthy case.
  res.status(404).json({ error: "API endpoint not found" });
});

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
