// server/routes/dev.mailcheck.ts
import { Router } from "express";
import { mailHealth } from "../utils/mailer";

const router = Router();

/**
 * GET /api/auth/_mail-verify
 * Returns the live SMTP status from the server:
 *  - verifyOK: true means SMTP login works and is ready to send
 *  - verifyError: any provider error if verify failed
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
