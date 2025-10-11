import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(express.json());

// ---------- STATIC FRONTEND ----------
/**
 * Runtime __dirname will be: /httpdocs/server/dist
 * Built client is at:        /httpdocs/client/dist
 */
const clientDist = path.resolve(__dirname, "../../client/dist");
const indexHtml = path.join(clientDist, "index.html");
const hasClient = fs.existsSync(indexHtml);

if (hasClient) {
  app.use(
    express.static(clientDist, {
      setHeaders: (res, file) => {
        // Serve correct MIME for PWA manifests, if present
        if (file.endsWith(".webmanifest")) {
          res.setHeader("Content-Type", "application/manifest+json");
        }
      },
    })
  );
  console.log(`🗂️  Serving static frontend from: ${clientDist}`);
} else {
  console.warn("⚠️  client/dist not found. Run `npm run build:client`.");
}

// ---------- HEALTH ----------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", mode: "static", hasClient, clientDist });
});

// ---------- SPA FALLBACK (skip real assets) ----------
app.get(
  /^(?!\/api\/)(?!.*\.(?:js|css|map|png|jpe?g|gif|svg|ico|txt|json|webmanifest|woff2?|ttf|otf))$/i,
  (_req, res) => {
    if (!hasClient) {
      return res
        .status(501)
        .type("text/plain")
        .send("Frontend not built. Run `npm run build:client` first.");
    }
    res.sendFile(indexHtml, (err) => {
      if (err) {
        console.error("❌ Error sending index.html:", err);
        res.status(500).type("text/plain").send("Failed to serve index.html");
      }
    });
  }
);

// ---------- 404 + ERROR HANDLERS ----------
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("❌ Unexpected server error:", err);
  res.status(500).json({ error: "Internal Server Error", details: err?.message });
});
