import pg from "pg";
import { pathToFileURL } from "node:url";

/**
 * Read-only operator gate. Never calls Square, mutates Neon, prints secrets,
 * enables flags or represents a sandbox dry-run as a paid transaction.
 */
const requiredTables = [
  "wedding_square_enrollment_attempts",
  "wedding_square_subscriptions",
  "wedding_square_invoice_evidence",
  "wedding_square_webhook_events",
];
const requiredColumns = [
  ["wedding_square_subscriptions", "last_renewal_scan_at"],
  ["wedding_square_subscriptions", "provider_status"],
  ["wedding_square_invoice_evidence", "last_payment_reconciled_at"],
  ["wedding_square_invoice_evidence", "payment_revoked_at"],
];

export function assessWeddingSquareSandboxReadiness({ env, tables, columns, counts }) {
  const blockers = [];
  const settings = [
    "WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
    "WEDDING_SQUARE_SANDBOX_SUBMIT_ENABLED",
    "WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED",
    "WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED",
    "WEDDING_SQUARE_SANDBOX_RECONCILIATION_BATCH_ENABLED",
    "WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED",
    "WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED",
  ];
  // Deliberately report names and booleans only, not environment values.
  if (env.SQUARE_ENV !== "sandbox") blockers.push("SQUARE_ENV must be sandbox");
  if (env.SQUARE_LIVE_PAYMENTS_ENABLED === "true") blockers.push("Live payment enable switch must be off");
  for (const name of ["WEDDING_SQUARE_SANDBOX_MERCHANT_ID", "SQUARE_LOCATION_ID",
    "WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID",
    "WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID",
    "WEDDING_SQUARE_ALLOWED_ORIGIN"]) {
    if (typeof env[name] !== "string" || !env[name].trim()) blockers.push(name + " is not configured");
  }
  const expectedOrigin = env.WEDDING_SQUARE_ALLOWED_ORIGIN;
  try {
    const url = new URL(expectedOrigin);
    if (url.protocol !== "https:" || url.origin !== expectedOrigin ||
        url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      blockers.push("WEDDING_SQUARE_ALLOWED_ORIGIN must be a bare HTTPS origin");
    }
  } catch {
    blockers.push("WEDDING_SQUARE_ALLOWED_ORIGIN must be a bare HTTPS origin");
  }
  for (const name of settings) if (env[name] !== "true") blockers.push(name + " is disabled");
  const existingTables = new Set(tables);
  const existingColumns = new Set(columns.map(({ table_name, column_name }) => table_name + "." + column_name));
  for (const table of requiredTables) if (!existingTables.has(table)) blockers.push("Missing table " + table);
  for (const [table, column] of requiredColumns) {
    if (!existingColumns.has(table + "." + column)) blockers.push("Missing column " + table + "." + column);
  }
  const sample = Object.fromEntries(requiredTables.map(table => [table, Number(counts[table] ?? 0)]));
  for (const [table, value] of Object.entries(sample)) {
    if (!Number.isSafeInteger(value) || value < 0) blockers.push("Invalid row count for " + table);
  }
  return Object.freeze({
    safeToAttemptSandboxAcceptance: blockers.length === 0,
    liveBillingActivatedByAudit: false,
    sandboxTransactionVerified: false,
    schema: { tablesChecked: requiredTables.length, columnsChecked: requiredColumns.length },
    rowCounts: sample,
    blockers,
    nextAction: blockers.length
      ? "Resolve blockers and rerun; no provider payment has been tested."
      : "Run real Square sandbox first-charge, renewal, cancellation and refund/dispute acceptance; this audit is not payment proof.",
  });
}

export async function runWeddingSquareSandboxReadiness(env = process.env) {
  // A non-sandbox configuration must never trigger even a DB connection.
  if (env.SQUARE_ENV !== "sandbox" || env.SQUARE_LIVE_PAYMENTS_ENABLED === "true") {
    return assessWeddingSquareSandboxReadiness({ env, tables: [], columns: [], counts: {} });
  }
  if (!env.DATABASE_URL) {
    return { ...assessWeddingSquareSandboxReadiness({ env, tables: [], columns: [], counts: {} }),
      blockers: ["DATABASE_URL is not configured"], safeToAttemptSandboxAcceptance: false };
  }
  const client = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const tables = (await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[])",
      [requiredTables],
    )).rows.map(row => row.table_name);
    const columns = (await client.query(
      "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = ANY($1::text[])",
      [requiredTables],
    )).rows;
    const counts = {};
    // Fixed, locally authored names only, never identifier interpolation from users.
    for (const table of requiredTables) {
      if (tables.includes(table)) counts[table] = Number((await client.query(
        'SELECT COUNT(*)::int AS total FROM public."' + table + '"',
      )).rows[0].total);
    }
    return assessWeddingSquareSandboxReadiness({ env, tables, columns, counts });
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runWeddingSquareSandboxReadiness().then(result => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exitCode = result.safeToAttemptSandboxAcceptance ? 0 : 1;
  }).catch(() => {
    // Never print driver errors: they may contain connection secrets.
    process.stderr.write("Wedding Square readiness audit unavailable; no payment verified.\n");
    process.exitCode = 1;
  });
}
