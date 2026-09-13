import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cateringBillingIdentity,
  cateringPaymentFormMatches,
  cateringPaymentSnapshot,
  editCateringPaymentForm,
  editCateringTermsForm,
  emptyCateringTermsForm,
  hydrateCateringTermsForm,
  openCateringPaymentForm,
  settleCateringPaymentForm,
  settleCateringTermsForm,
  type CateringPaymentForm,
} from "./catering-booking-billing-state";
import type { CateringInvoiceView } from "@shared/catering-booking-billing";

/**
 * AN ASYNC COMPLETION MAY ONLY SETTLE THE EXACT LOCAL STATE IT SUBMITTED.
 *
 * The payment form stays editable while a save is in flight, deliberately: a provider standing in a venue should
 * not be frozen out of correcting a figure, and a lost response must not throw away what they typed. But success
 * closed the form unconditionally, which produced this:
 *
 *   1. the provider enters payment A and presses Record payment
 *   2. the request sends A
 *   3. while it is in flight they correct the visible form to B
 *   4. the server records A and answers
 *   5. the form closes and the history refreshes
 *
 * B is gone, and everything on screen says the entry was accepted. The provider has every reason to believe their
 * correction is what was recorded. It was not, and nothing told them.
 *
 * The rule is stated as a pure function so it is pinned independently of how React happens to call it.
 */

const A = cateringBillingIdentity("user-1", "booking-a");
const B = cateringBillingIdentity("user-1", "booking-b");
const TODAY = "2026-09-13";
const OLD_KEY = "key-original-1";
const FRESH_KEY = "key-rotated-2";

const invoice = (patch: Partial<CateringInvoiceView> = {}): CateringInvoiceView => ({
  id: "inv-1", number: 1, kind: "deposit", reference: "BOOKINGA-001", amountCents: 50_000, currency: "USD",
  status: "issued", state: "issued", overdue: false, dueOn: null, issuedAt: null, voidedAt: null,
  paidCents: 0, remainingCents: 50_000, ...patch,
});
const opened = (identity = A, key = OLD_KEY) => openCateringPaymentForm(identity, invoice(), TODAY, key);

/* ------------------------------------------------------------------------------------------------------------- *
 * The ordinary case
 * ------------------------------------------------------------------------------------------------------------- */

test("no edits while pending: the success closes the form", () => {
  const form = opened();
  const submitted = cateringPaymentSnapshot(form);
  assert.equal(settleCateringPaymentForm(form, A, submitted, FRESH_KEY), null);
});

