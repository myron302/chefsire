// server/routes/index.ts
import { Router } from "express";

// Routers
import recipesRouter from "./recipes";
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";// server/routes/index.ts
import { Router } from "express";

// Existing routers
import recipesRouter from "./recipes";
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";

// NEW: drinks
import drinksRouter from "./drinks";

const r = Router();

// Mounted under /api in app.ts
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);
r.use(drinksRouter);

export default r;


const r = Router();

// Mounted under /api in app.ts
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);

export default r;
