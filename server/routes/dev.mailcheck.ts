// server/routes/dev.mailcheck.ts
import { Router } from "express";
import { mailHealth } from "../utils/mailer";

const router = Router();

/**
 * GET /api/auth/_mail-verify
 * Confirms SMTP login from the server (no guessing).
 */
router.get("/auth/_mail-verify", async (_req, res) => {
  try {
    const status = await mailHealth();
    res.json({ ok: true, ...status });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default router;
