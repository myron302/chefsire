// server/routes/index.ts
import { Router } from "express";

// --- Core feature routers ---
import { recipesRouter } from "./recipes";   // ✅ use the named export we just added
import bitesRouter from "./bites";
import usersRouter from "./users";
import postsRouter from "./posts";
import pantryRouter from "./pantry";
import marketplaceRouter from "./marketplace";
import substitutionsRouter from "./substitutions";
import drinksRouter from "./drinks";

// --- Integrations ---
import lookupRouter from "./lookup";
import exportRouter from "./exportList";
import { googleRouter } from "./google";

// --- Competitions (Cook-Off Feature) ---
import competitionsRouter from "./competitions";

// --- Auth (signup/login) ---
import authRouter from "./auth";

const r = Router();

/**
 * Mounted in app.ts as: app.use("/api", r)
 * Final paths: /api/recipes, /api/auth/login, etc.
 */

// Primary mounts
r.use("/recipes", recipesRouter);
r.use("/bites", bitesRouter);
r.use("/users", usersRouter);
r.use("/posts", postsRouter);
r.use("/pantry", pantryRouter);
r.use("/marketplace", marketplaceRouter);
r.use("/substitutions", substitutionsRouter);
r.use("/drinks", drinksRouter);

// Auth
r.use(authRouter); // /auth/signup, /auth/login

// Integrations
r.use("/lookup", lookupRouter);
r.use("/export", exportRouter);
r.use("/google", googleRouter);

// Competitions
r.use("/competitions", competitionsRouter);

// Debug (dev only)
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
