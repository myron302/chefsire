// server/index.ts
import { app } from "./app";

const env = process.env.NODE_ENV || "development";
const envPort = process.env.PORT;

// In production (e.g., Plesk), we MUST use the provided PORT. No fallback.
if (env === "production") {
  if (!envPort) {
    console.error(
      "❌ FATAL: No PORT provided in environment. In Plesk, set PORT in the Node.js app settings."
    );
    process.exit(1);
  }
}

const parsePort = (p: string | undefined): number | null => {
  if (!p) return null;
  const n = Number(p);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) return null;
  return n;
};

const port = parsePort(envPort) ?? (env === "development" ? 3000 : null);

if (port == null) {
  console.error(
    "❌ FATAL: Invalid or missing PORT. " +
      (env === "development"
        ? "Dev mode defaults to 3000—this should never happen."
        : "In Plesk production, set a valid integer PORT in the Node.js app settings.")
  );
  process.exit(1);
}

const host = "0.0.0.0";

const server = app.listen(port, host, () => {
  const from = envPort ? "process.env.PORT" : "dev default";
  console.log(
    `✅ Server listening on http://${host}:${port} — NODE_ENV=${env} (source: ${from})`
  );
});

server.on("error", (err: any) => {
  if (err?.code === "EADDRINUSE") {
    console.error(
      `❌ Port ${port} is already in use.\n` +
        `• On Plesk: open the Node.js app page and change the PORT to a free one (or click "Generate port"), then click "Restart".\n` +
        `• Make sure you don't have another app/site using the same PORT.`
    );
  } else {
    console.error("❌ Server error:", err);
  }
  process.exit(1);
});
