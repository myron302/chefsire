import { app } from "./app";

const env = process.env.NODE_ENV || "development";
const rawPort = process.env.PORT;
const port = Number(rawPort) > 0 ? Number(rawPort) : 3000;
const host = "0.0.0.0";

console.log("🔧 Starting server...", { env, rawPort, finalPort: port });

try {
  const server = app.listen(port, host, () => {
    console.log(`✅ Server listening on http://${host}:${port} — NODE_ENV=${env}`);
  });
  server.on("error", (err: any) => {
    console.error("❌ Server failed to start:", err);
    process.exit(1);
  });
} catch (err) {
  console.error("❌ Fatal startup error:", err);
  process.exit(1);
}
