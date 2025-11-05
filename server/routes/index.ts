// server/routes/index.ts
import { Router } from "express";

// Core feature routers
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
import restaurantsRouter from "./restaurants.js";
import { googleRouter } from "./google.js";
import competitionsRouter from "./competitions.js";
import storesRouter from "./stores.js";
import storesCrudRouter from "./stores-crud.js";
import squareRouter from "./square.js";

// Auth routes (mounted at root to expose /auth/*)
import authRouter from "./auth.js";

const r = Router();

/**
 * Mounted under `/api` by app.ts:
 *   app.use("/api", routes)
 */

// Auth first (some routes include their own /auth/* paths)
r.use(authRouter);

// Core resources
r.use("/recipes", recipesRouter);
r.use("/bites", bitesRouter);
r.use("/users", usersRouter);
r.use("/posts", postsRouter);
r.use("/pantry", pantryRouter);
r.use("/allergies", allergiesRouter);
r.use("/meal-plans", mealPlansRouter);
r.use("/clubs", clubsRouter);
r.use("/marketplace", marketplaceRouter);
r.use("/substitutions", substitutionsRouter);
r.use("/drinks", drinksRouter);

// Integrations / utilities
r.use("/lookup", lookupRouter);
r.use("/export", exportListRouter);
r.use("/restaurants", restaurantsRouter);

// BiteMap (Google proxy)
r.use("/google", googleRouter);

// Competitions / Stores / Payments
r.use("/competitions", competitionsRouter);
r.use("/stores", storesRouter);
r.use("/stores-crud", storesCrudRouter);
r.use("/square", squareRouter);

// Dev helper
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
        "/allergies/*",
        "/meal-plans/*",
        "/clubs/*",
        "/marketplace/*",
        "/substitutions/*",
        "/drinks/*",
        "/lookup/*",
        "/export/*",
        "/restaurants/*",
        "/google/*",
        "/competitions/*",
        "/stores/*",
        "/stores-crud/*",
        "/square/*",
      ],
    });
  });
}

export default r;
