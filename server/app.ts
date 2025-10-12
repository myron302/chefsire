// server/app.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";
import routes from "./routes";

const app = express();

// ---- App-level settings ----
app.set("trust proxy", true);

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Log verbosely only in dev
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ---- Health ----
app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || "development" });
});

// ---- API FIRST (mounted under /api) ----
app.use("/api", routes);

// Helpful API root info
app.get("/api", (_req, res) => {
  res.json({
    name: "ChefSire API",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// 404 for unknown API paths
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

// ---- Serve built client (Vite output at /httpdocs/dist/public) ----
// NOTE: App root is /httpdocs/server, so UI is one level up:
const clientDir = path.resolve(process.cwd(), "../dist/public");
const hasClient = fs.existsSync(clientDir);

// Only mount static if it exists (avoid 500s)
if (hasClient) {
  app.use(express.static(clientDir, {
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    }
  }));
}

// ---- SPA fallback for all non-API routes ----
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();

  if (!hasClient) {
    // Friendly fallback instead of a 500 if the client bundle isn't present
    return res
      .status(200)
      .send("Client bundle not found. Build the UI with `npm run build` to populate /httpdocs/dist/public.");
  }

  res.sendFile(path.join(clientDir, "index.html"));
});

// ---- Global error handler ----
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
