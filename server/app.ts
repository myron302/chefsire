// server/app.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(express.json());

// Serve ONLY the built frontend at ../dist
const staticDir = path.join(__dirname, "../dist");
app.use(express.static(staticDir));

// Health
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// (Mount your API routers here, e.g. app.use("/api", apiRouter);)

// SPA fallback for real page navigations (not assets or API)
app.get("*", (req, res, next) => {
  const wantsHtml = (req.headers.accept || "").includes("text/html");
  const isApi = req.path.startsWith("/api/");
  const looksLikeAsset = req.path.includes(".");
  if (req.method !== "GET" || isApi || looksLikeAsset || !wantsHtml) {
    return next();
  }
  res.sendFile(path.join(staticDir, "index.html"));
});
