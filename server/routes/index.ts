// server/routes/index.ts
import { Router } from "express";

// Keep the routers you already have:
import recipesRouter from "./recipes";
import bitesRouter from "./bites";           // “stories” → “bites”
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";

// NEW: substitutions (AI swapper – local engine for now)
import substitutionsRouter from "./substitutions";

const r = Router();

// Mount them all under /api (app.ts does app.use("/api", r))
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);

export default r;
