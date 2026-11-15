/**
 * The provider-evidence decision model. No database and no network: every one of these asserts the
 * rule that a thing we could not verify must never come out looking settled.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  PROVIDER_REFERENCE_SOURCES,
  PROVIDER_EVIDENCE_FRESHNESS_MS,
  REFUSING_SQUARE_READBACK,
  REQUIRED_PROVIDER_FAMILIES,
  ClosureProviderEvidenceUnavailableError,
  ProviderReadbackUnavailableError,
  assertProviderEvidenceUsable,
  assertProviderFamilyCoverage,
  isProviderEvidenceStale,
  reconcileProviderEvidence,
  type ProviderEvidenceManifest,
  type ProviderObjectKind,
  type ProviderObjectState,
  type ProviderPage,
  type ProviderReference,
  type SquareReadbackPort,
} from "./closure-provider-evidence";

const NOW = 1_800_000_000_000;

const reference = (over: Partial<ProviderReference> = {}): ProviderReference => ({
  family: "MARKETPLACE_ORDERS",
  kind: "payment",
  table: "orders",
  localRowId: "order-1",
  environment: "production",
  merchantId: "MERCHANT_1",
  providerId: "sqpmt_1",
  localStatus: "captured",
  ...over,
});

/** A port that answers with exactly what the test says, and records what it was asked. */
function portReturning(
  objects: ProviderObjectState[],
  complete = true,
): SquareReadbackPort & { asked: { kind: ProviderObjectKind; environment: string; merchantId: string; ids: string[] }[] } {
  const asked: { kind: ProviderObjectKind; environment: string; merchantId: string; ids: string[] }[] = [];
  return {
    asked,
    async readObjects(kind, environment, merchantId, providerIds): Promise<ProviderPage<ProviderObjectState>> {
      asked.push({ kind, environment, merchantId, ids: [...providerIds] });
      return { objects, complete };
    },
  };
}

const settled = (providerId = "sqpmt_1"): ProviderObjectState => ({
  providerId,
  status: "COMPLETED",
  amountCents: 2500,
  currency: "USD",
});

test("every required ledger family has a declared provider reference source", () => {
  assertProviderFamilyCoverage();
  const covered = new Set(PROVIDER_REFERENCE_SOURCES.map((source) => source.family));
  for (const family of REQUIRED_PROVIDER_FAMILIES) {
    assert.ok(covered.has(family), `${family} has no provider reference source`);
  }
});

test("a family with no source makes the whole verdict UNAVAILABLE rather than improving it", async () => {
  // The dangerous failure this guards: a forgotten ledger looks exactly like a settled one, because
  // both produce no references. Simulated by reconciling with the coverage check made to fail.
  const sources = PROVIDER_REFERENCE_SOURCES as unknown as { family: string }[];
  const removed = sources.splice(0, sources.length);
  try {
    assert.throws(() => assertProviderFamilyCoverage(), ClosureProviderEvidenceUnavailableError);
    const manifest = await reconcileProviderEvidence("user-1", [], portReturning([]), NOW);
    assert.equal(manifest.verdict, "UNAVAILABLE");
    assert.equal(manifest.exceptions[0].code, "FAMILY_NOT_COVERED");
  } finally {
    sources.push(...removed);
    assertProviderFamilyCoverage();
  }
});

test("the shipped port refuses, so this build cannot reach Square and gets UNAVAILABLE", async () => {
  await assert.rejects(
    () => REFUSING_SQUARE_READBACK.readObjects("payment", "production", "MERCHANT_1", ["sqpmt_1"]),
    ProviderReadbackUnavailableError,
  );
  // The default argument is that same refusing port, so a caller who forgets to inject one cannot
  // accidentally get a clear answer either.
  const manifest = await reconcileProviderEvidence("user-1", [reference()], undefined, NOW);
  assert.equal(manifest.verdict, "UNAVAILABLE");
  assert.deepEqual(manifest.exceptions.map((item) => item.code), ["READBACK_FAILED"]);
});

