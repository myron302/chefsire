import assert from "node:assert/strict";
import test from "node:test";
import {
  cateringBillingGuard,
  cateringBillingVersionMatches,
  cateringDepositTermsOf,
  resolveCateringDepositTerms,
  resolveCateringPayment,
} from "./catering-booking-billing-policy";
import { calendarDateInProviderTimezone } from "./catering-provider-calendar";
import { cateringMoneyToCents, cateringPaymentReplayMatches, type CateringBillingFacts, type CateringInvoiceFact, type CateringPaymentFact } from "@shared/catering-booking-billing";
import type { CateringBookingBillingRecord } from "@shared/schema";

/**
 * Who may act, what may be written, and what a precondition means.
 *
 * The recurring theme: nothing a client sends is taken as given. The role is derived from the persisted booking,
 * the amount is bounded against the ledger, the precondition is compared against the row the transaction holds,
 * and each of those fails CLOSED.
 */

const PROVIDER = "user-provider";
const CUSTOMER = "user-customer";
const STRANGER = "user-stranger";
const booking = (status = "confirmed") => ({ providerId: PROVIDER, customerId: CUSTOMER, status });

const invoice = (patch: Partial<CateringInvoiceFact> = {}): CateringInvoiceFact =>
  ({ id: "inv-1", number: 1, kind: "deposit", amountCents: 50_000, currency: "USD", status: "issued", dueOn: null, issuedAt: "2026-09-01T00:00:00.000Z", ...patch });
const payment = (patch: Partial<CateringPaymentFact> = {}): CateringPaymentFact =>
  ({ id: "pay-1", invoiceId: "inv-1", amountCents: 10_000, currency: "USD", method: "cash", source: "provider_recorded", status: "recorded", receivedOn: "2026-09-02", ...patch });
