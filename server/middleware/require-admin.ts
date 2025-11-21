// server/middleware/require-admin.ts
import type { Request, Response, NextFunction } from "express";

/**
 * Light admin guard.
 * Assumes req.user is set by requireAuth and contains either:
 *   - role === "admin", or
 *   - isAdmin === true
 * Adjust to match your actual User payload if different.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (user.role === "admin" || user.isAdmin === true) {
    return next();
  }
  return res.status(403).json({ error: "Admin access required" });
}