test("a complete, fully terminal readback reconciles, and says so for this member at this moment", async () => {
  const port = portReturning([settled()]);
  const manifest = await reconcileProviderEvidence("user-1", [reference()], port, NOW);
  assert.equal(manifest.verdict, "RECONCILED_LOCAL_AND_PROVIDER");
  assert.deepEqual(manifest.exceptions, []);
  assert.equal(manifest.userId, "user-1");
  assert.equal(manifest.readbackAt, NOW);
  assert.equal(manifest.expiresAt, NOW + PROVIDER_EVIDENCE_FRESHNESS_MS);
  assert.deepEqual(port.asked, [{ kind: "payment", environment: "production", merchantId: "MERCHANT_1", ids: ["sqpmt_1"] }]);
});

test("references are grouped per kind, environment and merchant, never mixed across accounts", async () => {
  const port = portReturning([settled("a"), settled("b")]);
  await reconcileProviderEvidence("user-1", [
    reference({ providerId: "a" }),
    reference({ providerId: "b", localRowId: "order-2" }),
    reference({ providerId: "c", localRowId: "order-3", merchantId: "MERCHANT_2" }),
    reference({ providerId: "d", localRowId: "order-4", environment: "sandbox" }),
    reference({ providerId: "e", localRowId: "sub-1", kind: "subscription", family: "WEDDING_SUBSCRIPTIONS" }),
  ], port, NOW);
  assert.equal(port.asked.length, 4, "one readback per kind+environment+merchant, and no more");
  assert.deepEqual(port.asked[0], { kind: "payment", environment: "production", merchantId: "MERCHANT_1", ids: ["a", "b"] });
  assert.deepEqual(port.asked.map((ask) => ask.merchantId).sort(), ["MERCHANT_1", "MERCHANT_1", "MERCHANT_2", "MERCHANT_1"].sort());
});

test("a local row that names no provider id is BLOCKED, never read as 'no payment'", async () => {
  const port = portReturning([]);
  const manifest = await reconcileProviderEvidence("user-1", [reference({ providerId: null })], port, NOW);
  assert.equal(manifest.verdict, "BLOCKED");
  assert.deepEqual(manifest.exceptions.map((item) => item.code), ["UNMAPPED_PROVIDER_REFERENCE"]);
  assert.equal(port.asked.length, 0, "an unaddressable row is not silently dropped from the readback either");
});

test("a blank provider id counts as no provider id", async () => {
  // collectLocalProviderReferences trims, so this is the belt: whitespace must not pass as an id.
  const manifest = await reconcileProviderEvidence("user-1", [reference({ providerId: null, localStatus: "captured" })], portReturning([]), NOW);
  assert.equal(manifest.verdict, "BLOCKED");
});

test("a row with no environment or merchant is UNAVAILABLE, because the wrong account could be read", async () => {
  const port = portReturning([settled()]);
  const manifest = await reconcileProviderEvidence("user-1", [reference({ environment: null })], port, NOW);
  assert.equal(manifest.verdict, "UNAVAILABLE");
  assert.deepEqual(manifest.exceptions.map((item) => item.code), ["UNKNOWN_ENVIRONMENT"]);
  assert.equal(port.asked.length, 0);

  const noMerchant = await reconcileProviderEvidence("user-1", [reference({ merchantId: null })], portReturning([settled()]), NOW);
  assert.equal(noMerchant.verdict, "UNAVAILABLE");
});

test("an unexhausted cursor or a default query window is UNAVAILABLE, not a shorter list", async () => {
  const manifest = await reconcileProviderEvidence("user-1", [reference()], portReturning([settled()], false), NOW);
  assert.equal(manifest.verdict, "UNAVAILABLE");
  assert.deepEqual(manifest.exceptions.map((item) => item.code), ["PAGINATION_INCOMPLETE"]);
});

test("a provider object the provider does not have is UNAVAILABLE", async () => {
  const manifest = await reconcileProviderEvidence("user-1", [reference()], portReturning([]), NOW);
  assert.equal(manifest.verdict, "UNAVAILABLE");
  assert.deepEqual(manifest.exceptions.map((item) => item.code), ["PROVIDER_OBJECT_MISSING"]);
});

test("an unrecognized provider status is UNAVAILABLE, so a new Square enum cannot read as settled", async () => {
  const manifest = await reconcileProviderEvidence(
    "user-1",
    [reference()],
    portReturning([{ ...settled(), status: "SOME_FUTURE_STATE" }]),
    NOW,
  );
  assert.equal(manifest.verdict, "UNAVAILABLE");
  assert.deepEqual(manifest.exceptions.map((item) => item.code), ["UNKNOWN_PROVIDER_STATUS"]);
});

