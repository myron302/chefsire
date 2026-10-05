// server/scripts/migrate-square-oauth-tokens.ts
//
// Seals legacy PLAINTEXT Square OAuth tokens (payment_methods.account_details.accessToken / refreshToken) with the
// server key, then removes the plaintext. Idempotent: run it as often as you like; a converted row is skipped.
//
//   SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY=<32 random bytes, base64>  npx tsx server/scripts/migrate-square-oauth-tokens.ts --dry-run
//   SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY=<...>                      npx tsx server/scripts/migrate-square-oauth-tokens.ts
//
// KEY ROTATION: with the new key as SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY and the old one as ..._KEY_PREVIOUS, run
//   npx tsx server/scripts/migrate-square-oauth-tokens.ts --reseal [--dry-run]
// to re-seal every stored credential under the new key. Only when it reports failed=[] may the previous key be removed.
//
// Requires DATABASE_URL (as every other script here) and the migration 20261007_square_connection_hardening.sql.
// Prints counts and payment_methods ids only. It never prints a token, a ciphertext or the key.
// A malformed row is reported and left exactly as it was; its owner is shown "reconnect" until they re-authorize.
// FINALIZATION (forbidding plaintext tokens in the database) is a separate, explicit step: finalize-square-plaintext-enforcement.ts.
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
  if (process.argv.includes("--reseal")) {
    const resealed = await service.resealRotatedCredentials({ dryRun });
    console.warn(JSON.stringify({ event: "square_oauth_token_reseal", dryRun, ...resealed }));
    process.exitCode = resealed.failed.length > 0 ? 2 : 0;
    return;
  }
  const summary = await service.convertAllLegacyRows({ dryRun });
  console.warn(JSON.stringify({ event: "square_oauth_token_migration", dryRun, ...summary }));
  if (!dryRun && summary.malformed.length === 0) {
    // The write-blocking constraint is NOT installed by the automatic migrations (see the doc), so there is nothing to VALIDATE
    // yet: the explicit finalization script installs and validates it.
    console.warn(
      "Conversion finished with no malformed rows. To make plaintext tokens impossible to write: (1) make sure every OLD application " +
        "server is drained; (2) confirm `finalize-square-plaintext-enforcement.ts --check` reports plaintextRows: 0; (3) run " +
        "`npx tsx server/scripts/finalize-square-plaintext-enforcement.ts --confirm-old-servers-drained`, which installs and validates " +
        "the constraint (and refuses while any plaintext remains).",
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
