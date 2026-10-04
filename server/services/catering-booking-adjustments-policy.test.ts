import assert from "node:assert/strict";
import test from "node:test";
import { billingForbidsAmendment, changesBillingSensitiveFields } from "./catering-booking-amendments";

test("once billing exists a currency change is always forbidden, whatever else it carries", () => {
  assert.equal(billingForbidsAmendment(["currency"], { priceCents: 100 }, undefined), true);
  assert.equal(billingForbidsAmendment(["price_cents", "currency"], { priceCents: 100 }, 200), true);
});

test("a price change between two stated amounts is NOT forbidden: it is reconciled into the ledger on acceptance", () => {
  assert.equal(billingForbidsAmendment(["price_cents"], { priceCents: 250_000 }, 290_000), false);
  assert.equal(billingForbidsAmendment(["price_cents"], { priceCents: 250_000 }, 0), false);
  assert.equal(billingForbidsAmendment(["price_cents", "guest_count"], { priceCents: 250_000 }, 230_000), false);
});

test("clearing the price, or setting one where there was none, has no stated difference to record, so it stays forbidden", () => {
  assert.equal(billingForbidsAmendment(["price_cents"], { priceCents: 250_000 }, null), true);
  assert.equal(billingForbidsAmendment(["price_cents"], { priceCents: null }, 100), true);
  assert.equal(billingForbidsAmendment(["price_cents"], { priceCents: 250_000 }, undefined), true, "an absent proposed price is not a stated one");
});

test("terms that no invoice depends on are never forbidden by billing", () => {
  for (const field of ["event_date", "guest_count", "terms_note"]) {
    assert.equal(changesBillingSensitiveFields([field]), false, field);
    assert.equal(billingForbidsAmendment([field], { priceCents: 100 }, undefined), false, field);
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Which adjustment kinds are offered: lifecycle AND a positive current ceiling
 * ------------------------------------------------------------------------------------------------------------- */
import { adjustmentActionsFor } from "./catering-booking-adjustments";
import { CATERING_INVOICE_MAXIMUM_CENTS, type CateringAdjustmentFact, type CateringAdjustmentFacts } from "@shared/catering-billing-adjustments";

let seq = 0;
const fact = (over: Partial<CateringAdjustmentFact> = {}): CateringAdjustmentFact => ({ id: `e${++seq}`, kind: "charge", amountCents: 100, currency: "USD", status: "posted", source: "provider_recorded", paymentId: null, ...over });
const actionFacts = (over: Partial<CateringAdjustmentFacts> = {}): CateringAdjustmentFacts => ({ bookingStatus: "confirmed", currency: "USD", agreedTotalCents: 250_000, liveInvoicedCents: 0, paidTotalCents: 0, payments: [], adjustments: [], ...over });

test("a legacy confirmed booking with ordinary positive ceilings keeps charge, credit and refund available as before", () => {
  const actions = adjustmentActionsFor(actionFacts({ paidTotalCents: 10_000 }));
  assert.deepEqual(actions.kinds, ["charge", "credit", "refund"]);
  assert.deepEqual([actions.maxCreditCents, actions.maxRefundCents, actions.maxChargeCents], [250_000, 10_000, CATERING_INVOICE_MAXIMUM_CENTS - 250_000]);
});

test("a cancelled booking with nothing received offers no refund (its ceiling is zero), and one with refundable money does", () => {
  const none = adjustmentActionsFor(actionFacts({ bookingStatus: "cancelled" }));
  assert.deepEqual([none.kinds, none.maxRefundCents], [[], 0], "lifecycle permits a refund but every positive amount would be refused");
  const some = adjustmentActionsFor(actionFacts({ bookingStatus: "cancelled", paidTotalCents: 5_000 }));
  assert.deepEqual([some.kinds, some.maxRefundCents], [["refund"], 5_000]);
});

test("a refund appears when a payment creates refundable capacity and disappears when refunds consume it, and returns when one is reversed", () => {
  assert.equal(adjustmentActionsFor(actionFacts()).kinds.includes("refund"), false, "nothing received yet");
  assert.equal(adjustmentActionsFor(actionFacts({ paidTotalCents: 5_000 })).kinds.includes("refund"), true);
  const spent = actionFacts({ paidTotalCents: 5_000, adjustments: [fact({ kind: "refund", amountCents: 5_000 })] });
  assert.equal(adjustmentActionsFor(spent).kinds.includes("refund"), false, "all of it already recorded as returned");
  const reversed = actionFacts({ paidTotalCents: 5_000, adjustments: [fact({ kind: "refund", amountCents: 5_000, status: "reversed" })] });
  assert.equal(adjustmentActionsFor(reversed).kinds.includes("refund"), true, "a reversal removes the consumption");
});

test("a credit is not offered when the obligation is zero, and a charge is not offered at the ceiling; a credit makes room for a charge again", () => {
  const owesNothing = adjustmentActionsFor(actionFacts({ agreedTotalCents: 0 }));
  assert.deepEqual([owesNothing.kinds.includes("credit"), owesNothing.maxCreditCents, owesNothing.kinds.includes("charge")], [false, 0, true]);
  const fullyCredited = adjustmentActionsFor(actionFacts({ adjustments: [fact({ kind: "credit", amountCents: 250_000 })] }));
  assert.equal(fullyCredited.kinds.includes("credit"), false);
  const atCeiling = actionFacts({ agreedTotalCents: CATERING_INVOICE_MAXIMUM_CENTS });
  const full = adjustmentActionsFor(atCeiling);
  assert.deepEqual([full.kinds.includes("charge"), full.maxChargeCents, full.kinds.includes("credit")], [false, 0, true]);
  const room = adjustmentActionsFor({ ...atCeiling, adjustments: [fact({ kind: "credit", amountCents: 1_000 })] });
  assert.deepEqual([room.kinds.includes("charge"), room.maxChargeCents], [true, 1_000], "a credit restores charge headroom");
});

test("lifecycle AND ceiling are both required: a completed booking never offers a charge, whatever the headroom", () => {
  const completed = adjustmentActionsFor(actionFacts({ bookingStatus: "completed", paidTotalCents: 1_000 }));
  assert.deepEqual(completed.kinds, ["credit", "refund"]);
  assert.ok(completed.maxChargeCents > 0, "the ceiling alone is not enough");
  assert.deepEqual(adjustmentActionsFor(actionFacts({ bookingStatus: "pending_confirmation", paidTotalCents: 1_000 })).kinds, ["refund"]);
  assert.deepEqual(adjustmentActionsFor(actionFacts({ agreedTotalCents: null, paidTotalCents: 1_000 })).kinds, ["refund"], "no price: no charge or credit");
});
