import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(express.json());

// Try to import routes, but don't crash if they don't exist
try {
  const { default: apiRouter } = await import("./routes/index.js");
  app.use("/api", apiRouter);
  console.log("✅ API routes loaded");
} catch (err) {
  console.warn("⚠️  API routes not found, skipping");
}

try {
  const { default: authRouter } = await import("./routes/auth.js");
  app.use("/api/auth", authRouter);
  console.log("✅ Auth routes loaded");
} catch (err) {
  console.warn("⚠️  Auth routes not found, skipping");
}

// Find the dist folder
const possiblePaths = [
  path.resolve(__dirname, "../../dist"),
  path.resolve(__dirname, "../dist"),
  path.resolve(__dirname, "../../client/dist"),
];

let distPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(path.join(p, "index.html"))) {
    distPath = p;
    console.log(`✅ Found dist at: ${distPath}`);
    break;
  }
}

if (distPath) {
  app.use(express.static(distPath));
} else {
  console.error("❌ Could not find dist folder with index.html in any of:", possiblePaths);
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ 
    status: "ok",
    distPath,
    __dirname,
    checkedPaths: possiblePaths
  });
});

// SPA fallback - serve index.html for all non-API routes
app.get("*", (_req, res) => {
  if (!distPath) {
    return res.status(500).send("Frontend build not found. Checked paths: " + possiblePaths.join(", "));
  }
  
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send("index.html not found at: " + indexPath);
  }
});

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// START THE SERVER
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Serving from: ${distPath || 'NOT FOUND'}`);
});
