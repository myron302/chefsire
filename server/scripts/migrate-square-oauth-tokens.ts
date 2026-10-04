// server/scripts/migrate-square-oauth-tokens.ts
//
// Seals legacy PLAINTEXT Square OAuth tokens (payment_methods.account_details.accessToken / refreshToken) with the
// server key, then removes the plaintext. Idempotent: run it as often as you like; a converted row is skipped.
//
//   SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY=<32 random bytes, base64>  npx tsx server/scripts/migrate-square-oauth-tokens.ts --dry-run
//   SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY=<...>                      npx tsx server/scripts/migrate-square-oauth-tokens.ts
//
// Requires DATABASE_URL (as every other script here) and the migration 20261007_square_connection_hardening.sql.
// Prints counts and payment_methods ids only. It never prints a token, a ciphertext or the key.
// A malformed row is reported and left exactly as it was; its owner is shown "reconnect" until they re-authorize.
import "../lib/load-env";
import { pool } from "../db";
import { createSquareConnectionService, type SqlPool } from "../lib/square-connection-service";
import { assertSecretBoxConfigured } from "../lib/secret-box";
import { squareProviderApi } from "../lib/square-integration";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  // Fails closed, before any row is read, when the key is missing or malformed.
  assertSecretBoxConfigured();
  const service = createSquareConnectionService({ pool: pool as unknown as SqlPool, api: squareProviderApi });
  const summary = await service.convertAllLegacyRows({ dryRun });
  console.warn(JSON.stringify({ event: "square_oauth_token_migration", dryRun, ...summary }));
  if (!dryRun && summary.malformed.length === 0) {
    console.warn(
      "Done. Once this reports found=0 everywhere, run: ALTER TABLE payment_methods VALIDATE CONSTRAINT payment_methods_no_plaintext_oauth_token_check;",
    );
  }
  process.exitCode = summary.malformed.length > 0 ? 2 : 0;
}

main()
  .catch((error) => {
    console.error("Square token migration failed:", error instanceof Error ? error.name : "unknown");
    process.exitCode = 1;
  })
  .finally(() => {
    const end = (pool as { end?: () => Promise<void> } | null)?.end;
    if (end) void end.call(pool);
  });
