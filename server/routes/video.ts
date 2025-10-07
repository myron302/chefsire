// server/routes/video.ts
import "dotenv/config";
import { Router, Request, Response } from "express";
import crypto from "crypto";

const router = Router();

/**
 * POST /api/video/token
 * Body: { roomId: string, role?: "host"|"participant"|"viewer" }
 * Returns: { provider: "mock", roomId, role, token }
 *
 * Swap this to Daily/Agora SDK later for real tokens.
 */
router.post("/token", (req: Request, res: Response) => {
  const roomId = String(req.body?.roomId ?? "").trim();
  const role =
    req.body?.role === "host" || req.body?.role === "participant" ? req.body.role : "viewer";
  if (!roomId) return res.status(400).json({ error: "roomId required" });

  const token = crypto.randomBytes(24).toString("hex");
  res.json({ provider: "mock", roomId, role, token });
});

export default router;
