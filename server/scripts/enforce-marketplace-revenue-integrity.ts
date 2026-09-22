import "../lib/load-env";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required for marketplace revenue enforcement");

const client = new pg.Client({ connectionString: databaseUrl });
try {
  await client.connect();
  const exists = (await client.query(`SELECT to_regclass('orders') AS relation`)).rows[0]?.relation;
  if (!exists) {
    if (process.argv.includes("--allow-missing")) {
      console.log("Orders table absent; Drizzle may bootstrap it.");
      process.exit(0);
    }
    throw new Error("orders table is required after schema synchronization");
  }
  await client.query("BEGIN");
  await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_revenue_status text`);
  const hasPaymentStatus = (await client.query(`SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'payment_status'
  ) AS present`)).rows[0].present;
  await client.query(hasPaymentStatus ? `UPDATE orders SET seller_revenue_status = CASE
    WHEN payment_status IN ('captured', 'refund_pending') THEN 'credited'
    WHEN payment_status = 'refunded' THEN 'reversed'
    WHEN payment_status = 'capture_reconciliation' THEN 'uncredited'
    ELSE 'legacy_unverified' END
    WHERE seller_revenue_status IS NULL`
    : `UPDATE orders SET seller_revenue_status = 'legacy_unverified' WHERE seller_revenue_status IS NULL`);
  await client.query(`ALTER TABLE orders ALTER COLUMN seller_revenue_status SET DEFAULT 'uncredited'`);
  await client.query(`ALTER TABLE orders ALTER COLUMN seller_revenue_status SET NOT NULL`);
  await client.query(`DO $$ BEGIN IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_seller_revenue_status_check' AND conrelid = 'orders'::regclass
  ) THEN ALTER TABLE orders ADD CONSTRAINT orders_seller_revenue_status_check CHECK (
    seller_revenue_status IN ('uncredited', 'credited', 'reversed', 'legacy_unverified')
  ); END IF; END $$`);
  await client.query("COMMIT");
  console.log("Marketplace seller revenue invariants verified.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Marketplace revenue enforcement failed.", error);
  process.exitCode = 1;
} finally {
  await client.end();
}
