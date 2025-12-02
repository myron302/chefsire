// server/routes/auth.ts - WITH MAILER (won't crash if email fails)
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import passport from "passport";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs";
import { storage } from "../storage";
import { AuthService } from "../services/auth.service";

const RAW_SECRET =
  process.env.JWT_SECRET || process.env.SESSION_SECRET || "";
const JWT_SECRET = RAW_SECRET.trim() || "CHEFSIRE_DEV_FALLBACK_SECRET";

const router = Router();

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (error) {
      console.error('[UPLOAD] Failed to create uploads directory:', error);
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `avatar-${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for avatars
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'));
    }
  }
});

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
router.post("/auth/signup", avatarUpload.single('avatar'), async (req, res) => {
  const { firstName, lastName, username, email, password, selectedTitle } = req.body ?? {};
  // Avatar file comes from req.file if multer is used, or handle manually from FormData
  const avatarFile = (req as any).file; // Will be set if multer middleware is used

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

    // Handle avatar URL (if file was uploaded, it will be in /uploads)
    const avatarUrl = avatarFile ? `/uploads/${avatarFile.filename}` : null;

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
      avatar: avatarUrl,
      provider: 'local',
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
    console.log("🔐 Login attempt started");
    const { email, password } = req.body;

    if (!email || !password) {
      console.log("❌ Login failed: Missing email or password");
      return res.status(400).json({ error: "Email and password are required" });
    }

    console.log("🔍 Looking up user:", email);
    const user = await storage.findByEmail(email);
    if (!user) {
      console.log("❌ Login failed: User not found");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    console.log("✓ User found:", user.id);

    // Check if email verified
    if (!user.emailVerifiedAt) {
      console.log("❌ Login failed: Email not verified");
      return res.status(403).json({ error: "Please verify your email to log in." });
    }

    console.log("✓ Email verified");

    // Verify password
    console.log("🔑 Verifying password...");
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      console.log("❌ Login failed: Invalid password");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    console.log("✓ Password valid");

    // Create JWT token
    console.log("🎟️ Creating JWT token...");
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: "7d" } // Token expires in 7 days
    );

    console.log("✓ JWT token created");

    // Set token as HTTP-only cookie
    console.log("🍪 Setting auth cookie...");
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    console.log("✅ Login successful for user:", user.id);

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
    console.error("💥 CRITICAL ERROR during login:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
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

/**
 * POST /auth/change-password
 * Change user password (requires authentication)
 */
router.post("/auth/change-password", async (req, res) => {
  try {
    // Extract token from cookie or authorization header
    const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const userId = decoded.id;

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    // Get user from database
    const user = await storage.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user has a password (OAuth users might not)
    if (!user.password) {
      return res.status(400).json({ error: "Cannot change password for OAuth accounts" });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await storage.updateUser(userId, { password: hashedPassword });

    console.log("✅ Password changed successfully for user:", userId);

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Invalid token" });
    }
    res.status(500).json({ error: "Failed to change password" });
  }
});

/**
 * GET /auth/me
 * Get current user from JWT cookie
 */
router.get("/auth/me", async (req, res) => {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; username: string };
    const user = await storage.getUser(decoded.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        royalTitle: user.royalTitle,
        avatar: user.avatar,
        bio: user.bio,
        subscriptionTier: user.subscriptionTier,
        nutritionPremium: user.nutritionPremium,
        nutritionTrialEndsAt: user.nutritionTrialEndsAt,
      },
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Invalid token" });
    }
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

/**
 * GET /auth/google
 * Initiates Google OAuth flow
 */
router.get("/auth/google", passport.authenticate("google", {
  scope: ["profile", "email"],
}));

/**
 * GET /auth/google/callback
 * Google OAuth callback
 */
router.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login?error=google-auth-failed", session: false }),
  async (req, res) => {
    try {
      const user = req.user as any;

      if (!user) {
        return res.redirect("/login?error=no-user");
      }

      // Create JWT token for the user
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          username: user.username,
        },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      // Set token as HTTP-only cookie
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      console.log("✅ Google OAuth login successful for user:", user.id);

      // Redirect to home page
      res.redirect("/?google-login=success");
    } catch (error) {
      console.error("💥 Error in Google OAuth callback:", error);
      res.redirect("/login?error=oauth-error");
    }
  }
);

export default router;
