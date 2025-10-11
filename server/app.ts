import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());

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
  app.use(express.static(staticDir));
  console.log(`🗂️  Serving static frontend from: ${staticDir}`);
} else {
  console.warn("⚠️  No built frontend found.");
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", staticDir });
});

// SPA fallback
app.get("*", (_req, res) => {
  if (!staticDir) {
    return res.status(500).send("Frontend not built");
  }
  res.sendFile(path.join(staticDir, "index.html"));
});

// START SERVER
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
