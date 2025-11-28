import { Router } from "express";

// Core feature routers
import recipesRouter from "./recipes";
import reviewsRouter from "./reviews";
import collectionsRouter from "./collections";
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";
import allergiesRouter from "./allergies";
import nutritionRouter from "./nutrition";
import mealPlansRouter from "./meal-plans";
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

// Video conferencing
import videoRouter from "./video";

// Stores (user storefronts)
import storesRouter from "./stores-crud";

// Square (subscriptions / checkout links)
import squareRouter from "./stores";

// Auth middleware
import { requireAuth } from "../middleware/auth";

// ⚡ Phase 1: Daily Addiction Features
import notificationsRouter from "./notifications";
import questsRouter from "./quests";
import suggestionsRouter from "./suggestions";
import remixesRouter from "./remixes";
import leaderboardRouter from "./leaderboard";
import achievementsRouter from "./achievements";
import streaksRouter from "./streaks";

// 💰 Marketplace & Monetization
import subscriptionsRouter from "./subscriptions";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import payoutsRouter from "./payouts";

// File uploads
import uploadRouter from "./upload";

const r = Router();

/**
 * Mounted under `/api` by app.ts:
 *   app.use("/api", routes)
 */

// AUTH - mount auth routes
r.use(authRouter);

// Recipes routes (prefixed)
r.use("/recipes", recipesRouter);

// Reviews - prefixed
r.use("/reviews", reviewsRouter);

// Collections - prefixed
r.use("/collections", collectionsRouter);

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

// Meal Plans Marketplace - prefixed
r.use("/api", mealPlansRouter);

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

// Video conferencing
r.use("/video", videoRouter);

// Stores (public viewer + owner writes)
r.use("/stores", storesRouter);

// Square (payments/subscriptions)
r.use("/square", squareRouter);

// ⚡ Phase 1: Daily Addiction Features
r.use("/notifications", notificationsRouter);
r.use("/quests", questsRouter);
r.use("/suggestions", suggestionsRouter);
r.use("/remixes", remixesRouter);
r.use("/leaderboard", leaderboardRouter);
r.use("/achievements", achievementsRouter);
r.use("/streaks", streaksRouter);

// 💰 Marketplace & Monetization
r.use("/subscriptions", subscriptionsRouter);
r.use("/orders", ordersRouter);
r.use("/payments", paymentsRouter);
r.use("/payouts", payoutsRouter);

// File uploads
r.use("/upload", uploadRouter);

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
        "/meal-plans/*",     // Nutrition marketplace
        "/my-plans/*",       // Creator meal plans
        "/my-purchases/*",   // Buyer meal plans
        "/analytics/*",      // Creator analytics
        "/dm/*",
        "/clubs/*",
        "/lookup/*",
        "/export/*",
        "/google/*",
        "/competitions/*",
        "/video/*",
        "/stores/*",
        "/square/*",
        "/notifications/*", // ⚡ Phase 1
        "/quests/*",        // ⚡ Phase 1
        "/suggestions/*",   // ⚡ Phase 1
        "/remixes/*",       // ⚡ Phase 1
        "/leaderboard/*",   // ⚡ Gamification
        "/achievements/*",  // ⚡ Gamification
        "/streaks/*",       // ⚡ Gamification
        "/subscriptions/*", // 💰 Monetization
        "/orders/*",        // 💰 Monetization
        "/payments/*",      // 💰 Square payments
        "/payouts/*"        // 💰 Seller payouts
      ],
    });
  });
}

export default r;
