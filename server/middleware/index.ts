// server/middleware/index.ts
// Central export file for all middleware

export { requireAuth, optionalAuth } from "./auth";
export { asyncHandler, ErrorFactory } from "./error-handler";
export { validateRequest, CommonSchemas } from "./validation";
export { requireAgeVerified } from "./ageGate";
