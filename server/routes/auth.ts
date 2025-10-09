import express from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";

const router = express.Router();

// Signup route (existing)
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await storage.createUser({
      name,
      email,
      password: hashedPassword,
      username: email.split('@')[0],
      isActive: true,
    });

    const { password: _, ...safeUser } = newUser;
    res.status(201).json({ user: safeUser });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login route (with debug logs)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  console.log("Login attempt:", { email }); // DEBUG: See in Plesk logs

  if (!email || !password) {
    console.log("Login fail: Missing fields"); // DEBUG
    return res.status(400).json({ error: "Missing email or password" });
  }

  try {
    const user = await storage.getUserByEmail(email);
    console.log("User found:", !!user ? "yes" : "no"); // DEBUG

    if (!user || !user.password) {
      console.log("Login fail: No user or password"); // DEBUG
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password match:", isPasswordValid); // DEBUG

    if (!isPasswordValid) {
      console.log("Login fail: Password mismatch"); // DEBUG
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const { password: _, ...safeUser } = user;
    console.log("Login success for:", safeUser.email); // DEBUG
    res.status(200).json({ user: safeUser });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
