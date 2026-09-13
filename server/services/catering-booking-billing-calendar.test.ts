import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calendarDateInProviderTimezone } from "./catering-provider-calendar";
import { resolveCateringPayment } from "./catering-booking-billing-policy";
import {
  cateringInvoiceIsOverdue,
  cateringMoneyToCents,
  deriveCateringBillingSummary,
  type CateringBillingFacts,
  type CateringInvoiceFact,
} from "@shared/catering-booking-billing";

/**
 * THE BILLING DAY IS THE CATERER'S DAY.
 *
 * It was UTC -- `now.toISOString().slice(0, 10)` -- which is wrong for every provider who is not on it. A caterer
 * in Los Angeles who says "deposit due by the 20th" means the 20th where they are; judged in UTC that invoice
 * turns red at 4pm on the 19th, and a payment they take in hand that evening is refused as "dated in the future"
 * because UTC has already rolled over. A caterer in Tokyo gets the mirror image: their own working day is not yet
 * allowed to have happened.
 *
 * The fix reuses what Catering already has -- `catering_availability_settings.timezone` through
 * `calendarDateInTimezone`, via the same `providerCalendarDate` the booking offer and confirmation rules use -- and
 * resolves it ONCE per request at the route boundary, so the pure helpers below stay timezone-agnostic and a
 * request that crosses midnight cannot judge one rule against the 13th and the next against the 14th.
 */

const invoice = (patch: Partial<CateringInvoiceFact> = {}): CateringInvoiceFact =>
  ({ id: "inv-1", number: 1, kind: "deposit", amountCents: 50_000, currency: "USD", status: "issued", dueOn: "2026-09-20", issuedAt: "2026-09-01T00:00:00.000Z", ...patch });
const facts = (asOfDate: string, invoices: CateringInvoiceFact[] = [invoice()]): CateringBillingFacts => ({
  bookingStatus: "confirmed", agreedTotalCents: 200_000, currency: "USD",
  terms: { mode: "none", amountCents: null, percentBasisPoints: null, dueOn: null },
  invoices, payments: [], asOfDate,
});

/** Late evening in the Americas on the 20th; already the 21st in UTC. */
const LATE_ON_THE_20TH = new Date("2026-09-21T02:00:00.000Z");

/* ------------------------------------------------------------------------------------------------------------- *
 * One instant, several business days
 * ------------------------------------------------------------------------------------------------------------- */

test("the same instant is a different billing day for differently placed providers", () => {
  const days = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"]
    .map((timezone) => [timezone, calendarDateInProviderTimezone(LATE_ON_THE_20TH, timezone)] as const);
  assert.deepEqual(days, [
    ["UTC", "2026-09-21"],
    ["America/New_York", "2026-09-20"],
    ["America/Los_Angeles", "2026-09-20"],
    ["Europe/London", "2026-09-21"],
    ["Asia/Tokyo", "2026-09-21"],
  ]);
});

test("a due date is not overdue until the PROVIDER's day has passed it", () => {
  const due20th = invoice({ dueOn: "2026-09-20" });
  // In UTC it is already the 21st, so UTC would call this overdue -- which is the bug.
  assert.equal(cateringInvoiceIsOverdue(due20th, [], calendarDateInProviderTimezone(LATE_ON_THE_20TH, "UTC")), true);
  // For the caterer it is still the evening of the 20th, and it is not.
  for (const timezone of ["America/New_York", "America/Los_Angeles"]) {
    const day = calendarDateInProviderTimezone(LATE_ON_THE_20TH, timezone);
    assert.equal(cateringInvoiceIsOverdue(due20th, [], day), false, timezone);
    assert.equal(deriveCateringBillingSummary(facts(day, [due20th])).hasOverdue, false, timezone);
  }
});

test("and it IS overdue once their own day has moved past it", () => {
  const nextMorning = new Date("2026-09-21T16:00:00.000Z");   // 09:00 on the 21st in Los Angeles
  const day = calendarDateInProviderTimezone(nextMorning, "America/Los_Angeles");
  assert.equal(day, "2026-09-21");
  assert.equal(cateringInvoiceIsOverdue(invoice({ dueOn: "2026-09-20" }), [], day), true);
  const summary = deriveCateringBillingSummary(facts(day));
  assert.equal(summary.hasOverdue, true);
  assert.equal(summary.nextDueIsOverdue, true);
});

