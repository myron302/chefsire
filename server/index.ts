import express from "express";
import path from "node:path";
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
app.use(express.static(path.resolve(__dirname, "../client/dist")));

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// SPA fallback - serve index.html for all non-API routes
app.get("*", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../client/dist/index.html"));
});

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});
