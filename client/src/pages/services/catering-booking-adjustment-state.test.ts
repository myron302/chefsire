import assert from "node:assert/strict";
import test from "node:test";
import {
  activeCateringAdjustmentForm,
  buildCateringAdjustmentRequest,
  cateringAdjustmentAmountText,
  cateringAdjustmentEffectSentence,
  cateringAdjustmentIdentity,
  cateringAdjustmentInvalidationKeys,
  cateringAdjustmentSnapshot,
  cateringAdjustmentSourceText,
  checkCateringAdjustmentForm,
  cateringRefundLimitForForm,
  chronologicalCateringAdjustments,
  describeCateringAdjustmentConfirmation,
  describeCateringReversalConfirmation,
  editCateringAdjustmentForm,
  isCurrentCateringAdjustmentTarget,
  maySubmitCateringAdjustment,
  openCateringAdjustmentForm,
  settleCateringAdjustmentForm,
} from "./catering-booking-adjustment-state";
import type { CateringAdjustmentView } from "@shared/catering-billing-adjustments";

const limits = { maxCreditCents: 250_000, maxRefundCents: 100_000 };
const A = cateringAdjustmentIdentity("user-a", "booking-1");
const B = cateringAdjustmentIdentity("user-a", "booking-2");
const form = (kind: "charge" | "credit" | "refund" = "charge", patch: Record<string, string> = {}) => {
  const opened = openCateringAdjustmentForm(A, kind, "key-0001-abcdef")!;
  return { ...opened, amount: "400", reason: "Extra guests", ...patch };
};
const view = (over: Partial<CateringAdjustmentView> = {}): CateringAdjustmentView => ({
  id: "e1", kind: "charge", source: "provider_recorded", status: "posted", amountCents: 40_000, currency: "USD", reason: "Extra guests",
  createdAt: "2026-03-01T10:00:00.000Z", reversedAt: null, reversalReason: null, amendmentNumber: null, paymentId: null, ...over,
});

test("a form belongs to one actor-and-booking identity and is invisible to any other", () => {
  const open = openCateringAdjustmentForm(A, "credit", "key-0001-abcdef");
  assert.equal(activeCateringAdjustmentForm(open, A, true)?.kind, "credit");
  assert.equal(activeCateringAdjustmentForm(open, B, true), null, "booking B never renders or submits booking A's draft");
  assert.equal(activeCateringAdjustmentForm(open, cateringAdjustmentIdentity("user-b", "booking-1"), true), null, "nor another account's");
  assert.equal(activeCateringAdjustmentForm(open, A, false), null, "a customer is never given a form");
  assert.equal(editCateringAdjustmentForm(open, B, { amount: "5" }), open, "an edit for another identity changes nothing");
  assert.equal(editCateringAdjustmentForm(open, A, { amount: "5" })?.amount, "5");
});

test("the amount is parsed to integer cents by the exact decimal parser and must be more than nothing", () => {
  for (const [text, cents] of [["400", 40_000], ["400.00", 40_000], ["$1,250.5", 125_050], ["0.01", 1], ["19.99", 1_999]] as const) {
    const checked = checkCateringAdjustmentForm(form("charge", { amount: text }), limits);
    assert.deepEqual(checked, { ok: true, amountCents: cents }, text);
  }
  for (const bad of ["", "0", "0.00", "-5", "abc", "1.234", "1e3", "12.", " "]) assert.equal(checkCateringAdjustmentForm(form("charge", { amount: bad }), limits).ok, false, bad);
});

test("a credit and a refund are checked against the SERVER's stated limits, and a reason is required", () => {
  assert.equal(checkCateringAdjustmentForm(form("credit", { amount: "2500" }), limits).ok, true);
  const overCredit = checkCateringAdjustmentForm(form("credit", { amount: "2500.01" }), limits);
  assert.deepEqual(overCredit.ok === false && overCredit.field, "amount");
  assert.equal(checkCateringAdjustmentForm(form("refund", { amount: "1000" }), limits).ok, true);
  assert.equal(checkCateringAdjustmentForm(form("refund", { amount: "1000.01" }), limits).ok, false);
  assert.equal(checkCateringAdjustmentForm(form("charge", { amount: "999999" }), limits).ok, true, "a charge has no client limit: the server decides");
  const noReason = checkCateringAdjustmentForm(form("charge", { reason: "   " }), limits);
  assert.deepEqual(noReason.ok === false && noReason.field, "reason");
  assert.equal(checkCateringAdjustmentForm(form("charge", { reason: "x".repeat(501) }), limits).ok, false);
  assert.equal(checkCateringAdjustmentForm(form("refund", { reference: "r".repeat(65) }), limits).ok, false);
  assert.equal(maySubmitCateringAdjustment(form(), limits, true), false, "never while a request is in flight");
  assert.equal(maySubmitCateringAdjustment(form(), limits, false), true);
});

