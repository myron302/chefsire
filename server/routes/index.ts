// server/routes/index.ts
import { Router } from "express";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

type LoadResult = {
  name: string;
  mountPath: string;
  ok: boolean;
  error?: string;
};

const r = Router();
const results: LoadResult[] = [];

/** Mounts a router with try/catch so a bad module can't take down the app */
function safeMount(name: string, mountPath: string, modulePath: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(modulePath);
    const router = (mod && (mod.default ?? mod)) as any;

    if (!router || typeof router !== "function") {
      throw new Error(`Module did not export an Express router`);
    }

    if (mountPath) {
      r.use(mountPath, router);
    } else {
      // Some routers (auth) register their own /auth/* paths internally
      r.use(router);
    }

    results.push({ name, mountPath: mountPath || "(root)", ok: true });
    // eslint-disable-next-line no-console
    console.log(`[routes] mounted ${name} at ${mountPath || "(root)"}`);
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    results.push({ name, mountPath: mountPath || "(root)", ok: false, error: msg });
    // eslint-disable-next-line no-console
    console.error(`[routes] FAILED to load ${name} from ${modulePath}:`, e);

    // Keep API alive: return 503 for this router's subtree
    const base = mountPath || "/"; // root-mounted routers define their own subpaths
    r.all(`${base}*`, (_req, res) =>
      res.status(503).json({
        error: "router_failed_to_load",
        router: name,
        hint: "Check server logs for stack/line numbers.",
      })
    );
  }
}

/* ------------------------------------------------------------------ */
/* Mount everything with guards — identical mount points as before    */
/* ------------------------------------------------------------------ */

// AUTH (root so it exposes /auth/*)
safeMount("auth", "", "./auth");

// Core features
safeMount("recipes", "/recipes", "./recipes");
safeMount("bites", "/bites", "./bites");
safeMount("users", "/users", "./users");
safeMount("posts", "/posts", "./posts");
safeMount("pantry", "/pantry", "./pantry");
safeMount("allergies", "/allergies", "./allergies");
safeMount("meal-plans", "/meal-plans", "./meal-plans");
safeMount("clubs", "/clubs", "./clubs");
safeMount("marketplace", "/marketplace", "./marketplace");
safeMount("substitutions", "/substitutions", "./substitutions");
safeMount("drinks", "/drinks", "./drinks");

// Integrations
safeMount("lookup", "/lookup", "./lookup");
safeMount("exportList", "/export", "./exportList");
safeMount("google", "/google", "./google");

// Competitions
safeMount("competitions", "/competitions", "./competitions");

// Stores
safeMount("stores (public)", "/stores", "./stores");
safeMount("stores-crud (admin)", "/stores-crud", "./stores-crud");

// Dev / health for routers
r.get("/_router-health", (_req, res) => {
  res.json({
    ok: results.every((x) => x.ok),
    failed: results.filter((x) => !x.ok),
    loaded: results.filter((x) => x.ok),
  });
});

export default r;
