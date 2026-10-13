// server/realtime/socket-server.ts
import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { socketIoOriginOptions, socketOriginAllowed } from "../lib/cors-policy";
import { installEngineOriginGuard } from "./engine-origin-guard";

const servers = new WeakMap<HttpServer, Server>();

/**
 * The ONE Socket.IO server for an HTTP server. Both realtime modules (/dm and /notifications) obtain it here and each registers its own
 * namespace on it.
 *
 * They used to construct a `Server` apiece, both on the same HTTP server and both on path `/socket.io`. That cannot work: each
 * engine.io instance installs its own `request` and `upgrade` listeners for the path, so the later one shadowed the earlier for
 * polling (a client of the first namespace got "Invalid namespace") and, worse, a WebSocket upgrade was handed to BOTH engines, which
 * makes `ws` throw "handleUpgrade() was called more than once with the same socket". Thrown inside an `upgrade` listener that is an
 * uncaught exception, and server/index.ts exits the process on those: any remote client that opened a WebSocket to /socket.io could
 * restart ChefSire.
 *
 * Creating the server in one place also means there is exactly one origin policy (lib/cors-policy.ts) applied to every handshake,
 * whichever namespace is asked for, and none to forget when a namespace is added.
 */
export function socketIoServerFor(httpServer: HttpServer): Server {
  let io = servers.get(httpServer);
  if (!io) {
    io = new Server(httpServer, { path: "/socket.io", ...socketIoOriginOptions() });
    // `allowRequest` (above) only ever sees the FIRST request of a session; engine.io skips it for anything that carries a sid (polling
    // GET/POST, preflights, the polling->websocket probe upgrade). The guard puts the same decision in front of every engine request that carries
    // an Origin. engine.use() middleware is per engine, so it is installed here, at the one place a Server is constructed.
    installEngineOriginGuard(io, (req, origin) => socketOriginAllowed(req, origin));
    servers.set(httpServer, io);
  }
  return io;
}
