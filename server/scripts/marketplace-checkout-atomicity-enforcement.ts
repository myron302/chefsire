import { splitPostgresStatements, type MigrationClient } from "./migration-runner";

type RelationState = { orders: boolean; products: boolean; commissions: boolean };

function requiredRelations(statement: string): Array<keyof RelationState> {
  const relations: Array<keyof RelationState> = [];
  if (/\bcommissions\b/i.test(statement)) relations.push("commissions");
  if (/\bproducts\b/i.test(statement)) relations.push("products");
  if (/\borders\b/i.test(statement)) relations.push("orders");
  return relations;
}

/**
 * Apply the P1-05 checkout-atomicity migration's column adds, evidence-based
 * inventory_status backfill and constraints, atomically and without a
 * migration ledger, so `db:push` cannot let Drizzle default existing rows to
 * 'legacy_unverified' before this backfill has a chance to classify them from
 * their own trustworthy payment/capture state.
 */
export async function enforceMarketplaceCheckoutAtomicity(
  client: MigrationClient,
  sql: string,
  allowPartialBootstrap: boolean,
): Promise<RelationState> {
  const result = await client.query(
    `SELECT to_regclass('orders')::text AS orders,
            to_regclass('products')::text AS products,
            to_regclass('commissions')::text AS commissions`
  ) as { rows: Array<{ orders: string | null; products: string | null; commissions: string | null }> };
  const state: RelationState = {
    orders: Boolean(result.rows[0]?.orders),
    products: Boolean(result.rows[0]?.products),
    commissions: Boolean(result.rows[0]?.commissions),
  };

  if (!allowPartialBootstrap && (!state.orders || !state.products || !state.commissions)) {
    throw new Error(
      "Marketplace checkout atomicity cannot be enforced: orders, products, and commissions tables must all exist."
    );
  }

  const statements = splitPostgresStatements(sql).filter((statement) =>
    requiredRelations(statement).every((relation) => state[relation])
  );
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
