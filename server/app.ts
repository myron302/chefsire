import express, { NextFunction, Request, Response } from "express";
import path from "path";
import morgan from "morgan";
import compression from "compression";
import helmet from "helmet";
import session from "express-session";
import MemoryStore from "memorystore";
import routes from "./routes/index.js";

// --- App ---
export const app = express();

// Trust proxy (Plesk / reverse proxy)
app.set("trust proxy", 1);

// Basic hardening
app.use(
  helmet({
    contentSecurityPolicy: false, // keep simple; your client bundle handles this
  })
);

// Logging (dev-friendly)
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Optional session (safe defaults; only if you use req.session elsewhere)
const MemStore = MemoryStore(session);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    store: new MemStore({ checkPeriod: 1000 * 60 * 60 }), // prune each hour
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // set true if you terminate TLS before Node and trust proxy is configured
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// Simple health
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    hasServerKey: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    hasBrowserKey: Boolean(process.env.GOOGLE_MAPS_JS_BROWSER_KEY),
  });
});

// Mount all API routes (your routes/index.ts already mounts /google etc.)
app.use("/api", routes);

// ---------- Static frontend ----------
// Adjust to where Vite outputs your built client
const publicDir = path.resolve(process.cwd(), "dist", "public");
app.use(express.static(publicDir, { maxAge: "1h", index: false }));

// SPA fallback (serves index.html for non-/api routes)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) next(err);
  });
});

// ---------- Error handling ----------
app.use((req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  const code = typeof err?.status === "number" ? err.status : 500;
  res.status(code).json({
    error: "server_error",
    message: err?.message || "Unexpected error",
  });
});
