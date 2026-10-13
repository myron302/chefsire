// server/app.ts
import "./lib/load-env";
import express, { Request, Response, NextFunction } from "express";
import compression from "compression";
import morgan from "morgan";
import passport from "passport";
import cookieParser from "cookie-parser";
import path from "node:path";
import routes from "./routes";
import { setupGoogleOAuth } from "./services/google-oauth.service";
import { setupFacebookOAuth } from "./services/facebook-oauth.service";
import { setupTikTokOAuth } from "./services/tiktok-oauth.service";
import { UPLOADS_DIR } from "./lib/uploads-dir";
import { uploadsStaticHandler } from "./lib/uploads-static";
import { CLIENT_STATIC_DIR_CANDIDATES, resolveClientStaticDir } from "./lib/public-static-dirs";
import { createCorsMiddleware, currentCorsPolicy } from "./lib/cors-policy";
import { resolveTrustProxy, TrustProxyConfigError, type TrustProxyResolution } from "./lib/proxy-trust";

const app = express();

// Which peer is a trusted reverse proxy. Default: one hop (the direct peer is the proxy -- nginx/Passenger on the same Plesk host), unchanged from
// when this was a literal `1`. Configurable and validated through TRUST_PROXY (see lib/proxy-trust), because the SAME decision also governs how
// the browser-origin checks read X-Forwarded-Proto, including on Socket.IO requests that never pass through Express.
// With a hop count, `req.ip` is the RIGHTMOST X-Forwarded-For entry (the one the nearest proxy appended), so extra entries a client prepends are
// ignored; `req.protocol` and `req.hostname` take the LEFTMOST X-Forwarded-Proto / -Host (Express's rule), which is why the origin checks do not
// use them. An invalid TRUST_PROXY stops the server from starting rather than silently trusting the wrong peers.
let trustProxy: TrustProxyResolution;
try {
  trustProxy = resolveTrustProxy();
} catch (error) {
  if (error instanceof TrustProxyConfigError) {
    console.error(`[ChefSire] Refusing to start — ${error.message}`);
    process.exit(1);
  }
  throw error;
}
app.set("trust proxy", trustProxy.setting);
console.log(`✓ trust proxy: ${trustProxy.description}${trustProxy.source === "env" ? " (TRUST_PROXY)" : ""}`);

// Browser origin policy: an explicit allowlist (CLIENT_URL, APP_BASE_URL, APP_URL, CORS_ALLOWED_ORIGINS, and CORS_DEV_ORIGINS outside
// production) that fails closed. This used to be `cors({ credentials: true, origin: process.env.CLIENT_URL || true })`, which reflected
// ANY origin with credentials whenever CLIENT_URL was missing. The same policy guards both Socket.IO servers. See lib/cors-policy.ts.
currentCorsPolicy(); // resolve now so configuration warnings print at boot, not on the first cross-origin request
app.use(createCorsMiddleware());
app.use(express.json({
  limit: "2mb",
  verify: (req, _res, buf) => {
    (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
  },
}));
app.use(express.urlencoded({
  extended: true,
  limit: "2mb",
  verify: (req, _res, buf) => {
    (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
  },
}));
app.use(compression());
app.use(cookieParser()); // Parse cookies before Passport

// Initialize Passport
app.use(passport.initialize());

// Setup OAuth providers
setupGoogleOAuth();
setupFacebookOAuth();
setupTikTokOAuth();

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Health
app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || "development" });
});

// API routes (mounted under /api)
app.use("/api", routes);

// Optional API banner (at /api)
app.get("/api", (_req, res) => {
  res.json({
    name: "ChefSire API",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// Serve uploaded files — UPLOADS_DIR is the canonical absolute path shared by all write sites
// (routes/upload.ts, lib/data-uri.ts, routes/auth.ts, etc.). The mount's headers, and why they are what they
// are, live in lib/uploads-static so the application and its tests exercise one handler.
app.use("/uploads", uploadsStaticHandler(UPLOADS_DIR));

// Serve built client at dist/public. The candidate locations and the choice between them live in
// lib/public-static-dirs, which is also what private booking storage validates itself against: this mount is
// unauthenticated, so the isolation check has to be reading the same list the app actually serves from.
const clientDir = resolveClientStaticDir() ?? "";
const hasClient = clientDir !== "";

if (!hasClient) {
  console.warn('[WARN] Client bundle not found. Checked:', CLIENT_STATIC_DIR_CANDIDATES);
}

if (hasClient) {
  app.use(
    express.static(clientDir, {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );
}

// SPA fallback for any non-API route
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (!hasClient) {
    return res
      .status(200)
      .send("Client bundle not found. Build UI with `npm run build` to populate dist/public.");
  }
  // Never cache index.html so browsers always get the latest asset hashes
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(clientDir, "index.html"));
});

// FINAL: 404 for unknown API paths (keep this at the end)
app.all("/api/*", (_req: Request, res: Response) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Detail (message and stack, which for a database failure means driver text, host names and SQL) is returned only when the runtime
  // is EXPLICITLY "development". It used to be returned whenever NODE_ENV was anything but "production", so an unset, misspelled,
  // "test" or "staging" environment answered every unhandled error with its stack trace.
  const exposeDetail = process.env.NODE_ENV === "development";
  const message = err instanceof Error ? err.message : "Unknown error";
  const stack = err instanceof Error ? err.stack : undefined;

  // ALWAYS log the error server-side
  console.error("[ERROR]", err);

  if (!exposeDetail) {
    res.status(500).json({ error: "Internal Server Error" });
  } else {
    // In development, include details for debugging
    res.status(500).json({
      error: "Internal Server Error",
      message,
      stack,
    });
  }
});

export default app;
