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

// CRITICAL: API routes MUST come before static files
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

// SPA fallback - ONLY for non-API, non-asset routes
// This must come AFTER all API routes and static files
app.get("*", (req, res, next) => {
  // Skip if it's an API route that somehow got here
  if (req.path.startsWith("/api/")) {
    return next();
  }

  // Skip if it looks like a file with extension
  if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
    return next();
  }

  // Serve index.html for client-side routing
  if (!staticDir) {
    return res.status(501).type("text/plain").send("Frontend not built. Build to create dist/index.html.");
  }

  res.sendFile(path.join(staticDir, "index.html"), (err) => {
    if (err) {
      console.error("❌ Error sending index.html:", err);
      res.status(500).type("text/plain").send("Failed to serve index.html");
    }
  });
});

// 404 for anything that fell through
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// Error handler
app.use((err: any, req: any, res: any, _next: any) => {
  console.error("❌ Unexpected server error:", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    details: err?.message,
    path: req.path 
  });
});
