// server/routes/auth.verification.ts
import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../db";
import { eq, and, isNull, gt } from "drizzle-orm";
import { emailVerificationTokens, users } from "../../shared/schema";
import { sendVerificationEmail } from "../utils/mailer";

const router = Router();

// helpers
const sha256Hex = (s: string) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const newToken = () => crypto.randomBytes(32).toString("hex");

// POST /api/auth/send-email-verification
// body: { userId: string, email: string }
router.post("/send-email-verification", async (req, res) => {
  try {
    const { userId, email } = req.body ?? {};
    if (!userId || !email) return res.status(400).json({ ok: false, error: "userId and email are required" });

    // user must exist
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    // fresh token
    const raw = newToken();
    const tokenHash = sha256Hex(raw);

    // remove old tokens for this user
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));

    // insert new token (expires in 30 min via default)
    await db.insert(emailVerificationTokens).values({
      userId,
      tokenHash,
      email,
    });

    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${raw}`;

    await sendVerificationEmail(email, verifyUrl);
    return res.json({ ok: true });
  } catch (e) {
    console.error("send-email-verification error:", e);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// GET /api/auth/verify-email?token=RAW
router.get("/verify-email", async (req, res) => {
  try {
    const raw = String(req.query.token || "");
    if (!raw) return res.status(400).send("Missing token.");

    const tokenHash = sha256Hex(raw);
    const now = new Date();

    const [row] = await db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.consumedAt),
          gt(emailVerificationTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!row) return res.status(400).send("This verification link is invalid or has expired.");

    // mark user verified
    await db.update(users).set({ emailVerifiedAt: now }).where(eq(users.id, row.userId));

    // consume token
    await db.update(emailVerificationTokens).set({ consumedAt: now }).where(eq(emailVerificationTokens.id, row.id));

    const appUrl = process.env.APP_URL || "http://localhost:5173";
    return res.redirect(`${appUrl}/verify/success`);
  } catch (e) {
    console.error("verify-email error:", e);
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
    if (!userId || !email) return res.status(400).send("Need userId & email query params.");

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).send("User not found.");

    const raw = newToken();
    const tokenHash = sha256Hex(raw);
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
    await db.insert(emailVerificationTokens).values({ userId, tokenHash, email });

    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${raw}`;
    await sendVerificationEmail(email, verifyUrl);

    return res.send(`Sent to ${email}. Check your inbox. (link: ${verifyUrl})`);
  } catch (e) {
    console.error("_dev_send error:", e);
    return res.status(500).send("Internal error.");
  }
});

export default router;
