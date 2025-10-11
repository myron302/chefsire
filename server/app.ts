import express from "express";

export const app = express();
app.use(express.json());

// Simple health route to verify the server is alive
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", mode: "safe" });
});

// Root route (so Plesk shows this instead of its error page)
app.get("/", (_req, res) => {
  res
    .status(200)
    .type("text/plain")
    .send("✅ Server is running (SAFE MODE). Static files and routes disabled for now.");
});

// 404 handler (optional, but helps confirm routing works)
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler for unexpected issues
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("❌ Unexpected server error:", err);
  res.status(500).json({ error: "Internal Server Error", details: err?.message });
});
