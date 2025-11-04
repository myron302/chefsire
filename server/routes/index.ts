// server/routes/index.ts
import { Router } from "express";

// AUTH ROUTES
import authRouter from "./auth";

// Core feature routers
import recipesRouter from "./recipes";
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
// import pantryRouter from "./pantry"; // ⛔ disabled until pantry tables exist in Neon
import allergiesRouter from "./allergies";
import mealPlansRouter from "./meal-plans";
import clubsRouter from "./clubs";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";

// Integrations
import lookupRouter from "./lookup";
import exportRouter from "./exportList";
import { googleRouter } from "./google";

// Competitions
import competitionsRouter from "./competitions";

// Stores
import storesPublicRouter from "./stores";       // public: GET /:handle
import storesCrudRouter from "./stores-crud";    // admin CRUD

// Dev mail health-check route
import devMailcheckRouter from "./dev.mailcheck";

// 🔔 DMs (NEW)
import dmRouter from "./dm";

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
// r.use("/pantry", pantryRouter); // ⛔ disabled until Neon pantry tables are created
r.use("/allergies", allergiesRouter);
r.use("/meal-plans", mealPlansRouter);
r.use("/clubs", clubsRouter);
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
// public storefront endpoints: /api/stores/:handle
r.use("/stores", storesPublicRouter);
// admin CRUD endpoints: /api/stores-crud/*
r.use("/stores-crud", storesCrudRouter);

// ---- Dev helpers ----
r.use(devMailcheckRouter);

// ---- DMs (NEW) ----
// All DM endpoints will live under /api/dm/*
r.use("/dm", dmRouter);

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
        // "/pantry/*",  // disabled
        "/allergies/*",    // Allergy Profiles & Smart Substitutions
        "/meal-plans/*",   // Meal Plan Marketplace
        "/clubs/*",        // Clubs & Challenges
        "/marketplace/*",
        "/substitutions/*",
        "/drinks/*",
        "/lookup/*",
        "/export/*",
        "/google/*",
        "/competitions/*",
        "/stores/*",       // public
        "/stores-crud/*",  // admin
        "/auth/_mail-verify",
        "/dm/*"            // 🔔 NEW
      ],
    });
  });
}

export default r;
