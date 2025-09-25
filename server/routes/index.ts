// server/routes/index.ts
import { Router } from "express";

// Feature routers
import recipesRouter from "./recipes";
import bitesRouter from "./bites";           // “stories” → “bites”
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";

const r = Router();

/**
 * NOTE:
 * app.ts does `app.use("/api", r)` so every path you register here becomes:
 *   /api/<whatever-the-router-handles>
 *
 * Each child router should define its own absolute paths, e.g.
 *   r.get("/recipes/search", ...)
 * so the final URL is /api/recipes/search
 */

// Mount routers (no per-router prefix here; each router defines full paths)
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);

export default r;
