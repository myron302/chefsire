// server/middleware/ageGate.ts
import type { Request, Response, NextFunction } from "express";

export function requireAgeVerified(req: Request, res: Response, next: NextFunction) {
  // Accept either a header or a cookie your frontend sets
  const headerOK = req.header("x-age-verified") === "1";
  const cookieOK = (req.headers.cookie || "").includes("cs_age_verified=1");

  if (headerOK || cookieOK) return next();
  return res.status(403).json({ error: "Age verification required (21+)." });
}
