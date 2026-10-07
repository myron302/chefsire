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
  // Only failed redemptions spend the budget (brute force on token/password); legitimate users behind a
  // shared IP are not throttled by each other's successful verifications.
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Please try again later." },
});

/**
 * Rendering the verification form is not a guess at anything: it consumes nothing and reveals nothing,
 * so it has its own, much larger budget and cannot starve POST redemption (link previews, reloads).
 */
export const verifyEmailPageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

/**
 * Limiter for Square OAuth initiation.
 * 20 requests per 15 minutes per IP.
 */
export const squareOauthInitiationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Too many Square connection attempts. Please try again later." },
});

/**
 * Limiter for the signed-in provider's Square connection status, recheck and disconnect.
 * 60 requests per 15 minutes per IP: a status read may call Square, so it is bounded.
 */
export const squareConnectionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Too many Square connection requests. Please try again later." },
});

/**
 * Catering Phase 2Q: starting a Square checkout. Each accepted call may create a checkout at Square, so it is bounded.
 * 30 per 15 minutes per IP.
 */
export const cateringSquarePayLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many payment requests. Please try again shortly." },
});

/** Catering Phase 2Q: a customer's payment-status poll, which may read Square (itself throttled per attempt). 600 per 15 minutes per IP. */
export const cateringSquareStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many status checks. Please try again shortly." },
});
