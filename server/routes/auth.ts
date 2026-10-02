// server/routes/auth.ts - WITH MAILER (won't crash if email fails)
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import passport from "passport";
import multer from "multer";
import { storage } from "../storage";
import { AuthService, MIN_PASSWORD_LENGTH } from "../services/auth.service";
import {
  loginLimiter,
  signupLimiter,
  emailSendLimiter,
  passwordChangeLimiter,
  verifyEmailLimiter,
  verifyEmailPageLimiter,
} from "../middleware/rate-limit";
import { UnsupportedMediaError, storeVerifiedImage } from "../services/image-upload";
import { serializeAuthenticatedUser } from "../serializers/authenticated-user";
import { hashPassword } from "../lib/password-hash";
import { isEmailAuthoritativelyVerified } from "../lib/email-verification-provenance";
import { signAuthToken, verifyAuthToken } from "../lib/jwt-config";

const router = Router();
const OAUTH_RETURN_COOKIE = "oauth_return_to";
const oauthReturnCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth/google/callback",
  maxAge: 10 * 60 * 1000,
};

function safeInternalDestination(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const parsed = new URL(value, "https://chefsire.internal");
    if (parsed.origin !== "https://chefsire.internal") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

/**
 * Avatar uploads.
 *
 * This was the most exposed upload path in ChefSire and the reason it is worth spelling out. `POST /auth/signup`
 * is unauthenticated by necessity, and the disk-storage branch wrote the request body straight into `UPLOADS_DIR`
 * -- the directory `express.static` serves at `/uploads` -- under `avatar-${randomUUID()}${path.extname(
 * file.originalname)}`. An anonymous caller therefore chose the stored extension, and the only gate was a declared
 * MIME copied out of their own request. Posting HTML bytes with `Content-Type: image/png` and the filename
 * `avatar.html` left `avatar-<uuid>.html` on the served origin, and it stayed there even when the signup itself
 * failed, because the file was written by the parser before the handler ever ran.
 *
 * Both of those are gone. Avatars are parsed into memory -- 5MB is well inside a request's budget -- so nothing is
 * on disk until `storeVerifiedImage` has decoded the bytes and named the object from the DETECTED format. A
 * failed signup now leaves nothing behind for the same reason.
 */
const AVATAR_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;

const avatarMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AVATAR_UPLOAD_LIMIT_BYTES,
    files: 1,
  },
  // A cheap pre-filter, not the decision: what the file actually is comes from its bytes, below.
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'));
    }
  }
});

