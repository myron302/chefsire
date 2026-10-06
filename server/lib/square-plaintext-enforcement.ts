import type { SqlPool } from "./square-connection-service";

/**
 * FINALIZATION of the Square credential hardening: make "no plaintext OAuth token in payment_methods.account_details" a
 * database-enforced guarantee.
 *
 * This is deliberately NOT part of the automatic migration sequence. A CHECK constraint, even `NOT VALID`, is enforced on every
 * new INSERT/UPDATE, so installing it while an OLD application server is still running (a rolling deploy, or a rollback) would
 * make that server's OAuth callback fail. It therefore runs only on an operator's explicit instruction, after every old server
 * has been drained and every legacy row converted:
 *
 *   npx tsx server/scripts/finalize-square-plaintext-enforcement.ts --check
 *   npx tsx server/scripts/finalize-square-plaintext-enforcement.ts --confirm-old-servers-drained
 *
 * It refuses while any plaintext token remains (it reports ids and counts only, never a token) and installs + validates the
 * constraint in one transaction. Re-running it is a no-op.
 *
 * DURABLE FINALIZED STATE. The constraint alone cannot be the record that finalization happened: drizzle-kit push treats the
 * Drizzle schema as authoritative and cannot represent this constraint (installing it there would enforce it BEFORE old servers are
 * drained), so a routine `db:push` / `db:push:accept` would drop it and, with nothing else to go on, the database would look
 * "not finalized" again. Finalization therefore also writes a one-way marker row (`square_plaintext_enforcement_state`, declared in
 * the Drizzle schema so a push never drops it, and guarded by a trigger that forbids UPDATE/DELETE) in the SAME transaction that
 * installs and validates the constraint. `restoreFinalizedPlaintextEnforcement` -- run by push-schema.ts after every push -- reads
 * the marker: not finalized => nothing happens (the staged rollout is untouched); finalized => the constraint is verified and, if a
 * push removed it, reinstalled and validated. If it cannot be (plaintext reappeared) the push FAILS rather than continuing.
 */
export const PLAINTEXT_CONSTRAINT = "payment_methods_no_plaintext_oauth_token_check";
export const FINALIZATION_MARKER_TABLE = "square_plaintext_enforcement_state";

export type PlaintextEnforcementResult =
  | { ok: true; state: "installed" | "already_installed" }
  | { ok: false; reason: "confirmation_required" }
  | { ok: false; reason: "plaintext_rows_remain"; rows: string[] };

/** The payment_methods ids that still carry a plaintext token. Ids only. */
export async function plaintextRowIds(pool: Pick<SqlPool, "query">): Promise<string[]> {
  const result = await pool.query(
    `SELECT id FROM payment_methods WHERE account_details IS NOT NULL AND account_details ?| ARRAY['accessToken', 'refreshToken'] ORDER BY created_at ASC, id ASC`,
  );
  return result.rows.map((row) => String(row.id));
}

export async function plaintextEnforcementInstalled(pool: Pick<SqlPool, "query">): Promise<boolean> {
  const result = await pool.query(
    `SELECT convalidated FROM pg_constraint WHERE conname = $1 AND conrelid = 'payment_methods'::regclass`,
    [PLAINTEXT_CONSTRAINT],
  );
  return result.rows.length > 0 && result.rows[0].convalidated === true;
}

/**
 * Creates the marker table and its one-way trigger if absent. Idempotent. Shape MUST match the Drizzle declaration
 * (`squarePlaintextEnforcementState` in shared/schema/domains/ops-wedding.ts) so a push proposes nothing for it.
 */
