// server/app.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";

const app = express();

app.set("trust proxy", true);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// --- Health ---
app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || "development" });
});

// ---------- Static client (built UI) ----------
const clientDir = path.resolve(process.cwd(), "../dist/public");
const hasClient = fs.existsSync(clientDir);

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

// ---------- Router diagnostics + safe mounting ----------
type RouteDef = {
  name: string;
  mountPath: string | null; // null means mount at /api root
  importPath: string;
};

const routeDefs: RouteDef[] = [
  // AUTH (mounted at /api so it exposes /auth/*)
  { name: "auth", mountPath: null, importPath: "./routes/auth" },

  // Core
  { name: "recipes", mountPath: "/recipes", importPath: "./routes/recipes" },
  { name: "bites", mountPath: "/bites", importPath: "./routes/bites" },
  { name: "users", mountPath: "/users", importPath: "./routes/users" },
  { name: "posts", mountPath: "/posts", importPath: "./routes/posts" },
  { name: "pantry", mountPath: "/pantry", importPath: "./routes/pantry" },
  { name: "allergies", mountPath: "/allergies", importPath: "./routes/allergies" },
  { name: "meal-plans", mountPath: "/meal-plans", importPath: "./routes/meal-plans" },
  { name: "clubs", mountPath: "/clubs", importPath: "./routes/clubs" },
  { name: "marketplace", mountPath: "/marketplace", importPath: "./routes/marketplace" },
  { name: "substitutions", mountPath: "/substitutions", importPath: "./routes/substitutions" },
  { name: "drinks", mountPath: "/drinks", importPath: "./routes/drinks" },

  // Integrations
  { name: "lookup", mountPath: "/lookup", importPath: "./routes/lookup" },
  { name: "export", mountPath: "/export", importPath: "./routes/exportList" },
  { name: "google", mountPath: "/google", importPath: "./routes/google" },

  // Competitions
  { name: "competitions", mountPath: "/competitions", importPath: "./routes/competitions" },

  // Stores
  { name: "stores (public)", mountPath: "/stores", importPath: "./routes/stores" },
  { name: "stores-crud", mountPath: "/stores-crud", importPath: "./routes/stores-crud" },

  // Dev mailcheck
  { name: "dev.mailcheck", mountPath: null, importPath: "./routes/dev.mailcheck" },

  // DMs
  { name: "dm", mountPath: "/dm", importPath: "./routes/dm" },
];

const routeStatus: {
  ok: string[];
  failed: Record<string, { message: string; stack?: string }>;
} = { ok: [], failed: {} };

async function safeMountAll() {
  for (const def of routeDefs) {
    try {
      const mod = await import(def.importPath);
      const router = mod.default ?? mod.router ?? mod[Object.keys(mod).find(k => typeof (mod as any)[k]?.use === "function") as any];

      if (!router || typeof (router as any).use !== "function") {
        throw new Error(`Module did not export an Express router (got: ${Object.keys(mod).join(", ") || "no exports"})`);
      }

      if (def.mountPath) {
        app.use("/api" + def.mountPath, router);
      } else {
        // Mount at /api root
        app.use("/api", router);
      }

      routeStatus.ok.push(def.name);
    } catch (e: any) {
      const msg = e?.message || String(e);
      routeStatus.failed[def.name] = { message: msg, stack: e?.stack };
      // Mount a stub that reports the failure for this subtree
      const base = "/api" + (def.mountPath || "");
      app.all(base + (def.mountPath ? "/*" : "/*"), (_req, res) => {
        res.status(503).json({
          error: "Router failed to initialize",
          router: def.name,
          importPath: def.importPath,
          message: msg,
        });
      });
    }
  }
}

// Kick off mounting (top-level await is fine in Node 22 ESM)
await safeMountAll();

// ---------- Diagnostics (always enabled) ----------
app.get("/api/_diag", (_req, res) => {
  res.json({
    status: Object.keys(routeStatus.failed).length ? "degraded" : "running",
    ok: routeStatus.ok,
    failed: routeStatus.failed,
    timestamp: new Date().toISOString(),
  });
});

// API banner
app.get("/api", (_req, res) => {
  res.json({
    name: "ChefSire API",
    status: Object.keys(routeStatus.failed).length ? "degraded" : "running",
    timestamp: new Date().toISOString(),
  });
});

// ---------- SPA fallback ----------
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (!hasClient) {
    return res
      .status(200)
      .send("Client bundle not found. Build UI with `npm run build` to populate /httpdocs/dist/public.");
  }
  res.sendFile(path.join(clientDir, "index.html"));
});

// Unknown API paths (keep last)
app.all("/api/*", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

export default app;
