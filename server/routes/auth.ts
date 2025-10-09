import express from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";

const router = express.Router();

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

export default router;
