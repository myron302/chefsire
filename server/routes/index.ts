// server/routes/index.ts
import { Router } from "express";

import recipesRouter from "./recipes";
import bitesRouter from "./bites";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";

const r = Router();

// Grouped mounts
r.use("/recipes", recipesRouter);
r.use("/bites", bitesRouter);

// Pantry & nutrition-related endpoints live at root with /users/:id prefix
r.use("/", pantryRouter);

// Marketplace endpoints live under /marketplace
r.use("/", marketplaceRouter);

// AI substitutions (swapper)
r.use("/", substitutionsRouter);

// Simple ping within the /api scope (health without DB)
r.get("/healthz", (_req, res) => res.json({ ok: true }));

export default r;
