// server/routes/index.ts
import { Router } from "express";
import health from "./health";
import users from "./users";
import posts from "./posts";
import recipes from "./recipes";
import bites from "./bites";       // “stories” in DB, “bites” in app
import comments from "./comments";
import likes from "./likes";
import follows from "./follows";

const api = Router();

api.use("/health", health);
api.use("/users", users);
api.use("/posts", posts);
api.use("/recipes", recipes);
api.use("/bites", bites);
api.use("/comments", comments);
api.use("/likes", likes);
api.use("/follows", follows);

export default api;
