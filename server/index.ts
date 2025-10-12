// server/index.ts
import "dotenv/config";
import http from "node:http";
import app from "./app";

const PORT = Number(process.env.PORT) || 3001;

const server = http.createServer(app);

server.listen(PORT, () => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`➡️  ChefSire API listening on port ${PORT}`);
  }
});

const shutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down...`);
  server.close((err?: Error) => {
    if (err) {
      console.error("Error during server close:", err);
      process.exit(1);
    }
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
