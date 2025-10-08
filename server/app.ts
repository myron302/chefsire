// server/app.ts
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import apiRouter from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(express.json());

// Find a built SPA (works with root /dist or /client/dist)
const candidates = [
  // server-relative
  path.join(__dirname, "../dist"),
  path.join(__dirname, "../dist/public"),
  path.join(__dirname, "../client/dist"),
  path.join(__dirname, "../client/dist/public"),
  // root-relative (your current Vite output)
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
  } catch {}
}

if (staticDir) {
  app.use(express.static(staticDir));
  console.log(`🗂️  Serving static frontend from: ${staticDir}`);
} else {
  console.warn("⚠️  No built frontend found. The API will run; build the client to serve the SPA.");
}

// Always-on healthcheck (no DB needed)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Mount all API routes under /api
app.use("/api", apiRouter);

// ---------- NEW: centralized error handler (shows real errors) ----------
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.status || err.code === "42P01" ? 200 : 500; // keep UI alive if table missing
  const env = process.env.NODE_ENV || "development";

  // Always log full error on server
  console.error("❌ API Error:", err);

  // In prod, don’t leak stack; in dev, show detail
  if (env === "production") {
    return res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
      code: err.code,
    });
  }

  return res.status(status).json({
    error: err.message || "Internal Server Error",
    code: err.code,
    stack: err.stack,
  });
});

// SPA fallback for client-side routing
app.get("*", (req, res, next) => {
  const wantsHtml = (req.headers.accept || "").includes("text/html");
  const isApi = req.path.startsWith("/api/");
  const looksLikeAsset = req.path.includes(".");

  if (!wantsHtml || req.method !== "GET" || isApi || looksLikeAsset) return next();
  if (!staticDir) {
    return res.status(501).send("Frontend not built. Run `npm run build` to create dist/public/index.html.");
  }
  res.sendFile(path.join(staticDir, "index.html"));
});
