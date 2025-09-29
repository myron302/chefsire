// server/routes/index.ts
import { Router } from "express";

// Feature routers
import recipesRouter from "./recipes";
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";

// NEW: barcode lookup (OpenFoodFacts proxy) and shopping-list export
import lookupRouter from "./lookup";
import exportRouter from "./exportList";

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

// New endpoints
// GET /api/lookup/:barcode           → return PantryCandidate or null
r.use("/lookup", lookupRouter);

// POST /api/export/instacart-links  → [{name, url}], body: ShoppingItem[]
// POST /api/export/text              → text/plain shopping list
// POST /api/export/csv               → CSV download
r.use("/export", exportRouter);

export default r;
