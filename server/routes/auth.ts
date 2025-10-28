import { Router } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { AuthService } from "../services/auth.service";

const router = Router();

// Utility to normalize emails
function normEmail(e: string) {
  return (e || "").trim().toLowerCase();
}

/**
 * POST /auth/signup
 * Body: { firstName, lastName, username, email, password, selectedTitle? }
 * Creates the user (unverified), generates a token, and emails the verification link.
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

    // Check if user already exists
    const existing = await storage.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (unverified)
    const newUser = await storage.createUser({
      email: normalizedEmail,
      password: hashedPassword,
      username: username.trim(),
      displayName: username.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      royalTitle: selectedTitle || null,
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
      // Account created but email failed — return 201 with a warning
      return res.status(201).json({
        message:
          "Account created! Email sending is currently unavailable. Contact support for verification.",
        userId: newUser.id,
        emailError: result.error || "Email service unavailable",
      });
    }
  } catch (err) {
    console.error("Error during /auth/signup:", err);
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

    if (!user) {
      // keep it generic to avoid user enumeration
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.emailVerifiedAt) {
      return res.status(403).json({ error: "Please verify your email to log in." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Here you would normally set a session/cookie or return a token.
    // Keeping it simple and consistent with your current setup:
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
