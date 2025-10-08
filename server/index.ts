// server/routes/index.ts
import { Router } from "express";

// Feature routers (existing in your project)
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

// ✅ Google Places proxy
import { googleRouter } from "./google";
// If/when Foursquare is ready, uncomment:
// import { fsqRouter } from "./fsq";

// ✅ Competitions (new)
import competitionsRouter from "./competitions";

const r = Router();

// NOTE: This file is mounted under /api in app.ts (app.use("/api", r))

// Core feature namespaces (each router defines its own subpaths)
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);
r.use(drinksRouter);

// Utility namespaces
r.use("/lookup", lookupRouter);
r.use("/export", exportRouter);

// External provider proxies
r.use("/google", googleRouter);
// r.use("/fsq", fsqRouter); // when available

// Competitions namespace (/competitions, /competitions/:id, etc.)
r.use(competitionsRouter);

export default r;
