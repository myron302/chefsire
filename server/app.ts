// server/app.ts
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import apiRouter from "./routes";
import authRouter from "./routes/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(express.json());

// ---------------- Auth + API ----------------
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);

// --------------- Static client ---------------
// At runtime, __dirname === /httpdocs/server/dist
// Built client lives at:   /httpdocs/client/dist
const clientDist = path.resolve(__dirname, "../../client/dist");
const indexHtml = path.join(clientDist, "index.html");
const hasClient = fs.existsSync(indexHtml);

if (hasClient) {
  app.use(
    express.static(clientDist, {
      setHeaders: (res, file) => {
        // Serve correct MIME for PWA manifest
        if (file.endsWith(".webmanifest")) {
          res.setHeader("Content-Type", "application/manifest+json");
        }
      },
    })
  );
  console.log(`🗂️  Serving static frontend from: ${clientDist}`);
} else {
  console.warn("⚠️  No built frontend found. Run `npm run build:client` to create client/dist.");
}

// ---------------- Healthcheck ----------------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", clientDist, hasClient });
});

// --------------- SPA fallback ----------------
// Serve index.html for non-API, non-static GET routes.
// IMPORTANT: exclude real asset extensions (incl. .webmanifest)
// so they are NOT replaced by HTML.
app.get(
  /^(?!\/api\/)(?!.*\.(?:js|css|map|png|jpe?g|gif|svg|ico|txt|json|webmanifest|woff2?|ttf|otf))$/i,
  (_req, res) => {
    if (!hasClient) {
      return res
        .status(501)
        .type("text/plain")
        .send("Frontend not built. Run `npm run build:client` first.");
    }
    res.sendFile(indexHtml, (err) => {
      if (err) {
        console.error("❌ Error sending index.html:", err);
        res.status(500).type("text/plain").send("Failed to serve index.html");
      }
    });
  }
);

// -------- Centralized error handler ----------
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("❌ API Error:", err);
  const status =
    typeof err?.status === "number"
      ? err.status
      : err?.code === "42P01" // missing table; keep UI alive
      ? 200
      : 500;

  // In production we avoid leaking stacks; message is enough
  res.status(status).json({
    error: err?.message || "Internal Server Error",
    code: err?.code,
  });
});
