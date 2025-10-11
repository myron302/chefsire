import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(express.json());

// Enhanced global error handling
process.on("uncaughtException", (e) => {
  console.error("❌ Uncaught Exception:", e);
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.error("❌ Unhandled Rejection:", e);
  process.exit(1);
});

// Request logging
app.use((req, _res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// ---- Dynamic route loading with better error handling ----
let apiRouter: any = null;
let authRouter: any = null;

try {
  console.log("🔄 Attempting to load API routes from ./routes/index.js");
  const routes = await import("./routes/index.js");
  apiRouter = routes.default || routes.apiRouter;
  console.log("✅ API routes loaded successfully");
} catch (err) {
  console.error("❌ Failed to load API routes:", err);
  // Fallback: Log available files for debug
  try {
    const files = fs.readdirSync(path.join(__dirname, "routes"));
    console.log("📁 Available files in routes/:", files);
  } catch {}
}

try {
  console.log("🔄 Attempting to load Auth routes from ./routes/auth.js");
  const auth = await import("./routes/auth.js");
  authRouter = auth.default || auth.authRouter;
  console.log("✅ Auth routes loaded successfully");
} catch (err) {
  console.error("❌ Failed to load Auth routes:", err);
  // Fallback: Log available files
  try {
    const files = fs.readdirSync(path.join(__dirname, "routes"));
    console.log("📁 Available files in routes/:", files);
  } catch {}
}

// Mount routers if loaded
if (authRouter) {
  app.use("/api/auth", authRouter);
  console.log("🔗 Mounted /api/auth router");
}
if (apiRouter) {
  app.use("/api", apiRouter);
  console.log("🔗 Mounted /api router");
} else {
  console.warn("⚠️ No API router mounted - API endpoints unavailable");
}

// Health endpoint (always up, reports route status)
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    routes: { 
      api: Boolean(apiRouter), 
      auth: Boolean(authRouter) 
    },
    env: process.env.NODE_ENV || "unknown",
    port: process.env.PORT || 3001
  });
});

// ---- Static files serving (with icon/manifest support) ----
const candidates = [
  path.resolve(__dirname, "public"),  // Dev: if running from server/
  path.resolve(__dirname, "../dist/public"),  // Build: dist/public relative to server/dist
  path.resolve(__dirname, "../../dist/public"),  // Alt build path
  path.resolve(__dirname, "../../client/dist"),  // Legacy client build
];

let staticDir: string | null = null;
for (const p of candidates) {
  const indexPath = path.join(p, "index.html");
  try {
    if (fs.existsSync(indexPath)) {
      staticDir = p;
      console.log(`🗂️ Found static dir: ${staticDir}`);
      console.log(`📄 index.html exists: ${indexPath}`);
      // Quick check for manifest/icons
      const manifestPath = path.join(p, "site.webmanifest");
      const faviconPath = path.join(p, "favicon.ico");
      console.log(`🔍 site.webmanifest: ${fs.existsSync(manifestPath)}`);
      console.log(`🔍 favicon.ico: ${fs.existsSync(faviconPath)}`);
      break;
    }
  } catch (err) {
    console.warn(`⚠️ Check failed for ${p}:`, err);
  }
}

if (staticDir) {
  app.use(
    express.static(staticDir, {
      setHeaders: (res, filePath) => {
        const ext = path.extname(filePath);
        if (ext === ".webmanifest") {
          res.setHeader("Content-Type", "application/manifest+json");
        } else if (ext === ".ico") {
          res.setHeader("Content-Type", "image/x-icon");
        } else if (ext === ".png") {
          res.setHeader("Content-Type", "image/png");
        }
      },
    })
  );
  console.log(`🌐 Serving static files from: ${staticDir}`);
} else {
  console.error("❌ No static directory found! Candidates checked:");
  candidates.forEach(p => console.log(`  - ${p} (index.html exists: ${fs.existsSync(path.join(p, "index.html"))})`));
}

// SPA fallback for client-side routing
app.get("*", (req, res, next) => {
  // Block API paths from fallback
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found", path: req.path });
  }
  // If no static dir, 501
  if (!staticDir) {
    return res.status(501).json({ error: "Frontend not built - run 'npm run build:client'" });
  }
  // Serve index.html for SPA routes
  const indexPath = path.join(staticDir, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("❌ Error serving index.html:", err);
      res.status(500).json({ error: "Failed to serve frontend" });
    } else {
      console.log(`📤 Served SPA fallback for: ${req.path}`);
    }
  });
});

// 404 for unmatched API (after all mounts)
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found", path: req.path });
});

// Global error handler (last middleware)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("💥 Global error:", err);
  res.status(500).json({ error: "Internal server error" });
});

console.log("✅ App configured successfully");
