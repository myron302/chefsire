// server/routes/substitutions.ts
import { Router } from "express";
const r = Router();

r.post("/", async (req, res) => {
  // TODO: call your AI substitution logic
  res.json({ ok: true, substitutions: [] });
});

export default r;
