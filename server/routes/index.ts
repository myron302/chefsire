// server/routes/index.ts
import { Router } from "express";

// --- Core feature routers ---
import recipesRouter from "./recipes";
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";

// --- Integrations ---
import lookupRouter from "./lookup";
import exportRouter from "./exportList";
import { googleRouter } from "./google";

// --- Competitions (Cook-Off Feature) ---
import competitionsRouter from "./competitions";

const r = Router();

/**
 * Mounted under `/api` in app.ts.
 * Do NOT prefix `/api` here.
 */

// Primary mounts
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);
r.use(drinksRouter);

// Integrations
r.use("/lookup", lookupRouter);
r.use("/export", exportRouter);
r.use("/google", googleRouter);

// Competitions
r.use("/competitions", competitionsRouter);

// Debug (dev only)
if (process.env.NODE_ENV !== "production") {
  r.get("/_routes", (_req, res) => {
    res.json({
      ok: true,
      mountedAt: "/api",
      endpoints: [
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
}

export default r;
