import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cateringBillingDateSchema,
  cateringDepositTermsSaveSchema,
  cateringInvoiceIssueSchema,
  cateringPaymentRecordSchema,
} from "./catering-booking-billing";
import { calendarDateSchema } from "./catering-availability";

/**
 * A DATE-ONLY FIELD MUST NAME A DAY THAT EXISTS.
 *
 * The billing schema validated shape and nothing else: `/^\d{4}-\d{2}-\d{2}$/` happily accepted `2026-02-30`,
 * `2026-13-01` and `2026-00-15`. Those passed request validation, reached an insert, and failed in Postgres
 * writing a `date` column -- turning a malformed client input into a 500 instead of the ordinary 400 every other
 * refusal in this phase answers with.
 *
 * The fix is not a better regex. Catering already has one canonical answer to "is this a real calendar day", used
 * by the availability, operations and execution phases, and billing now uses that same one.
 */

const VALID = ["2026-02-28", "2028-02-29", "2026-12-31", "2026-01-01", "2024-02-29", "2000-02-29"];
const IMPOSSIBLE = ["2026-02-29", "2026-02-30", "2026-04-31", "2026-06-31", "2026-13-01", "2026-00-10", "2026-01-00", "2026-01-32", "1900-02-29"];
const MALFORMED = ["2026-1-01", "26-01-01", "2026/01/01", "2026-01-01T00:00:00Z", "", " ", "tomorrow", "2026-01-01 ", "20260101"];

/* ------------------------------------------------------------------------------------------------------------- *
 * The schema itself
 * ------------------------------------------------------------------------------------------------------------- */

test("billing's date schema IS the canonical one, not a second implementation", () => {
  assert.equal(cateringBillingDateSchema, calendarDateSchema, "the same object, by reference");
  const contract = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "catering-booking-billing.ts"), "utf8");
  assert.ok(contract.includes('import { calendarDateSchema } from "./catering-availability";'));
  // And the shape-only regex that let impossible dates through is gone.
  assert.equal(contract.includes('z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/'), false);
});

test("real calendar days pass", () => {
  for (const value of VALID) assert.equal(cateringBillingDateSchema.safeParse(value).success, true, value);
});

test("days that do not exist are refused, however well-shaped they look", () => {
  for (const value of IMPOSSIBLE) assert.equal(cateringBillingDateSchema.safeParse(value).success, false, value);
  // The three named in the report, explicitly.
  for (const value of ["2026-02-30", "2026-13-01", "2026-00-15"]) {
    assert.equal(cateringBillingDateSchema.safeParse(value).success, false, value);
  }
});

test("leap years are decided by the calendar, not by a rule of thumb", () => {
  assert.equal(cateringBillingDateSchema.safeParse("2028-02-29").success, true, "a leap year");
  assert.equal(cateringBillingDateSchema.safeParse("2000-02-29").success, true, "a century that IS a leap year");
  assert.equal(cateringBillingDateSchema.safeParse("1900-02-29").success, false, "a century that is not");
  assert.equal(cateringBillingDateSchema.safeParse("2026-02-29").success, false, "an ordinary year");
});

