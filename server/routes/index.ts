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
import drinksRouter from "./drinks"; // keep if you created server/routes/drinks.ts

const r = Router();

// Mounted under /api in app.ts: app.use("/api", r)
r.use(recipesRouter);
r.use(bitesRouter);
r.use(usersRouter);
r.use(postsRouter);
r.use(pantryRouter);
r.use(marketplaceRouter);
r.use(substitutionsRouter);
r.use(drinksRouter);

export default r;
