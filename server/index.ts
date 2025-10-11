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

// Auth and API routes
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);

// Serve static files from client/dist
const clientDistPath = path.resolve(__dirname, "../../client/dist");

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  console.log(`🗂️  Serving static files from: ${clientDistPath}`);
} else {
  console.warn("⚠️  Client dist folder not found. Run 'npm run build:client' first.");
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// SPA fallback - serve index.html for all non-API routes
app.get("*", (_req, res) => {
  const indexPath = path.join(clientDistPath, "index.html");
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Frontend not built. Please run 'npm run build:client'.");
  }
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});
