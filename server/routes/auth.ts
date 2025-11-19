// server/routes/auth.ts - WITH MAILER (won't crash if email fails)
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { AuthService } from "../services/auth.service";

const RAW_SECRET =
  process.env.JWT_SECRET || process.env.SESSION_SECRET || "";
const JWT_SECRET = RAW_SECRET.trim() || "CHEFSIRE_DEV_FALLBACK_SECRET";

const router = Router();

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
  const { firstName, lastName, username, email, password, selectedTitle } = req.body ?? {};

  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "First and last name are required" });
    }

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    // Check if user already exists
    const existing = await storage.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Use the username EXACTLY as the user typed it!
    const finalUsername = username.trim();
    const displayName = finalUsername; // Display the username they chose

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await storage.createUser({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      username: finalUsername,
      displayName: displayName,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      royalTitle: selectedTitle || null,
      showFullName: false,
      emailVerifiedAt: null,
    });

    // Create and send verification email
    const result = await AuthService.createAndSendVerification(newUser.id, email);

    if (result.success) {
      console.log('✅ Verification email sent to:', email);
      res.status(201).json({
        message: "Account created! Please check your email to verify your account.",
        userId: newUser.id,
      });
    } else {
      // Email failed but account was created - log error but don't fail signup
      console.error('⚠️ Email sending failed:', result.error);
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

    // Create JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: "7d" } // Token expires in 7 days
    );

    // Set token as HTTP-only cookie
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    res.json({
      success: true,
      token, // Also send token in response for optional use
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        royalTitle: user.royalTitle,
        avatar: user.avatar,
        bio: user.bio,
        nutritionPremium: user.nutritionPremium,
        nutritionTrialEndsAt: user.nutritionTrialEndsAt,
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

    const result = await AuthService.verifyEmailToken(token);

    if (!result.success) {
      return res.status(400).send(result.error);
    }

    console.log('✅ Email verified for user:', result.userId);
    res.redirect("/verify/success");
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).send("Verification failed");
  }
});

/**
 * POST /auth/logout
 */
router.post("/auth/logout", async (req, res) => {
  try {
    // Clear the auth cookie
    res.clearCookie("auth_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ error: "Logout failed" });
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

    // Create and send verification email
    const result = await AuthService.createAndSendVerification(user.id, email);

    if (result.success) {
      console.log('✅ Verification email resent to:', email);
      res.json({ message: "Verification email sent" });
    } else {
      console.error('⚠️ Failed to resend email:', result.error);
      res.status(500).json({ error: "Failed to send verification email. Please try again later." });
    }
  } catch (error) {
    console.error("Error resending verification:", error);
    res.status(500).json({ error: "Failed to resend verification email" });
  }
});

export default router;
