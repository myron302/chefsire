// server/app.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import passport from "passport";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import routes from "./routes";
import { setupGoogleOAuth } from "./services/google-oauth.service";
import { setupFacebookOAuth } from "./services/facebook-oauth.service";
import { setupTikTokOAuth } from "./services/tiktok-oauth.service";
import { UPLOADS_DIR } from "./lib/uploads-dir";

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust exactly one proxy hop (nginx on the same Plesk VPS).
// This ensures req.ip comes from the first X-Forwarded-For entry
// set by nginx, rather than trusting the entire chain which would
// let attackers spoof their IP via extra X-Forwarded-For headers.
app.set("trust proxy", 1);

app.use(cors({
  credentials: true,
  origin: process.env.CLIENT_URL || true, // Allow configured origin or all origins in dev
}));
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

// Serve uploaded files — UPLOADS_DIR is the canonical absolute path shared by
// all write sites (routes/upload.ts, lib/data-uri.ts, routes/auth.ts, etc.).
const uploadContentTypes: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    maxAge: "365d",
    immutable: true,
    setHeaders: (res, filePath) => {
      const contentType = uploadContentTypes[path.extname(filePath).toLowerCase()];
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
    },
  }),
);

// Serve built client at dist/public
// Try multiple possible locations for the client build
const possibleClientDirs = [
  path.resolve(process.cwd(), "dist/public"),      // If running from project root
  path.resolve(process.cwd(), "../dist/public"),   // If running from server/ directory
  path.resolve(__dirname, "../../dist/public"),    // Relative to bundled server location
];

let clientDir = "";
let hasClient = false;

for (const dir of possibleClientDirs) {
  if (fs.existsSync(dir)) {
    clientDir = dir;
    hasClient = true;
    break;
  }
}

if (!hasClient) {
  console.warn('[WARN] Client bundle not found. Checked:', possibleClientDirs);
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
  const isProd = process.env.NODE_ENV === "production";
  const message = err instanceof Error ? err.message : "Unknown error";
  const stack = err instanceof Error ? err.stack : undefined;

  // ALWAYS log the error server-side
  console.error("[ERROR]", err);

  if (isProd) {
    // Never expose internal details to clients in production
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
