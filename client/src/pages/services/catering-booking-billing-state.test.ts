import assert from "node:assert/strict";
import test from "node:test";
import {
  activeCateringPaymentForm,
  cateringBillingCanStillChange,
  cateringBillingFailureNotice,
  cateringBillingIdentity,
  cateringMajorUnits,
  cateringPaymentProvenance,
  cateringTermsFormIsCurrent,
  editCateringPaymentForm,
  editCateringTermsForm,
  emptyCateringTermsForm,
  hydrateCateringTermsForm,
  isCateringBillingConflict,
  markCateringTermsConflict,
  mayReloadCateringTerms,
  maySubmitCateringPayment,
  maySubmitCateringTerms,
  openCateringPaymentForm,
  reloadCateringTermsForm,
  settleCateringTermsForm,
  shouldRefetchBillingAfterError,
  type CateringBillingError,
} from "./catering-booking-billing-state";
import {
  CATERING_BILLING_STATE_CODE,
  CATERING_BILLING_VERSION_CONFLICT_CODE,
  type CateringInvoiceView,
} from "@shared/catering-booking-billing";

/**
 * The client's billing state, with the Phase 2J and 2K lessons applied from the first line rather than retrofitted.
 *
 * Two properties matter most here. IDENTITY: the workspace stays mounted across `/bookings/A` -> `/bookings/B`, so
 * nothing may render or submit under a booking it does not belong to. TRUTH: no total is computed on this client,
 * and no failure is allowed to look like a success.
 */

const A = cateringBillingIdentity("user-1", "booking-a");
const B = cateringBillingIdentity("user-1", "booking-b");
const TODAY = "2026-09-13";
const V1 = "2026-09-10T12:00:00.000Z";
const V2 = "2026-09-10T12:05:00.000Z";

const invoice = (patch: Partial<CateringInvoiceView> = {}): CateringInvoiceView => ({
  id: "inv-1", number: 1, kind: "deposit", reference: "BOOKINGA-001", amountCents: 50_000, currency: "USD",
  status: "issued", state: "issued", overdue: false, dueOn: null, issuedAt: V1, voidedAt: null,
  paidCents: 0, remainingCents: 50_000, ...patch,
});
const hydrated = (values = { mode: "percentage" as const, amount: "", percent: "25", dueOn: "" }, version: string | null = V1) =>
  hydrateCateringTermsForm(emptyCateringTermsForm(), A, values, version);

/* ------------------------------------------------------------------------------------------------------------- *
 * The terms form
 * ------------------------------------------------------------------------------------------------------------- */

test("a clean form takes the authoritative values and version together", () => {
  const form = hydrated();
  assert.equal(form.identity, A);
  assert.equal(form.percent, "25");
  assert.equal(form.baseVersion, V1);
  assert.equal(form.dirty, false);
});

test("a DIRTY form keeps its entries AND its version, so it cannot claim to be based on a newer record", () => {
  const dirty = editCateringTermsForm(hydrated(), { percent: "40" });
  const polled = hydrateCateringTermsForm(dirty, A, { mode: "percentage", amount: "", percent: "10", dueOn: "" }, V2);
  assert.equal(polled.percent, "40", "the provider's entry survives the poll");
  assert.equal(polled.baseVersion, V1, "and so does the version it was written against");
});

test("a CONFLICTED form is untouched by a poll, and typing does not clear it", () => {
  const conflicted = markCateringTermsConflict(editCateringTermsForm(hydrated(), { percent: "40" }));
  const polled = hydrateCateringTermsForm(conflicted, A, { mode: "fixed", amount: "500", percent: "", dueOn: "" }, V2);
  assert.equal(polled, conflicted, "untouched, by reference");
  const typed = editCateringTermsForm(conflicted, { percent: "45" });
  assert.equal(typed.conflicted, true, "typing is not a resolution");
  assert.equal(typed.baseVersion, V1, "and the refused version does not move");
  assert.equal(maySubmitCateringTerms(typed, A, true, false), false, "so Save stays blocked");
  assert.equal(mayReloadCateringTerms(typed, A), true, "and the explicit reload stays offered");
});

test("the explicit reload is the only thing that clears a conflict, and it adopts values and version together", () => {
  const conflicted = markCateringTermsConflict(editCateringTermsForm(hydrated(), { percent: "40" }));
  const reloaded = reloadCateringTermsForm(A, { mode: "fixed", amount: "500.00", percent: "", dueOn: "2026-10-01" }, V2);
  assert.equal(reloaded.conflicted, false);
  assert.equal(reloaded.dirty, false);
  assert.equal(reloaded.mode, "fixed");
  assert.equal(reloaded.baseVersion, V2);
  assert.notEqual(reloaded, conflicted);
});

