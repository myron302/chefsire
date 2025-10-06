// server/routes/index.ts
import { Router } from "express";

// Feature routers (existing)
import recipesRouter from "./recipes";
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";

// New: barcode lookup + export
import lookupRouter from "./lookup";
import exportRouter from "./exportList";

// ✅ NEW: Google Places proxy
import { googleRouter } from "./google";
// If/when Foursquare is ready, uncomment:
// import { fsqRouter } from "./fsq";

const r = Router();

// NOTE: This file is mounted under /api in app.ts (app.use("/api", r))
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);
r.use(drinksRouter);

// New endpoints (existing)
r.use("/lookup", lookupRouter);
r.use("/export", exportRouter);

// ✅ Mount new API namespaces
r.use("/google", googleRouter);
// r.use("/fsq", fsqRouter); // when available

export default r;
