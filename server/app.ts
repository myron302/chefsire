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

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("trust proxy", true);

app.use(cors({
  credentials: true,
  origin: process.env.CLIENT_URL || true, // Allow configured origin or all origins in dev
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(cookieParser()); // Parse cookies before Passport

// Initialize Passport
app.use(passport.initialize());

// --- Passport Serialization/Deserialization ---
// Even if not using sessions for OAuth callback, Passport still needs these for setup
// This tells Passport how to save and retrieve user data
passport.serializeUser((user: any, done) => {
  console.log("👤 Serializing user:", user.id);
  done(null, user.id); // Save only the user ID
});

passport.deserializeUser(async (id: string, done) => {
  console.log("🔄 Deserializing user with ID:", id);
  try {
    const { storage } = await import("./storage");
    const user = await storage.findById(id);
    done(null, user);
  } catch (err) {
    console.error("❌ Error deserializing user:", err);
    done(err, null);
  }
});

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

// Serve uploaded files
const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

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
    console.log('[INFO] Found client bundle at:', dir);
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

  // ALWAYS log the error
  console.error("[ERROR]", err);

  // TEMPORARY: Show full error even in production to debug OAuth issue
  res.status(500).json({
    error: "Internal Server Error",
    message: message, // Show actual error message
    stack: stack, // Show stack trace
  });
});

export default app;
