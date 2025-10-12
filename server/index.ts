// server/routes/index.ts
import { Router } from "express";

import recipesRouter from "./recipes";
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";
import lookupRouter from "./lookup";
import exportRouter from "./exportList";
import { googleRouter } from "./google";
import competitionsRouter from "./competitions";

const r = Router();

// ✅ Mount routers that already include their own path segments (e.g. "/recipes/...") with NO base prefix
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);
r.use(drinksRouter);

// Integrations (these expect a base)
r.use("/lookup", lookupRouter);
r.use("/export", exportRouter);
r.use("/google", googleRouter);

// Feature
r.use("/competitions", competitionsRouter);

export default r;
