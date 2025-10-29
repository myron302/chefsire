import { Router } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { AuthService } from "../services/auth.service";

const router = Router();

// Normalize email
function normEmail(e: string) {
  return (e || "").trim().toLowerCase();
}

// Safe username (server-side too, never trust client)
function slugify(raw: string) {
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 32);
}

// Allow-list of titles; anything else becomes null
const ALLOWED_TITLES = new Set([
  "king","queen","prince","princess","sire","your-majesty","your-highness",
  "duke","duchess","lord","lady","knight","dame",
  "royal-chef","court-master","noble-chef","imperial-chef","majestic-chef","chef",
]);

/**
 * POST /auth/signup
 * Body: { firstName, lastName, username, email, password, selectedTitle? }
 * - Username is slugified and saved as-is (no title added).
 * - Title is stored separately in royalTitle.
 * - displayName defaults to "First Last" (or username if missing).
 * - Creates email verification token and sends mail.
 */
router.post("/auth/signup", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      email,
      password,
      selectedTitle,
    } = (req.body ?? {}) as {
      firstName?: string;
      lastName?: string;
      username?: string;
      email?: string;
      password?: string;
      selectedTitle?: string | null;
    };

    // Basic validation
    if (!firstName?.trim()) return res.status(400).json({ error: "First name is required" });
    if (!lastName?.trim())  return res.status(400).json({ error: "Last name is required" });
    if (!username?.trim())  return res.status(400).json({ error: "Username is required" });
    if (!email?.trim())     return res.status(400).json({ error: "Email is required" });
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const normalizedEmail = normEmail(email);
    const handle = slugify(username); // <- enforce on server, too

    // Pre-check email uniqueness
    const existingByEmail = await storage.findByEmail(normalizedEmail);
    if (existingByEmail) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Optional pre-check username uniqueness (keeps error messages friendly).
    // If your storage layer doesn't expose findByUsername, you can rely on the DB UNIQUE constraint.
    const storageAny = storage as any;
    if (typeof storageAny.findByUsername === "function") {
      const existingByUsername = await storageAny.findByUsername(handle);
      if (existingByUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Clean title: if user picked "No Title" (empty string/null) or unrecognized, store null
    const cleanTitle =
      selectedTitle && ALLOWED_TITLES.has(String(selectedTitle))
        ? String(selectedTitle)
        : null;

    // Build a sensible display name (never prepend the title here;
    // the profile UI will render "👑 Title First Last" without touching username)
    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim() || handle;

    // Create user (unverified)
    const newUser = await storage.createUser({
      email: normalizedEmail,
      password: hashedPassword,
      username: handle,            // <- clean, title-free handle
      displayName,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      royalTitle: cleanTitle,      // <- stored separately
      showFullName: false,
      emailVerifiedAt: null,
    });

    // Create token + send verification email
    const result = await AuthService.createAndSendVerification(newUser.id, normalizedEmail);

    if (result.success) {
      return res.status(201).json({
        message: "Account created! Please check your email to verify your account.",
        userId: newUser.id,
      });
    } else {
      // Account created but email failed — still 201 with a warning
      return res.status(201).json({
        message:
          "Account created! Email sending is currently unavailable. Contact support for verification.",
        userId: newUser.id,
        emailError: result.error || "Email service unavailable",
      });
    }
  } catch (err) {
    console.error("Error during /auth/signup:", err);
    // If DB unique constraint fires (username/email), surface a friendly message
    const msg = String(err?.toString?.() || "");
    if (msg.includes("users_username_key")) {
      return res.status(400).json({ error: "Username already taken" });
    }
    if (msg.includes("users_email_key")) {
      return res.status(400).json({ error: "Email already registered" });
    }
    return res.status(500).json({ error: "Failed to create account" });
  }
});

/**
 * POST /auth/login
 * Body: { email, password }
 * Requires user.emailVerifiedAt to be non-null.
 */
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = (req.body ?? {}) as {
      email?: string;
      password?: string;
    };

    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = normEmail(email);
    const user = await storage.findByEmail(normalizedEmail);

    // keep it generic to avoid user enumeration
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.emailVerifiedAt) {
      return res.status(403).json({ error: "Please verify your email to log in." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // return minimal user info; session/token handling can be added here
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    });
  } catch (err) {
    console.error("Error during /auth/login:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /auth/resend-verification
 * Body: { email }
 * Resends a verification email if the user exists and isn't verified yet.
 */
router.post("/auth/resend-verification", async (req, res) => {
  try {
    const { email } = (req.body ?? {}) as { email?: string };
    if (!email?.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }
    const normalizedEmail = normEmail(email);
    const user = await storage.findByEmail(normalizedEmail);

    // Always return success-ish to avoid enumeration
    if (!user) {
      return res.json({ message: "If that email exists, a verification email has been sent." });
    }

    if (user.emailVerifiedAt) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    const result = await AuthService.createAndSendVerification(user.id, normalizedEmail);
    if (result.success) {
      return res.json({ message: "Verification email sent" });
    } else {
      return res.status(500).json({
        error: "Failed to send verification email. Please try again later.",
      });
    }
  } catch (err) {
    console.error("Error during /auth/resend-verification:", err);
    return res.status(500).json({ error: "Failed to resend verification email" });
  }
});

/**
 * GET /auth/verify-email?token=xxx
 * Consumes the token, marks the user verified, then redirects to /verify/success
 */
router.get("/auth/verify-email", async (req, res) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      return res.status(400).send("Invalid verification link");
    }

    const result = await AuthService.verifyEmailToken(token);
    if (!result.success) {
      return res.status(400).send(result.error || "Invalid or expired verification link");
    }

    // Redirect to a client route that shows your “success” screen
    return res.redirect("/verify/success");
  } catch (err) {
    console.error("Error verifying email:", err);
    return res.status(500).send("Verification failed");
  }
});

export default router;
