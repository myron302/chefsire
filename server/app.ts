import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import apiRouter from "./routes/index"; // <-- static import
import authRouter from "./routes/auth"; // signup routes

export const app = express();
app.use(express.json());

// (optional) request log to debug routing
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// --- Mount API FIRST ---
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);

// Health
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --- Static files (Vite build) ---
// When this code runs from server/dist, the built client is at server/dist/public
const candidates = [
  path.resolve(__dirname, "public"),              // vite outDir when bundled
  path.resolve(__dirname, "../dist/public"),      // safety
  path.resolve(__dirname, "../../dist/public"),   // safety
  path.resolve(__dirname, "../../client/dist"),   // legacy
];

let staticDir: string | null = null;
for (const p of candidates) {
  try {
    if (fs.existsSync(path.join(p, "index.html"))) {
      staticDir = p;
      break;
    }
  } catch {}
}

if (staticDir) {
  app.use(
    express.static(staticDir, {
      setHeaders: (res, file) => {
        if (file.endsWith(".webmanifest")) {
          res.setHeader("Content-Type", "application/manifest+json");
        }
      },
    })
  );
  console.log(`🗂️  Serving static frontend from: ${staticDir}`);
} else {
  console.warn("⚠️  No built frontend found. Build the client to create dist/public/index.html.");
}

// --- SPA fallback (AFTER API & static) ---
app.get("*", (req, res) => {
  // never serve index.html to /api/*
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found", path: req.path });
  }
  if (!staticDir) return res.status(501).send("Frontend not built");

  res.sendFile(path.join(staticDir, "index.html"), (err) => {
    if (err) {
      console.error("❌ Error sending index.html:", err);
      res.status(500).send("Failed to serve index.html");
    }
  });
});
