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

// Mount auth routes
app.use("/api/auth", authRouter);

// Mount API routes
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
  app.use(express.static(staticDir));
  console.log(`🗂️  Serving static from: ${staticDir}`);
} else {
  console.warn("⚠️  No built frontend found.");
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", staticDir });
});

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("❌ Error:", err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Internal Server Error",
    code: err.code,
  });
});

// SPA fallback
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  
  if (!staticDir) {
    return res.status(501).send("Frontend not built");
  }
  
  res.sendFile(path.join(staticDir, "index.html"));
});