test("an accepted save settles against what was SUBMITTED, keeping anything typed while it was in flight", () => {
  const submitted = { mode: "percentage" as const, amount: "", percent: "40", dueOn: "" };
  const unchanged = settleCateringTermsForm(editCateringTermsForm(hydrated(), { percent: "40" }), A, submitted, V2);
  assert.equal(unchanged.dirty, false);
  assert.equal(unchanged.baseVersion, V2);

  // The provider kept typing: the newer entry is kept and the version still advances, so the next save succeeds.
  const movedOn = settleCateringTermsForm(editCateringTermsForm(hydrated(), { percent: "45" }), A, submitted, V2);
  assert.equal(movedOn.percent, "45");
  assert.equal(movedOn.dirty, true);
  assert.equal(movedOn.baseVersion, V2);
});

test("Save requires values the form can actually make sense of", () => {
  assert.equal(maySubmitCateringTerms(hydrated({ mode: "none", amount: "", percent: "", dueOn: "" }, V1), A, true, false), true);
  assert.equal(maySubmitCateringTerms(hydrated({ mode: "fixed", amount: "", percent: "", dueOn: "" }, V1), A, true, false), false);
  assert.equal(maySubmitCateringTerms(hydrated({ mode: "fixed", amount: "500.00", percent: "", dueOn: "" }, V1), A, true, false), true);
  assert.equal(maySubmitCateringTerms(hydrated({ mode: "percentage", amount: "", percent: "0", dueOn: "" }, V1), A, true, false), false);
  assert.equal(maySubmitCateringTerms(hydrated({ mode: "percentage", amount: "", percent: "101", dueOn: "" }, V1), A, true, false), false);
  // And a non-actionable booking or an in-flight request blocks it whatever the values are.
  assert.equal(maySubmitCateringTerms(hydrated(), A, false, false), false);
  assert.equal(maySubmitCateringTerms(hydrated(), A, true, true), false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Cross-booking identity
 * ------------------------------------------------------------------------------------------------------------- */

test("booking A's terms form is neither current nor submittable under booking B", () => {
  const form = hydrated();
  assert.equal(cateringTermsFormIsCurrent(form, B), false);
  assert.equal(maySubmitCateringTerms(form, B, true, false), false);
  assert.equal(mayReloadCateringTerms(markCateringTermsConflict(form), B), false);
});

test("navigating to another booking REPLACES the form wholesale rather than merging it", () => {
  const dirty = markCateringTermsConflict(editCateringTermsForm(hydrated(), { percent: "40" }));
  const onB = hydrateCateringTermsForm(dirty, B, { mode: "none", amount: "", percent: "", dueOn: "" }, null);
  assert.equal(onB.identity, B);
  assert.equal(onB.percent, "", "nothing about booking A's draft is relevant to booking B");
  assert.equal(onB.conflicted, false);
  assert.equal(onB.baseVersion, null);
});

test("booking A's payment form never renders under booking B, on the render path", () => {
  const form = openCateringPaymentForm(A, invoice(), TODAY, "key-abcdefgh");
  assert.equal(activeCateringPaymentForm(form, A, true), form);
  assert.equal(activeCateringPaymentForm(form, B, true), null, "not even for the one committed render before a reset");
  assert.equal(activeCateringPaymentForm(form, A, false), null, "and not on a booking that may not be billed");
});

test("editing a payment form addressed to another booking changes nothing", () => {
  const form = openCateringPaymentForm(A, invoice(), TODAY, "key-abcdefgh");
  assert.equal(editCateringPaymentForm(form, B, { amount: "1.00" }), form, "untouched, by reference");
  assert.equal(editCateringPaymentForm(form, A, { amount: "1.00" })?.amount, "1.00");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The payment form
 * ------------------------------------------------------------------------------------------------------------- */

test("it opens prefilled from the SERVER's remaining figure, and keeps one key for its life", () => {
  const form = openCateringPaymentForm(A, invoice({ remainingCents: 30_000 }), TODAY, "key-abcdefgh");
  assert.equal(form.amount, "300.00", "the server's own remainingCents, not a total computed here");
  assert.equal(form.idempotencyKey, "key-abcdefgh");
  assert.equal(form.receivedOn, TODAY);
  // Every edit keeps the key, so a double-click and a retry after a lost response are one attempt.
  const edited = editCateringPaymentForm(editCateringPaymentForm(form, A, { amount: "100" }), A, { method: "cash" });
  assert.equal(edited?.idempotencyKey, "key-abcdefgh");
});

test("it cannot be submitted for more than the invoice has left", () => {
  const open = openCateringPaymentForm(A, invoice({ remainingCents: 30_000 }), TODAY, "key-abcdefgh");
  const row = invoice({ remainingCents: 30_000 });
  assert.equal(maySubmitCateringPayment(open, row, false), true);
  assert.equal(maySubmitCateringPayment({ ...open, amount: "300.01" }, row, false), false);
  assert.equal(maySubmitCateringPayment({ ...open, amount: "0" }, row, false), false);
  assert.equal(maySubmitCateringPayment({ ...open, amount: "" }, row, false), false);
  assert.equal(maySubmitCateringPayment({ ...open, amount: "abc" }, row, false), false);
});

test("and not against a settled, draft, void or missing invoice, or while a request is in flight", () => {
  const open = openCateringPaymentForm(A, invoice(), TODAY, "key-abcdefgh");
  assert.equal(maySubmitCateringPayment(open, invoice({ state: "paid", remainingCents: 0 }), false), false);
  assert.equal(maySubmitCateringPayment(open, invoice({ state: "draft" }), false), false);
  assert.equal(maySubmitCateringPayment(open, invoice({ state: "void" }), false), false);
  assert.equal(maySubmitCateringPayment(open, undefined, false), false);
  assert.equal(maySubmitCateringPayment(open, invoice({ id: "inv-other" }), false), false, "an invoice it was not opened for");
  assert.equal(maySubmitCateringPayment(open, invoice(), true), false, "pending");
});

test("a part-paid invoice still accepts the rest", () => {
  const row = invoice({ state: "partially_paid", paidCents: 20_000, remainingCents: 30_000 });
  const open = openCateringPaymentForm(A, row, TODAY, "key-abcdefgh");
  assert.equal(open.amount, "300.00");
  assert.equal(maySubmitCateringPayment(open, row, false), true);
});

test("a malformed date blocks submission rather than being coerced", () => {
  const open = openCateringPaymentForm(A, invoice(), TODAY, "key-abcdefgh");
  assert.equal(maySubmitCateringPayment({ ...open, receivedOn: "13/09/2026" }, invoice(), false), false);
  assert.equal(maySubmitCateringPayment({ ...open, receivedOn: "" }, invoice(), false), false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Failures
 * ------------------------------------------------------------------------------------------------------------- */

test("only a genuine version conflict is a conflict", () => {
  assert.equal(isCateringBillingConflict({ message: "x", code: CATERING_BILLING_VERSION_CONFLICT_CODE }), true);
  assert.equal(isCateringBillingConflict({ message: "x", code: CATERING_BILLING_STATE_CODE }), false);
  assert.equal(isCateringBillingConflict({ message: "Failed to fetch", offline: true }), false);
  assert.equal(isCateringBillingConflict({ message: "Internal Server Error" }), false);
});

test("a transport failure keeps the entries and is retryable; a conflict is not", () => {
  const offline = cateringBillingFailureNotice({ message: "Failed to fetch", offline: true });
  assert.equal(offline.retryable, true);
  assert.match(offline.message, /still here/);
  const conflict = cateringBillingFailureNotice({ message: "x", code: CATERING_BILLING_VERSION_CONFLICT_CODE });
  assert.equal(conflict.retryable, false);
});

test("an unreadable success is reported as indeterminate and safe to retry, never as saved", () => {
  const unreadable: CateringBillingError = { message: "unreadable", offline: true, unreadable: true };
  const notice = cateringBillingFailureNotice(unreadable);
  assert.match(notice.message, /could not be read/);
  assert.match(notice.message, /Trying again is safe/);
  assert.equal(notice.retryable, true);
  assert.equal(isCateringBillingConflict(unreadable), false, "and it is never dressed up as a conflict");
  assert.equal(shouldRefetchBillingAfterError(unreadable), false, "no refetch at a connection that just failed");
});

test("a conflict and a state refusal refetch; a transport failure does not", () => {
  assert.equal(shouldRefetchBillingAfterError({ message: "x", code: CATERING_BILLING_VERSION_CONFLICT_CODE }), true);
  assert.equal(shouldRefetchBillingAfterError({ message: "x", code: CATERING_BILLING_STATE_CODE }), true);
  assert.equal(shouldRefetchBillingAfterError({ message: "x", offline: true }), false);
  assert.equal(shouldRefetchBillingAfterError(null), false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Wording and polling
 * ------------------------------------------------------------------------------------------------------------- */

test("a recorded payment is never described as paid through ChefSire", () => {
  assert.equal(cateringPaymentProvenance("provider_recorded", "customer"), "Recorded by your caterer");
  assert.equal(cateringPaymentProvenance("provider_recorded", "provider"), "Recorded by you");
  // Unreachable today -- nothing writes one -- and handled so the day it exists it reads truthfully.
  assert.equal(cateringPaymentProvenance("processor", "customer"), "Paid through ChefSire");
});

test("cents render as major units by integer arithmetic", () => {
  assert.equal(cateringMajorUnits(0), "0.00");
  assert.equal(cateringMajorUnits(5), "0.05");
  assert.equal(cateringMajorUnits(115), "1.15");
  assert.equal(cateringMajorUnits(125_000), "1250.00");
});

test("polling continues for every status except cancelled, so a customer learns of a request without reloading", () => {
  assert.equal(cateringBillingCanStillChange("pending_confirmation"), true);
  assert.equal(cateringBillingCanStillChange("confirmed"), true);
  assert.equal(cateringBillingCanStillChange("completed"), true);
  assert.equal(cateringBillingCanStillChange("cancelled"), false);
  assert.equal(cateringBillingCanStillChange(undefined), false, "and never before a payload has landed");
});
