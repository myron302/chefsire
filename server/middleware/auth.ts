import { Request, Response, NextFunction } from "express";

/**
 * Middleware to require authentication
 * Checks if req.user exists from session
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Type assertion to access user property
  const anyReq = req as any;

  // Check if user is authenticated via session
  if (anyReq.user?.id) {
    return next();
  }

  // Fallback: check for user ID in headers (for development/testing)
  const headerUserId = req.headers["x-user-id"];
  if (headerUserId) {
    anyReq.user = { id: String(headerUserId) };
    return next();
  }

  return res.status(401).json({ ok: false, error: "Unauthorized - Authentication required" });
}

/**
 * Middleware for optional authentication
 * Allows request to proceed whether authenticated or not
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // Type assertion to access user property
  const anyReq = req as any;

  // If user ID in headers, set it
  const headerUserId = req.headers["x-user-id"];
  if (headerUserId && !anyReq.user) {
    anyReq.user = { id: String(headerUserId) };
  }

  next();
}
