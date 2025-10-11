// server/app.ts
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import apiRouter from "./routes";
import authRouter from "./routes/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(express.json());

// Auth routes
app.use("/api/auth", authRouter);

// -------------------- Static client (deterministic) --------------------
// At runtime, __dirname === /httpdocs/server/dist
// The built client lives at /httpdocs/client/dist
const clientDist = path.resolve(__dirname, "../../client/dist");
const hasClient = fs.existsSync(path.join(clientDist, "index.html"));

if (hasClient) {
  app.use(
    express.static(clientDist, {
      setHeaders: (res, file) => {
        // Ensure correct MIME for PWA manifest
        if (file.endsWith(".webmanifest")) {
          res.setHeader("Content-Type", "application/manifest+json");
        }
      },
      // Optional: add caching for static assets (tune as you like)
      // maxAge: "1h",
      // etag: true,
    })
  );
  console.log(`🗂️  Serving static frontend from: ${clientDist}`);
} else {
  console.warn("⚠️  No built frontend found. Run `npm run build:client` to create client/dist.");
}

// Healthcheck (always on)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Mount API routes
app.use("/api", apiRouter);

// -------------------- Centralized error handler --------------------
app.use((err: any, _req: any, res: any, _next: any) => {
  const env = process.env.NODE_ENV || "development";
  const status =
    typeof err?.status === "number"
      ? err.status
      : err?.code === "42P01" // missing table, keep UI alive
      ? 200
      : 500;

  console.error("❌ API Error:", err);

  if (env === "production") {
    return res.status(status).json({
      error: err?.message || "Internal Server Error",
      code: err?.code,
    });
  }

  return res.status(status).json({
    error: err?.message || "Internal Server Error",
    code: err?.code,
    stack: err?.stack,
  });
});

// -------------------- SPA fallback (skip real assets) --------------------
app.get(
  /^(?!\/api\/)(?!.*\.(?:js|css|map|png|jpe?g|gif|svg|ico|txt|json|webmanifest|woff2?|ttf|otf))$/i,
  (_req, res) => {
    if (!hasClient) {
      return res
        .status(501)
        .send("Frontend not built. Run `npm run build:client` to create client/dist/index.html.");
    }
    res.sendFile(path.join(clientDist, "index.html"));
  }
);
