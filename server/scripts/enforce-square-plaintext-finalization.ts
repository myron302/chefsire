// server/scripts/enforce-square-plaintext-finalization.ts
//
// Run by push-schema.ts after every `drizzle-kit push`. If an operator has FINALIZED Square plaintext-token enforcement
// (finalize-square-plaintext-enforcement.ts --confirm-old-servers-drained), the push may have dropped the enforcing CHECK, which
// Drizzle cannot represent. This re-establishes it, and EXITS NON-ZERO if it cannot (e.g. plaintext tokens reappeared), so a schema
// sync can never silently turn a finalized database back into a plaintext-permissive one. On a database that has NOT been finalized it
// does nothing, preserving the staged rollout. Prints ids/counts only; never a token.
import "../lib/load-env";
import pg from "pg";
import type { SqlPool } from "../lib/square-connection-service";
import { restoreFinalizedPlaintextEnforcement } from "../lib/square-plaintext-enforcement";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required to verify Square plaintext enforcement");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const hasTable = await pool.query(`SELECT to_regclass('payment_methods') AS name`);
    if (!hasTable.rows[0]?.name) {
      console.log("payment_methods absent; Square plaintext enforcement not applicable yet.");
      return;
    }
    const result = await restoreFinalizedPlaintextEnforcement(pool as unknown as SqlPool);
    console.log(JSON.stringify({ event: "square_plaintext_enforcement_after_push", ...result }));
    if (!result.ok) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Square plaintext enforcement verification failed:", error instanceof Error ? error.name : "unknown");
  process.exit(1);
});