test("malformed strings are refused too", () => {
  for (const value of MALFORMED) assert.equal(cateringBillingDateSchema.safeParse(value).success, false, JSON.stringify(value));
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Every request that carries a date
 * ------------------------------------------------------------------------------------------------------------- */

const REQUESTS = [
  {
    name: "deposit terms due date",
    parse: (dueOn: string) => cateringDepositTermsSaveSchema.safeParse({ mode: "fixed", amount: "500.00", dueOn }),
  },
  {
    name: "invoice issue due date",
    parse: (dueOn: string) => cateringInvoiceIssueSchema.safeParse({ kind: "balance", dueOn }),
  },
  {
    name: "payment received date",
    parse: (receivedOn: string) => cateringPaymentRecordSchema.safeParse({
      invoiceId: "inv-1", amount: "100.00", method: "cash", receivedOn, idempotencyKey: "key-abcdefgh",
    }),
  },
] as const;

for (const request of REQUESTS) {
  test(`${request.name}: a real day is accepted`, () => {
    for (const value of VALID) assert.equal(request.parse(value).success, true, value);
  });

  test(`${request.name}: an impossible day is refused BEFORE anything is persisted`, () => {
    for (const value of [...IMPOSSIBLE, ...MALFORMED]) {
      const result = request.parse(value);
      assert.equal(result.success, false, value);
      // The ordinary validation failure this phase's routes answer as a 400, not an exception from the driver.
      assert.ok(result.error!.issues[0]?.message, value);
    }
  });
}

test("the nullable date fields still accept an explicit null, which is how a date is cleared", () => {
  assert.equal(cateringDepositTermsSaveSchema.safeParse({ mode: "none", dueOn: null }).success, true);
  assert.equal(cateringInvoiceIssueSchema.safeParse({ kind: "deposit", dueOn: null }).success, true);
  // And omitted entirely, which is how a deposit inherits its terms date.
  assert.equal(cateringInvoiceIssueSchema.safeParse({ kind: "deposit" }).success, true);
});

test("the payment's received date is required, so it cannot be omitted into a default", () => {
  assert.equal(cateringPaymentRecordSchema.safeParse({
    invoiceId: "inv-1", amount: "100.00", method: "cash", idempotencyKey: "key-abcdefgh",
  }).success, false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * No second date implementation, and no UTC reasoning reintroduced
 * ------------------------------------------------------------------------------------------------------------- */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), "utf8");
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("no Phase 2L file validates a date by regex, by Date.parse or by trusting the database", () => {
  for (const file of [
    "shared/catering-booking-billing.ts",
    "server/routes/catering-booking-billing.ts",
    "server/services/catering-booking-billing-policy.ts",
    "client/src/pages/services/catering-booking-billing-state.ts",
  ]) {
    const body = code(read(file));
    for (const forbidden of ["\\d{4}-\\d{2}-\\d{2}", "Date.parse(dueOn", "Date.parse(receivedOn", "new Date(dueOn", "new Date(receivedOn"]) {
      assert.equal(body.includes(forbidden), false, `${file}: ${forbidden}`);
    }
  }
});

test("the client uses the SAME canonical check, so an impossible day is caught before a round trip", () => {
  // A shape regex here would have let `2026-02-30` reach the server to be refused. The form now applies the same
  // schema the server does -- which is the provider being told sooner, never the client being trusted.
  const clientState = read("client/src/pages/services/catering-booking-billing-state.ts");
  assert.ok(clientState.includes("calendarDateSchema.safeParse(form.receivedOn).success"));
  assert.ok(clientState.includes('import { calendarDateSchema } from "@shared/catering-availability";'));
  // And an impossible date typed past it is refused by the server rather than reaching a column.
  assert.equal(cateringPaymentRecordSchema.safeParse({
    invoiceId: "inv-1", amount: "100.00", method: "cash", receivedOn: "2026-02-30", idempotencyKey: "key-abcdefgh",
  }).success, false);
});

test("calendar validity and calendar-day comparison stay separate concerns", () => {
  // This file decides only whether a string names a real day. Whether that day is past or future is decided
  // against the provider's own calendar date, and no UTC day reasoning is reintroduced by any of it.
  const contract = code(read("shared/catering-booking-billing.ts"));
  for (const forbidden of ["toISOString().slice", "Intl.DateTimeFormat", "timeZone", "new Date("]) {
    assert.equal(contract.includes(forbidden), false, forbidden);
  }
  assert.ok(contract.includes("return invoice.dueOn < asOfDate;"), "a string comparison against the provider's day");
  const route = code(read("server/routes/catering-booking-billing.ts"));
  assert.ok(route.includes("const asOfDate = await cateringBillingDay(db, booking.providerId);"));
});