test("an edit made and then undone still counts as unchanged, because it is compared by value", () => {
  const form = opened();
  const submitted = cateringPaymentSnapshot(form);
  const wobbled = editCateringPaymentForm(editCateringPaymentForm(form, A, { amount: "1.00" }), A, { amount: form.amount });
  assert.equal(settleCateringPaymentForm(wobbled, A, submitted, FRESH_KEY), null);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Every semantic field, edited while the request is in flight
 * ------------------------------------------------------------------------------------------------------------- */

for (const [field, patch] of [
  ["amount", { amount: "123.45" }],
  ["method", { method: "cash" as const }],
  ["received date", { receivedOn: "2026-09-11" }],
  ["reference", { reference: "CORRECTED-REF" }],
] as const) {
  test(`editing the ${field} while pending keeps the form open, with the edit intact`, () => {
    const form = opened();
    const submitted = cateringPaymentSnapshot(form);
    const edited = editCateringPaymentForm(form, A, patch)!;
    const settled = settleCateringPaymentForm(edited, A, submitted, FRESH_KEY);

    assert.notEqual(settled, null, "the response settled the OLD entry, not this one");
    // Byte for byte, every value the provider can see is exactly what they left there.
    assert.equal(settled!.amount, edited.amount);
    assert.equal(settled!.method, edited.method);
    assert.equal(settled!.receivedOn, edited.receivedOn);
    assert.equal(settled!.reference, edited.reference);
    assert.equal(settled!.invoiceId, edited.invoiceId);
    assert.equal(settled!.identity, A);
    // And it is a NEW logical entry, so it no longer carries the key of the payment that was just recorded.
    assert.equal(settled!.idempotencyKey, FRESH_KEY);
    assert.notEqual(settled!.idempotencyKey, OLD_KEY);
  });
}

test("changing the invoice while pending keeps the form open too", () => {
  // The one field the edit helper refuses to patch, so the form is reopened on another invoice by hand -- which
  // also gives it its own key, and is covered by the different-attempt rule below.
  const form = opened();
  const submitted = cateringPaymentSnapshot(form);
  const elsewhere: NonNullable<CateringPaymentForm> = { ...form, invoiceId: "inv-2" };
  assert.equal(cateringPaymentFormMatches(elsewhere, submitted), false);
  const settled = settleCateringPaymentForm(elsewhere, A, submitted, FRESH_KEY);
  assert.equal(settled!.invoiceId, "inv-2");
  assert.equal(settled!.idempotencyKey, FRESH_KEY);
});

test("the key rotates exactly once, and nothing is resubmitted on the provider's behalf", () => {
  const form = opened();
  const submitted = cateringPaymentSnapshot(form);
  const edited = editCateringPaymentForm(form, A, { amount: "123.45" })!;
  const settled = settleCateringPaymentForm(edited, A, submitted, FRESH_KEY)!;
  // Settling the same response again is inert: the form no longer carries the submitted key.
  assert.equal(settleCateringPaymentForm(settled, A, submitted, "key-third-3"), settled, "untouched, by reference");
  assert.equal(settled.idempotencyKey, FRESH_KEY);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * A different attempt entirely
 * ------------------------------------------------------------------------------------------------------------- */

test("a form the provider closed and reopened is left alone: it was never submitted", () => {
  const submitted = cateringPaymentSnapshot(opened());
  const reopened = opened(A, "key-a-different-attempt");
  assert.equal(settleCateringPaymentForm(reopened, A, submitted, FRESH_KEY), reopened, "untouched, by reference");
  assert.equal(reopened.idempotencyKey, "key-a-different-attempt", "and keeps its own key");
});

test("a closed form stays closed", () => {
  assert.equal(settleCateringPaymentForm(null, A, cateringPaymentSnapshot(opened()), FRESH_KEY), null);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Cross-booking isolation
 * ------------------------------------------------------------------------------------------------------------- */

test("booking A's response can neither close nor rotate booking B's form", () => {
  const onB = opened(B, OLD_KEY);
  const submittedOnA = cateringPaymentSnapshot(opened(A, OLD_KEY));
  // Same key, same values -- and still untouched, because the identity does not match.
  assert.equal(settleCateringPaymentForm(onB, A, submittedOnA, FRESH_KEY), onB, "untouched, by reference");
  assert.equal(onB.idempotencyKey, OLD_KEY);
});

test("A's response cannot overwrite B's edits either", () => {
  const editedOnB = editCateringPaymentForm(opened(B, OLD_KEY), B, { amount: "999.00" })!;
  const submittedOnA = cateringPaymentSnapshot(opened(A, OLD_KEY));
  assert.equal(settleCateringPaymentForm(editedOnB, A, submittedOnA, FRESH_KEY), editedOnB);
  assert.equal(editedOnB.amount, "999.00");
});

test("a stale completion for a booking the participant has left is inert", () => {
  // The component's own `settlesHere` guard returns before any of this, and the identity check here is the second
  // line: even called, a response for A cannot reach the form belonging to B.
  const onB = opened(B);
  assert.equal(settleCateringPaymentForm(onB, A, cateringPaymentSnapshot(opened(A)), FRESH_KEY), onB);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The comparison itself
 * ------------------------------------------------------------------------------------------------------------- */

test("the comparison covers every semantic field and nothing else", () => {
  const form = opened();
  const submitted = cateringPaymentSnapshot(form);
  assert.equal(cateringPaymentFormMatches(form, submitted), true);
  for (const patch of [{ amount: "1.00" }, { method: "cheque" as const }, { receivedOn: "2020-01-01" }, { reference: "x" }]) {
    assert.equal(cateringPaymentFormMatches(editCateringPaymentForm(form, A, patch)!, submitted), false, JSON.stringify(patch));
  }
  // The key is not part of the field comparison -- it identifies the attempt, not what the payment is.
  assert.equal(cateringPaymentFormMatches({ ...form, idempotencyKey: "other" }, submitted), true);
});

test("amounts are compared AS TYPED, so a reformatted figure keeps the form open rather than closing it", () => {
  const form = opened();
  const submitted = cateringPaymentSnapshot(form);
  assert.equal(form.amount, "500.00");
  assert.equal(cateringPaymentFormMatches(editCateringPaymentForm(form, A, { amount: "500" })!, submitted), false,
    "the same money, a different entry -- and staying open is the safe direction");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Failure paths are unchanged
 * ------------------------------------------------------------------------------------------------------------- */

test("nothing here runs on a failure, so a transport error keeps the form AND its key for the retry", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const component = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingBilling.tsx"), "utf8");
  // The handler body only: the file continues into JSX where Cancel legitimately closes the form, and into the
  // key generator itself.
  const onError = component.slice(
    component.indexOf("onError: async (error: CateringBillingError, variables)"),
    component.indexOf("const pending = mutation.isPending;"),
  );
  assert.equal(onError.includes("setPaymentForm"), false, "the form is not touched on any failure");
  assert.equal(onError.includes("cateringIdempotencyKey"), false, "and the key is never rotated by an error");
  // The key rotation happens only on the success path, and only for a form that no longer matches what was sent.
  const onSuccess = component.slice(component.indexOf("onSuccess: async (value, variables)"), component.indexOf("onError: async"));
  assert.ok(onSuccess.includes("settleCateringPaymentForm(current, started.identity, variables.submittedPayment!, cateringIdempotencyKey())"));
  assert.equal(onSuccess.includes("setPaymentForm(null)"), false, "the unconditional close is gone from the success path");
  // The only two `setPaymentForm(null)` left in the file are the ones that should be there: the booking-identity
  // reset, and the provider pressing Cancel. Neither is an async completion deciding for them.
  const closes = [...component.matchAll(/setPaymentForm\(null\)/g)].length;
  assert.equal(closes, 2);
  assert.ok(component.includes("onClick={() => setPaymentForm(null)}>Cancel</Button>"));
  const reset = component.slice(component.indexOf("if (localIdentity === identity) return;"), component.indexOf("const localStateIsCurrent"));
  assert.ok(reset.includes("setPaymentForm(null);"));
});

test("the snapshot is captured at SUBMIT time, from the form being submitted", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const component = fs.readFileSync(path.join(here, "..", "..", "components", "catering", "BookingBilling.tsx"), "utf8");
  assert.ok(component.includes("submittedPayment: cateringPaymentSnapshot(open),"));
  // `open` is the guarded, identity-checked form -- the same object the request body is built from.
  const submit = component.slice(component.indexOf("const submitPayment ="), component.indexOf("const voidPayment ="));
  assert.ok(submit.includes("const open = activeCateringPaymentForm(paymentForm, identity, actionable);"));
  assert.ok(submit.includes("idempotencyKey: open.idempotencyKey"));
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The same principle, already held by the terms form
 * ------------------------------------------------------------------------------------------------------------- */

test("the deposit-terms form settles against what it submitted too, keeping newer entries", () => {
  const hydrated = hydrateCateringTermsForm(emptyCateringTermsForm(), A, { mode: "percentage", amount: "", percent: "25", dueOn: "" }, "2026-09-10T12:00:00.000Z");
  const submitted = { mode: "percentage" as const, amount: "", percent: "40", dueOn: "" };
  // Typed on after the save went out: kept, and the version still advances so the next save succeeds.
  const movedOn = settleCateringTermsForm(editCateringTermsForm(hydrated, { percent: "45" }), A, submitted, "2026-09-10T12:05:00.000Z");
  assert.equal(movedOn.percent, "45");
  assert.equal(movedOn.dirty, true);
  // Unchanged: settles clean.
  const unchanged = settleCateringTermsForm(editCateringTermsForm(hydrated, { percent: "40" }), A, submitted, "2026-09-10T12:05:00.000Z");
  assert.equal(unchanged.dirty, false);
  // And another booking's form is untouched by either.
  const onB = editCateringTermsForm(hydrateCateringTermsForm(emptyCateringTermsForm(), B, { mode: "none", amount: "", percent: "", dueOn: "" }, null), { percent: "7" });
  assert.equal(settleCateringTermsForm(onB, A, submitted, "2026-09-10T12:05:00.000Z"), onB);
});
