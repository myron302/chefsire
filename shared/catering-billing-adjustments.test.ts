import assert from "node:assert/strict";
import test from "node:test";
import {
  CATERING_ADJUSTMENT_ACTION_LABEL,
  CATERING_ADJUSTMENT_EFFECT_COPY,
  CATERING_ADJUSTMENT_KINDS,
  CATERING_ADJUSTMENT_NOTIFICATIONS,
  CATERING_REFUND_DISCLOSURE,
  cateringAdjustmentCreateSchema,
  cateringAdjustmentKindsRecordable,
  cateringAdjustmentKindsReversible,
  cateringAdjustmentReplayMatches,
  cateringAdjustmentReverseSchema,
  cateringAmendedPriceKeepsLedgerCoherent,
  cateringAmendmentLedgerEffect,
  cateringCreditCeilingCents,
  cateringRefundCeilingCents,
  deriveCateringLedgerPosition,
  resolveCateringAdjustment,
  resolveCateringAdjustmentReversal,
  type CateringAdjustmentFact,
  type CateringAdjustmentFacts,
} from "./catering-billing-adjustments";
import {
  CATERING_INVOICE_KINDS,
  cateringInvoiceAmountFor,
  cateringIssuableInvoiceKinds,
  cateringObligationCents,
  cateringPayableCents,
  cateringEffectivePayables,
  cateringEffectivePayableCents,
  cateringIssuanceKeepsPartition,
  cateringDepositRequirement,
  deriveCateringBillingSummary,
  type CateringBillingFacts,
  type CateringInvoiceFact,
  type CateringPaymentFact,
} from "./catering-booking-billing";

let counter = 0;
const entry = (over: Partial<CateringAdjustmentFact> = {}): CateringAdjustmentFact => ({ id: `e${++counter}`, kind: "charge", amountCents: 100, currency: "USD", status: "posted", source: "provider_recorded", paymentId: null, ...over });
const facts = (over: Partial<CateringAdjustmentFacts> = {}): CateringAdjustmentFacts => ({ bookingStatus: "confirmed", currency: "USD", agreedTotalCents: 250_000, liveInvoicedCents: 0, paidTotalCents: 0, payments: [], adjustments: [], ...over });

/* ------------------------------------------------------------------------------------------------------------- *
 * The formula
 * ------------------------------------------------------------------------------------------------------------- */

test("the position is exactly: original + charges - credits = obligation; payments - refunds = net received; obligation - net = balance", () => {
  const position = deriveCateringLedgerPosition({
    agreedTotalCents: 250_000, paidTotalCents: 100_000,
    adjustments: [entry({ kind: "charge", amountCents: 40_000 }), entry({ kind: "credit", amountCents: 20_000 }), entry({ kind: "refund", amountCents: 30_000 })],
  });
  assert.deepEqual(
    [position.originalAgreedCents, position.chargesCents, position.creditsCents, position.obligationCents, position.refundsCents, position.netReceivedCents, position.balanceDueCents, position.refundPotentiallyDueCents],
    [250_000, 40_000, 20_000, 270_000, 30_000, 70_000, 200_000, 0]);
});

test("an amendment-generated entry EXPLAINS a movement the agreed price already contains, so it is displayed and never added twice", () => {
  // Booking amended 2,500 -> 2,900 after billing: the agreed price is now 2,900 and the ledger holds the +400 that explains it.
  const position = deriveCateringLedgerPosition({ agreedTotalCents: 290_000, paidTotalCents: 0, adjustments: [entry({ source: "amendment", kind: "charge", amountCents: 40_000 })] });
  assert.deepEqual([position.originalAgreedCents, position.chargesCents, position.obligationCents, position.amendmentNetCents], [250_000, 40_000, 290_000, 40_000]);
  assert.equal(position.originalAgreedCents! + position.chargesCents - position.creditsCents, position.obligationCents, "the identity holds whichever source an entry has");
  const decrease = deriveCateringLedgerPosition({ agreedTotalCents: 230_000, paidTotalCents: 250_000, adjustments: [entry({ source: "amendment", kind: "credit", amountCents: 20_000 })] });
  assert.deepEqual([decrease.originalAgreedCents, decrease.obligationCents, decrease.refundPotentiallyDueCents, decrease.refundsCents], [250_000, 230_000, 20_000, 0]);
});

test("a reversed entry counts for nothing, in every figure", () => {
  const position = deriveCateringLedgerPosition({
    agreedTotalCents: 100_000, paidTotalCents: 50_000,
    adjustments: [entry({ kind: "charge", amountCents: 9_999, status: "reversed" }), entry({ kind: "credit", amountCents: 9_999, status: "reversed" }), entry({ kind: "refund", amountCents: 9_999, status: "reversed" })],
  });
  assert.deepEqual([position.chargesCents, position.creditsCents, position.refundsCents, position.obligationCents, position.netReceivedCents], [0, 0, 0, 100_000, 50_000]);
});

test("a booking with no agreed price has no obligation, no original and no balance -- never zero", () => {
  const position = deriveCateringLedgerPosition({ agreedTotalCents: null, paidTotalCents: 0, adjustments: [] });
  assert.deepEqual([position.obligationCents, position.originalAgreedCents, position.balanceDueCents], [null, null, null]);
});

