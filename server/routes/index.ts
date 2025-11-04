// server/routes/index.ts
import { Router } from "express";

// Import all routers (keep `.js` specifiers to match your build)
import authRouter from "./auth.js";
import recipesRouter from "./recipes.js";
import bitesRouter from "./bites.js";
import usersRouter from "./users.js";
import postsRouter from "./posts.js";
import pantryRouter from "./pantry.js";
import allergiesRouter from "./allergies.js";
import mealPlansRouter from "./meal-plans.js";
import clubsRouter from "./clubs.js";
import marketplaceRouter from "./marketplace.js";
import substitutionsRouter from "./substitutions.js";
import drinksRouter from "./drinks.js";
import lookupRouter from "./lookup.js";
import exportListRouter from "./exportList.js";
import restaurantsRouter from "./restaurants.js";        // ← added
import { googleRouter } from "./google.js";
import competitionsRouter from "./competitions.js";
import storesRouter from "./stores.js";
import storesCrudRouter from "./stores-crud.js";
// If you have Square/payments:
import squareRouter from "./square.js";

type LoadResult = {
  name: string;
  mountPath: string;
  ok: boolean;
  error?: string;
};

const r = Router();
const results: LoadResult[] = [];

/**
 * Mounts a router with try/catch so a bad module can't take down the app.
 * If mounting fails, that subtree responds 503 with a hint.
 */
function safeMount(name: string, mountPath: string, router: any) {
  try {
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
    console.log(`[routes] mounted ${name} at ${mountPath || "(root)"}`);
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    results.push({ name, mountPath: mountPath || "(root)", ok: false, error: msg });
    console.error(`[routes] FAILED to mount ${name}:`, e);

    // Keep API alive: return 503 for this router's subtree
    const base = mountPath || "/";
    r.all(`${base}*`, (_req, res) =>
      res.status(503).json({
        error: "router_failed_to_load",
        router: name,
        hint: "Check server logs for stack/line numbers.",
        message: msg,
      })
    );
  }
}

/* ------------------------------------------------------------------ */
/* Mount everything with guards                                        */
/* ------------------------------------------------------------------ */

// AUTH (root so it exposes /auth/*)
safeMount("auth", "", authRouter);

// Core resources (prefixed)
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

// Integrations / utilities
safeMount("lookup", "/lookup", lookupRouter);
safeMount("exportList", "/export", exportListRouter);
safeMount("restaurants", "/restaurants", restaurantsRouter);  // ← added

// BiteMap (Google proxy used by BiteMap page)
safeMount("google", "/google", googleRouter);

// Competitions / Stores / Payments
safeMount("competitions", "/competitions", competitionsRouter);
safeMount("stores (public)", "/stores", storesRouter);
safeMount("stores-crud (admin)", "/stores-crud", storesCrudRouter);
safeMount("square", "/square", squareRouter);

// Dev / router health
r.get("/_router-health", (_req, res) => {
  res.json({
    ok: results.every((x) => x.ok),
    failed: results.filter((x) => !x.ok),
    loaded: results.filter((x) => x.ok),
  });
});

export default r;
