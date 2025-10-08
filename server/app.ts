// server/app.ts
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Extra middleware for a sturdier server
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import apiRouter from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// --- Core hardening & DX middleware ---
app.set("trust proxy", 1); // respect X-Forwarded-* headers behind proxies
app.use(helmet());
app.use(
  cors({
    origin: true, // reflect origin
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// --- Static SPA discovery (your original logic, kept) ---
const candidates = [
  // server-relative
  path.join(__dirname, "../dist"),
  path.join(__dirname, "../dist/public"),
  path.join(__dirname, "../client/dist"),
  path.join(__dirname, "../client/dist/public"),
  // root-relative (Vite output)
  path.join(__dirname, "../../dist"),
  path.join(__dirname, "../../dist/public"),
  path.join(__dirname, "../../client/dist"),
  path.join(__dirname, "../../client/dist/public"),
];

let staticDir: string | null = null;
for (const p of candidates) {
  try {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
      staticDir = p;
      break;
    }
  } catch {
    // ignore fs errors and continue searching
  }
}

if (staticDir) {
  app.use(express.static(staticDir));
  console.log(`🗂️  Serving static frontend from: ${staticDir}`);
} else {
  console.warn("⚠️  No built frontend found. The API will run; build the client to serve the SPA.");
}

// --- Health checks (always-on, no DB) ---
app.get("/", (_req, res) => {
  res.type("text").send("ChefSire API is up ✅");
});
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// --- API routes mounted under /api ---
app.use("/api", apiRouter);

// --- API 404 (only for /api/* that didn’t match above) ---
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// --- Global error handler (last before SPA fallback) ---
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const status = err?.status || 500;
    const payload: Record<string, any> = {
      error: err?.message || "Internal Server Error",
    };
    if (process.env.NODE_ENV !== "production" && err?.stack) {
      payload.stack = err.stack;
    }
    res.status(status).json(payload);
  }
);

// --- SPA fallback for client-side routing (only when static is available) ---
app.get("*", (req, res, next) => {
  const wantsHtml = (req.headers.accept || "").includes("text/html");
  const isApi = req.path.startsWith("/api/");
  const looksLikeAsset = req.path.includes(".");

  if (!wantsHtml || req.method !== "GET" || isApi || looksLikeAsset) {
    return next();
  }
  if (!staticDir) {
    return res
      .status(501)
      .send(
        "Frontend not built. Run `npm run build` to create dist/public/index.html."
      );
  }
  res.sendFile(path.join(staticDir, "index.html"));
});
