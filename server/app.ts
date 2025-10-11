import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Enable JSON parsing
app.use(express.json());

// IMPORTANT: Log all requests to debug routing issues
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Import routes - try/catch to handle missing routes gracefully
let apiRouter: any = null;
let authRouter: any = null;

try {
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

// Mount routes BEFORE static files
if (authRouter) {
  app.use("/api/auth", authRouter);
}

if (apiRouter) {
  app.use("/api", apiRouter);
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ 
    status: "ok", 
    routes: {
      auth: !!authRouter,
      api: !!apiRouter
    }
  });
});

// Find built frontend
const candidates = [
  path.resolve(__dirname, "../../dist"),
  path.resolve(__dirname, "../dist"),
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
  console.warn("⚠️  No built frontend found in candidates.");
}

// SPA fallback - serve index.html for client-side routes
// This MUST come after API routes and static files
app.get("*", (req, res) => {
  // Don't serve HTML for API requests that got here by mistake
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found", path: req.path });
  }

  if (!staticDir) {
    return res.status(501).send("Frontend not built");
  }

  res.sendFile(path.join(staticDir, "index.html"), (err) => {
    if (err) {
      console.error("❌ Error sending index.html:", err);
      res.status(500).send("Failed to serve index.html");
    }
  });
});

// Error handler
app.use((err: any, req: any, res: any, _next: any) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: err?.message,
    path: req.path
  });
});
