// server/routes/auth.ts
import { Router } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { AuthService } from "../services/auth.service";

const router = Router();

/**
 * POST /auth/signup
 * Body: { firstName, lastName, username, email, password, selectedTitle }
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
    } = req.body ?? {};

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (!firstName || !lastName) {
      return res.status(400).json({ error: "First and last name are required" });
    }
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Use getUserByEmail consistently
    const existing = await storage.getUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Persist new user
    const newUser = await storage.createUser({
      email: normalizedEmail,
      password: hashedPassword,
      username: String(username).trim(),
      displayName: String(username).trim(), // show exactly what they chose
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      royalTitle: selectedTitle || null,
      showFullName: false,
      emailVerifiedAt: null,
    });

    // Send verification (best effort)
    const result = await AuthService.createAndSendVerification(newUser.id, normalizedEmail);

    if (result.success) {
      return res.status(201).json({
        message: "Account created! Please check your email to verify your account.",
        userId: newUser.id,
      });
    } else {
      // Account is created even if email fails (you can still verify manually)
      return res.status(201).json({
        message:
          "Account created! Email sending is currently unavailable. Contact support for verification.",
        userId: newUser.id,
        emailError: "Email service unavailable",
      });
    }
  } catch (error) {
    console.error("Error during signup:", error);
    return res.status(500).json({ error: "Failed to create account" });
  }
});

/**
 * POST /auth/login
 * Body: { email, password }
 */
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Use getUserByEmail (not findByEmail)
    const user = await storage.getUserByEmail(normalizedEmail);
    if (!user || !user.password) {
      // do not reveal which field is wrong
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Must verify email first
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ error: "Please verify your email to log in." });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // shape kept minimal on purpose
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName ?? user.username,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /auth/verify-email?token=xxx
 */
router.get("/auth/verify-email", async (req, res) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";

    if (!token) {
      return res.status(400).send("Invalid verification link");
    }

    const result = await AuthService.verifyEmailToken(token);

    if (!result.success) {
      return res.status(400).send(result.error ?? "Invalid or expired verification link");
    }

    // redirect to a success page in your client
    return res.redirect("/verify/success");
  } catch (error) {
    console.error("Error verifying email:", error);
    return res.status(500).send("Verification failed");
  }
});

/**
 * POST /auth/resend-verification
 * Body: { email }
 */
router.post("/auth/resend-verification", async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await storage.getUserByEmail(normalizedEmail);

    // For privacy, don't disclose existence. If not found, reply like it's fine.
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
      console.error("Failed to resend email:", result.error);
      return res
        .status(500)
        .json({ error: "Failed to send verification email. Please try again later." });
    }
  } catch (error) {
    console.error("Error resending verification:", error);
    return res.status(500).json({ error: "Failed to resend verification email" });
  }
});

export default router;
