// server/routes/recipes.ts
import { Router } from "express";
const r = Router();

r.get("/search", async (req, res) => {
  // TODO: wire to recipes-service.ts
  res.json({ ok: true, items: [] });
});

export default r;
