// server/index.ts
import "dotenv/config";
import http from "http";
import app from "./app";
import { attachDmRealtime } from "./realtime/dmSocket";

const PORT = Number(process.env.PORT || 3001);

// Create the raw HTTP server so Socket.IO can hook in
const server = http.createServer(app);

// Attach DM realtime namespace at /socket.io and /dm
attachDmRealtime(server);

server.listen(PORT, () => {
  console.log(
    `[ChefSire] API listening on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || "development"})`
  );
});
