// server/routes/index.ts — MINIMAL TEST
import { Router } from "express";

const r = Router();

// Just a test endpoint
r.get("/test", (_req, res) => {
  res.json({ ok: true, message: "Routes are working!" });
});

export default r;
