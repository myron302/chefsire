// server/routes/auth.ts
import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { storage } from "../storage";
import { db } from "../db";
import { emailVerificationTokens } from "../../shared/schema";
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
  "sire": "Sire",
  "your-majesty": "Your Majesty",
  "your-highness": "Your Highness",
  "duke": "Duke",
  "duchess": "Duchess",
  "lord": "Lord",
  "lady": "Lady",
  "knight": "Sir Knight",
  "dame": "Dame",
  "royal-chef": "Royal Chef",
  "court-master": "Court Master",
  "noble-chef": "Noble Chef",
  "imperial-chef": "Imperial Chef",
  "majestic-chef": "Majestic Chef",
  "chef": "Chef",
};

/**
 * POST /auth/signup
 * Body: { name, email, password, username?, selectedTitle? }
 * - name: display name (e.g., "King Myron Jones")
 * - username: base handle the user typed (can have spaces, per your request)
 * - selectedTitle: one of the known slugs (king, queen, etc.)
 *
 * Behavior:
 *  - Creates the user with username: "<Title Label> <username>" (SPACE at the beginning)
 *  - Automatically creates a verification token and emails a link
 *  - DOES NOT log the user in; user must verify via email before login
 */
router.post("/auth/signup", async (req, res) => {
  const { name, email, password, username, selectedTitle } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Check existing user
    const existingUser = await storage.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Build final username with title at the BEGINNING (space-separated)
    const titleLabel = TITLE_LABELS[selectedTitle] || "";
    const baseUsername = username || email.split("@")[0];
    const finalUsername = titleLabel ? `${titleLabel} ${baseUsername}` : baseUsername;

    // Create user
    const newUser = await storage.createUser({
      name: name || finalUsername,
      email,
      password: hashedPassword,
      username: finalUsername,
      emailVerifiedAt: null,
    });

    // Create verification token
    const token = newToken();
    const hashedToken = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(emailVerificationTokens).values({
      userId: newUser.id,
      token: hashedToken,
      expiresAt,
    });

    // Send verification email
    const verificationLink = `${process.env.APP_URL || 'https://chefsire.com'}/api/auth/verify-email?token=${token}`;
    await sendVerificationEmail(email, verificationLink);

    res.status(201).json({
      message: "Account created! Please check your email to verify your account.",
      userId: newUser.id,
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

/**
 * GET /auth/verify-email?token=...
 * - Verifies the email by checking the token
 * - Marks user as verified
 * - Redirects to success page
 */
router.get("/auth/verify-email", async (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return res.status(400).send("Invalid or missing token");
  }

  try {
    const hashedToken = sha256Hex(token);
    const tokenRecord = await storage.findVerificationToken(hashedToken);

    if (!tokenRecord) {
      return res.status(400).send("Invalid verification token");
    }

    if (new Date() > tokenRecord.expiresAt) {
      return res.status(400).send("Verification token has expired");
    }

    // Mark user as verified
    await storage.verifyUserEmail(tokenRecord.userId);

    // Delete the used token
    await storage.deleteVerificationToken(hashedToken);

    // Redirect to success page
    res.redirect("/verify/success");
  } catch (error) {
    console.error("Error during email verification:", error);
    res.status(500).send("Failed to verify email");
  }
});

/**
 * POST /auth/login
 * Body: { email, password }
 * - BLOCKS login if email is not verified
 */
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await storage.findByEmail(email);

    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // CHECK: Email must be verified before login
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ error: "Please verify your email to log in." });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Set session
    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /auth/logout
 */
router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to logout" });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logout successful" });
  });
});

/**
 * GET /auth/me
 * Returns current logged-in user or 401
 */
router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const user = await storage.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

/**
 * POST /auth/resend-verification
 * Body: { email }
 * Resends verification email
 */
router.post("/auth/resend-verification", async (req, res) => {
  const { email } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await storage.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists
      return res.json({ message: "If that email exists, a verification email has been sent." });
    }

    if (user.emailVerifiedAt) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Delete any existing tokens for this user
    await storage.deleteVerificationTokensByUserId(user.id);

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
    await sendVerificationEmail(email, verificationLink);

    res.json({ message: "Verification email sent" });
  } catch (error) {
    console.error("Error resending verification:", error);
    res.status(500).json({ error: "Failed to resend verification email" });
  }
});

export default router;
