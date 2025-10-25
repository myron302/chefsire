// server/routes/auth.ts - WITH MAILER (won't crash if email fails)
import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { storage } from "../storage";
import { db } from "../db";
import { emailVerificationTokens } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { sendVerificationEmail } from "../utils/mailer";

const router = Router();

// --- helpers ---
const sha256Hex = (s: string) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const newToken = () => crypto.randomBytes(32).toString("hex");

// Map slug values to pretty labels for the space version
const TITLE_LABELS: Record<string, string> = {
  "king": "King",
  "queen": "Queen",
  "prince": "Prince",
  "princess": "Princess",
  "duke": "Duke",
  "duchess": "Duchess",
  "lord": "Lord",
  "lady": "Lady",
  "sir": "Sir",
  "dame": "Dame",
  "baron": "Baron",
  "baroness": "Baroness",
};

/**
 * POST /auth/signup
 */
router.post("/auth/signup", async (req, res) => {
  const { name, email, password, username, selectedTitle } = req.body ?? {};

  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user already exists
    const existing = await storage.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Build username with title prepended WITH SPACE
    const titleLabel = TITLE_LABELS[selectedTitle] || "";
    const baseUsername = username || email.split("@")[0];
    const finalUsername = titleLabel ? `${titleLabel} ${baseUsername}` : baseUsername;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await storage.createUser({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      username: finalUsername,
      displayName: finalUsername,
      emailVerifiedAt: null,
    });

    // Create verification token
    const token = newToken();
    const tokenHash = sha256Hex(token);

    await db.insert(emailVerificationTokens).values({
      userId: newUser.id,
      tokenHash: tokenHash,
      email: email.toLowerCase().trim(),
    });

    // Try to send verification email
    const verificationLink = `${process.env.APP_URL || 'https://chefsire.com'}/api/auth/verify-email?token=${token}`;
    
    try {
      await sendVerificationEmail(email, verificationLink);
      console.log('✅ Verification email sent to:', email);
      
      res.status(201).json({
        message: "Account created! Please check your email to verify your account.",
        userId: newUser.id,
      });
    } catch (emailError: any) {
      // Email failed but account was created - log error but don't fail signup
      console.error('⚠️ Email sending failed:', emailError.message);
      
      res.status(201).json({
        message: "Account created! Email sending is currently unavailable. Contact support for verification.",
        userId: newUser.id,
        emailError: "Email service unavailable",
      });
    }
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

/**
 * POST /auth/login
 */
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await storage.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if email verified
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ error: "Please verify your email to log in." });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /auth/verify-email?token=xxx
 */
router.get("/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).send("Invalid verification link");
    }

    const tokenHash = sha256Hex(token);

    const [tokenRecord] = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);

    if (!tokenRecord) {
      return res.status(400).send("Invalid or expired verification link");
    }

    if (new Date() > tokenRecord.expiresAt) {
      return res.status(400).send("Verification link has expired");
    }

    if (tokenRecord.consumedAt) {
      return res.status(400).send("This link has already been used");
    }

    // Mark user as verified
    await storage.verifyUserEmail(tokenRecord.userId);

    // Mark token as consumed
    await db
      .update(emailVerificationTokens)
      .set({ consumedAt: new Date() })
      .where(eq(emailVerificationTokens.id, tokenRecord.id));

    console.log('✅ Email verified for user:', tokenRecord.userId);

    res.redirect("/verify/success");
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).send("Verification failed");
  }
});

/**
 * POST /auth/resend-verification
 */
router.post("/auth/resend-verification", async (req, res) => {
  const { email } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await storage.findByEmail(email);

    if (!user) {
      return res.json({ message: "If that email exists, a verification email has been sent." });
    }

    if (user.emailVerifiedAt) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Delete old tokens for this user
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));

    // Create new token
    const token = newToken();
    const tokenHash = sha256Hex(token);

    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash: tokenHash,
      email: email.toLowerCase().trim(),
    });

    // Try to send email
    const verificationLink = `${process.env.APP_URL || 'https://chefsire.com'}/api/auth/verify-email?token=${token}`;
    
    try {
      await sendVerificationEmail(email, verificationLink);
      console.log('✅ Verification email resent to:', email);
      res.json({ message: "Verification email sent" });
    } catch (emailError: any) {
      console.error('⚠️ Failed to resend email:', emailError.message);
      res.status(500).json({ error: "Failed to send verification email. Please try again later." });
    }
  } catch (error) {
    console.error("Error resending verification:", error);
    res.status(500).json({ error: "Failed to resend verification email" });
  }
});

export default router;