const facts = (patch: Partial<CateringBillingFacts> = {}): CateringBillingFacts => ({
  bookingStatus: "confirmed", agreedTotalCents: 200_000, currency: "USD",
  terms: { mode: "none", amountCents: null, percentBasisPoints: null, dueOn: null },
  invoices: [], payments: [], asOfDate: "2026-09-13", ...patch,
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Authorization
 * ------------------------------------------------------------------------------------------------------------- */

test("only the persisted provider may change billing", () => {
  assert.equal(cateringBillingGuard(booking(), PROVIDER), "ok");
  assert.equal(cateringBillingGuard(booking(), CUSTOMER), "forbidden");
  assert.equal(cateringBillingGuard(booking(), STRANGER), "forbidden");
});

test("a customer can never declare their own money received, on any booking status", () => {
  for (const status of ["pending_confirmation", "confirmed", "completed", "cancelled"]) {
    assert.equal(cateringBillingGuard(booking(status), CUSTOMER), "forbidden", status);
  }
});

test("the role comes from the persisted booking, so a swapped body changes nothing", () => {
  // The same actor against a booking whose participants are the other way round: the answer follows the ROW.
  assert.equal(cateringBillingGuard({ providerId: CUSTOMER, customerId: PROVIDER, status: "confirmed" }, PROVIDER), "forbidden");
  assert.equal(cateringBillingGuard({ providerId: CUSTOMER, customerId: PROVIDER, status: "confirmed" }, CUSTOMER), "ok");
});

test("a cancelled booking refuses every write, and the wrong-actor answer takes precedence over it", () => {
  assert.equal(cateringBillingGuard(booking("cancelled"), PROVIDER), "not_available");
  // Forbidden is answered first, so a stranger cannot learn a booking's status from which refusal they get.
  assert.equal(cateringBillingGuard(booking("cancelled"), STRANGER), "forbidden");
});

test("billing stays open through completion, because balances are settled after service", () => {
  assert.equal(cateringBillingGuard(booking("pending_confirmation"), PROVIDER), "ok");
  assert.equal(cateringBillingGuard(booking("completed"), PROVIDER), "ok");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Preconditions
 * ------------------------------------------------------------------------------------------------------------- */

test("a version precondition fails closed in both directions", () => {
  const at = new Date("2026-09-10T12:00:00.000Z");
  assert.equal(cateringBillingVersionMatches("2026-09-10T12:00:00.000Z", at), true);
  assert.equal(cateringBillingVersionMatches("2026-09-10T12:00:01.000Z", at), false, "a different instant");
  // A row exists and the request states nothing: refused. "I did not know this was here" is not a licence to
  // overwrite what somebody else wrote.
  assert.equal(cateringBillingVersionMatches(undefined, at), false);
  // No row exists and the request states a version: refused too.
  assert.equal(cateringBillingVersionMatches("2026-09-10T12:00:00.000Z", null), false);
  // Only the genuinely first write to a booking with no terms row may omit it.
  assert.equal(cateringBillingVersionMatches(undefined, null), true);
});

test("versions compare as instants, so an equivalent spelling still matches", () => {
  const at = new Date("2026-09-10T12:00:00.000Z");
  assert.equal(cateringBillingVersionMatches("2026-09-10T12:00:00Z", at), true);
  assert.equal(cateringBillingVersionMatches("not-a-date", at), false, "and an unparseable one never does");
});

test("the billing day is the PROVIDER's calendar day, not the host's or UTC's", () => {
  // 03:30 UTC on the 14th is still the evening of the 13th in New York and Los Angeles, and already the afternoon
  // of the 14th in Tokyo. One instant, three business days -- which is the whole point.
  const instant = new Date("2026-09-14T03:30:00.000Z");
  assert.equal(calendarDateInProviderTimezone(instant, "UTC"), "2026-09-14");
  assert.equal(calendarDateInProviderTimezone(instant, "America/New_York"), "2026-09-13");
  assert.equal(calendarDateInProviderTimezone(instant, "America/Los_Angeles"), "2026-09-13");
  assert.equal(calendarDateInProviderTimezone(instant, "Asia/Tokyo"), "2026-09-14");
  assert.equal(calendarDateInProviderTimezone(instant, "Europe/London"), "2026-09-14");
});

test("a provider east of UTC can already be on the next day", () => {
  const instant = new Date("2026-09-13T22:00:00.000Z");
  assert.equal(calendarDateInProviderTimezone(instant, "UTC"), "2026-09-13");
  assert.equal(calendarDateInProviderTimezone(instant, "Asia/Tokyo"), "2026-09-14", "07:00 on the 14th in Tokyo");
  assert.equal(calendarDateInProviderTimezone(instant, "America/Los_Angeles"), "2026-09-13", "15:00 on the 13th");
});

test("the fallback is the one Catering already uses: no timezone means UTC", () => {
  const instant = new Date("2026-09-14T03:30:00.000Z");
  for (const missing of [null, undefined, ""]) {
    assert.equal(calendarDateInProviderTimezone(instant, missing as never), "2026-09-14", JSON.stringify(missing));
  }
  // A persisted identifier `Intl` cannot parse falls back to the same value rather than throwing out of a
  // formatter -- the column is free text, and a provider must not be locked out of their own billing by it.
  assert.equal(calendarDateInProviderTimezone(instant, "Not/AZone"), "2026-09-14");
  assert.doesNotThrow(() => calendarDateInProviderTimezone(instant, "🙂"));
});

test("every billing day is a plain calendar date, whatever the zone", () => {
  for (const timezone of ["UTC", "America/New_York", "Asia/Tokyo", "Australia/Eucla", "Pacific/Kiritimati"]) {
    assert.match(calendarDateInProviderTimezone(new Date(), timezone), /^\d{4}-\d{2}-\d{2}$/, timezone);
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Deposit terms
 * ------------------------------------------------------------------------------------------------------------- */

test("a fixed deposit may not exceed the agreed price", () => {
  const refused = resolveCateringDepositTerms({ mode: "fixed", amountCents: 300_000, percentBasisPoints: null, dueOn: null, agreedTotalCents: 200_000 });
  assert.equal(refused.ok, false);
  assert.match((refused as { message: string }).message, /cannot be more than the agreed price/);
  const allowed = resolveCateringDepositTerms({ mode: "fixed", amountCents: 200_000, percentBasisPoints: null, dueOn: null, agreedTotalCents: 200_000 });
  assert.equal(allowed.ok, true, "exactly the agreed price is allowed");
});

test("a deposit of nothing is refused, because 'no deposit' is its own explicit answer", () => {
  const refused = resolveCateringDepositTerms({ mode: "fixed", amountCents: 0, percentBasisPoints: null, dueOn: null, agreedTotalCents: 200_000 });
  assert.equal(refused.ok, false);
});

test("a mode without its figure is refused rather than defaulted", () => {
  assert.equal(resolveCateringDepositTerms({ mode: "fixed", amountCents: null, percentBasisPoints: null, dueOn: null, agreedTotalCents: 200_000 }).ok, false);
  assert.equal(resolveCateringDepositTerms({ mode: "percentage", amountCents: null, percentBasisPoints: null, dueOn: null, agreedTotalCents: 200_000 }).ok, false);
});

test("the two figures can never both be persisted: the unused one is written as null", () => {
  const fixed = resolveCateringDepositTerms({ mode: "fixed", amountCents: 50_000, percentBasisPoints: 2_500, dueOn: null, agreedTotalCents: 200_000 });
  assert.deepEqual(fixed, { ok: true, mode: "fixed", amountCents: 50_000, percentBasisPoints: null, dueOn: null });
  const percentage = resolveCateringDepositTerms({ mode: "percentage", amountCents: 50_000, percentBasisPoints: 2_500, dueOn: null, agreedTotalCents: 200_000 });
  assert.deepEqual(percentage, { ok: true, mode: "percentage", amountCents: null, percentBasisPoints: 2_500, dueOn: null });
  const none = resolveCateringDepositTerms({ mode: "none", amountCents: 50_000, percentBasisPoints: 2_500, dueOn: "2026-10-01", agreedTotalCents: 200_000 });
  assert.deepEqual(none, { ok: true, mode: "none", amountCents: null, percentBasisPoints: null, dueOn: "2026-10-01" });
});

test("a fixed deposit is allowed on a booking with no agreed price, since there is no ceiling to breach", () => {
  assert.equal(resolveCateringDepositTerms({ mode: "fixed", amountCents: 50_000, percentBasisPoints: null, dueOn: null, agreedTotalCents: null }).ok, true);
});

test("terms read back from an absent row are the explicit 'no deposit' answer", () => {
  assert.deepEqual(cateringDepositTermsOf(undefined), { mode: "none", amountCents: null, percentBasisPoints: null, dueOn: null });
  const row = { depositMode: "percentage", depositAmountCents: null, depositPercentBp: 2_500, depositDueOn: "2026-10-01" } as unknown as CateringBookingBillingRecord;
  assert.deepEqual(cateringDepositTermsOf(row), { mode: "percentage", amountCents: null, percentBasisPoints: 2_500, dueOn: "2026-10-01" });
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Recording a payment
 * ------------------------------------------------------------------------------------------------------------- */

const record = (amount: string, patch: Partial<Parameters<typeof resolveCateringPayment>[0]> = {}) => resolveCateringPayment({
  amountCents: cateringMoneyToCents(amount),
  currency: "USD",
  invoice: invoice(),
  facts: facts({ invoices: [invoice()] }),
  receivedOn: "2026-09-12",
  ...patch,
});

test("a payment up to what the invoice has left is accepted", () => {
  assert.deepEqual(record("500.00"), { ok: true, amountCents: 50_000 });
  assert.deepEqual(record("100.00"), { ok: true, amountCents: 10_000 }, "part payments are supported");
});

test("OVERPAYMENT is refused rather than absorbed", () => {
  const refused = record("500.01");
  assert.equal(refused.ok, false);
  assert.match((refused as { message: string }).message, /more than this request still has outstanding/);
});

test("what is left is recomputed from the ledger, not taken from the request", () => {
  const partly = facts({ invoices: [invoice()], payments: [payment({ amountCents: 40_000 })] });
  assert.deepEqual(record("100.00", { facts: partly }), { ok: true, amountCents: 10_000 });
  assert.equal(record("100.01", { facts: partly }).ok, false, "one cent past what is left");
});

test("a voided payment frees its share again", () => {
  const voided = facts({ invoices: [invoice()], payments: [payment({ amountCents: 40_000, status: "voided" })] });
  assert.deepEqual(record("500.00", { facts: voided }), { ok: true, amountCents: 50_000 });
});

test("a fully covered invoice takes nothing further", () => {
  const covered = facts({ invoices: [invoice()], payments: [payment({ amountCents: 50_000 })] });
  const refused = record("0.01", { facts: covered });
  assert.equal(refused.ok, false);
  assert.match((refused as { message: string }).message, /already fully covered/);
});

test("a payment against a draft, voided or unknown invoice is refused", () => {
  assert.equal(record("100.00", { invoice: invoice({ status: "draft" }) }).ok, false);
  assert.equal(record("100.00", { invoice: invoice({ status: "void" }) }).ok, false);
  assert.equal(record("100.00", { invoice: undefined }).ok, false);
});

test("a currency mismatch is a refusal, never a conversion", () => {
  const refused = record("100.00", { currency: "EUR" });
  assert.equal(refused.ok, false);
  assert.match((refused as { message: string }).message, /different currency/);
});

test("an unparseable or non-positive amount is refused rather than coerced", () => {
  assert.equal(resolveCateringPayment({ amountCents: null, currency: "USD", invoice: invoice(), facts: facts({ invoices: [invoice()] }), receivedOn: "2026-09-12" }).ok, false);
  assert.equal(resolveCateringPayment({ amountCents: 0, currency: "USD", invoice: invoice(), facts: facts({ invoices: [invoice()] }), receivedOn: "2026-09-12" }).ok, false);
  assert.equal(resolveCateringPayment({ amountCents: -100, currency: "USD", invoice: invoice(), facts: facts({ invoices: [invoice()] }), receivedOn: "2026-09-12" }).ok, false);
});

test("payments against OTHER invoices do not reduce what this one accepts", () => {
  const two = facts({
    invoices: [invoice(), invoice({ id: "inv-2", number: 2, kind: "balance", amountCents: 150_000 })],
    payments: [payment({ invoiceId: "inv-2", amountCents: 150_000 })],
  });
  assert.deepEqual(record("500.00", { facts: two }), { ok: true, amountCents: 50_000 });
});

test("a payment cannot be dated in the future, judged against the SERVER's date", () => {
  const refused = record("100.00", { receivedOn: "2026-09-14" });
  assert.equal(refused.ok, false);
  assert.match((refused as { message: string }).message, /dated in the future/);
  assert.equal(record("100.00", { receivedOn: "2026-09-13" }).ok, true, "today is fine");
  assert.equal(record("100.00", { receivedOn: "2020-01-01" }).ok, true, "and so is any past day");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * A replayed payment must be the SAME payment
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * An idempotency key makes a retry safe; it does not make a retry mean whatever the second request says.
 *
 * The payment form stays editable while a save is in flight -- deliberately, so a lost response does not throw
 * away what the provider typed -- and it keeps its key, so the retry is recognisably the same attempt. If they
 * corrected the amount before retrying, answering "already done" would close their form over an edit the ledger
 * never received, leaving them believing they had recorded a figure that was never written.
 */
const recorded = { invoiceId: "inv-1", amountCents: 20_000, method: "cash", receivedOn: "2026-09-12", reference: "REF-1" };
const attempt = (patch: Partial<{ invoiceId: string; amountCents: number | null; method: string; receivedOn: string; reference: string | null }> = {}) =>
  ({ invoiceId: "inv-1", amountCents: 20_000, method: "cash", receivedOn: "2026-09-12", reference: "REF-1", ...patch });

test("an identical replay is the same payment", () => {
  assert.equal(cateringPaymentReplayMatches(recorded, attempt()), true);
});

test("a replay that changed ANY semantic field is not", () => {
  for (const patch of [
    { amountCents: 20_001 },
    { amountCents: 10_000 },
    { invoiceId: "inv-2" },
    { method: "bank_transfer" },
    { receivedOn: "2026-09-11" },
    { reference: "REF-2" },
    { reference: null },
  ]) {
    assert.equal(cateringPaymentReplayMatches(recorded, attempt(patch)), false, JSON.stringify(patch));
  }
});

test("an unparseable amount is never a match, so a malformed replay cannot pass as one", () => {
  assert.equal(cateringPaymentReplayMatches(recorded, attempt({ amountCents: null })), false);
});

test("an omitted and a cleared reference are one absence", () => {
  const withoutReference = { ...recorded, reference: null };
  assert.equal(cateringPaymentReplayMatches(withoutReference, { invoiceId: "inv-1", amountCents: 20_000, method: "cash", receivedOn: "2026-09-12" }), true);
  assert.equal(cateringPaymentReplayMatches(withoutReference, attempt({ reference: null })), true);
  assert.equal(cateringPaymentReplayMatches(withoutReference, attempt({ reference: "REF-1" })), false);
});

test("the currency is not compared, because a client never sends one", () => {
  // It is the booking's, taken from the locked row on both the original write and any replay.
  assert.equal(cateringPaymentReplayMatches(recorded, attempt()), true);
});
