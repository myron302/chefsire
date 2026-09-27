import { splitPostgresStatements, type MigrationClient } from "./migration-runner";

type RelationState = { orders: boolean; products: boolean; commissions: boolean; paymentColumnsReady: boolean };

function requiredRelations(statement: string): Array<keyof Omit<RelationState, "paymentColumnsReady">> {
  const relations: Array<keyof Omit<RelationState, "paymentColumnsReady">> = [];
  if (/\bcommissions\b/i.test(statement)) relations.push("commissions");
  if (/\bproducts\b/i.test(statement)) relations.push("products");
  if (/\borders\b/i.test(statement)) relations.push("orders");
  return relations;
}

/**
 * The backfill and its constraints read payment_status, capture_idempotency_key,
 * provider_payment_status, payment_captured_at and square_payment_id -- all
 * introduced by the P1-03 payment/fulfillment migration, not this one. A
 * database from before P1-03 has an `orders` table without them: running the
 * backfill there would fail with an undefined-column error and abort db:push
 * before Drizzle ever gets a chance to add them. Detect that prerequisite
 * schema directly instead of assuming table existence implies column existence.
 */
async function hasPaymentFulfillmentColumns(client: MigrationClient): Promise<boolean> {
  const result = await client.query(
    `SELECT
       EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'payment_status') AS payment_status,
       EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'capture_idempotency_key') AS capture_idempotency_key,
       EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'provider_payment_status') AS provider_payment_status,
       EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'payment_captured_at') AS payment_captured_at,
       EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'square_payment_id') AS square_payment_id,
       EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'seller_revenue_status') AS seller_revenue_status,
       EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'capture_attempted_at') AS capture_attempted_at`
  ) as { rows: Array<Record<string, boolean>> };
  const row = result.rows[0] ?? {};
  return Boolean(
    row.payment_status && row.capture_idempotency_key && row.provider_payment_status
      && row.payment_captured_at && row.square_payment_id && row.seller_revenue_status
      && row.capture_attempted_at
  );
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
  const tableState = {
    orders: Boolean(result.rows[0]?.orders),
    products: Boolean(result.rows[0]?.products),
    commissions: Boolean(result.rows[0]?.commissions),
  };

  if (!allowPartialBootstrap && (!tableState.orders || !tableState.products || !tableState.commissions)) {
    throw new Error(
      "Marketplace checkout atomicity cannot be enforced: orders, products, and commissions tables must all exist."
    );
  }

  // Only ask about prerequisite columns once the table that would hold them
  // actually exists; to_regclass already covers a fresh/absent orders table.
  const paymentColumnsReady = tableState.orders ? await hasPaymentFulfillmentColumns(client) : false;
  const state: RelationState = { ...tableState, paymentColumnsReady };

  if (tableState.orders && !paymentColumnsReady) {
    if (!allowPartialBootstrap) {
      throw new Error(
        "Marketplace checkout atomicity cannot be enforced: orders is missing P1-03 payment/capture columns required by the backfill."
      );
    }
    // Pre-P1-03 database: let Drizzle add the payment/capture columns (and
    // inventory_status) in this push. Every row is uniformly pre-P1-03, so a
    // blind default is not a stranding risk here -- there is no existing
    // capture_pending/capture_reconciliation state for it to hide. The
    // post-push run, once those columns exist, re-evaluates every row.
    return state;
  }

  const statements = splitPostgresStatements(sql).filter((statement) =>
    requiredRelations(statement).every((relation) => tableState[relation])
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
