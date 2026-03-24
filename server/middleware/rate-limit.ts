// server/middleware/rate-limit.ts
// Targeted rate limiters for auth and sensitive endpoints.
// Uses express-rate-limit with the default in-memory store,
// which is fine for a single-process deployment.

import rateLimit from "express-rate-limit";

/**
 * Strict limiter for login attempts.
 * 10 attempts per 15-minute window per IP.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

/**
 * Strict limiter for signup / account creation.
 * 5 accounts per hour per IP.
 */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many accounts created. Please try again later." },
});

/**
 * Limiter for email-sending endpoints (verification, resend).
 * Prevents email bombing: 5 requests per 15 minutes per IP.
 */
export const emailSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

/**
 * Limiter for password change.
 * 5 attempts per 15 minutes per IP.
 */
export const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many password change attempts. Please try again later." },
});

/**
 * Limiter for email verification token checks.
 * 10 attempts per 15 minutes per IP.
 */
export const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Please try again later." },
});