const avatarUpload = (req: any, res: any, next: any) => avatarMemoryUpload.single('avatar')(req, res, next);

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
router.post("/auth/signup", signupLimiter, avatarUpload, async (req, res) => {
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
    const hashedPassword = await hashPassword(password);

    // Handle avatar URL (if file was uploaded, it will be in /uploads locally or R2 in production).
    // One call, one rule: the bytes are verified, and the key, the extension and the stored content type are all
    // generated from what they turned out to be. Neither destination sees an unvalidated byte.
    let avatarUrl: string | null = null;
    if (avatarFile) {
      avatarUrl = await storeVerifiedImage(avatarFile, { folder: "avatars", prefix: "avatar-", maxBytes: AVATAR_UPLOAD_LIMIT_BYTES });
    }

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
    // A rejected avatar is the caller's error and answers with the media status, not a 500 that hides why.
    if (error instanceof UnsupportedMediaError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Error during signup:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

/**
 * POST /auth/login
 */
router.post("/auth/login", loginLimiter, async (req, res) => {
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

    // OAuth-only (or credential-cleared) accounts have no local password: never a valid login.
    if (!user.password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Create JWT token
    const token = signAuthToken({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    // Set token as HTTP-only cookie
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    res.json({
      success: true,
      token, // Also send token in response for optional use
      user: serializeAuthenticatedUser(user),
    });
  } catch (error) {
    console.error("💥 CRITICAL ERROR during login:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    res.status(500).json({ error: "Login failed" });
  }
});

const VERIFY_TOKEN_SHAPE = /^[a-f0-9]{64}$/;

function verifyEmailPage(token: string, error?: string): string {
  // `token` is validated as 64 hex characters before it reaches here; `error` is a fixed server string.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>Verify your email</title></head>
<body style="font-family:system-ui,sans-serif;max-width:26rem;margin:4rem auto;padding:0 1rem">
<h1>Verify your email</h1>
<p>Choose the password for your ChefSire account to finish verifying your email address.</p>
${error ? `<p role="alert" style="color:#b00020">${error}</p>` : ""}
<form method="POST" action="/api/auth/verify-email">
<input type="hidden" name="token" value="${token}">
<label>Password<br><input type="password" name="password" minlength="6" autocomplete="new-password" required style="width:100%;padding:.5rem;margin:.25rem 0 1rem"></label>
<button type="submit" style="padding:.5rem 1rem">Verify email</button>
</form></body></html>`;
}

/**
 * GET /auth/verify-email?token=xxx
 * Shows the password form. Deliberately does NOT consume the token or verify anything: ownership of
 * the address is proven by the emailed token, and the password is established by the same person
 * in the POST below -- never taken from whoever created the account (P2-1).
 */
router.get("/auth/verify-email", verifyEmailPageLimiter, async (req, res) => {
  const { token } = req.query;
  if (typeof token !== "string" || !VERIFY_TOKEN_SHAPE.test(token)) {
    return res.status(400).send("Invalid verification link");
  }
  res.set("Cache-Control", "no-store");
  res.type("html").send(verifyEmailPage(token));
});

/**
 * POST /auth/verify-email  { token, password }
 * Redeems the token and sets the account password atomically.
 */
router.post("/auth/verify-email", verifyEmailLimiter, async (req, res) => {
  try {
    const { token, password } = req.body ?? {};

    if (typeof token !== "string" || !VERIFY_TOKEN_SHAPE.test(token)) {
      return res.status(400).send("Invalid verification link");
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      res.set("Cache-Control", "no-store");
      return res
        .status(400)
        .type("html")
        .send(verifyEmailPage(token, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`));
    }

    const result = await AuthService.verifyEmailToken(token, password);

    if (!result.success) {
      return res.status(400).send(result.error);
    }

    res.redirect(303, "/verify/success");
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
router.post("/auth/resend-verification", emailSendLimiter, async (req, res) => {
  const { email } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await storage.findByEmail(email);

    if (!user) {
      return res.json({ message: "If that email exists, a verification email has been sent." });
    }

    // "Verified" here means authoritatively verified: a legacy provider-stamped timestamp can be re-proven.
    if (isEmailAuthoritativelyVerified(user)) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Create and send verification email
    const result = await AuthService.createAndSendVerification(user.id, email);

    if (result.success) {
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
router.post("/auth/change-password", passwordChangeLimiter, async (req, res) => {
  try {
    // Extract token from cookie or authorization header
    const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify token
    const decoded = verifyAuthToken(token) as { id: string };
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

    const decoded = verifyAuthToken(token) as { id: string; email: string; username: string };
    const user = await storage.getUser(decoded.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      user: serializeAuthenticatedUser(user),
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
 * Initiates Google OAuth flow for LOGIN (silent if already authenticated)
 */
router.get("/auth/google", (req, res, next) => {
  const destination = safeInternalDestination(req.query.next);
  if (destination) res.cookie(OAUTH_RETURN_COOKIE, destination, oauthReturnCookieOptions);
  else res.clearCookie(OAUTH_RETURN_COOKIE, { path: oauthReturnCookieOptions.path });
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

/**
 * GET /auth/google/signup
 * Initiates Google OAuth flow for SIGNUP (forces account selection)
 */
router.get("/auth/google/signup", passport.authenticate("google", {
  scope: ["profile", "email"],
  prompt: "select_account" // Forces account selection for signup
}));

/**
 * GET /auth/google/callback
 * Google OAuth callback
 */
router.get("/auth/google/callback", (req, res, next) => {
  const destination = safeInternalDestination(req.cookies?.[OAUTH_RETURN_COOKIE]);
  res.clearCookie(OAUTH_RETURN_COOKIE, { path: oauthReturnCookieOptions.path });
  passport.authenticate("google", { session: false }, async (error, user) => {
    if (error) {
      const postgresError = error as Error & { code?: string; column?: string };
      const message = error instanceof Error ? error.message : String(error);
      const missingColumn = postgresError.column ?? message.match(/column ["']([^"']+)["'] does not exist/i)?.[1];

      // Preserve the database diagnostics in server logs only. The browser gets
      // a generic failure redirect below and never receives these details.
      console.error("💥 Google OAuth authentication failed", {
        errorType: error?.constructor?.name,
        postgresCode: postgresError.code,
        missingColumn,
        message,
      });
      return res.redirect("/login?error=google-auth-failed");
    }

    try {
      if (!user) {
        return res.redirect("/login?error=no-user");
      }

      // Create JWT token for the user
      const token = signAuthToken({
        id: user.id,
        email: user.email,
        username: user.username,
      });

      // Set token as HTTP-only cookie
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Keep the established success marker while returning to a validated internal page.
      const successUrl = new URL(destination ?? "/", "https://chefsire.internal");
      successUrl.searchParams.set("google-login", "success");
      res.redirect(`${successUrl.pathname}${successUrl.search}${successUrl.hash}`);
    } catch (error) {
      console.error("💥 Error in Google OAuth callback:", error);
      res.redirect("/login?error=oauth-error");
    }
  })(req, res, next);
});

/**
 * GET /auth/facebook
 * Initiates Facebook OAuth flow
 */
router.get("/auth/facebook", passport.authenticate("facebook", {
  scope: ["email", "public_profile"],
}));

/**
 * GET /auth/facebook/callback
 * Facebook OAuth callback
 */
router.get("/auth/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/login?error=facebook-auth-failed", session: false }),
  async (req, res) => {
    try {
      const user = req.user as any;

      if (!user) {
        return res.redirect("/login?error=no-user");
      }

      // Create JWT token for the user
      const token = signAuthToken({
        id: user.id,
        email: user.email,
        username: user.username,
      });

      // Set token as HTTP-only cookie
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect to home page
      res.redirect("/?facebook-login=success");
    } catch (error) {
      console.error("💥 Error in Facebook OAuth callback:", error);
      res.redirect("/login?error=oauth-error");
    }
  }
);

/**
 * GET /auth/tiktok
 * Initiates TikTok OAuth flow
 */
router.get("/auth/tiktok", passport.authenticate("tiktok", {
  scope: ["user.info.basic"],
}));

/**
 * GET /auth/tiktok/callback
 * TikTok OAuth callback
 */
router.get("/auth/tiktok/callback",
  passport.authenticate("tiktok", { failureRedirect: "/login?error=tiktok-auth-failed", session: false }),
  async (req, res) => {
    try {
      const user = req.user as any;

      if (!user) {
        return res.redirect("/login?error=no-user");
      }

      // Create JWT token for the user
      const token = signAuthToken({
        id: user.id,
        email: user.email,
        username: user.username,
      });

      // Set token as HTTP-only cookie
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect to home page
      res.redirect("/?tiktok-login=success");
    } catch (error) {
      console.error("💥 Error in TikTok OAuth callback:", error);
      res.redirect("/login?error=oauth-error");
    }
  }
);

/**
 * GET /auth/instagram
 * Note: Instagram OAuth is handled through Facebook
 * Redirect users to use Facebook login for Instagram integration
 */
router.get("/auth/instagram", (req, res) => {
  // Instagram Basic Display API requires Facebook OAuth
  res.redirect("/auth/facebook");
});

export default router;
