import { app } from "./app.js";

const envPort = process.env.PORT;
const port = Number.isInteger(Number(envPort)) ? Number(envPort) : 3000;

const host = "0.0.0.0";

const server = app.listen(port, host, () => {
  const env = process.env.NODE_ENV || "development";
  if (envPort) {
    console.log(`✅ Server running on port ${port} (from process.env.PORT) — NODE_ENV=${env}`);
  } else {
    console.log(`✅ Server running on fallback port ${port} (no process.env.PORT set) — NODE_ENV=${env}`);
  }
});

// Friendly shutdown
const shutdown = (sig: string) => {
  console.log(`\nReceived ${sig}, shutting down...`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
