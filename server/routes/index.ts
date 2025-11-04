// server/app.ts
import "dotenv/config";
import express, { Request, Response, NextFunction, Router } from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const app = express();
app.set("trust proxy", true);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Health
app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || "development" });
});

/* ------------------------------------------------------------------ */
/* Mount /api with guarded, per-router loading                        */
/* ------------------------------------------------------------------ */
const api = Router();

type LoadResult = {
  name: string;
  mountPath: string;
  ok: boolean;
  error?: string;
};

const loadResults: LoadResult[] = [];

/** Mount a router with try/catch so a bad module can't take down the app */
function safeMount(name: string, mountPath: string, modulePath: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(modulePath);
    const router = (mod && (mod.default ?? mod)) as any;

    if (!router || typeof router !== "function") {
      throw new Error(`Module did not export an Express router`);
    }

    if (mountPath) {
      api.use(mountPath, router);
    } else {
      // root-mounted (e.g. auth registers its own /auth/*)
      api.use(router);
    }

    loadResults.push({ name, mountPath: mountPath || "(root)", ok: true });
    console.log(`[routes] mounted ${name} at ${mountPath || "(root)"}`);
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    loadResults.push({ name, mountPath: mountPath || "(root)", ok: false, error: msg });
    console.error(`[routes] FAILED to load ${name} from ${modulePath}:`, e);

    // Return 503 for this subtree instead of crashing
    const base = mountPath || "/";
    api.all(`${base}*`, (_req, res) =>
      res.status(503).json({
        error: "router_failed_to_load",
        router: name,
        hint: "See server logs for stack/line numbers.",
      })
    );
  }
}

/* ---- EXACT SAME ROUTERS / MOUNT PATHS AS BEFORE ------------------- */
// AUTH (root so it exposes /auth/*)
safeMount("auth", "", "./routes/auth");

// Core features
safeMount("recipes", "/recipes", "./routes/recipes");
safeMount("bites", "/bites", "./routes/bites");
safeMount("users", "/users", "./routes/users");
safeMount("posts", "/posts", "./routes/posts");
safeMount("pantry", "/pantry", "./routes/pantry");
safeMount("allergies", "/allergies", "./routes/allergies");
safeMount("meal-plans", "/meal-plans", "./routes/meal-plans");
safeMount("clubs", "/clubs", "./routes/clubs");
safeMount("marketplace", "/marketplace", "./routes/marketplace");
safeMount("substitutions", "/substitutions", "./routes/substitutions");
safeMount("drinks", "/drinks", "./routes/drinks");

// Integrations
safeMount("lookup", "/lookup", "./routes/lookup");
safeMount("exportList", "/export", "./routes/exportList");
safeMount("google", "/google", "./routes/google");

// Competitions
safeMount("competitions", "/competitions", "./routes/competitions");

// Stores
safeMount("stores (public)", "/stores", "./routes/stores");
safeMount("stores-crud (admin)", "/stores-crud", "./routes/stores-crud");

// Router health endpoint
api.get("/_router-health", (_req, res) => {
  res.json({
    ok: loadResults.every((x) => x.ok),
    failed: loadResults.filter((x) => !x.ok),
    loaded: loadResults.filter((x) => x.ok),
  });
});

// Optional banner
api.get("/", (_req, res) => {
  res.json({
    name: "ChefSire API",
    status: loadResults.every((x) => x.ok) ? "running" : "degraded",
    failures: loadResults.filter((x) => !x.ok).map((x) => x.name),
    timestamp: new Date().toISOString(),
  });
});

// 404 for unknown API paths
api.all("*", (_req: Request, res: Response) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// Mount /api
app.use("/api", api);

/* ------------------------------------------------------------------ */
/* Static client (unchanged)                                          */
/* ------------------------------------------------------------------ */
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

// SPA fallback for any non-API route
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (!hasClient) {
    return res
      .status(200)
      .send("Client bundle not found. Build UI with `npm run build` to populate /httpdocs/dist/public.");
  }
  res.sendFile(path.join(clientDir, "index.html"));
});

/* ------------------------------------------------------------------ */
/* Global error handler                                               */
/* ------------------------------------------------------------------ */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const isProd = process.env.NODE_ENV === "production";
  const message = err instanceof Error ? err.message : "Unknown error";
  const stack = err instanceof Error ? err.stack : undefined;

  if (!isProd) console.error("[ERROR]", err);

  res.status(500).json({
    error: "Internal Server Error",
    message: isProd ? "An unexpected error occurred." : message,
    ...(isProd ? {} : { stack }),
  });
});

export default app;
