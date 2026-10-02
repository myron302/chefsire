// server/routes/auth.verification.ts
import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "../../shared/schema";
import { AuthService } from "../services/auth.service";
import { emailSendLimiter } from "../middleware/rate-limit";

const router = Router();

// POST /api/auth/send-email-verification
// body: { userId: string, email: string }
router.post("/send-email-verification", emailSendLimiter, async (req, res) => {
  try {
    const { userId, email } = req.body ?? {};
    if (!userId || !email) {
      return res.status(400).json({ ok: false, error: "userId and email are required" });
    }

    // user must exist
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // Create and send verification email
    const result = await AuthService.createAndSendVerification(userId, email);

    if (result.success) {
      return res.json({ ok: true });
    } else {
      return res.status(500).json({ ok: false, error: result.error || "Failed to send email" });
    }
  } catch (error) {
    console.error("send-email-verification error:", error);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// NOTE: the verification redemption endpoint lives only in routes/auth.ts (GET shows the
// password form, POST redeems). It must not be duplicated here: redemption has to establish the
// password in the same step (P2-1), which a bare GET cannot do.

/**
 * DEV-ONLY helper for you (no terminal needed):
 * You can send yourself a link by visiting:
 *   /api/auth/_dev_send?userId=<USER_ID>&email=<YOUR_EMAIL>
 * Remove this in production.
 */
router.get("/_dev_send", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    const email = String(req.query.email || "");
    if (!userId || !email) {
      return res.status(400).send("Need userId & email query params.");
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    const result = await AuthService.createAndSendVerification(userId, email);

    if (result.success) {
      // Note: Can't include raw token in response since it's hashed by the service
      return res.send(`Sent to ${email}. Check your inbox.`);
    } else {
      return res.status(500).send(`Failed to send email: ${result.error}`);
    }
  } catch (error) {
    console.error("_dev_send error:", error);
    return res.status(500).send("Internal error.");
  }
});

export default router;
