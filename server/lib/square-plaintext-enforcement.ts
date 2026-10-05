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
 */
export const PLAINTEXT_CONSTRAINT = "payment_methods_no_plaintext_oauth_token_check";

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
    if (await plaintextEnforcementInstalled(client)) {
      await client.query("COMMIT");
      return { ok: true, state: "already_installed" };
    }
    await client.query(`ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS ${PLAINTEXT_CONSTRAINT}`);
    await client.query(
      `ALTER TABLE payment_methods ADD CONSTRAINT ${PLAINTEXT_CONSTRAINT} CHECK (account_details IS NULL OR NOT (account_details ?| ARRAY['accessToken', 'refreshToken'])) NOT VALID`,
    );
    await client.query(`ALTER TABLE payment_methods VALIDATE CONSTRAINT ${PLAINTEXT_CONSTRAINT}`);
    await client.query("COMMIT");
    return { ok: true, state: "installed" };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