test("the request is cents, an explicit currency, a kind, a reason and an attempt key -- never an actor, role, status or booking column", () => {
  const body = buildCateringAdjustmentRequest(form("charge"), "USD", 40_000);
  assert.deepEqual(body, { kind: "charge", amountCents: 40_000, currency: "USD", reason: "Extra guests", idempotencyKey: "key-0001-abcdef" });
  for (const forbidden of ["userId", "providerId", "customerId", "role", "status", "source", "recordedBy", "bookingId", "amendmentId"]) assert.equal(forbidden in body, false, forbidden);
  assert.equal(Number.isInteger(body.amountCents), true);
  const refund = buildCateringAdjustmentRequest(form("refund", { paymentId: "pay-1", reference: " BANK-1 " }), "EUR", 100);
  assert.deepEqual(refund, { kind: "refund", amountCents: 100, currency: "EUR", reason: "Extra guests", paymentId: "pay-1", reference: "BANK-1", idempotencyKey: "key-0001-abcdef" });
  const stray = buildCateringAdjustmentRequest(form("credit", { paymentId: "pay-1", reference: "x" }), "USD", 100);
  assert.equal("paymentId" in stray || "reference" in stray, false, "a payment and a reference are for a refund only");
});

test("a completion closes the form only if it is still the entry that was sent; newer edits are kept under a FRESH key", () => {
  const sent = form("charge");
  const snapshot = cateringAdjustmentSnapshot(sent);
  assert.equal(settleCateringAdjustmentForm(sent, A, snapshot, "fresh-key-0002"), null, "unchanged: closed");
  const edited = { ...sent, amount: "450" };
  const kept = settleCateringAdjustmentForm(edited, A, snapshot, "fresh-key-0002");
  assert.equal(kept?.amount, "450");
  assert.equal(kept?.idempotencyKey, "fresh-key-0002", "a new entry is not a retry of the one just recorded");
  assert.equal(settleCateringAdjustmentForm(sent, B, snapshot, "fresh-key-0002"), sent, "another booking's form is never touched by this completion");
  assert.equal(settleCateringAdjustmentForm(null, A, snapshot, "k"), null);
});

test("the confirmation states the type, the amount, the currency, the reason and the effect before anything is written", () => {
  const charge = describeCateringAdjustmentConfirmation(form("charge"), "USD", 40_000);
  assert.deepEqual(charge.lines.map((line) => line.label), ["Type", "Amount", "Currency", "Reason your customer will see"]);
  assert.equal(charge.lines[1].value.replace(/\s/g, ""), "$400.00");
  assert.equal(charge.action, "Add charge");
  assert.match(charge.effect, /not marked paid/);
  const refund = describeCateringAdjustmentConfirmation(form("refund", { reference: "BANK-1" }), "USD", 5_000);
  assert.equal(refund.action, "Record external refund");
  assert.match(refund.effect, /outside ChefSire/);
  assert.match(refund.effect, /does not send money/);
  assert.equal(refund.lines.some((line) => /only you can see/.test(line.label) && line.value === "BANK-1"), true);
  assert.equal(/refund (was )?successful|refunded to/i.test(JSON.stringify(refund)), false);
  const credit = describeCateringAdjustmentConfirmation(form("credit"), "USD", 100);
  assert.match(credit.effect, /does not mean any money was returned/);
});

test("a reversal confirmation says the entry stays in the history and what it changes", () => {
  for (const kind of ["charge", "credit", "refund"] as const) {
    const confirmation = describeCateringReversalConfirmation(view({ kind }));
    assert.equal(confirmation.action, "Reverse entry");
    assert.match(confirmation.effect, /stays in the history/);
  }
  assert.match(describeCateringReversalConfirmation(view({ kind: "credit" })).effect, /owe this amount again/);
});

test("history is oldest first with a stable tiebreak, and a reversed entry keeps its place", () => {
  const sorted = chronologicalCateringAdjustments([view({ id: "c", createdAt: "2026-03-03T00:00:00.000Z" }), view({ id: "b", createdAt: "2026-03-01T00:00:00.000Z", status: "reversed" }), view({ id: "a", createdAt: "2026-03-01T00:00:00.000Z" })]);
  assert.deepEqual(sorted.map((entry) => entry.id), ["a", "b", "c"]);
});

