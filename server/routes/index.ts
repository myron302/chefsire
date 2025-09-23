// server/routes/index.ts
import { Router } from "express";

import recipes from "./recipes";
import substitutions from "./substitutions";
import pantry from "./pantry";
import marketplace from "./marketplace";

const router = Router();

// Grouped API under /api/*
router.use("/recipes", recipes);
router.use("/substitutions", substitutions);
router.use("/pantry", pantry);
router.use("/marketplace", marketplace);

// You can add more here next:
// import users from "./users";
// import posts from "./posts";
// router.use("/users", users);
// router.use("/posts", posts);

export default router;
