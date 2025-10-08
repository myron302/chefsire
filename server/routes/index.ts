// server/routes/index.ts
import { Router } from "express";

// --- Existing feature routers ---
import recipesRouter from "./recipes";
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";

// --- New integrations ---
import lookupRouter from "./lookup";
import exportRouter from "./exportList";
import { googleRouter } from "./google";

// --- ✅ NEW: Competitions (Cookoff Feature) ---
import competitionsRouter from "./competitions";

const r = Router();

/**
 * 🧠 NOTE:
 * This router is mounted at /api in app.ts
 * so routes defined here should NOT repeat the /api prefix.
 * e.g.  app.use("/api", r)
 *       -> GET /api/recipes
 *       -> GET /api/competitions
 */

// --- Core routes ---
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);
r.use(drinksRouter);

// --- Integrations ---
r.use("/lookup", lookupRouter);
r.use("/export", exportRouter);
r.use("/google", googleRouter);

// --- Competitions ---
r.use("/competitions", competitionsRouter);

// --- Optional future integrations ---
// import { fsqRouter } from "./fsq";
// r.use("/fsq", fsqRouter);

// --- Debug healthcheck for routing tree ---
r.get("/_routes", (_req, res) => {
  res.json({
    ok: true,
    routes: [
      "/recipes",
      "/bites",
      "/users",
      "/posts",
      "/pantry",
      "/marketplace",
      "/substitutions",
      "/drinks",
      "/lookup",
      "/export",
      "/google",
      "/competitions",
    ],
  });
});

export default r;
