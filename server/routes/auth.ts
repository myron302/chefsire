// server/routes/auth.ts
import { Router } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";

const router = Router();

/**
 * POST /auth/signup
 */
router.post("/auth/signup", async (req, res) => {
  const { name, email, password } = req.body ?? {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await storage.getUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await storage.createUser({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      username: normalizedEmail.split("@")[0],
      isActive: true,
    });

    const { password: _pw, ...safeUser } = newUser;
    return res.status(201).json({ user: safeUser });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /auth/login
 */
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  console.log("Login attempt:", { email }); // DEBUG

  if (!email || !password) {
    console.log("Login fail: Missing fields");
    return res.status(400).json({ error: "Missing email or password" });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await storage.getUserByEmail(normalizedEmail);
    console.log("User found:", !!user ? "yes" : "no");

    if (!user || !user.password) {
      console.log("Login fail: No user or password");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password match:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("Login fail: Password mismatch");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const { password: _pw, ...safeUser } = user;
    console.log("Login success for:", safeUser.email);
    return res.status(200).json({ user: safeUser });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
