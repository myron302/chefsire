// server/routes/index.ts
import { Router } from "express";

import users from "./users";
import posts from "./posts";
import recipes from "./recipes";
import bites from "./bites";
import comments from "./comments";
import likes from "./likes";
import follows from "./follows";
import marketplace from "./marketplace";
import catering from "./catering";
import pantry from "./pantry";
import nutrition from "./nutrition";
import mealPlans from "./meal-plans";

const api = Router();

/** Simple DB connectivity probe: GET /api/health/db */
api.get("/health/db", async (_req, res) => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return res.status(500).json({ ok: false, error: "DATABASE_URL not set" });
  }
  try {
    // Use Neon serverless Pool (already in your deps)
    const { Pool } = await import("@neondatabase/serverless");
    const pool = new Pool({ connectionString: url });
    const r = await pool.query("SELECT 1 AS ok");
    await pool.end().catch(() => {});
    return res.json({ ok: true, rows: r.rows });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

api.use("/users", users);
api.use("/posts", posts);
api.use("/recipes", recipes);
api.use("/bites", bites);
api.use("/comments", comments);
api.use("/likes", likes);
api.use("/follows", follows);
api.use("/marketplace", marketplace);
api.use("/catering", catering);
api.use("/pantry", pantry);
api.use("/nutrition", nutrition);
api.use("/meal-plans", mealPlans);

export default api;