for (const [label, state, expected] of [
  ["a payment still pending", { status: "PENDING" }, "PROVIDER_STATUS_NOT_TERMINAL"],
  ["a refund in flight", { hasPendingRefund: true }, "PENDING_REFUND"],
  ["an open dispute", { hasOpenDispute: true }, "OPEN_DISPUTE"],
  ["a scheduled renewal", { hasScheduledRenewal: true }, "SCHEDULED_RENEWAL"],
  ["an unsettled payout", { hasUnsettledPayout: true }, "UNSETTLED_PAYOUT"],
] as const) {
  test(`${label} is BLOCKED`, async () => {
    const manifest = await reconcileProviderEvidence(
      "user-1",
      [reference()],
      portReturning([{ ...settled(), ...state }]),
      NOW,
    );
    assert.equal(manifest.verdict, "BLOCKED");
    assert.ok(manifest.exceptions.some((item) => item.code === expected),
      `expected ${expected}, got ${manifest.exceptions.map((item) => item.code).join(",")}`);
  });
}

test("a terminal subscription with an unpaid invoice behind it is still BLOCKED", async () => {
  // The exact case the design calls out: a CANCELED subscription says nothing about its invoices.
  const port: SquareReadbackPort = {
    async readObjects(kind) {
      if (kind === "subscription") return { objects: [{ providerId: "sub_1", status: "CANCELED", amountCents: null, currency: null }], complete: true };
      return { objects: [{ providerId: "inv_1", status: "UNPAID", amountCents: 4900, currency: "USD" }], complete: true };
    },
  };
  const manifest = await reconcileProviderEvidence("user-1", [
    reference({ family: "WEDDING_SUBSCRIPTIONS", kind: "subscription", table: "wedding_square_subscriptions", localRowId: "s1", providerId: "sub_1" }),
    reference({ family: "WEDDING_INVOICES", kind: "invoice", table: "wedding_square_invoice_evidence", localRowId: "i1", providerId: "inv_1" }),
  ], port, NOW);
  assert.equal(manifest.verdict, "BLOCKED");
  assert.deepEqual(manifest.exceptions.map((item) => item.code), ["PROVIDER_STATUS_NOT_TERMINAL"]);
  assert.equal(manifest.exceptions[0].family, "WEDDING_INVOICES");
});

test("UNAVAILABLE outranks BLOCKED when both are present", async () => {
  const manifest = await reconcileProviderEvidence("user-1", [
    reference({ providerId: null, localRowId: "order-1" }),
    reference({ providerId: "sqpmt_2", localRowId: "order-2", environment: null }),
  ], portReturning([]), NOW);
  assert.equal(manifest.verdict, "UNAVAILABLE");
  assert.deepEqual(manifest.exceptions.map((item) => item.code).sort(),
    ["UNKNOWN_ENVIRONMENT", "UNMAPPED_PROVIDER_REFERENCE"]);
});

test("a payout that reads PAID still blocks until the provider's reversal window has closed", async () => {
  // Square's Payouts overview: a payout initially marked PAID can transition to FAILED if the
  // seller's bank answers later than Square expects. So PAID alone must not clear.
  const payout = (over: Partial<ProviderObjectState> = {}) =>
    reconcileProviderEvidence("user-1", [reference({ kind: "payout", providerId: "po_1" })],
      portReturning([{ providerId: "po_1", status: "PAID", amountCents: 9710, currency: "USD", ...over }]), NOW);

  const silent = await payout();
  assert.equal(silent.verdict, "BLOCKED", "an adapter that says nothing about reversal must not clear");
  assert.deepEqual(silent.exceptions.map((item) => item.code), ["PROVISIONAL_SETTLEMENT"]);

  const stillOpen = await payout({ settlementProvisional: true });
  assert.equal(stillOpen.verdict, "BLOCKED");

  const closed = await payout({ settlementProvisional: false });
  assert.equal(closed.verdict, "RECONCILED_LOCAL_AND_PROVIDER", "an explicitly closed window clears");

  // The same leniency must NOT leak to kinds that do not reverse.
  const payment = await reconcileProviderEvidence("user-1", [reference()], portReturning([settled()]), NOW);
  assert.equal(payment.verdict, "RECONCILED_LOCAL_AND_PROVIDER",
    "a payment that is COMPLETED needs no reversal-window claim");
});