test("every entry is conveyed in words and a sign, never by colour alone", () => {
  const text = (kind: "charge" | "credit" | "refund") => cateringAdjustmentAmountText(view({ kind, amountCents: 12_345 })).replace(/\s/g, "");
  assert.equal(text("charge"), "+$123.45");
  assert.equal(text("credit"), "-$123.45");
  assert.equal(text("refund"), "$123.45");
  const customer = (kind: "charge" | "credit" | "refund") => cateringAdjustmentEffectSentence(view({ kind }), "customer");
  assert.match(customer("charge"), /^You owe .* more\.$/);
  assert.match(customer("credit"), /reduced by .*does not mean money was returned/);
  assert.match(customer("refund"), /Your caterer recorded .* as returned outside ChefSire\. ChefSire did not send it\./);
  assert.match(cateringAdjustmentEffectSentence(view({ kind: "refund" }), "provider"), /^You recorded .* as returned outside ChefSire/);
  assert.equal(cateringAdjustmentSourceText(view()), null);
  assert.equal(cateringAdjustmentSourceText(view({ source: "amendment", amendmentNumber: 2 })), "From accepted amendment 2");
});

test("a financial write invalidates only this actor's billing, workspace and amendment views, and never the whole cache", () => {
  const keys = cateringAdjustmentInvalidationKeys({ surfaceUserId: "user-a", bookingId: "booking-1" });
  assert.deepEqual(keys, [
    ["catering", "booking-billing", "user-a", "booking-1"],
    ["catering", "booking-workspace", "user-a", "booking-1"],
    ["catering", "amendments", "user-a", "booking-1"],
  ]);
  for (const key of keys) assert.equal(key.includes("user-a") && key.includes("booking-1"), true, "actor- and resource-scoped");
  assert.equal(keys.some((key) => key.length < 4), false, "no broad prefix that would clear another booking or account");
  const other = cateringAdjustmentInvalidationKeys({ surfaceUserId: "user-b", bookingId: "booking-1" });
  assert.equal(other.every((key) => key.includes("user-b") && !key.includes("user-a")), true, "another user's cache is never named");
});

test("a response for a previous booking or account never lands on the one now shown", () => {
  assert.equal(isCurrentCateringAdjustmentTarget(A, A), true);
  assert.equal(isCurrentCateringAdjustmentTarget(B, A), false);
  assert.equal(isCurrentCateringAdjustmentTarget(cateringAdjustmentIdentity("user-b", "booking-1"), A), false);
});

test("a REVERSED entry gets its own wording and never the active effect as well", () => {
  const reversed = (kind: "charge" | "credit" | "refund", role: "provider" | "customer") => cateringAdjustmentEffectSentence(view({ kind, status: "reversed", amountCents: 10_000 }), role).replace(/\s/g, " ");
  for (const role of ["provider", "customer"] as const) {
    assert.match(reversed("charge", role), /^This \$100\.00 charge was reversed and no longer increases the amount owed\.$/);
    assert.match(reversed("credit", role), /^This \$100\.00 credit was reversed and no longer reduces the amount owed\.$/);
    const refund = reversed("refund", role);
    assert.match(refund, /^This \$100\.00 external refund record was reversed and no longer counts toward recorded refunds\./);
    assert.match(refund, /ChefSire reversed its record only; it did not move any money\./);
    for (const kind of ["charge", "credit", "refund"] as const) {
      const text = reversed(kind, role);
      for (const contradiction of [/You owe/, /Your customer owes/, /is reduced by/, /recorded .* as returned/, /It no longer counts\. /]) assert.equal(contradiction.test(text), false, `${kind}/${role}: ${text}`);
    }
  }
  assert.equal(/clawed|returned to you|refunded/i.test(reversed("refund", "customer")), false, "no claim that external money was taken back");
});

