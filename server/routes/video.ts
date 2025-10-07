// server/routes/video.ts
import "dotenv/config";
import { Router, Request, Response } from "express";
import crypto from "crypto";

const router = Router();

/**
 * POST /api/video/token
 * Body: { roomId: string, role?: "host"|"participant"|"viewer" }
 * Returns: { provider: "mock", roomId, token }
 *
 * In production: replace with Daily/Agora SDK call that issues a real token.
 */
router.post("/token", (_req: Request, res: Response) => {
  const roomId = String((_req.body?.roomId ?? "")).trim();
  const role = (_req.body?.role === "host" || _req.body?.role === "participant") ? _req.body.role : "viewer";
  if (!roomId) return res.status(400).json({ error: "roomId required" });

  // Mock token (do NOT use in prod)
  const token = crypto.randomBytes(24).toString("hex");
  res.json({ provider: "mock", roomId, role, token });
});

export default router;
