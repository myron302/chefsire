import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import apiRouter from "./routes/index.js";
import authRouter from "./routes/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(express.json());

// Auth + API routes
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);

// Find built frontend
const candidates = [
  path.resolve(__dirname, "../../dist"),
  path.resolve(__dirname, "../dist"),
  path.resolve(__dirname, "../../client/dist"),
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
  console.warn("⚠️  No built frontend found in candidates. Build the client to create dist/index.html.");
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", staticDir, tested: candidates, found: Boolean(staticDir) });
});

// SPA fallback (skip real assets)
app.get(
  /^(?!\/api\/)(?!.*\.(?:js|css|map|png|jpe?g|gif|svg|ico|txt|json|webmanifest|woff2?|ttf|otf))$/i,
  (_req, res) => {
    if (!staticDir) {
      return res.status(501).type("text/plain").send("Frontend not built. Build to create dist/index.html.");
    }
    res.sendFile(path.join(staticDir, "index.html"), (err) => {
      if (err) {
        console.error("❌ Error sending index.html:", err);
        res.status(500).type("text/plain").send("Failed to serve index.html");
      }
    });
  }
);

// 404 + Error handlers
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("❌ Unexpected server error:", err);
  res.status(500).json({ error: "Internal Server Error", details: err?.message });
});