async function ensureMarkerSchema(db: Pick<SqlPool, "query">): Promise<void> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS ${FINALIZATION_MARKER_TABLE} (
       id boolean PRIMARY KEY DEFAULT true,
       finalized_at timestamptz NOT NULL DEFAULT now(),
       CONSTRAINT ${FINALIZATION_MARKER_TABLE}_singleton_check CHECK (id = true)
     )`,
  );
  await db.query(
    `CREATE OR REPLACE FUNCTION enforce_square_plaintext_finalization_permanent() RETURNS trigger LANGUAGE plpgsql AS $$
     BEGIN
       RAISE EXCEPTION 'square plaintext enforcement finalization is permanent';
     END $$`,
  );
  await db.query(`DROP TRIGGER IF EXISTS ${FINALIZATION_MARKER_TABLE}_permanent_trigger ON ${FINALIZATION_MARKER_TABLE}`);
  await db.query(
    `CREATE TRIGGER ${FINALIZATION_MARKER_TABLE}_permanent_trigger BEFORE UPDATE OR DELETE ON ${FINALIZATION_MARKER_TABLE}
     FOR EACH ROW EXECUTE FUNCTION enforce_square_plaintext_finalization_permanent()`,
  );
}

/** Whether an operator has finalized this database. Reads ONLY the durable marker: an absent constraint is never "finalized". */
export async function plaintextFinalizationRecorded(db: Pick<SqlPool, "query">): Promise<boolean> {
  const table = await db.query(`SELECT to_regclass('${FINALIZATION_MARKER_TABLE}') AS name`);
  if (!table.rows[0]?.name) return false;
  return (await db.query(`SELECT 1 FROM ${FINALIZATION_MARKER_TABLE} WHERE id = true`)).rows.length > 0;
}

async function installConstraint(db: Pick<SqlPool, "query">): Promise<void> {
  await db.query(`ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS ${PLAINTEXT_CONSTRAINT}`);
  await db.query(
    `ALTER TABLE payment_methods ADD CONSTRAINT ${PLAINTEXT_CONSTRAINT} CHECK (account_details IS NULL OR NOT (account_details ?| ARRAY['accessToken', 'refreshToken'])) NOT VALID`,
  );
  await db.query(`ALTER TABLE payment_methods VALIDATE CONSTRAINT ${PLAINTEXT_CONSTRAINT}`);
}

export type RestoreResult =
  | { ok: true; state: "not_finalized" | "intact" | "restored" }
  | { ok: false; reason: "plaintext_rows_remain"; rows: string[] };

/**
 * Run after every schema push. NOT finalized: a no-op (the staged rollout is preserved). Finalized: guarantees the validated
 * constraint exists, reinstalling it if the push removed it, and FAILS CLOSED (ok:false) if plaintext tokens are present and the
 * constraint therefore cannot be re-established.
 */
export async function restoreFinalizedPlaintextEnforcement(pool: SqlPool): Promise<RestoreResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`LOCK TABLE payment_methods IN SHARE ROW EXCLUSIVE MODE`);
    if (!(await plaintextFinalizationRecorded(client))) {
      await client.query("COMMIT");
      return { ok: true, state: "not_finalized" };
    }
    if (await plaintextEnforcementInstalled(client)) {
      await client.query("COMMIT");
      return { ok: true, state: "intact" };
    }
    const remaining = await plaintextRowIds(client);
    if (remaining.length > 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "plaintext_rows_remain", rows: remaining };
    }
    await installConstraint(client);
    await client.query("COMMIT");
    return { ok: true, state: "restored" };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function finalizeSquarePlaintextEnforcement(pool: SqlPool, options: { oldServersDrained: boolean }): Promise<PlaintextEnforcementResult> {
  if (!options.oldServersDrained) return { ok: false, reason: "confirmation_required" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Block writers while we decide: a plaintext write landing between the check and the constraint would otherwise be missed.
    await client.query(`LOCK TABLE payment_methods IN SHARE ROW EXCLUSIVE MODE`);
    const remaining = await plaintextRowIds(client);
    if (remaining.length > 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "plaintext_rows_remain", rows: remaining };
    }
    // The durable marker is written in the SAME transaction as the validated constraint (or when adopting one an earlier revision
    // installed), so "finalized" and "enforcement present" can never be recorded apart.
    await ensureMarkerSchema(client);
    if (await plaintextEnforcementInstalled(client)) {
      await client.query(`INSERT INTO ${FINALIZATION_MARKER_TABLE} (id) VALUES (true) ON CONFLICT (id) DO NOTHING`);
      await client.query("COMMIT");
      return { ok: true, state: "already_installed" };
    }
    await installConstraint(client);
    await client.query(`INSERT INTO ${FINALIZATION_MARKER_TABLE} (id) VALUES (true) ON CONFLICT (id) DO NOTHING`);
    await client.query("COMMIT");
    return { ok: true, state: "installed" };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
