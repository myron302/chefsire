// server/routes/bites.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

// GET /api/bites/active/:userId
r.get("/active/:userId", async (req, res, next) => {
  try {
    const items = await storage.getActiveStories(req.params.userId);
    res.json(items);
  } catch (e) { next(e); }
});

// GET /api/bites/user/:userId
r.get("/user/:userId", async (req, res, next) => {
  try {
    const items = await storage.getUserStories(req.params.userId);
    res.json(items);
  } catch (e) { next(e); }
});

// POST /api/bites
r.post("/", async (req, res, next) => {
  try {
    const created = await storage.createStory(req.body);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

export default r;
