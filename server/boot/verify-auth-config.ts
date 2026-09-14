// server/boot/verify-auth-config.ts
/**
 * Startup gate for ChefSire's authentication configuration.
 *
 * This module has an intentional side effect: importing it loads every supported environment
 * source and then validates the JWT signing configuration, terminating the process if it is not
 * safe to serve with. It lives in its own module, and is imported early by `server/index.ts`,
 * because ES module imports are evaluated in order before any top-level statement runs — so the
 * check genuinely happens before the rest of the server is even constructed, let alone listening.
 *
 * Order matters in both directions: the environment must be loaded before the check (a valid
 * secret in `server/.env` must pass), and the check must run before the app is constructed.
 *
 * In production (and any runtime not explicitly labelled development or test) a missing, blank or
 * publicly-known signing secret ends the process here. The failure message explains what is
 * required and never contains the configured value.
 */
// Loading the environment is this module's own precondition, not something it trusts a caller to
// have done. `server/.env` is a supported source for JWT_SECRET on the Plesk deployment, and
// validating before that file is read would reject a perfectly valid configuration.
import "../lib/load-env";
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
