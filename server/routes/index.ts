// server/routes/index.ts — testing without pantry, clubs, allergies
import { Router } from "express";

// Core feature routers
import recipesRouter from "./recipes";
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
// import pantryRouter from "./pantry";  // COMMENTED OUT FOR TESTING
// import allergiesRouter from "./allergies";  // COMMENTED OUT FOR TESTING
import mealPlansRouter from "./meal-plans";
// import clubsRouter from "./clubs";  // COMMENTED OUT FOR TESTING
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";
import lookupRouter from "./lookup";
import exportListRouter from "./exportList";
import restaurantsRouter from "./restaurants";
import { googleRouter } from "./google";
import competitionsRouter from "./competitions";
import storesRouter from "./stores";
import storesCrudRouter from "./stores-crud";
import squareRouter from "./square";

// Auth routes (mounted at root to expose /auth/*)
import authRouter from "./auth";

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
// r.use("/pantry", pantryRouter);  // COMMENTED OUT FOR TESTING
// r.use("/allergies", allergiesRouter);  // COMMENTED OUT FOR TESTING
r.use("/meal-plans", mealPlansRouter);
// r.use("/clubs", clubsRouter);  // COMMENTED OUT FOR TESTING
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
        // "/pantry/*",  // COMMENTED OUT
        // "/allergies/*",  // COMMENTED OUT
        "/meal-plans/*",
        // "/clubs/*",  // COMMENTED OUT
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
