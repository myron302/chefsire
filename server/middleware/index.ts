// server/middleware/index.ts
export { requireAuth, optionalAuth } from "./auth";
export { errorHandler } from "./error-handler";
export { validateRequest } from "./validation";

// Re-export both names so either import works in routes
export { requireAgeVerified } from "./ageGate";
export { requireAgeVerified as requireAgeGate } from "./ageGate";
