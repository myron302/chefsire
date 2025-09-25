// server/routes/index.ts
import { Router } from "express";

// Mounted feature routers
import recipesRouter from "./recipes";
import bitesRouter from "./bites";              // stories → bites
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";

const r = Router();

/**
 * NOTE:
 * app.ts already does: app.use("/api", r)
 * Each router below should register its own subpaths, e.g.:
 *   recipesRouter -> r.get("/recipes/search", ...)
 * so the final paths look like:
 *   /api/recipes/search
 *   /api/bites/...
 *   /api/users/...
 *   /api/posts/...
 *   /api/pantry/...
 *   /api/marketplace/...
 *   /api/substitutions/suggest
 */

// Attach routers
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);

export default r;
