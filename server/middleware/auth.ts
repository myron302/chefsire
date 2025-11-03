import { Request, Response, NextFunction } from "express";

/**
 * Middleware to require authentication
 * Checks if req.user exists from session
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Not authenticated" });
  }
  next();
}
