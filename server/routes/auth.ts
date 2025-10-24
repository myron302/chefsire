import { Router } from "express";
import { db } from "@/db";
import { users, emailVerificationTokens } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendVerificationEmail } from "../utils/mailer";

const router = Router();

// Utility functions
function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function sha256Hex(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex");
}

// Title labels mapping
const TITLE_LABELS: Record<string, string> = {
  king: "King",
  queen: "Queen",
  prince: "Prince",
  princess: "Princess",
  duke: "Duke",
  duchess: "Duchess",
  lord: "Lord",
  lady: "Lady",
  sir: "Sir",
  dame: "Dame",
  baron: "Baron",
  baroness: "Baroness",
};

// ==================== SIGNUP ====================
router.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, username, selectedTitle } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Build final username with title prepended with space
    const titleLabel = TITLE_LABELS[selectedTitle] || "";
    const baseUsername = username || email.split("@")[0];
    const finalUsername = titleLabel ? `${titleLabel} ${baseUsername}` : baseUsername;

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        username: finalUsername,
        emailVerifiedAt: null,
      })
      .returning();

    // Create verification token
    const token = newToken();
    const hashedToken = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(emailVerificationTokens).values({
      userId: newUser.id,
      token: hashedToken,
      expiresAt,
    });

    // Send verification email (non-blocking)
    const verificationLink = `${process.env.APP_URL || 'https://chefsire.com'}/api/auth/verify-email?token=${token}`;
    console.log('📧 Attempting to send verification email to:', email);
    console.log('📧 Verification link:', verificationLink);
    
    sendVerificationEmail(email, verificationLink)
      .then(() => {
        console.log('✅ Verification email sent successfully to:', email);
      })
      .catch((emailError) => {
        console.error('❌ Failed to send verification email:', emailError);
        console.error('❌ Error details:', emailError.message);
      });

    res.status(201).json({
      message: "Account created! Please check your email to verify your account.",
      userId: newUser.id,
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// ==================== LOGIN ====================
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if email is verified
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ error: "Please verify your email to log in." });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Create session (simplified - you should use proper session management)
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

// ==================== VERIFY EMAIL ====================
router.get("/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).send("Invalid verification link");
    }

    const hashedToken = sha256Hex(token);

    // Find valid token
    const [tokenRecord] = await db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.token, hashedToken),
          eq(emailVerificationTokens.used, false)
        )
      )
      .limit(1);

    if (!tokenRecord) {
      return res.status(400).send("Invalid or expired verification link");
    }

    // Check if expired
    if (new Date() > tokenRecord.expiresAt) {
      return res.status(400).send("Verification link has expired");
    }

    // Mark user as verified
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, tokenRecord.userId));

    // Mark token as used
    await db
      .update(emailVerificationTokens)
      .set({ used: true })
      .where(eq(emailVerificationTokens.id, tokenRecord.id));

    console.log('✅ Email verified for user:', tokenRecord.userId);

    // Redirect to success page
    res.redirect("/verify/success");
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).send("Verification failed");
  }
});

// ==================== RESEND VERIFICATION ====================
router.post("/auth/resend-verification", async (req, res) => {
  const { email } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      // Don't reveal if user exists
      return res.json({ message: "If that email exists, a verification email has been sent." });
    }

    if (user.emailVerifiedAt) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Delete any existing tokens for this user
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));

    // Create new verification token
    const token = newToken();
    const hashedToken = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      token: hashedToken,
      expiresAt,
    });

    // Send verification email
    const verificationLink = `${process.env.APP_URL || 'https://chefsire.com'}/api/auth/verify-email?token=${token}`;
    console.log('📧 Resending verification email to:', email);
    
    try {
      await sendVerificationEmail(email, verificationLink);
      console.log('✅ Verification email resent successfully to:', email);
      res.json({ message: "Verification email sent" });
    } catch (emailError) {
      console.error('❌ Failed to resend verification email:', emailError);
      res.status(500).json({ error: "Failed to send verification email" });
    }
  } catch (error) {
    console.error("Error resending verification:", error);
    res.status(500).json({ error: "Failed to resend verification email" });
  }
});

export default router;
