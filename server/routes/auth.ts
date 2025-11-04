// server/routes/auth.ts
import { Router } from "express";
import bcrypt from "bcryptjs";

// ---- helpers (safe) ----
function normEmail(e: string) {
  return (e || "").trim().toLowerCase();
}
function slugify(raw: string) {
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 32);
}
const ALLOWED_TITLES = new Set([
  "king","queen","prince","princess","sire","your-majesty","your-highness",
  "duke","duchess","lord","lady","knight","dame",
  "royal-chef","court-master","noble-chef","imperial-chef","majestic-chef","chef",
]);

// 🔁 Lazy loaders so the file can be required without executing heavy deps
async function getAuthService() {
  const mod = await import("../services/auth.service");
  return mod.AuthService ?? mod.default;
}
async function getStorage() {
  const mod = await import("../storage");
  return (mod as any).storage ?? mod.default;
}

const router = Router();

/**
 * POST /auth/signup
 */
router.post("/auth/signup", async (req, res) => {
  try {
    const {
      firstName, lastName, username, email, password, selectedTitle,
    } = (req.body ?? {}) as {
      firstName?: string; lastName?: string; username?: string;
      email?: string; password?: string; selectedTitle?: string | null;
    };

    if (!firstName?.trim()) return res.status(400).json({ error: "First name is required" });
    if (!lastName?.trim())  return res.status(400).json({ error: "Last name is required" });
    if (!username?.trim())  return res.status(400).json({ error: "Username is required" });
    if (!email?.trim())     return res.status(400).json({ error: "Email is required" });
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const storage = await getStorage();
    const normalizedEmail = normEmail(email);
    const handle = slugify(username);

    const existingByEmail = await storage.findByEmail(normalizedEmail);
    if (existingByEmail) return res.status(400).json({ error: "Email already registered" });

    const storageAny = storage as any;
    if (typeof storageAny.findByUsername === "function") {
      const existingByUsername = await storageAny.findByUsername(handle);
      if (existingByUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const cleanTitle =
      selectedTitle && ALLOWED_TITLES.has(String(selectedTitle))
        ? String(selectedTitle)
        : null;

    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim() || handle;

    const newUser = await storage.createUser({
      email: normalizedEmail,
      password: hashedPassword,
      username: handle,
      displayName,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      royalTitle: cleanTitle,
      showFullName: false,
      emailVerifiedAt: null,
    });

    const AuthService = await getAuthService();
    const result = await AuthService.createAndSendVerification(newUser.id, normalizedEmail);

    if (result.success) {
      return res.status(201).json({
        message: "Account created! Please check your email to verify your account.",
        userId: newUser.id,
      });
    } else {
      return res.status(201).json({
        message:
          "Account created! Email sending is currently unavailable. Contact support for verification.",
        userId: newUser.id,
        emailError: result.error || "Email service unavailable",
      });
    }
  } catch (err) {
    console.error("Error during /auth/signup:", err);
    const msg = String((err as any)?.toString?.() || "");
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
 */
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const storage = await getStorage();
    const normalizedEmail = normEmail(email);
    const user = await storage.findByEmail(normalizedEmail);

    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ error: "Please verify your email to log in." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    return res.json({
      success: true,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error("Error during /auth/login:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /auth/resend-verification
 */
router.post("/auth/resend-verification", async (req, res) => {
  try {
    const { email } = (req.body ?? {}) as { email?: string };
    if (!email?.trim()) return res.status(400).json({ error: "Email is required" });

    const storage = await getStorage();
    const normalizedEmail = normEmail(email);
    const user = await storage.findByEmail(normalizedEmail);

    // Avoid enumeration
    if (!user) return res.json({ message: "If that email exists, a verification email has been sent." });
    if (user.emailVerifiedAt) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    const AuthService = await getAuthService();
    const result = await AuthService.createAndSendVerification(user.id, normalizedEmail);
    if (result.success) {
      return res.json({ message: "Verification email sent" });
    } else {
      return res.status(500).json({ error: "Failed to send verification email. Please try again later." });
    }
  } catch (err) {
    console.error("Error during /auth/resend-verification:", err);
    return res.status(500).json({ error: "Failed to resend verification email" });
  }
});

/**
 * GET /auth/verify-email?token=xxx
 */
router.get("/auth/verify-email", async (req, res) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).send("Invalid verification link");

    const AuthService = await getAuthService();
    const result = await AuthService.verifyEmailToken(token);
    if (!result.success) {
      return res.status(400).send(result.error || "Invalid or expired verification link");
    }

    return res.redirect("/verify/success");
  } catch (err) {
    console.error("Error verifying email:", err);
    return res.status(500).send("Verification failed");
  }
});

export default router;
