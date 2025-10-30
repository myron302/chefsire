import "dotenv/config";
import app from "./app";

// ✅ Realtime sockets for DMs
import http from "node:http";
import { attachDmRealtime } from "./realtime/dmSocket";

const PORT = Number(process.env.PORT || 3001);

// Create HTTP server so Socket.IO can attach
const server = http.createServer(app);

// Attach DM namespace under /socket.io → /dm
attachDmRealtime(server);

server.listen(PORT, () => {
  console.log(
    `[ChefSire] API listening on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || "development"})`
  );
});
