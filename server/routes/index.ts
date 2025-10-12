import { Router } from "express";

// Core feature routers
import recipesRouter from "./recipes"; // default import
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";

// Integrations
import lookupRouter from "./lookup";
import exportRouter from "./exportList";
import { googleRouter } from "./google";

// Competitions
import competitionsRouter from "./competitions";

// Auth
import authRouter from "./auth";

const r = Router();

/**
 * Mounted by app.ts as: app.use("/api", r)
 * Final endpoints: /api/recipes/search, /api/recipes/random, etc.
 */

r.use("/recipes", recipesRouter);
r.use("/bites", bitesRouter);
r.use("/users", usersRouter);
r.use("/posts", postsRouter);
r.use("/pantry", pantryRouter);
r.use("/marketplace", marketplaceRouter);
r.use("/substitutions", substitutionsRouter);
r.use("/drinks", drinksRouter);

r.use(authRouter); // /auth/signup, /auth/login

r.use("/lookup", lookupRouter);
r.use("/export", exportRouter);
r.use("/google", googleRouter);

r.use("/competitions", competitionsRouter);

if (process.env.NODE_ENV !== "production") {
  r.get("/_routes", (_req, res) => {
    res.json({
      ok: true,
      mountedAt: "/api",
      endpoints: [
        "/recipes",
        "/bites",
        "/users",
        "/posts",
        "/pantry",
        "/marketplace",
        "/substitutions",
        "/drinks",
        "/auth/signup",
        "/auth/login",
        "/lookup",
        "/export",
        "/google",
        "/competitions",
      ],
    });
  });
}

export default r;
