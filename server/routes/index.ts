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
import allergiesRouter from "./allergies";
import nutritionRouter from "./nutrition";
import dmRouter from "./dm";
import clubsRouter from "./clubs";

// AUTH ROUTES
import authRouter from "./auth";

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

// ⚡ Phase 1: Daily Addiction Features
import notificationsRouter from "./notifications";
import questsRouter from "./quests";
import suggestionsRouter from "./suggestions";
import remixesRouter from "./remixes";

const r = Router();

/**
 * Mounted under `/api` by app.ts:
 *   app.use("/api", routes)
 */

// AUTH - mount auth routes
r.use(authRouter);

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

// Allergies - prefixed
r.use("/allergies", allergiesRouter);

// Nutrition - prefixed
r.use("/nutrition", nutritionRouter);

// DM (Direct Messages) - prefixed
r.use("/dm", dmRouter);

// Clubs - prefixed
r.use("/clubs", clubsRouter);

// Integrations with explicit prefixes
r.use("/lookup", lookupRouter);
r.use("/export", exportRouter);

// IMPORTANT: Google router for BiteMap
r.use("/google", googleRouter);

// Competitions
r.use("/competitions", competitionsRouter);

// Stores (public viewer + owner writes)
r.use("/stores", storesRouter);

// Square (payments/subscriptions)
r.use("/square", squareRouter);

// ⚡ Phase 1: Daily Addiction Features
r.use("/notifications", notificationsRouter);
r.use("/quests", questsRouter);
r.use("/suggestions", suggestionsRouter);
r.use("/remixes", remixesRouter);

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
        "/allergies/*",
        "/nutrition/*",
        "/dm/*",
        "/clubs/*",
        "/lookup/*",
        "/export/*",
        "/google/*",
        "/competitions/*",
        "/stores/*",
        "/square/*",
        "/notifications/*", // ⚡ Phase 1
        "/quests/*",        // ⚡ Phase 1
        "/suggestions/*",   // ⚡ Phase 1
        "/remixes/*"        // ⚡ Phase 1
      ],
    });
  });
}

export default r;
