// server/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/** What we store inside the token */
type JwtPayload = {
  id: string;
  email?: string;
  username?: string;
  iat?: number;
  exp?: number;
};

/** Use an env secret if available; otherwise fall back (safe for dev, not for prod) */
const RAW_SECRET =
  process.env.JWT_SECRET || process.env.SESSION_SECRET || "";
const JWT_SECRET = RAW_SECRET.trim() || "CHEFSIRE_DEV_FALLBACK_SECRET";

if (!RAW_SECRET) {
  console.warn(
    "[auth] JWT_SECRET not set. Using insecure fallback secret (dev-only). " +
      "Set JWT_SECRET in Plesk → Node.js → Environment Variables."
  );
}

/** Attach user to req once verified */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        username?: string;
        nutritionPremium?: boolean;
        nutritionTrialEndsAt?: Date | string;
      };
    }
  }
}

/** Try header first, then cookie `auth_token` */
function extractToken(req: Request): string | null {
  const h = req.headers["authorization"];
  if (h && typeof h === "string" && h.startsWith("Bearer ")) {
    return h.slice(7);
  }
  const cookie = req.headers["cookie"];
  if (cookie) {
    const m = cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

/** Strict auth gate */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "Unauthorized", code: "NO_TOKEN" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: "Unauthorized", code: "BAD_TOKEN" });
    }

    req.user = { id: decoded.id, email: decoded.email, username: decoded.username };

    // Check and expire nutrition trial if needed
    // Load full user data to check trial status
    try {
      const { db } = await import("../db");
      const { users } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");

      const [fullUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      if (fullUser) {
        req.user.nutritionPremium = fullUser.nutritionPremium;
        req.user.nutritionTrialEndsAt = fullUser.nutritionTrialEndsAt;

        // Check if trial has expired
        if (fullUser.nutritionPremium && fullUser.nutritionTrialEndsAt) {
          const now = new Date();
          const trialEnd = new Date(fullUser.nutritionTrialEndsAt);

          if (now > trialEnd) {
            // Trial has expired - disable nutrition premium
            await db
              .update(users)
              .set({
                nutritionPremium: false,
                nutritionTrialEndsAt: null,
              })
              .where(eq(users.id, req.user.id));

            // Update the request user object
            req.user.nutritionPremium = false;
            req.user.nutritionTrialEndsAt = undefined;
          }
        }
      }
    } catch (trialError) {
      // Don't fail auth if trial check fails
      console.error("Error checking nutrition trial:", trialError);
    }

    next();
  } catch (e: any) {
    const code =
      e?.name === "TokenExpiredError" || e?.name === "JsonWebTokenError"
        ? "BAD_TOKEN"
        : "AUTH_ERROR";
    return res.status(401).json({ error: "Unauthorized", code });
  }
}

/** Optional auth - populates req.user if logged in, but doesn't fail if not */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      return next(); // No token, that's fine
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (decoded && decoded.id) {
      req.user = { id: decoded.id, email: decoded.email, username: decoded.username };
    }

    next();
  } catch (e) {
    // Invalid token, just continue without user
    next();
  }
}
