// server/index.ts
import "dotenv/config";
import app from "./app";
import { attachDmRealtime } from "./realtime/dmSocket";
import { attachNotificationRealtime } from "./realtime/notificationSocket";

const HAS_PASSENGER_PORT = !!process.env.PORT;
const PORT = Number(process.env.PORT || 3001);

// On Plesk/Passenger, bind to 127.0.0.1 (Passenger reverse-proxies to us).
// For local/dev, 0.0.0.0 is fine.
const HOST = process.env.HOST || (HAS_PASSENGER_PORT ? "127.0.0.1" : "0.0.0.0");

console.log(
  `[ChefSire] Booting… NODE_ENV=${process.env.NODE_ENV || "development"} | HOST=${HOST} | PORT=${PORT}${
    HAS_PASSENGER_PORT ? " (from Passenger)" : ""
  }`
);

// Database connection check
if (!process.env.DATABASE_URL) {
  console.error("⚠️  WARNING: DATABASE_URL is not set! Database operations will fail.");
} else {
  console.log("✓ DATABASE_URL is configured");
}

const server = app.listen(PORT, HOST, () => {
  console.log(`[ChefSire] Listening on http://${HOST}:${PORT}`);
});

// Attach WebSocket handlers
attachDmRealtime(server);
const notificationHelper = attachNotificationRealtime(server);

// Export notification helper for use in other parts of the app
export { notificationHelper };

// Robust error handling—exit so Passenger restarts us and shows the real log line
server.on("error", (err: any) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `[ChefSire] EADDRINUSE on port ${PORT}. In production (Plesk/Passenger) you must use process.env.PORT.`
    );
  } else if (err && err.code === "EACCES") {
    console.error(`[ChefSire] EACCES on port ${PORT}. Try a non-privileged port (>1024).`);
  } else {
    console.error("[ChefSire] Server error:", err);
  }
  process.exit(1);
});

process.on("unhandledRejection", (e) => {
  console.error("[ChefSire] Unhandled promise rejection:", e);
  process.exit(1);
});

process.on("uncaughtException", (e) => {
  console.error("[ChefSire] Uncaught exception:", e);
  process.exit(1);
});
