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

/**
 * Serve the built frontend.
 * Tries ../dist first (repo root build), then ../client/dist (client-only build).
 */
const candidateDirs = [
  path.join(__dirname, "../dist"),
  path.join(__dirname, "../client/dist"),
];

let staticDir: string | null = null;
for (const p of candidateDirs) {
  if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
    staticDir = p;
    break;
  }
}

if (staticDir) {
  app.use(express.static(staticDir));
  console.log(`🗂️  Serving static frontend from: ${staticDir}`);
} else {
  console.warn(
    "⚠️  No built frontend found (looked for ../dist or ../client/dist). " +
      "API will run, but the SPA won't be served until you build the client."
  );
}

/** Mount all API routes under /api */
app.use("/api", apiRouter);

/**
 * SPA fallback for real page navigations (not assets or API).
 * Sends back index.html so the client router can handle it.
 */
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
        "Frontend not built. Please build the client (e.g. `npm run build`) so index.html exists."
      );
  }

  res.sendFile(path.join(staticDir, "index.html"));
});
