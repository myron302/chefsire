// server/app.ts
import "dotenv/config";
import express, { Request, Response, NextFunction, Router } from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";

// Import all routers statically (required for esbuild bundling)
import authRouter from "./routes/auth.js";
import recipesRouter from "./routes/recipes.js";
import bitesRouter from "./routes/bites.js";
import usersRouter from "./routes/users.js";
import postsRouter from "./routes/posts.js";
import pantryRouter from "./routes/pantry.js";
import allergiesRouter from "./routes/allergies.js";
import mealPlansRouter from "./routes/meal-plans.js";
import clubsRouter from "./routes/clubs.js";
import marketplaceRouter from "./routes/marketplace.js";
import substitutionsRouter from "./routes/substitutions.js";
import drinksRouter from "./routes/drinks.js";
import lookupRouter from "./routes/lookup.js";
import exportListRouter from "./routes/exportList.js";
import { googleRouter } from "./routes/google.js";
import competitionsRouter from "./routes/competitions.js";
import storesRouter from "./routes/stores.js";
import storesCrudRouter from "./routes/stores-crud.js";

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
function safeMount(name: string, mountPath: string, router: any) {
  try {
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
    console.error(`[routes] FAILED to load ${name}:`, e);

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

/* ---- Mount routers with static imports ------------------- */
// AUTH (root so it exposes /auth/*)
safeMount("auth", "", authRouter);

// Core features
safeMount("recipes", "/recipes", recipesRouter);
safeMount("bites", "/bites", bitesRouter);
safeMount("users", "/users", usersRouter);
safeMount("posts", "/posts", postsRouter);
safeMount("pantry", "/pantry", pantryRouter);
safeMount("allergies", "/allergies", allergiesRouter);
safeMount("meal-plans", "/meal-plans", mealPlansRouter);
safeMount("clubs", "/clubs", clubsRouter);
safeMount("marketplace", "/marketplace", marketplaceRouter);
safeMount("substitutions", "/substitutions", substitutionsRouter);
safeMount("drinks", "/drinks", drinksRouter);

// Integrations
safeMount("lookup", "/lookup", lookupRouter);
safeMount("exportList", "/export", exportListRouter);
safeMount("google", "/google", googleRouter);

// Competitions
safeMount("competitions", "/competitions", competitionsRouter);

// Stores
safeMount("stores (public)", "/stores", storesRouter);
safeMount("stores-crud (admin)", "/stores-crud", storesCrudRouter);

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
