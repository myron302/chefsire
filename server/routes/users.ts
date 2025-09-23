// server/routes/users.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

// GET /api/users/:id
r.get("/:id", async (req, res, next) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (e) { next(e); }
});

// GET /api/users/username/:username
r.get("/username/:username", async (req, res, next) => {
  try {
    const user = await storage.getUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (e) { next(e); }
});

// POST /api/users
r.post("/", async (req, res, next) => {
  try {
    // trust client-side validation; server will throw if schema mismatches
    const created = await storage.createUser(req.body);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

// PATCH /api/users/:id
r.patch("/:id", async (req, res, next) => {
  try {
    const updated = await storage.updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json(updated);
  } catch (e) { next(e); }
});

// GET /api/users/:id/suggested
r.get("/:id/suggested", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 5);
    const users = await storage.getSuggestedUsers(req.params.id, limit);
    res.json(users);
  } catch (e) { next(e); }
});

export default r;
