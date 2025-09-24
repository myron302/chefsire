// server/routes/index.ts
import { Router } from "express";

// Mountable sub-routers
import recipesRouter from "./recipes";
import bitesRouter from "./bites";           // stories → bites
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";

const r = Router();

// All sub-routers define their own paths (e.g. "/recipes/search"), so we just use them directly.
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);

export default r;
