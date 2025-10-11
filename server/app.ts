import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(express.json());

// Log early errors
process.on("uncaughtException", (e) => {
  console.error("uncaughtException:", e);
});
process.on("unhandledRejection", (e) => {
  console.error("unhandledRejection:", e);
});

// Request log (helps verify ordering)
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ---- Load routers *dynamically* and guard failures ----
let apiRouter: any = null;
let authRouter: any = null;

try {
  // in the built app (server/dist/app.js), these files exist as .js
  const routes = await import("./routes/index.js");
  apiRouter = routes.default;
  console.log("✅ API routes loaded");
} catch (err) {
  console.error("❌ Failed to load API routes:", err);
}

try {
  const auth = await import("./routes/auth.js");
  authRouter = auth.default;
  console.log("✅ Auth routes loaded");
} catch (err) {
  console.error("❌ Failed to load auth routes:", err);
}

// Mount API before static/SPA
if (authRouter) app.use("/api/auth", authRouter);
if (apiRouter) app.use("/api", apiRouter);

// Health endpoint always available
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    routes: { api: Boolean(apiRouter), auth: Boolean(authRouter) },
  });
});

// ---- Static files (Vite build into server/dist/public) ----
const candidates = [
  path.resolve(__dirname, "public"),
  path.resolve(__dirname, "../dist/public"),
  path.resolve(__dirname, "../../dist/public"),
  path.resolve(__dirname, "../../client/dist"),
];

let staticDir: string | null = null;
for (const p of candidates) {
  try {
    if (fs.existsSync(path.join(p, "index.html"))) {
      staticDir = p;
      break;
    }
  } catch {}
}

if (staticDir) {
  app.use(
    express.static(staticDir, {
      setHeaders: (res, file) => {
        if (file.endsWith(".webmanifest")) {
          res.setHeader("Content-Type", "application/manifest+json");
        }
      },
    })
  );
  console.log(`🗂️  Serving static frontend from: ${staticDir}`);
} else {
  console.warn("⚠️  No built frontend found.");
}

// SPA fallback (after API & static)
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found", path: req.path });
  }
  if (!staticDir) return res.status(501).send("Frontend not built");
  res.sendFile(path.join(staticDir, "index.html"), (err) => {
    if (err) {
      console.error("❌ Error sending index.html:", err);
      res.status(500).send("Failed to serve index.html");
    }
  });
});
