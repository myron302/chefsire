// server/routes/index.ts
import { Router } from "express";

// AUTH ROUTES
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

// Stores (user storefronts)
import storesRouter from "./stores-crud";

// Square (subscriptions / checkout links)
import squareRouter from "./stores";

// Dev mail health-check route
import devMailcheckRouter from "./dev.mailcheck";

const r = Router();

/**
 * Mounted under `/api` by app.ts:
 *   app.use("/api", routes)
 */

// ---- AUTH (mounted at root so it exposes /auth/*) ----
r.use(authRouter);

// ---- Core features ----
r.use("/recipes", recipesRouter);
r.use("/bites", bitesRouter);
r.use("/users", usersRouter);
r.use("/posts", postsRouter);
r.use("/pantry", pantryRouter);
r.use("/marketplace", marketplaceRouter);
r.use("/substitutions", substitutionsRouter);
r.use("/drinks", drinksRouter);

// ---- Integrations ----
r.use("/lookup", lookupRouter);
r.use("/export", exportRouter);
r.use("/google", googleRouter);

// ---- Competitions ----
r.use("/competitions", competitionsRouter);

// ---- Stores ----
r.use("/stores", storesRouter);

// ---- Square ----
r.use("/square", squareRouter);

// ---- Dev helpers ----
r.use(devMailcheckRouter);

// ---- Optional: dev-only route list ----
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
        "/auth/_mail-verify",
      ],
    });
  });
}

export default r;