test("overpayment is a refund PROMPT and never a refund", () => {
  const position = deriveCateringLedgerPosition({ agreedTotalCents: 230_000, paidTotalCents: 250_000, adjustments: [] });
  assert.deepEqual([position.refundPotentiallyDueCents, position.refundsCents, position.balanceDueCents], [20_000, 0, 0]);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Writes
 * ------------------------------------------------------------------------------------------------------------- */

test("the three concepts are distinct: a charge and a credit move the obligation, a refund moves net received only", () => {
  const base = facts({ paidTotalCents: 100_000 });
  const after = (kind: "charge" | "credit" | "refund") => deriveCateringLedgerPosition({ agreedTotalCents: 250_000, paidTotalCents: 100_000, adjustments: [entry({ kind, amountCents: 10_000 })] });
  assert.deepEqual([after("charge").obligationCents, after("charge").netReceivedCents], [260_000, 100_000]);
  assert.deepEqual([after("credit").obligationCents, after("credit").netReceivedCents], [240_000, 100_000]);
  assert.deepEqual([after("refund").obligationCents, after("refund").netReceivedCents], [250_000, 90_000]);
  assert.equal(resolveCateringAdjustment({ kind: "refund", amountCents: 10_000, currency: "USD", paymentId: null }, base).ok, true);
});

test("a credit may reach exactly zero and never go below it", () => {
  const f = facts();
  assert.equal(cateringCreditCeilingCents(deriveCateringLedgerPosition({ agreedTotalCents: 250_000, paidTotalCents: 0, adjustments: [] })), 250_000);
  assert.equal(resolveCateringAdjustment({ kind: "credit", amountCents: 250_000, currency: "USD", paymentId: null }, f).ok, true);
  const over = resolveCateringAdjustment({ kind: "credit", amountCents: 250_001, currency: "USD", paymentId: null }, f);
  assert.deepEqual(over.ok === false && over.code, "exceeds_obligation");
  const afterCredit = facts({ adjustments: [entry({ kind: "credit", amountCents: 100_000 })] });
  assert.equal(resolveCateringAdjustment({ kind: "credit", amountCents: 150_001, currency: "USD", paymentId: null }, afterCredit).ok, false, "judged against the obligation AFTER earlier credits");
  assert.equal(resolveCateringAdjustment({ kind: "credit", amountCents: 150_000, currency: "USD", paymentId: null }, afterCredit).ok, true);
  const reversedCredit = facts({ adjustments: [entry({ kind: "credit", amountCents: 100_000, status: "reversed" })] });
  assert.equal(resolveCateringAdjustment({ kind: "credit", amountCents: 250_000, currency: "USD", paymentId: null }, reversedCredit).ok, true, "a reversed credit frees the obligation again");
});

test("a charge and a credit need an agreed price; a refund does not", () => {
  const noPrice = facts({ agreedTotalCents: null, paidTotalCents: 10_000 });
  for (const kind of ["charge", "credit"] as const) {
    const refused = resolveCateringAdjustment({ kind, amountCents: 1, currency: "USD", paymentId: null }, noPrice);
    assert.equal(refused.ok === false && refused.code, "no_agreed_price", kind);
  }
  assert.equal(resolveCateringAdjustment({ kind: "refund", amountCents: 1, currency: "USD", paymentId: null }, noPrice).ok, true);
});

test("a refund is bounded by money received less refunds already posted, exactly", () => {
  const base = { paidTotalCents: 100_000, adjustments: [entry({ kind: "refund", amountCents: 30_000 })] };
  assert.equal(cateringRefundCeilingCents(base), 70_000);
  assert.equal(resolveCateringAdjustment({ kind: "refund", amountCents: 70_000, currency: "USD", paymentId: null }, facts(base)).ok, true);
  const over = resolveCateringAdjustment({ kind: "refund", amountCents: 70_001, currency: "USD", paymentId: null }, facts(base));
  assert.equal(over.ok === false && over.code, "exceeds_received");
  assert.equal(cateringRefundCeilingCents({ paidTotalCents: 0, adjustments: [] }), 0);
  assert.equal(cateringRefundCeilingCents({ paidTotalCents: 10, adjustments: [entry({ kind: "refund", amountCents: 50 })] }), 0, "never negative");
  const reversed = { paidTotalCents: 100_000, adjustments: [entry({ kind: "refund", amountCents: 30_000, status: "reversed" })] };
  assert.equal(cateringRefundCeilingCents(reversed), 100_000, "a reversed refund frees the ceiling");
});

test("a refund that names a payment is bounded by that payment, must be a recorded payment, and must share its currency", () => {
  const payments = [{ id: "p1", amountCents: 60_000, currency: "USD", status: "recorded" as const }, { id: "p2", amountCents: 40_000, currency: "USD", status: "voided" as const }];
  const base = facts({ paidTotalCents: 60_000, payments, adjustments: [entry({ kind: "refund", amountCents: 50_000, paymentId: "p1" })] });
  assert.equal(resolveCateringAdjustment({ kind: "refund", amountCents: 10_000, currency: "USD", paymentId: "p1" }, base).ok, true);
  const over = resolveCateringAdjustment({ kind: "refund", amountCents: 10_001, currency: "USD", paymentId: "p1" }, base);
  assert.equal(over.ok === false && over.code, "exceeds_received", "the total ceiling is hit first, which is also exact");
  const perPayment = resolveCateringAdjustment({ kind: "refund", amountCents: 20_000, currency: "USD", paymentId: "p1" }, facts({ paidTotalCents: 200_000, payments, adjustments: [entry({ kind: "refund", amountCents: 50_000, paymentId: "p1" })] }));
  assert.equal(perPayment.ok === false && perPayment.code, "payment_exceeds");
  assert.equal((resolveCateringAdjustment({ kind: "refund", amountCents: 1, currency: "USD", paymentId: "p2" }, base) as { code: string }).code, "payment_not_found", "a voided payment is not money received");
  assert.equal((resolveCateringAdjustment({ kind: "refund", amountCents: 1, currency: "USD", paymentId: "nope" }, base) as { code: string }).code, "payment_not_found");
  const eur = facts({ paidTotalCents: 60_000, payments: [{ id: "p3", amountCents: 60_000, currency: "EUR", status: "recorded" }] });
  assert.equal((resolveCateringAdjustment({ kind: "refund", amountCents: 1, currency: "USD", paymentId: "p3" }, eur) as { code: string }).code, "currency_mismatch");
});

test("currency must match the booking, and nothing is ever converted", () => {
  const refused = resolveCateringAdjustment({ kind: "charge", amountCents: 100, currency: "EUR", paymentId: null }, facts());
  assert.equal(refused.ok === false && refused.code, "currency_mismatch");
  assert.match((refused as { message: string }).message, /does not convert/);
});

test("what each booking status permits: refunds survive cancellation, a new charge does not survive completion", () => {
  assert.deepEqual([...cateringAdjustmentKindsRecordable("confirmed")], ["charge", "credit", "refund"]);
  assert.deepEqual([...cateringAdjustmentKindsRecordable("completed")], ["credit", "refund"]);
  assert.deepEqual([...cateringAdjustmentKindsRecordable("cancelled")], ["refund"]);
  assert.deepEqual([...cateringAdjustmentKindsRecordable("pending_confirmation")], ["refund"]);
  assert.deepEqual([...cateringAdjustmentKindsRecordable("mystery")], [], "an unknown status permits nothing");
  for (const status of ["cancelled", "completed", "pending_confirmation"]) {
    const refused = resolveCateringAdjustment({ kind: "charge", amountCents: 1, currency: "USD", paymentId: null }, facts({ bookingStatus: status }));
    assert.equal(refused.ok === false && refused.code, "not_allowed_for_status", status);
  }
  assert.deepEqual([...cateringAdjustmentKindsReversible("confirmed")], ["charge", "credit", "refund"]);
  assert.deepEqual([...cateringAdjustmentKindsReversible("completed")], ["charge", "refund"]);
  assert.deepEqual([...cateringAdjustmentKindsReversible("cancelled")], ["refund"]);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Reversal
 * ------------------------------------------------------------------------------------------------------------- */

test("a reversal is refused for an entry that is missing, already reversed, or from an accepted amendment", () => {
  const posted = entry();
  assert.equal(resolveCateringAdjustmentReversal(undefined, facts()).ok, false);
  const reversed = entry({ status: "reversed" });
  assert.equal((resolveCateringAdjustmentReversal(reversed, facts({ adjustments: [reversed] })) as { code: string }).code, "already_reversed");
  const fromAmendment = entry({ source: "amendment" });
  assert.equal((resolveCateringAdjustmentReversal(fromAmendment, facts({ adjustments: [fromAmendment] })) as { code: string }).code, "not_reversible");
  assert.equal(resolveCateringAdjustmentReversal(posted, facts({ adjustments: [posted] })).ok, true);
});

test("reversing a charge cannot take the obligation below zero, and an unpaid ask cannot outlive the obligation", () => {
  const charge = entry({ kind: "charge", amountCents: 100_000 });
  const credit = entry({ kind: "credit", amountCents: 340_000 });
  const refused = resolveCateringAdjustmentReversal(charge, facts({ adjustments: [charge, credit] }));
  assert.equal(refused.ok === false && refused.code, "exceeds_obligation");
  const requested = facts({ adjustments: [charge], liveInvoicedCents: 350_000, paidTotalCents: 250_000 });
  assert.equal((resolveCateringAdjustmentReversal(charge, requested) as { code: string }).code, "invoice_outstanding", "100,000 of the ask is unpaid and no longer owed");
  const paid = facts({ adjustments: [charge], liveInvoicedCents: 350_000, paidTotalCents: 350_000 });
  assert.equal(resolveCateringAdjustmentReversal(charge, paid).ok, true, "paid history is never in question: the customer is owed a refund prompt instead");
});

test("completed and cancelled bookings reverse only what reduces exposure or restores a recorded fact", () => {
  const credit = entry({ kind: "credit" });
  const refund = entry({ kind: "refund" });
  const charge = entry({ kind: "charge" });
  const all = [credit, refund, charge];
  assert.equal((resolveCateringAdjustmentReversal(credit, facts({ bookingStatus: "completed", adjustments: all })) as { code: string }).code, "not_allowed_for_status");
  assert.equal(resolveCateringAdjustmentReversal(charge, facts({ bookingStatus: "completed", adjustments: all, paidTotalCents: 1000 })).ok, true);
  assert.equal((resolveCateringAdjustmentReversal(charge, facts({ bookingStatus: "cancelled", adjustments: all })) as { code: string }).code, "not_allowed_for_status");
  assert.equal(resolveCateringAdjustmentReversal(refund, facts({ bookingStatus: "cancelled", adjustments: all, paidTotalCents: 1000 })).ok, true);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Amendment integration
 * ------------------------------------------------------------------------------------------------------------- */

test("a price amendment becomes exactly one charge or credit, of exactly the difference", () => {
  assert.deepEqual(cateringAmendmentLedgerEffect(250_000, 290_000), { kind: "charge", amountCents: 40_000 });
  assert.deepEqual(cateringAmendmentLedgerEffect(250_000, 230_000), { kind: "credit", amountCents: 20_000 });
  assert.equal(cateringAmendmentLedgerEffect(250_000, 250_000), null, "no change, no entry");
  assert.equal(cateringAmendmentLedgerEffect(null, 100), "unreconcilable");
  assert.equal(cateringAmendmentLedgerEffect(100, null), "unreconcilable");
  assert.deepEqual(cateringAmendmentLedgerEffect(0, 1), { kind: "charge", amountCents: 1 });
  assert.deepEqual(cateringAmendmentLedgerEffect(1, 0), { kind: "credit", amountCents: 1 });
});

test("an amended price is accepted only if the resulting ledger stays coherent", () => {
  assert.equal(cateringAmendedPriceKeepsLedgerCoherent(290_000, { liveInvoicedCents: 250_000, paidTotalCents: 0, adjustments: [] }), true, "raising never strands an ask");
  assert.equal(cateringAmendedPriceKeepsLedgerCoherent(230_000, { liveInvoicedCents: 250_000, paidTotalCents: 0, adjustments: [] }), false, "an unpaid 2,500 ask would outlive a 2,300 obligation");
  assert.equal(cateringAmendedPriceKeepsLedgerCoherent(230_000, { liveInvoicedCents: 250_000, paidTotalCents: 250_000, adjustments: [] }), true, "paid history is untouched");
  assert.equal(cateringAmendedPriceKeepsLedgerCoherent(10_000, { liveInvoicedCents: 0, paidTotalCents: 0, adjustments: [entry({ kind: "credit", amountCents: 20_000 })] }), false, "the obligation would be negative");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Idempotency
 * ------------------------------------------------------------------------------------------------------------- */

test("a replay matches only the SAME entry: every field that decides what it is is compared", () => {
  const recorded = { kind: "refund", amountCents: 100, currency: "USD", reason: "Returned", paymentId: "p1", reference: "r" };
  assert.equal(cateringAdjustmentReplayMatches(recorded, { ...recorded }), true);
  assert.equal(cateringAdjustmentReplayMatches({ ...recorded, paymentId: null, reference: null }, { ...recorded, paymentId: undefined, reference: undefined }), true, "absent and null are one absence");
  for (const changed of [{ kind: "credit" }, { amountCents: 101 }, { currency: "EUR" }, { reason: "Other" }, { paymentId: "p2" }, { reference: "x" }]) {
    assert.equal(cateringAdjustmentReplayMatches(recorded, { ...recorded, ...changed }), false, JSON.stringify(changed));
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Request schemas: integer cents, explicit currency, strict
 * ------------------------------------------------------------------------------------------------------------- */

const valid = { kind: "charge", amountCents: 1000, currency: "USD", reason: "Extra guests", idempotencyKey: "key-123456" };

test("the create schema accepts whole positive cents with an explicit currency, and nothing else", () => {
  assert.equal(cateringAdjustmentCreateSchema.safeParse(valid).success, true);
  for (const amountCents of [10.5, 0, -1, "1000", null, undefined, 1e12, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(cateringAdjustmentCreateSchema.safeParse({ ...valid, amountCents }).success, false, String(amountCents));
  }
  for (const currency of ["usd", "US", "USDX", "", undefined, 5]) assert.equal(cateringAdjustmentCreateSchema.safeParse({ ...valid, currency }).success, false, String(currency));
  for (const reason of ["", "   ", undefined, "x".repeat(501)]) assert.equal(cateringAdjustmentCreateSchema.safeParse({ ...valid, reason }).success, false, String(reason).slice(0, 10));
  for (const idempotencyKey of ["short", "", undefined, "k".repeat(65)]) assert.equal(cateringAdjustmentCreateSchema.safeParse({ ...valid, idempotencyKey }).success, false);
  assert.equal(cateringAdjustmentCreateSchema.safeParse({ ...valid, kind: "bonus" }).success, false);
});

test("the create schema is strict: no actor, role, status, source or amendment can be sent", () => {
  for (const extra of [{ providerId: "x" }, { userId: "x" }, { customerId: "x" }, { role: "provider" }, { status: "posted" }, { source: "amendment" }, { amendmentId: "x" }, { recordedBy: "x" }, { amount: "10.00" }]) {
    assert.equal(cateringAdjustmentCreateSchema.safeParse({ ...valid, ...extra }).success, false, JSON.stringify(extra));
  }
});

test("a payment and a reference belong to a refund only", () => {
  const paymentId = "2f1c1d6e-3c0e-4a52-9a8a-0d6f9f4f5a11";
  assert.equal(cateringAdjustmentCreateSchema.safeParse({ ...valid, paymentId }).success, false);
  assert.equal(cateringAdjustmentCreateSchema.safeParse({ ...valid, reference: "r" }).success, false);
  assert.equal(cateringAdjustmentCreateSchema.safeParse({ ...valid, kind: "refund", paymentId, reference: "bank ref" }).success, true);
  assert.equal(cateringAdjustmentCreateSchema.safeParse({ ...valid, kind: "refund", paymentId: "not-a-uuid" }).success, false);
});

test("a reversal needs a reason and nothing else", () => {
  assert.equal(cateringAdjustmentReverseSchema.safeParse({ reason: "Entered twice" }).success, true);
  assert.equal(cateringAdjustmentReverseSchema.safeParse({}).success, false);
  assert.equal(cateringAdjustmentReverseSchema.safeParse({ reason: " " }).success, false);
  assert.equal(cateringAdjustmentReverseSchema.safeParse({ reason: "x", amountCents: 1 }).success, false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Copy: a record is never an action
 * ------------------------------------------------------------------------------------------------------------- */

test("a refund is only ever worded as a RECORD of money returned outside ChefSire", () => {
  const all = JSON.stringify([CATERING_ADJUSTMENT_ACTION_LABEL, CATERING_ADJUSTMENT_EFFECT_COPY, CATERING_REFUND_DISCLOSURE, CATERING_ADJUSTMENT_NOTIFICATIONS]);
  assert.match(CATERING_REFUND_DISCLOSURE.helper, /Recording a refund does not send money/);
  assert.match(CATERING_REFUND_DISCLOSURE.helper, /outside ChefSire/);
  assert.match(CATERING_ADJUSTMENT_ACTION_LABEL.refund, /Record external refund/);
  assert.match(CATERING_ADJUSTMENT_EFFECT_COPY.refund, /does not send money/);
  assert.match(CATERING_ADJUSTMENT_EFFECT_COPY.credit, /does not mean any money was returned/);
  for (const forbidden of [/refund successful/i, /refunded to your card/i, /processed/i, /we (have )?(sent|refunded)/i, /transaction id/i, /\bFix\b/]) assert.equal(forbidden.test(all), false, String(forbidden));
  assert.deepEqual([...CATERING_ADJUSTMENT_KINDS], ["charge", "credit", "refund"]);
});

test("notifications say that something changed and never what: no amount, reason, reference or payment detail", () => {
  for (const note of Object.values(CATERING_ADJUSTMENT_NOTIFICATIONS)) {
    assert.equal(/\d/.test(`${note.title} ${note.message}`), false, "no digits, so no amount");
    assert.equal(/refund|payment|credit|charge|\$/i.test(`${note.title} ${note.message}`), false, "not even the kind");
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Integration with the Phase 2L derivation
 * ------------------------------------------------------------------------------------------------------------- */

const invoice = (over: Partial<CateringInvoiceFact> = {}): CateringInvoiceFact => ({ id: `i${++counter}`, number: counter, kind: "balance", amountCents: 250_000, currency: "USD", status: "issued", dueOn: null, issuedAt: "2026-01-01T00:00:00.000Z", ...over });
const payment = (over: Partial<CateringPaymentFact> = {}): CateringPaymentFact => ({ id: `p${++counter}`, invoiceId: "i", amountCents: 100, currency: "USD", method: "cash", source: "provider_recorded", status: "recorded", receivedOn: "2026-01-02", ...over });
const billing = (over: Partial<CateringBillingFacts> = {}): CateringBillingFacts => ({
  bookingStatus: "confirmed", agreedTotalCents: 250_000, currency: "USD", terms: { mode: "none", amountCents: null, percentBasisPoints: null, dueOn: null },
  invoices: [], payments: [], asOfDate: "2026-02-01", ...over,
});

test("a booking with no adjustment list derives EXACTLY what Phase 2L derived, so a legacy booking needs no fabricated row", () => {
  const inv = invoice();
  const pay = payment({ invoiceId: inv.id, amountCents: 100_000 });
  const legacy = deriveCateringBillingSummary(billing({ invoices: [inv], payments: [pay] }));
  const explicit = deriveCateringBillingSummary(billing({ invoices: [inv], payments: [pay], adjustments: [] }));
  assert.deepEqual(legacy, explicit);
  assert.deepEqual([legacy.agreedTotalCents, legacy.obligationCents, legacy.originalAgreedCents, legacy.remainingOfAgreedCents, legacy.balanceDueCents, legacy.outstandingInvoicedCents, legacy.netReceivedCents, legacy.refundsRecordedCents], [250_000, 250_000, 250_000, 150_000, 150_000, 150_000, 100_000, 0]);
});

test("the summary carries each concept separately and the settled status follows NET received against the obligation", () => {
  const inv = invoice();
  const pay = payment({ invoiceId: inv.id, amountCents: 250_000 });
  assert.equal(deriveCateringBillingSummary(billing({ invoices: [inv], payments: [pay] })).status, "settled");
  const charged = deriveCateringBillingSummary(billing({ invoices: [inv], payments: [pay], adjustments: [entry({ kind: "charge", amountCents: 40_000 })] }));
  assert.deepEqual([charged.status, charged.obligationCents, charged.balanceDueCents, charged.adjustmentChargesCents], ["balance_not_requested", 290_000, 40_000, 40_000]);
  const refunded = deriveCateringBillingSummary(billing({ invoices: [inv], payments: [pay], adjustments: [entry({ kind: "refund", amountCents: 50_000 })] }));
  assert.deepEqual([refunded.paidTotalCents, refunded.refundsRecordedCents, refunded.netReceivedCents, refunded.status], [250_000, 50_000, 200_000, "balance_not_requested"]);
});

test("a fully credited, unpaid booking owes nothing; a fully credited, paid one is settled with a refund prompt", () => {
  const credit = entry({ kind: "credit", amountCents: 250_000 });
  assert.equal(deriveCateringBillingSummary(billing({ adjustments: [credit] })).status, "no_payment_required");
  const inv = invoice();
  const paid = deriveCateringBillingSummary(billing({ invoices: [inv], payments: [payment({ invoiceId: inv.id, amountCents: 10_000 })], adjustments: [credit] }));
  assert.deepEqual([paid.status, paid.refundPotentiallyDueCents, paid.balanceDueCents], ["settled", 10_000, 0]);
});

test("an old request never asks for more than is now owed after a credit", () => {
  const inv = invoice();
  const summary = deriveCateringBillingSummary(billing({ invoices: [inv], adjustments: [entry({ kind: "credit", amountCents: 20_000 })] }));
  assert.deepEqual([summary.outstandingInvoicedCents, summary.nextAmountDueCents, summary.balanceDueCents], [230_000, 230_000, 230_000]);
});

test("the `adjustment` invoice kind exists, is requested for exactly what was ADDED, and only beside a live balance", () => {
  assert.equal((CATERING_INVOICE_KINDS as readonly string[]).includes("adjustment"), true);
  const balance = invoice({ kind: "balance", amountCents: 250_000 });
  const none = billing({ invoices: [balance] });
  assert.deepEqual(cateringIssuableInvoiceKinds(none), [], "nothing added: nothing more to request");
  const added = billing({ invoices: [balance], adjustments: [entry({ kind: "charge", amountCents: 40_000 })] });
  assert.deepEqual(cateringIssuableInvoiceKinds(added), ["adjustment"]);
  assert.equal(cateringInvoiceAmountFor("adjustment", added), 40_000);
  assert.equal(cateringInvoiceAmountFor("balance", added), null, "the balance is already live and is never reissued larger");
  const requested = billing({ invoices: [balance, invoice({ kind: "adjustment", amountCents: 40_000 })], adjustments: [entry({ kind: "charge", amountCents: 40_000 })] });
  assert.deepEqual(cateringIssuableInvoiceKinds(requested), [], "once, not twice");
  const more = billing({ invoices: [balance, invoice({ kind: "adjustment", amountCents: 40_000 })], adjustments: [entry({ kind: "charge", amountCents: 40_000 }), entry({ kind: "charge", amountCents: 5_000 })] });
  assert.equal(cateringInvoiceAmountFor("adjustment", more), 5_000, "a later addition is requested for itself alone");
  const credited = billing({ invoices: [balance], adjustments: [entry({ kind: "charge", amountCents: 40_000 }), entry({ kind: "credit", amountCents: 40_000 })] });
  assert.deepEqual(cateringIssuableInvoiceKinds(credited), [], "a charge that was credited back is not an addition");
  const cancelled = billing({ bookingStatus: "cancelled", invoices: [balance], adjustments: [entry({ kind: "charge", amountCents: 40_000 })] });
  assert.deepEqual(cateringIssuableInvoiceKinds(cancelled), []);
});

test("without a live balance the balance request itself covers whatever the obligation has grown by", () => {
  const withCharge = billing({ adjustments: [entry({ kind: "charge", amountCents: 40_000 })] });
  assert.equal(cateringObligationCents(withCharge), 290_000);
  assert.deepEqual(cateringIssuableInvoiceKinds(withCharge), ["balance"]);
  assert.equal(cateringInvoiceAmountFor("balance", withCharge), 290_000);
});

test("the payable cap is min(invoice remaining, booking balance due), zero when nothing may be recorded", () => {
  const inv = invoice({ amountCents: 50_000 });
  const base = billing({ agreedTotalCents: 50_000, invoices: [inv] });
  assert.equal(cateringPayableCents(inv, base), 50_000);
  const credited = { ...base, adjustments: [entry({ kind: "credit", amountCents: 20_000 })] };
  assert.equal(cateringPayableCents(inv, credited), 30_000, "credit lowered the booking balance below the invoice remaining");
  const small = invoice({ amountCents: 20_000 });
  assert.equal(cateringPayableCents(small, billing({ agreedTotalCents: 50_000, invoices: [small] })), 20_000);
  assert.equal(cateringPayableCents(inv, { ...base, adjustments: [entry({ kind: "credit", amountCents: 50_000 })] }), 0);
  assert.equal(cateringPayableCents(inv, { ...base, adjustments: [entry({ kind: "credit", amountCents: 50_000, status: "reversed" })] }), 50_000, "reversed credit restores it");
  assert.equal(cateringPayableCents(inv, { ...base, adjustments: [entry({ kind: "charge", amountCents: 90_000 })] }), 50_000, "a charge cannot raise an existing invoice's cap");
  assert.equal(cateringPayableCents(invoice({ status: "void" }), base), 0);
  assert.equal(cateringPayableCents(inv, { ...base, bookingStatus: "cancelled" }), 0);
  const paid = payment({ invoiceId: inv.id, amountCents: 10_000 });
  assert.equal(cateringPayableCents(inv, { ...base, payments: [paid] }), 40_000);
});

test("one deposit basis: the percentage applies to the adjusted obligation, a fixed amount keeps its meaning", () => {
  const percent = { mode: "percentage" as const, amountCents: null, percentBasisPoints: 5_000, dueOn: null };
  const fixed = { mode: "fixed" as const, amountCents: 30_000, percentBasisPoints: null, dueOn: null };
  const obligation = (adjustments: CateringAdjustmentFact[]) => cateringObligationCents({ agreedTotalCents: 100_000, adjustments });
  assert.equal(cateringDepositRequirement(percent, obligation([])), 50_000);
  assert.equal(cateringDepositRequirement(percent, obligation([entry({ kind: "charge", amountCents: 20_000 })])), 60_000);
  assert.equal(cateringDepositRequirement(percent, obligation([entry({ kind: "credit", amountCents: 20_000 })])), 40_000);
  assert.equal(cateringDepositRequirement(percent, obligation([entry({ kind: "charge", amountCents: 20_000, status: "reversed" })])), 50_000);
  assert.equal(cateringDepositRequirement(percent, obligation([entry({ kind: "credit", amountCents: 20_000, status: "reversed" })])), 50_000);
  assert.equal(cateringDepositRequirement(fixed, obligation([entry({ kind: "charge", amountCents: 20_000 })])), 30_000);
  assert.equal(cateringDepositRequirement(fixed, obligation([entry({ kind: "credit", amountCents: 90_000 })])), 10_000, "capped by what is owed");
  // The preview and the issued invoice are derived from the same facts.
  const facts = billing({ agreedTotalCents: 100_000, terms: percent, adjustments: [entry({ kind: "charge", amountCents: 20_000 })] });
  assert.equal(cateringInvoiceAmountFor("deposit", facts), 60_000);
  assert.equal(deriveCateringBillingSummary(facts).depositRequiredCents, 60_000);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Refund collectibility: every cent of balance due has a request to be paid against
 * ------------------------------------------------------------------------------------------------------------- */

const refund = (amountCents: number, over: Partial<CateringAdjustmentFact> = {}) => entry({ kind: "refund", amountCents, ...over });
/** The invariant, asserted over a whole set of facts: whatever is owed can be paid against an existing or issuable request. */
function assertNoStrandedBalance(facts: CateringBillingFacts) {
  const summary = deriveCateringBillingSummary(facts);
  const live = facts.invoices.filter((row) => row.status === "issued");
  const requestable = cateringIssuableInvoiceKinds(facts).reduce((total, kind) => total + (cateringInvoiceAmountFor(kind, facts) ?? 0), 0);
  const unpaidOnLive = live.reduce((total, row) => total + Math.max(0, row.amountCents - facts.payments.filter((p) => p.invoiceId === row.id && p.status === "recorded").reduce((sum, p) => sum + p.amountCents, 0)), 0);
  if ((summary.balanceDueCents ?? 0) > 0) assert.ok(unpaidOnLive + requestable >= summary.balanceDueCents!, `stranded: due ${summary.balanceDueCents}, unpaid ${unpaidOnLive}, requestable ${requestable}`);
  return { summary, requestable, unpaidOnLive };
}

test("refund after partial payment: $2,500 obligation, $1,000 paid, $300 refunded => $1,800 due, $1,800 collectible in total", () => {
  const inv = invoice({ kind: "balance", amountCents: 250_000 });
  const facts = billing({ invoices: [inv], payments: [payment({ invoiceId: inv.id, amountCents: 100_000 })], adjustments: [refund(30_000)] });
  const { summary, requestable, unpaidOnLive } = assertNoStrandedBalance(facts);
  assert.deepEqual([summary.obligationCents, summary.netReceivedCents, summary.balanceDueCents], [250_000, 70_000, 180_000], "the refund moved net received, never the obligation");
  assert.deepEqual([unpaidOnLive, requestable], [150_000, 30_000]);
  assert.deepEqual(cateringIssuableInvoiceKinds(facts), ["adjustment"]);
  assert.equal(cateringInvoiceAmountFor("adjustment", facts), 30_000, "exactly the refunded amount, once");
});

test("refund after full payment: the refunded $300 becomes collectible and the booking is NOT settled", () => {
  const inv = invoice({ kind: "balance", amountCents: 250_000 });
  const paid = payment({ invoiceId: inv.id, amountCents: 250_000 });
  assert.equal(deriveCateringBillingSummary(billing({ invoices: [inv], payments: [paid] })).status, "settled");
  const facts = billing({ invoices: [inv], payments: [paid], adjustments: [refund(30_000)] });
  const { summary } = assertNoStrandedBalance(facts);
  assert.deepEqual([summary.balanceDueCents, summary.status, summary.refundPotentiallyDueCents], [30_000, "balance_not_requested", 0]);
  assert.equal(cateringInvoiceAmountFor("adjustment", facts), 30_000);
  assert.equal(cateringInvoiceAmountFor("balance", facts), null, "the balance request is history and is never reissued larger");
});

test("with no live balance request the balance request itself covers a refunded amount", () => {
  const deposit = invoice({ kind: "deposit", amountCents: 100_000 });
  const facts = billing({ invoices: [deposit], payments: [payment({ invoiceId: deposit.id, amountCents: 100_000 })], adjustments: [refund(30_000)] });
  assert.equal(cateringInvoiceAmountFor("balance", facts), 180_000, "2,500 + 300 refunded - 1,000 requested already");
  assertNoStrandedBalance(facts);
});

test("the request is exactly satisfiable: paying every unpaid request settles the booking and strands nothing", () => {
  const first = invoice({ kind: "balance", amountCents: 250_000 });
  const second = invoice({ kind: "adjustment", amountCents: 30_000 });
  const adjustments = [refund(30_000)];
  const paying = (...amounts: [string, number][]) => amounts.map(([invoiceId, amountCents]) => payment({ invoiceId, amountCents }));
  const before = billing({ invoices: [first, second], payments: paying([first.id, 100_000]), adjustments });
  assert.equal(deriveCateringBillingSummary(before).balanceDueCents, 180_000);
  assert.equal(deriveCateringBillingSummary(before).outstandingInvoicedCents, 180_000, "the requests now ask for exactly what is owed");
  assert.deepEqual(cateringIssuableInvoiceKinds(before), [], "and nothing more can be requested for the same receivable");
  const after = billing({ invoices: [first, second], payments: paying([first.id, 250_000], [second.id, 30_000]), adjustments });
  const summary = deriveCateringBillingSummary(after);
  assert.deepEqual([summary.balanceDueCents, summary.netReceivedCents, summary.status], [0, 250_000, "settled"]);
});

test("partial refund then partial re-payment tracks the remaining collectible balance", () => {
  const first = invoice({ kind: "balance", amountCents: 250_000 });
  const second = invoice({ kind: "adjustment", amountCents: 30_000 });
  const facts = billing({ invoices: [first, second], payments: [payment({ invoiceId: first.id, amountCents: 250_000 }), payment({ invoiceId: second.id, amountCents: 10_000 })], adjustments: [refund(30_000)] });
  const summary = deriveCateringBillingSummary(facts);
  assert.deepEqual([summary.netReceivedCents, summary.balanceDueCents, summary.nextAmountDueCents], [230_000, 20_000, 20_000]);
  assertNoStrandedBalance(facts);
});

test("multiple refunds raise the collectible amount exactly once per live refund, and a later refund is requested for itself alone", () => {
  const first = invoice({ kind: "balance", amountCents: 250_000 });
  const paid = payment({ invoiceId: first.id, amountCents: 250_000 });
  assert.equal(cateringInvoiceAmountFor("adjustment", billing({ invoices: [first], payments: [paid], adjustments: [refund(30_000), refund(20_000)] })), 50_000);
  const requested = invoice({ kind: "adjustment", amountCents: 30_000 });
  const later = billing({ invoices: [first, requested], payments: [paid], adjustments: [refund(30_000), refund(20_000)] });
  assert.equal(cateringInvoiceAmountFor("adjustment", later), 20_000, "only what the earlier further request did not cover");
  assertNoStrandedBalance(later);
});

test("a reversed refund stops creating collectible capacity, exactly once", () => {
  const first = invoice({ kind: "balance", amountCents: 250_000 });
  const paid = payment({ invoiceId: first.id, amountCents: 250_000 });
  const reversed = billing({ invoices: [first], payments: [paid], adjustments: [refund(30_000, { status: "reversed" })] });
  assert.deepEqual([cateringIssuableInvoiceKinds(reversed), deriveCateringBillingSummary(reversed).balanceDueCents, deriveCateringBillingSummary(reversed).status], [[], 0, "settled"]);
  const live = billing({ invoices: [first], payments: [paid], adjustments: [refund(30_000)] });
  assert.equal(cateringInvoiceAmountFor("adjustment", live), 30_000);
});

test("refund + credit: the credit lowers the obligation and so the collectible amount; refund + charge: each lands once, in its own place", () => {
  const first = invoice({ kind: "balance", amountCents: 250_000 });
  const paid = payment({ invoiceId: first.id, amountCents: 250_000 });
  const withCredit = billing({ invoices: [first], payments: [paid], adjustments: [refund(30_000), entry({ kind: "credit", amountCents: 20_000 })] });
  const credited = assertNoStrandedBalance(withCredit);
  assert.deepEqual([credited.summary.obligationCents, credited.summary.netReceivedCents, credited.summary.balanceDueCents], [230_000, 220_000, 10_000]);
  assert.equal(cateringInvoiceAmountFor("adjustment", withCredit), 10_000, "300 refunded, 200 credited: 100 is collectible");
  const withCharge = billing({ invoices: [first], payments: [paid], adjustments: [refund(30_000), entry({ kind: "charge", amountCents: 40_000 })] });
  const charged = assertNoStrandedBalance(withCharge);
  assert.deepEqual([charged.summary.obligationCents, charged.summary.refundsRecordedCents, charged.summary.balanceDueCents], [290_000, 30_000, 70_000], "the refund is not also counted as a charge");
  assert.equal(cateringInvoiceAmountFor("adjustment", withCharge), 70_000);
});

test("a refund never creates request capacity beyond the actual positive balance due", () => {
  const first = invoice({ kind: "balance", amountCents: 250_000 });
  // Overpaid and then refunded back to the obligation: nothing is owed, so nothing may be requested.
  const overpaid = billing({ invoices: [first], payments: [payment({ invoiceId: first.id, amountCents: 250_000 }), payment({ invoiceId: first.id, amountCents: 30_000 })], adjustments: [refund(30_000)] });
  assert.deepEqual([deriveCateringBillingSummary(overpaid).balanceDueCents, cateringIssuableInvoiceKinds(overpaid)], [0, []], "nothing is owed, so nothing may be requested");
});

test("when payments already cover the refunded amount again, the collectible capacity is already spent", () => {
  const first = invoice({ kind: "balance", amountCents: 250_000 });
  const second = invoice({ kind: "adjustment", amountCents: 30_000 });
  const facts = billing({ invoices: [first, second], payments: [payment({ invoiceId: first.id, amountCents: 250_000 }), payment({ invoiceId: second.id, amountCents: 30_000 })], adjustments: [refund(30_000)] });
  assert.deepEqual([deriveCateringBillingSummary(facts).balanceDueCents, cateringIssuableInvoiceKinds(facts)], [0, []]);
});

test("the partition invariant now bounds live requests by obligation PLUS refunds, and by nothing looser", () => {
  const first = invoice({ kind: "balance", amountCents: 250_000 });
  const facts = billing({ invoices: [first], adjustments: [refund(30_000)] });
  assert.equal(cateringIssuanceKeepsPartition(facts, 30_000), true);
  assert.equal(cateringIssuanceKeepsPartition(facts, 30_001), false);
  assert.equal(cateringIssuanceKeepsPartition(billing({ invoices: [first] }), 1), false, "no refund, no capacity");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Overdue describes a positive CURRENT amount
 * ------------------------------------------------------------------------------------------------------------- */

const pastDue = (over: Partial<CateringInvoiceFact> = {}) => invoice({ kind: "balance", amountCents: 50_000, dueOn: "2026-01-15", ...over });
const credit = (amountCents: number, over: Partial<CateringAdjustmentFact> = {}) => entry({ kind: "credit", amountCents, ...over });

test("a past-due request whose balance a credit took to zero is not overdue, and the request itself is untouched", () => {
  const inv = pastDue();
  const facts = billing({ agreedTotalCents: 50_000, invoices: [inv], adjustments: [credit(50_000)] });
  const summary = deriveCateringBillingSummary(facts);
  assert.deepEqual([summary.balanceDueCents, summary.nextAmountDueCents, summary.nextDueOn, summary.nextDueIsOverdue, summary.hasOverdue, summary.status], [0, null, null, false, false, "no_payment_required"]);
  assert.equal(inv.status, "issued", "the historical invoice is not mutated");
  assert.equal(inv.amountCents, 50_000);
  assert.equal(cateringEffectivePayableCents(inv, facts), 0);
});

test("a partial credit keeps the request overdue, but only for the effective positive amount", () => {
  const inv = pastDue();
  const summary = deriveCateringBillingSummary(billing({ agreedTotalCents: 50_000, invoices: [inv], adjustments: [credit(40_000)] }));
  assert.deepEqual([summary.balanceDueCents, summary.nextAmountDueCents, summary.nextDueIsOverdue, summary.hasOverdue, summary.status], [10_000, 10_000, true, true, "balance_due"]);
});

test("a future-due request with a positive amount is not overdue", () => {
  const summary = deriveCateringBillingSummary(billing({ agreedTotalCents: 50_000, invoices: [pastDue({ dueOn: "2026-03-01" })] }));
  assert.deepEqual([summary.nextAmountDueCents, summary.nextDueIsOverdue, summary.hasOverdue], [50_000, false, false]);
});

test("a reversed credit restores the overdue state", () => {
  const inv = pastDue();
  const reversed = deriveCateringBillingSummary(billing({ agreedTotalCents: 50_000, invoices: [inv], adjustments: [credit(50_000, { status: "reversed" })] }));
  assert.deepEqual([reversed.balanceDueCents, reversed.nextDueIsOverdue, reversed.hasOverdue], [50_000, true, true]);
});

test("the balance is applied oldest request first, so only a request it reaches can be overdue", () => {
  const deposit = invoice({ kind: "deposit", number: 1, amountCents: 20_000, dueOn: "2026-01-10" });
  const balance = invoice({ kind: "balance", number: 2, amountCents: 30_000, dueOn: "2026-01-12" });
  const facts = billing({ agreedTotalCents: 50_000, invoices: [deposit, balance], adjustments: [credit(40_000)] });
  assert.deepEqual([...cateringEffectivePayables([deposit, balance], [], 10_000).entries()], [[deposit.id, 10_000], [balance.id, 0]]);
  const summary = deriveCateringBillingSummary(facts);
  assert.deepEqual([summary.nextAmountDueCents, summary.nextDueOn, summary.hasOverdue], [10_000, "2026-01-10", true]);
  const fullyCredited = deriveCateringBillingSummary(billing({ agreedTotalCents: 50_000, invoices: [deposit, balance], adjustments: [credit(50_000)] }));
  assert.equal(fullyCredited.hasOverdue, false);
});

test("a refund-created request is overdue by ITS OWN date, never by a stale zero-payable earlier request", () => {
  const first = pastDue({ amountCents: 250_000 });
  const paid = payment({ invoiceId: first.id, amountCents: 250_000 });
  const noneYet = deriveCateringBillingSummary(billing({ invoices: [first], payments: [paid], adjustments: [refund(30_000)] }));
  assert.deepEqual([noneYet.hasOverdue, noneYet.balanceDueCents, noneYet.status], [false, 30_000, "balance_not_requested"], "owed, but not yet requested, so not overdue and not settled");
  const dated = invoice({ kind: "adjustment", amountCents: 30_000, dueOn: "2026-01-20" });
  const overdue = deriveCateringBillingSummary(billing({ invoices: [first, dated], payments: [paid], adjustments: [refund(30_000)] }));
  assert.deepEqual([overdue.nextAmountDueCents, overdue.nextDueOn, overdue.nextDueIsOverdue, overdue.hasOverdue], [30_000, "2026-01-20", true, true]);
  const future = invoice({ kind: "adjustment", amountCents: 30_000, dueOn: "2026-03-20" });
  assert.equal(deriveCateringBillingSummary(billing({ invoices: [first, future], payments: [paid], adjustments: [refund(30_000)] })).hasOverdue, false);
});

test("'settled' and 'no payment required' never coexist with an overdue flag, across a sweep of states", () => {
  const dues = ["2026-01-01", "2026-03-01", null];
  for (const agreed of [0, 50_000]) for (const creditCents of [0, 10_000, 50_000]) for (const paidCents of [0, 20_000, 50_000]) for (const refundCents of [0, 10_000]) for (const dueOn of dues) {
    if (creditCents > agreed || refundCents > paidCents) continue;
    const inv = pastDue({ dueOn });
    const pay = paidCents > 0 ? [payment({ invoiceId: inv.id, amountCents: Math.min(paidCents, 50_000) })] : [];
    const adjustments = [...(creditCents ? [credit(creditCents)] : []), ...(refundCents ? [refund(refundCents)] : [])];
    const summary = deriveCateringBillingSummary(billing({ agreedTotalCents: agreed, invoices: agreed > 0 ? [inv] : [], payments: agreed > 0 ? pay : [], adjustments }));
    const label = JSON.stringify({ agreed, creditCents, paidCents, refundCents, dueOn, summary: [summary.status, summary.balanceDueCents, summary.hasOverdue] });
    if (summary.status === "settled" || summary.status === "no_payment_required") {
      assert.equal(summary.hasOverdue, false, label);
      assert.equal(summary.nextDueIsOverdue, false, label);
      assert.equal(summary.nextAmountDueCents, null, label);
    }
    if (summary.hasOverdue) assert.ok((summary.balanceDueCents ?? 0) > 0 && (summary.nextAmountDueCents ?? 0) > 0, label);
    if (summary.nextDueIsOverdue) assert.ok((summary.nextAmountDueCents ?? 0) > 0, label);
  }
});

test("without adjustments the effective payables are the raw remainders, so a legacy booking's overdue state is exactly as before", () => {
  const inv = pastDue({ amountCents: 50_000 });
  const part = payment({ invoiceId: inv.id, amountCents: 10_000 });
  const summary = deriveCateringBillingSummary(billing({ agreedTotalCents: 50_000, invoices: [inv], payments: [part] }));
  assert.deepEqual([summary.nextAmountDueCents, summary.nextDueIsOverdue, summary.hasOverdue, summary.status], [40_000, true, true, "balance_due"]);
});
