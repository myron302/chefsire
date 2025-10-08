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

// Try to locate a built SPA (multiple common output locations)
const candidates = [
  // server-relative
  path.join(__dirname, "../dist"),
  path.join(__dirname, "../dist/public"),
  path.join(__dirname, "../client/dist"),
  path.join(__dirname, "../client/dist/public"),
  // repo root relative
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

// Healthcheck
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API
app.use("/api", apiRouter);

// SPA fallback
app.get("*", (req, res, next) => {
  const wantsHtml = (req.headers.accept || "").includes("text/html");
  const isApi = req.path.startsWith("/api/");
  const looksLikeAsset = req.path.includes(".");

  if (!wantsHtml || req.method !== "GET" || isApi || looksLikeAsset) return next();
  if (!staticDir) {
    return res
      .status(501)
      .send("Frontend not built. Run `npm run build` to create dist/public/index.html.");
  }
  res.sendFile(path.join(staticDir, "index.html"));
});
