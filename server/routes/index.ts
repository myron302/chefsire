// server/routes/index.ts
import { Router } from "express";

// Feature routers
import recipesRouter from "./recipes";
import bitesRouter from "./bites";            // “stories” → “bites”
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";

// Debug/seed (browser-only helpers; remove after verification)
import debugRouter from "./debug";

const r = Router();

// Mounted under /api by app.ts
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);

// Debug last so it doesn't shadow anything
r.use(debugRouter);

export default r;
