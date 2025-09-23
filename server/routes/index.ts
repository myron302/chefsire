// server/routes/index.ts
import { Router } from "express";

import recipes from "./recipes";
import substitutions from "./substitutions";
import pantry from "./pantry";
import marketplace from "./marketplace";
import users from "./users";
import posts from "./posts";
import likes from "./likes";
import comments from "./comments";
import nutrition from "./nutrition";
import mealPlans from "./meal-plans";
import follows from "./follows";
import bites from "./bites"; // renamed from stories

const router = Router();

// Grouped API under /api/*
router.use("/recipes", recipes);
router.use("/substitutions", substitutions);
router.use("/pantry", pantry);
router.use("/marketplace", marketplace);
router.use("/users", users);
router.use("/posts", posts);
router.use("/likes", likes);
router.use("/comments", comments);
router.use("/nutrition", nutrition);
router.use("/meal-plans", mealPlans);
router.use("/follows", follows);

// Preferred path
router.use("/bites", bites);

// Back-compat alias so any existing client calls to /api/stories/* keep working
router.use("/stories", bites);

export default router;
