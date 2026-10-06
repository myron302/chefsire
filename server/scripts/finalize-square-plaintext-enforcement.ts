// server/scripts/finalize-square-plaintext-enforcement.ts
//
// POST-DEPLOY FINALIZATION. Run ONLY after every old application server is drained and the rollback window is intentionally
// closed. See server/lib/square-plaintext-enforcement.ts and docs/square-provider-connection-gate0.md.
//
//   --check                          report how many rows still carry a plaintext token (ids only) and whether enforcement is installed
//   --confirm-old-servers-drained    install and validate the constraint (refuses while any plaintext token remains)
//
// Prints counts and payment_methods ids only. It never prints a token.
import "../lib/load-env";
import { pool } from "../db";
import type { SqlPool } from "../lib/square-connection-service";
import { finalizeSquarePlaintextEnforcement, plaintextEnforcementInstalled, plaintextRowIds } from "../lib/square-plaintext-enforcement";

async function main() {
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const sqlPool = pool as unknown as SqlPool;
  if (process.argv.includes("--check") || !process.argv.includes("--confirm-old-servers-drained")) {
    const rows = await plaintextRowIds(sqlPool);
    console.warn(JSON.stringify({ event: "square_plaintext_enforcement_check", plaintextRows: rows.length, rows, enforcementInstalled: await plaintextEnforcementInstalled(sqlPool) }));
    if (!process.argv.includes("--check")) console.warn("Nothing changed. Re-run with --confirm-old-servers-drained once every old server is drained.");
    process.exitCode = rows.length > 0 ? 2 : 0;
    return;
  }
  const result = await finalizeSquarePlaintextEnforcement(sqlPool, { oldServersDrained: true });
  console.warn(JSON.stringify({ event: "square_plaintext_enforcement", ...result }));
  process.exitCode = result.ok ? 0 : 2;
}

main()
  .catch((error) => {
    console.error("Square plaintext enforcement failed:", error instanceof Error ? error.name : "unknown");
    process.exitCode = 1;
  })
  .finally(() => {
    const end = (pool as { end?: () => Promise<void> } | null)?.end;
    if (end) void end.call(pool);
  });