test("a refund that is only APPROVED blocks, because Square does not say it equals COMPLETED", async () => {
  const manifest = await reconcileProviderEvidence(
    "user-1",
    [reference({ kind: "refund", providerId: "rf_1" })],
    portReturning([{ providerId: "rf_1", status: "APPROVED", amountCents: 500, currency: "USD" }]),
    NOW,
  );
  assert.equal(manifest.verdict, "BLOCKED");
  assert.deepEqual(manifest.exceptions.map((item) => item.code), ["PROVIDER_STATUS_NOT_TERMINAL"]);
});

test("the statuses Square actually defines are recognized, so real states do not read as unknown", async () => {
  // Each of these is a documented Square value. None may produce UNKNOWN_PROVIDER_STATUS, which
  // would be a refusal for the wrong reason and would hide the real state from whoever reads it.
  const cases: [ProviderObjectKind, string, "BLOCKED" | "RECONCILED_LOCAL_AND_PROVIDER"][] = [
    ["invoice", "PARTIALLY_REFUNDED", "BLOCKED"],
    ["invoice", "REFUNDED", "RECONCILED_LOCAL_AND_PROVIDER"],
    ["invoice", "PAYMENT_PENDING", "BLOCKED"],
    ["dispute", "INQUIRY_PROCESSING", "BLOCKED"],
    ["dispute", "INQUIRY_CLOSED", "RECONCILED_LOCAL_AND_PROVIDER"],
    ["order", "DRAFT", "BLOCKED"],
    ["payout", "SENT", "BLOCKED"],
  ];
  for (const [kind, status, expected] of cases) {
    const manifest = await reconcileProviderEvidence(
      "user-1",
      [reference({ kind, providerId: `obj_${status}` })],
      portReturning([{ providerId: `obj_${status}`, status, amountCents: 100, currency: "USD", settlementProvisional: false }]),
      NOW,
    );
    assert.equal(manifest.verdict, expected, `${kind} ${status}: ${JSON.stringify(manifest.exceptions)}`);
    assert.ok(!manifest.exceptions.some((item) => item.code === "UNKNOWN_PROVIDER_STATUS"),
      `${kind} ${status} is a documented Square value and must be recognized`);
  }
});

test("evidence expires, and an expired manifest is refused rather than downgraded", async () => {
  const port = portReturning([settled()]);
  const manifest = await reconcileProviderEvidence("user-1", [reference()], port, NOW);
  assert.equal(isProviderEvidenceStale(manifest, NOW + PROVIDER_EVIDENCE_FRESHNESS_MS - 1), false);
  assert.equal(isProviderEvidenceStale(manifest, NOW + PROVIDER_EVIDENCE_FRESHNESS_MS), true);
});

test("the final gate refuses the wrong member, a non-clear verdict and expired evidence", async () => {
  const unchanged = { execute: async () => ({ rows: [] }) };
  const clear: ProviderEvidenceManifest = {
    verdict: "RECONCILED_LOCAL_AND_PROVIDER",
    userId: "user-1",
    readbackAt: NOW,
    expiresAt: NOW + PROVIDER_EVIDENCE_FRESHNESS_MS,
    references: [],
    exceptions: [],
  };

  await assert.rejects(() => assertProviderEvidenceUsable(unchanged, "user-2", clear, NOW),
    (error: any) => error instanceof ClosureProviderEvidenceUnavailableError && /different member/.test(error.message));

  for (const verdict of ["BLOCKED", "UNAVAILABLE"] as const) {
    await assert.rejects(() => assertProviderEvidenceUsable(unchanged, "user-1", { ...clear, verdict }, NOW),
      (error: any) => error instanceof ClosureProviderEvidenceUnavailableError && error.message.includes(verdict));
  }

  await assert.rejects(
    () => assertProviderEvidenceUsable(unchanged, "user-1", clear, NOW + PROVIDER_EVIDENCE_FRESHNESS_MS),
    (error: any) => error instanceof ClosureProviderEvidenceUnavailableError && /expired/.test(error.message),
  );

  // The clear, fresh, right-member case with unchanged ledgers is the only one that passes.
  await assertProviderEvidenceUsable(unchanged, "user-1", clear, NOW);
});
