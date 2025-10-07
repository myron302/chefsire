// server/routes/index.ts
import { Router } from "express";

// ===== EXISTING FEATURE ROUTERS =====
import recipesRouter from "./recipes";
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";

// ===== ADDITIONAL EXISTING ROUTERS =====
import lookupRouter from "./lookup";
import exportRouter from "./exportList";

// ✅ Google Places proxy
import { googleRouter } from "./google";
// If/when Foursquare is ready, uncomment:
// import { fsqRouter } from "./fsq";

// ===== NEW FEATURE ROUTERS =====
import competitionsRouter from "./competitions";
import videoRouter from "./video";

// ===== SETUP ROUTER =====
const r = Router();

// NOTE: This file is mounted under /api in app.ts (app.use("/api", r))

// Core features
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);
r.use(drinksRouter);

// Utility endpoints
r.use("/lookup", lookupRouter);
r.use("/export", exportRouter);

// Third-party integrations
r.use("/google", googleRouter);
// r.use("/fsq", fsqRouter); // when available

// ✅ NEW: Competitions + Video streaming
r.use("/competitions", competitionsRouter);
r.use("/video", videoRouter);

// ===== EXPORT =====
export default r;
