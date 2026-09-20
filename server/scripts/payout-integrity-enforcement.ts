import { splitPostgresStatements, type MigrationClient } from "./migration-runner";

type RelationState = { payouts: boolean; commissions: boolean };

function requiredRelation(statement: string): keyof RelationState | null {
  if (/\bcommissions\b/i.test(statement)) return "commissions";
  if (/enforce_payout_completed_transfer|payouts_completed_transfer/i.test(statement)) return "payouts";
  return null;
}

/** Apply every payout invariant whose table exists, atomically and without a migration ledger. */
export async function enforcePayoutIntegrity(
  client: MigrationClient,
  sql: string,
  allowPartialBootstrap: boolean,
): Promise<RelationState> {
  const result = await client.query(
    `SELECT to_regclass('payouts')::text AS payouts,
            to_regclass('commissions')::text AS commissions`
  ) as { rows: Array<{ payouts: string | null; commissions: string | null }> };
  const state = {
    payouts: Boolean(result.rows[0]?.payouts),
    commissions: Boolean(result.rows[0]?.commissions),
  };

  if (!allowPartialBootstrap && (!state.payouts || !state.commissions)) {
    throw new Error("Payout integrity cannot be enforced: payouts and commissions tables must both exist.");
  }

  const statements = splitPostgresStatements(sql).filter((statement) => {
    const relation = requiredRelation(statement);
    return relation === null || state[relation];
  });
  if (statements.length === 0) return state;

  await client.query("BEGIN");
  try {
    for (const statement of statements) await client.query(statement);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return state;
}
