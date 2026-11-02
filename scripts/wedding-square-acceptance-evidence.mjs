import pg from "pg";
import { pathToFileURL } from "node:url";

/** Read-only, aggregate-only operator report. No Square calls and no PII. */
export function assessWeddingSquareEvidence(rows) {
  const counts = Object.fromEntries(
    ["cardSetups","enrollmentAttempts","subscriptions","invoicePayments",
     "freshPayments","revokedPayments","cancellations","failedWebhooks",
     "unresolvedCardSetups","unresolvedEnrollments"]
      .map(key => [key, Number(rows[key])]),
  );
  if (Object.values(counts).some(n => !Number.isSafeInteger(n) || n < 0))
    throw new Error("Wedding Square evidence counts unavailable");
  const blocked = [];
  if (!counts.cardSetups || !counts.enrollmentAttempts || !counts.subscriptions)
    blocked.push("No end-to-end provider enrollment evidence recorded");
  if (!counts.invoicePayments || !counts.freshPayments)
    blocked.push("No independently reconciled paid invoice evidence recorded");
  if (!counts.cancellations)
    blocked.push("No provider-confirmed cancellation recorded");
  if (counts.revokedPayments === 0)
    blocked.push("Refund/dispute revocation has not been demonstrated by this database snapshot");
  if (counts.unresolvedCardSetups || counts.unresolvedEnrollments || counts.failedWebhooks)
    blocked.push("Unresolved owner or webhook reconciliation exists");
  return Object.freeze({
    environment: "sandbox",
    readOnly: true,
    liveBillingActivated: false,
    realProviderAcceptancePassed: false,
    counts,
    blockers: blocked,
    note: "Aggregate database rows cannot independently prove successful live Square sandbox acceptance. Verify provider transactions and operator sign-off separately.",
  });
}

export async function collectWeddingSquareEvidence(env = process.env, makeClient = config => new pg.Client(config)) {
  if (env.SQUARE_ENV !== "sandbox" ||
      env.SQUARE_LIVE_PAYMENTS_ENABLED === "true" ||
      !env.DATABASE_URL) throw new Error("Sandbox acceptance evidence unavailable");
  const client = makeClient({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  let began = false;
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY"); began = true;
    await client.query("SET LOCAL statement_timeout = '8s'");
    const result = await client.query(`
      SELECT
        (SELECT count(*)::int FROM wedding_square_card_setup_attempts WHERE square_environment='sandbox') AS "cardSetups",
        (SELECT count(*)::int FROM wedding_square_enrollment_attempts WHERE square_environment='sandbox') AS "enrollmentAttempts",
        (SELECT count(*)::int FROM wedding_square_subscriptions WHERE square_environment='sandbox') AS "subscriptions",
        (SELECT count(*)::int FROM wedding_square_invoice_evidence WHERE square_environment='sandbox') AS "invoicePayments",
        (SELECT count(*)::int FROM wedding_square_invoice_evidence
          WHERE square_environment='sandbox' AND payment_revoked_at IS NULL
            AND last_payment_reconciled_at >= now() - interval '24 hours'
            AND last_payment_reconciled_at <= now()) AS "freshPayments",
        (SELECT count(*)::int FROM wedding_square_invoice_evidence
          WHERE square_environment='sandbox' AND payment_revoked_at IS NOT NULL) AS "revokedPayments",
        (SELECT count(*)::int FROM wedding_square_subscriptions
          WHERE square_environment='sandbox' AND provider_cancelled_at IS NOT NULL) AS "cancellations",
        (SELECT count(*)::int FROM wedding_square_webhook_events
          WHERE square_environment='sandbox' AND processing_status='failed') AS "failedWebhooks",
        (SELECT count(*)::int FROM wedding_square_card_setup_attempts
          WHERE square_environment='sandbox' AND status IN
            ('reserved','customer_submitting','customer_confirmed','card_submitting','needs_reconciliation')) AS "unresolvedCardSetups",
        (SELECT count(*)::int FROM wedding_square_enrollment_attempts
          WHERE square_environment='sandbox' AND status IN
            ('reserved','submitting','needs_reconciliation')) AS "unresolvedEnrollments"
    `);
    if (result.rows.length !== 1) throw new Error("Missing aggregate evidence");
    return assessWeddingSquareEvidence(result.rows[0]);
  } catch {
    throw new Error("Sandbox acceptance evidence unavailable");
  } finally {
    if (began) await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectWeddingSquareEvidence().then(value => {
    process.stdout.write(JSON.stringify(value, null, 2) + "\n");
    process.exitCode = 1; // NEVER mark provider acceptance passed from a DB snapshot
  }).catch(() => {
    process.stderr.write("Square sandbox acceptance evidence unavailable. No payment verified.\n");
    process.exitCode = 1;
  });
}