test("a provider east of UTC is not held to yesterday either", () => {
  // 07:00 on the 21st in Tokyo, while UTC is still the 20th.
  const instant = new Date("2026-09-20T22:00:00.000Z");
  assert.equal(calendarDateInProviderTimezone(instant, "UTC"), "2026-09-20");
  assert.equal(calendarDateInProviderTimezone(instant, "Asia/Tokyo"), "2026-09-21");
  assert.equal(cateringInvoiceIsOverdue(invoice({ dueOn: "2026-09-20" }), [], calendarDateInProviderTimezone(instant, "Asia/Tokyo")), true,
    "their day really has passed it, so it really is late");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Recording a payment
 * ------------------------------------------------------------------------------------------------------------- */

const record = (receivedOn: string, asOfDate: string) => resolveCateringPayment({
  amountCents: cateringMoneyToCents("100.00"),
  currency: "USD",
  invoice: invoice(),
  facts: facts(asOfDate),
  receivedOn,
});

test("a payment received on the provider's today is accepted", () => {
  for (const timezone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
    const day = calendarDateInProviderTimezone(LATE_ON_THE_20TH, timezone);
    assert.equal(record(day, day).ok, true, timezone);
  }
});

test("money taken in hand on the provider's evening is NOT refused as 'in the future'", () => {
  // The reported consequence, exactly: it is the evening of the 20th in Los Angeles and the 21st in UTC. Under the
  // old UTC day the caterer could not record what they had just been handed.
  const theirDay = calendarDateInProviderTimezone(LATE_ON_THE_20TH, "America/Los_Angeles");
  assert.equal(theirDay, "2026-09-20");
  assert.equal(record("2026-09-20", theirDay).ok, true);
  // The counterfactual: judged against the UTC day it is accepted too -- but the day AFTER theirs is not, which is
  // the half a provider west of UTC used to lose.
  assert.equal(record("2026-09-21", theirDay).ok, false, "genuinely tomorrow for them, and refused");
  assert.equal(record("2026-09-21", calendarDateInProviderTimezone(LATE_ON_THE_20TH, "UTC")).ok, true,
    "whereas in UTC the 21st is today -- two different answers from one instant");
});

test("a date after the provider's today is still refused", () => {
  const day = calendarDateInProviderTimezone(LATE_ON_THE_20TH, "Asia/Tokyo");
  const refused = record("2026-09-22", day);
  assert.equal(refused.ok, false);
  assert.match((refused as { message: string }).message, /dated in the future/);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * One day per request
 * ------------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-billing.ts"), "utf8");
const policy = fs.readFileSync(path.join(here, "catering-booking-billing-policy.ts"), "utf8");
const contract = fs.readFileSync(path.join(here, "..", "..", "shared", "catering-booking-billing.ts"), "utf8");

test("the day is resolved once, at the boundary, from the booking's own provider", () => {
  assert.ok(route.includes("const asOfDate = await cateringBillingDay(db, booking.providerId);"));
  assert.equal((route.match(/cateringBillingDay\(/g) ?? []).length, 1, "resolved in exactly one place");
  // And every consumer takes that same value rather than asking again.
  assert.equal((route.match(/asOfDate: resolved\.asOfDate/g) ?? []).length, 4);
  assert.equal(route.includes("cateringBillingToday"), false, "the UTC day is gone");
});

test("it reuses Catering's own provider calendar rather than a second model", () => {
  assert.ok(policy.includes('import { providerCalendarDate } from "./catering-provider-calendar";'));
  const calendar = fs.readFileSync(path.join(here, "catering-provider-calendar.ts"), "utf8");
  assert.ok(calendar.includes("cateringAvailabilitySettings.timezone"), "the same persisted source");
  assert.ok(calendar.includes('calendarDateInTimezone(now, timezone ?? "UTC")'), "the same formatter");
  assert.ok(calendar.includes('settings?.timezone ?? "UTC"'), "and the same fallback");
  // The booking routes now import it too, so there is one owner of the question and not two copies.
  const bookings = fs.readFileSync(path.join(here, "..", "routes", "catering-bookings.ts"), "utf8");
  assert.ok(bookings.includes('import { providerCalendarDate } from "../services/catering-provider-calendar";'));
  assert.equal(bookings.includes("async function providerCalendarDate("), false, "the private copy is gone");
});

test("the shared contract stays timezone-agnostic: it compares dates and knows nothing about zones", () => {
  // The CODE, not the prose: the header explains why a due date is the caterer's day, and that explanation
  // necessarily uses the word.
  const body = contract.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const forbidden of ["timeZone", "timezone", "Intl.DateTimeFormat", "toISOString().slice", "getTimezoneOffset", "new Date("]) {
    assert.equal(body.includes(forbidden), false, forbidden);
  }
  // It receives `asOfDate` as a plain YYYY-MM-DD and does string comparison, which is why it can be tested with
  // any zone's answer without a clock.
  assert.ok(contract.includes("return invoice.dueOn < asOfDate;"));
});

test("no Phase 2L business date is derived from UTC, the host or the browser", () => {
  const client = fs.readFileSync(path.join(here, "..", "..", "client", "src", "components", "catering", "BookingBilling.tsx"), "utf8");
  const clientState = fs.readFileSync(path.join(here, "..", "..", "client", "src", "pages", "services", "catering-booking-billing-state.ts"), "utf8");
  for (const source of [route, policy, contract, client, clientState]) {
    const body = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of ["toISOString().slice(0, 10)", "toISOString().slice(0,10)", "getFullYear()", "toLocaleDateString", "getTimezoneOffset"]) {
      assert.equal(body.includes(forbidden), false, forbidden);
    }
  }
  // The payment form's default date is the SERVER's answer, carried on the payload -- not the device's clock.
  assert.ok(client.includes("openCateringPaymentForm(identity, invoice, billing.asOfDate, cateringIdempotencyKey())"));
});

test("the instants that remain are instants, not business days", () => {
  // `issuedAt`, `voidedAt` and `updatedAt` are timestamptz: moments, which have no calendar day to get wrong.
  const stamps = [...route.matchAll(/(\w+): new Date\(\)/g)].map((match) => match[1]);
  assert.ok(stamps.length >= 4);
  for (const stamp of stamps) {
    assert.ok(["issuedAt", "voidedAt", "updatedAt"].includes(stamp), stamp);
  }
  assert.equal(route.includes("dueOn: new Date()"), false);
  assert.equal(route.includes("receivedOn: new Date()"), false);
});

test("the customer is told the resulting date, never where their caterer is", () => {
  const serializer = fs.readFileSync(path.join(here, "..", "serializers", "catering-booking-billing.ts"), "utf8");
  for (const source of [contract, serializer, route]) {
    assert.equal(/\btimezone\b/i.test(source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")), false);
  }
  // `asOfDate` is on the payload; the identifier it came from is not.
  assert.ok(contract.includes("asOfDate: string;"));
});