test("an ACTIVE entry keeps its present-tense meaning", () => {
  const active = (kind: "charge" | "credit" | "refund", role: "provider" | "customer") => cateringAdjustmentEffectSentence(view({ kind, amountCents: 10_000 }), role).replace(/\s/g, " ");
  assert.match(active("charge", "customer"), /^You owe \$100\.00 more\.$/);
  assert.match(active("charge", "provider"), /^Your customer owes \$100\.00 more\.$/);
  assert.match(active("credit", "customer"), /^What you owe is reduced by \$100\.00\. This does not mean money was returned\.$/);
  assert.match(active("credit", "provider"), /^What your customer owes is reduced by \$100\.00\./);
  assert.match(active("refund", "customer"), /^Your caterer recorded \$100\.00 as returned outside ChefSire\. ChefSire did not send it\.$/);
  assert.match(active("refund", "provider"), /^You recorded \$100\.00 as returned outside ChefSire\. ChefSire did not send it\.$/);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * A selected payment's own refundable remainder
 * ------------------------------------------------------------------------------------------------------------- */

// Payments A and B are $100 each; $80 already recorded against A. Booking-wide $120, A $20, B $100 -- all server figures.
const wide = { maxCreditCents: 250_000, maxRefundCents: 12_000, maxChargeCents: 400_000 };
const refundForm = (amount: string, paymentId = "") => ({ ...form("refund", { amount }), paymentId });

test("with a payment selected the limit is the smaller of the booking-wide remainder and that payment's remainder", () => {
  const onA = { ...wide, selectedPaymentRefundableCents: 2_000 };
  const onB = { ...wide, selectedPaymentRefundableCents: 10_000 };
  assert.equal(cateringRefundLimitForForm(refundForm("50", "pa"), onA), 2_000);
  assert.equal(cateringRefundLimitForForm(refundForm("50", "pb"), onB), 10_000);
  assert.equal(cateringRefundLimitForForm(refundForm("50"), { ...wide, selectedPaymentRefundableCents: null }), 12_000, "no payment selected: booking-wide");
  assert.equal(cateringRefundLimitForForm(refundForm("50", "pa"), { ...wide, maxRefundCents: 1_500, selectedPaymentRefundableCents: 10_000 }), 1_500, "the booking-wide remainder can be the smaller one");
});

test("$50 against a payment with $20 left is refused client-side even though $120 remains booking-wide; $20 is accepted, $21 is not", () => {
  const onA = { ...wide, selectedPaymentRefundableCents: 2_000 };
  const refused = checkCateringAdjustmentForm(refundForm("50", "pa"), onA);
  assert.equal(refused.ok, false);
  assert.match(refused.ok === false ? refused.message : "", /cannot be more than what is left of that payment/);
  assert.deepEqual(checkCateringAdjustmentForm(refundForm("20", "pa"), onA), { ok: true, amountCents: 2_000 });
  assert.equal(checkCateringAdjustmentForm(refundForm("20.01", "pa"), onA).ok, false);
  assert.equal(checkCateringAdjustmentForm(refundForm("21", "pa"), onA).ok, false);
  assert.equal(checkCateringAdjustmentForm(refundForm("50", "pb"), { ...wide, selectedPaymentRefundableCents: 10_000 }).ok, true, "the same $50 against B is fine");
  assert.equal(maySubmitCateringAdjustment(refundForm("50", "pa"), onA, false), false, "submit is disabled above the payment's limit");
});

test("switching the selected payment immediately changes what the form accepts", () => {
  const amount = "50";
  const against = (paymentId: string, remaining: number | null) => checkCateringAdjustmentForm(refundForm(amount, paymentId), { ...wide, selectedPaymentRefundableCents: remaining }).ok;
  assert.deepEqual([against("pa", 2_000), against("pb", 10_000), against("", null)], [false, true, true]);
});

test("a payment with nothing left allows no positive refund, with a truthful message; a payment the payload does not vouch for allows nothing", () => {
  const spent = checkCateringAdjustmentForm(refundForm("0.01", "pa"), { ...wide, selectedPaymentRefundableCents: 0 });
  assert.equal(spent.ok, false);
  assert.match(spent.ok === false ? spent.message : "", /Nothing is left to record as returned against that payment/);
  assert.equal(checkCateringAdjustmentForm(refundForm("1", "pa"), { ...wide, selectedPaymentRefundableCents: undefined }).ok, false);
  assert.equal(maySubmitCateringAdjustment(refundForm("1", "pa"), { ...wide, selectedPaymentRefundableCents: 0 }, false), false);
});

test("the booking-wide message is used when no payment is the binding limit", () => {
  const wideOnly = checkCateringAdjustmentForm(refundForm("121"), { ...wide, selectedPaymentRefundableCents: null });
  assert.match(wideOnly.ok === false ? wideOnly.message : "", /money already recorded as received and not yet recorded as returned/);
  assert.equal(checkCateringAdjustmentForm(refundForm("120"), { ...wide, selectedPaymentRefundableCents: null }).ok, true);
});

test("a charge is checked against the server's stated headroom when it states one, and the server decides when it does not", () => {
  assert.equal(checkCateringAdjustmentForm(form("charge", { amount: "4000" }), wide).ok, true);
  const over = checkCateringAdjustmentForm(form("charge", { amount: "4000.01" }), wide);
  assert.equal(over.ok, false);
  assert.match(over.ok === false ? over.message : "", /largest amount ChefSire can request/);
  assert.equal(checkCateringAdjustmentForm(form("charge", { amount: "999999" }), { maxCreditCents: 1, maxRefundCents: 1 }).ok, true, "an older payload without a headroom: the server judges");
});
