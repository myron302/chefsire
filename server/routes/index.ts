import { Router } from "express";

// 🔐 AUTH ROUTER
import authRouter from "./auth";

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

// 🆕 Stores (user storefronts)
import storesRouter from "./stores-crud";

// 🆕 Square (subscriptions / checkout links)
import squareRouter from "./stores";

const r = Router();

/**
 * Mounted under `/api` by app.ts:
 *   app.use("/api", routes)
 */

// 🔐 AUTH ROUTES
r.use("/auth", authRouter);

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

// 🆕 Stores (public viewer + owner writes)
r.use("/stores", storesRouter);

// 🆕 Square (payments/subscriptions)
r.use("/square", squareRouter);

// Optional: dev-only route list
if (process.env.NODE_ENV !== "production") {
  r.get("/_routes", (_req, res) => {
    res.json({
      ok: true,
      mountedAt: "/api",
      endpoints: [
        "/auth/*",
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
        "/google/*",
        "/competitions/*",
        "/stores/*",
        "/square/*",
      ],
    });
  });
}

export default r;
