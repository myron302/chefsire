// server/boot/verify-auth-config.ts
/**
 * Startup gate for ChefSire's authentication configuration.
 *
 * This module has an intentional side effect: importing it validates the JWT signing
 * configuration and terminates the process if it is not safe to serve with. It lives in its own
 * module, and is imported first by `server/index.ts`, because ES module imports are evaluated in
 * order before any top-level statement runs — so the check genuinely happens before the rest of
 * the server is even constructed, let alone listening.
 *
 * In production (and any runtime not explicitly labelled development or test) a missing, blank or
 * publicly-known signing secret ends the process here. The failure message explains what is
 * required and never contains the configured value.
 */
import { assertJwtConfigured, JwtConfigError } from "../lib/jwt-config";

try {
  const config = assertJwtConfigured();
  console.log(
    `✓ JWT signing configuration validated (source: ${config.source}, algorithm: ${config.algorithm}, runtime: ${config.mode})`,
  );
} catch (error) {
  if (error instanceof JwtConfigError) {
    console.error(`[ChefSire] Refusing to start — ${error.message}`);
    process.exit(1);
  }
  throw error;
}
