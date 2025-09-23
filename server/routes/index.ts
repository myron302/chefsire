// server/routes/index.ts
import { Router } from "express";

import recipes from "./recipes";
import substitutions from "./substitutions";
import pantry from "./pantry";
import marketplace from "./marketplace";
import users from "./users";
import posts from "./posts";

const router = Router();

// /api/*
router.use("/recipes", recipes);
router.use("/substitutions", substitutions);
router.use("/pantry", pantry);
router.use("/marketplace", marketplace);
router.use("/users", users);
router.use("/posts", posts);

export default router;
