import { Router } from "express";

// Core feature routers
import recipesRouter from "./recipes";
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";

// Integrations
import lookupRouter from "./lookup";
import exportRouter from "./exportList";
import { googleRouter } from "./google";

// Competitions
import competitionsRouter from "./competitions";

const r = Router();

/**
 * Mounted under `/api` by app.ts:
 *   app.use("/api", routes)
 */

// Recipes routes (prefixed)
r.use("/recipes", recipesRouter);

// Bites (social stories) - prefixed
r.use("/bites", bitesRouter);

// Users - prefixed
r.use("/users", usersRouter);

// Posts - prefixed
r.use("/posts", postsRouter);

// Pantry - prefixed
r.use("/pantry", pantryRouter);

// Marketplace - prefixed
r.use("/marketplace", marketplaceRouter);

// Substitutions - prefixed
r.use("/substitutions", substitutionsRouter);

// Drinks - prefixed
r.use("/drinks", drinksRouter);

// Integrations with explicit prefixes
r.use("/lookup", lookupRouter);
r.use("/export", exportRouter);

// IMPORTANT: Google router for BiteMap
r.use("/google", googleRouter);

// Competitions
r.use("/competitions", competitionsRouter);

// Optional: dev-only route list
if (process.env.NODE_ENV !== "production") {
  r.get("/_routes", (_req, res) => {
    res.json({
      ok: true,
      mountedAt: "/api",
      endpoints: [
        "/recipes/*",
        "/bites/*",
        "/users/*",
        "/posts/*",
        "/pantry/*",
        "/marketplace/*",
        "/substitutions/*",
        "/drinks/*",
        "/lookup/*",
        "/export/*",
        "/google/*",        // <-- BiteMap uses this
        "/competitions/*",
      ],
    });
  });
}

export default r;
