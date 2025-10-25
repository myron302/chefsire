// server/routes/auth.verification.ts
import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "../../shared/schema";
import { AuthService } from "../services/auth.service";

const router = Router();

// POST /api/auth/send-email-verification
// body: { userId: string, email: string }
router.post("/send-email-verification", async (req, res) => {
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

// GET /api/auth/verify-email?token=RAW
router.get("/verify-email", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    if (!token) {
      return res.status(400).send("Missing token.");
    }

    const result = await AuthService.verifyEmailToken(token);

    if (!result.success) {
      return res.status(400).send(result.error || "Verification failed");
    }

    const appUrl = process.env.APP_URL || "http://localhost:5173";
    return res.redirect(`${appUrl}/verify/success`);
  } catch (error) {
    console.error("verify-email error:", error);
    return res.status(500).send("Internal server error.");
  }
});

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
