import { Router } from "express";

// Core feature routers
import recipesRouter from "./recipes";
import reviewsRouter from "./reviews";
import bitesRouter from "./bites";
import usersRouter from "./users";
import followsRouter from "./follows";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";
import allergiesRouter from "./allergies";
import searchRouter from "./search";
import nutritionRouter from "./nutrition";
import mealPlansRouter from "./meal-plans";
import mealPlannerAdvancedRouter from "./meal-planner-advanced";
import mealPlannerWeekRouter from "./meal-planner-week";
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
import leaderboardRouter from "./leaderboard";
import achievementsRouter from "./achievements";
import streaksRouter from "./streaks";

// 🎉 Phase 2: Social Explosion Features
import duetsRouter from "./duets";
import eventsRouter from "./events";
import cookTogetherRouter from "./cook-together";

// 📊 Phase 3: Power User Features
import analyticsRouter from "./analytics";

// 💰 Marketplace & Monetization
import subscriptionsRouter from "./subscriptions";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import payoutsRouter from "./payouts";

// File uploads
import uploadRouter from "./upload";

// Wedding Planning
import weddingSubscriptionRouter from "./wedding-subscription";
import vendorSubscriptionRouter from "./vendor-subscription";
import weddingRsvpRouter from "./wedding-rsvp";
import weddingEventDetailsRouter from "./wedding-event-details";
import weddingCalendarEventsRouter from "./wedding-calendar-events";
import weddingBudgetSettingsRouter from "./wedding-budget-settings";
import weddingPlanningTasksRouter from "./wedding-planning-tasks";
import weddingRegistryLinksRouter from "./wedding-registry-links";
import weddingVendorQuotesRouter from "./wedding-vendor-quotes";
import weddingVendorListingsRouter from "./wedding-vendor-listings";
import weddingInsightsRouter from "./wedding-insights";

// Recipe imports (Paprika / AnyList / Plan to Eat / URL import)
import importPaprikaRouter from "./import-paprika";

const r = Router();

/**
 * Mounted under `/api` by app.ts:
 *   app.use("/api", routes)
 */

// AUTH - mount auth routes
r.use(authRouter);

// Recipes routes (prefixed)
r.use("/recipes", recipesRouter);
r.use("/recipes", importPaprikaRouter);

// Reviews - prefixed
r.use("/reviews", reviewsRouter);

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

// Search - prefixed
r.use("/search", searchRouter);

// Drinks - prefixed
r.use("/drinks", drinksRouter);

// Allergies - prefixed
r.use("/allergies", allergiesRouter);

// Nutrition - prefixed
r.use("/nutrition", nutritionRouter);

// Meal Plans Marketplace - prefixed
r.use(mealPlansRouter);

// Advanced Meal Planning Features - prefixed
r.use("/meal-planner", mealPlannerAdvancedRouter);

// Week planning (one-click generator + weekly plan fetch) - prefixed
r.use("/meal-planner", mealPlannerWeekRouter);

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
r.use("/leaderboard", leaderboardRouter);
r.use("/achievements", achievementsRouter);
r.use("/streaks", streaksRouter);

// 🎉 Phase 2: Social Explosion Features
r.use("/duets", duetsRouter);
r.use("/events", eventsRouter);
r.use("/cook-together", cookTogetherRouter);
r.use("/follows", followsRouter);

// 📊 Phase 3: Power User Features
r.use("/analytics", analyticsRouter);

// 💰 Marketplace & Monetization
r.use("/subscriptions", subscriptionsRouter);
r.use("/orders", ordersRouter);
r.use("/payments", paymentsRouter);
r.use("/payouts", payoutsRouter);

// File uploads
r.use("/upload", uploadRouter);

// Wedding Planning — subscription management (must come before other /wedding mounts so routes resolve)
r.use("/wedding", weddingSubscriptionRouter);
r.use("/vendors", vendorSubscriptionRouter);
r.use("/wedding", weddingRsvpRouter);
r.use("/wedding", weddingEventDetailsRouter);
r.use("/wedding", weddingCalendarEventsRouter);
r.use("/wedding", weddingBudgetSettingsRouter);
r.use("/wedding", weddingPlanningTasksRouter);
r.use("/wedding", weddingRegistryLinksRouter);
r.use("/wedding", weddingVendorQuotesRouter);
r.use("/wedding", weddingVendorListingsRouter);
r.use("/wedding", weddingInsightsRouter);

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
        "/remixes/*",       // ⚡ Phase 1
        "/leaderboard/*",   // ⚡ Phase 1
        "/achievements/*",  // ⚡ Phase 1
        "/streaks/*",       // ⚡ Phase 1
        "/duets/*",         // 🎉 Phase 2
        "/events/*",        // 🎉 Phase 2
        "/cook-together/*", // 🎉 Phase 2
        "/analytics/*",     // 📊 Phase 3
        "/subscriptions/*", // 💰 Monetization
        "/orders/*",        // 💰 Monetization
        "/payments/*",      // 💰 Square payments
        "/payouts/*",       // 💰 Seller payouts
        "/wedding/*",       // 💍 Wedding Planning + Subscription
        "/vendors/*",       // 🏪 Vendor Subscriptions
      ],
    });
  });
}

export default r;
