// server/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import { verifyAuthToken } from "../lib/jwt-config";
import { checkSession } from "../lib/auth-session";
import { sendServiceUnavailable } from "../lib/db-availability";
import { hasCurrentAdminAuthority } from "../lib/admin-authority";

/**
 * What we store inside the token.
 *
 * These claims identify the authenticated account; they do not grant authority. Anything that
 * depends on mutable account state (admin membership above all) is re-read from the database.
 */
type JwtPayload = {
  id: string;
  email?: string;
  username?: string;
  iat?: number;
  exp?: number;
};

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
      cookies?: {
        auth_token?: string;
        [key: string]: any;
      };
    }
  }
}

/** Try cookie first (via cookie-parser), then Authorization header */
function extractToken(req: Request): string | null {
  // First try parsed cookie from cookie-parser middleware
  if (req.cookies?.auth_token) {
    return req.cookies.auth_token;
  }

  // Then try Authorization header
  const h = req.headers["authorization"];
  if (h && typeof h === "string" && h.startsWith("Bearer ")) {
    return h.slice(7);
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

    const decoded = verifyAuthToken(token) as JwtPayload;
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: "Unauthorized", code: "BAD_TOKEN" });
    }

    // The signature proves the token was issued; only the live account row says it still counts.
    // Three outcomes (Phase 2C): valid; definitively not valid (401, as before); or the database could not answer (retryable 503). The
    // last one grants nothing and does not claim the user is logged out.
    const session = await checkSession(decoded);
    if (session.status === "unavailable") return sendServiceUnavailable(res);
    if (session.status !== "valid") {
      return res.status(401).json({ error: "Unauthorized", code: "BAD_TOKEN" });
    }
    const fullUser = session.user;

    req.user = {
      id: String(decoded.id),
      email: decoded.email,
      username: decoded.username,
      nutritionPremium: fullUser.nutritionPremium ?? undefined,
      nutritionTrialEndsAt: fullUser.nutritionTrialEndsAt ?? undefined,
    };

    // Check and expire nutrition trial if needed
    try {
      if (fullUser.nutritionPremium && fullUser.nutritionTrialEndsAt) {
        const now = new Date();
        const trialEnd = new Date(fullUser.nutritionTrialEndsAt);

        if (now > trialEnd) {
          const { db } = await import("../db");
          const { users } = await import("../../shared/schema");
          const { eq } = await import("drizzle-orm");
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

/**
 * Admin gate — must run after requireAuth.
 *
 * Authority comes from the *current* stored account, never from the token: the verified token
 * supplies the user id, the database supplies the email that is checked against
 * INTERNAL_ADMIN_EMAILS. A forged or stale email claim therefore buys nothing, and a token whose
 * account no longer exists is denied.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const deny = () => res.status(403).json({ ok: false, error: "Admin only" });

  const userId = req.user?.id;
  if (!userId) return deny();

  if (!(await hasCurrentAdminAuthority(userId))) return deny();

  next();
}

/** Optional auth - populates req.user if logged in, but doesn't fail if not */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      return next(); // No token, that's fine
    }

    const decoded = verifyAuthToken(token) as JwtPayload;
    // A revoked or stale session is anonymous, exactly like an invalid token. A session that could NOT be checked is neither: answering
    // as anonymous would show a signed-in user the logged-out view of private data (or accept an action as someone else), so it is a retryable 503.
    if (decoded && decoded.id) {
      const session = await checkSession(decoded);
      if (session.status === "unavailable") return sendServiceUnavailable(res);
      if (session.status === "valid") {
        req.user = {
          id: String(decoded.id),
          email: decoded.email,
          username: decoded.username,
        };
      }
    }

    next();
  } catch (e) {
    // Invalid token, just continue without user
    next();
  }
}
