import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_FINANCIAL_STATUSES, CATERING_BILLING_DISCLOSURE } from "./catering-booking-billing";

/**
 * PHASE 2L STAYS IN ITS OWN DOMAIN.
 *
 * Money is a second, independent description of a booking. A booking can be `confirmed` with a deposit due, or
 * `completed` with a balance outstanding, or closed out operationally with money still owed. Every one of those is
 * a legitimate state, and each would be inexpressible if the two domains were collapsed into one.
 *
 * This file is the guard against that collapse -- and against the other thing that would make this phase untrue,
 * which is claiming money moved when none did.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), "utf8");
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const route = read("server/routes/catering-booking-billing.ts");
const component = read("client/src/components/catering/BookingBilling.tsx");
const contract = read("shared/catering-booking-billing.ts");
const policy = read("server/services/catering-booking-billing-policy.ts");

/* ------------------------------------------------------------------------------------------------------------- *
 * Phase 2G: the booking lifecycle
 * ------------------------------------------------------------------------------------------------------------- */

test("Phase 2L invents no booking status", () => {
  for (const status of CATERING_FINANCIAL_STATUSES) {
    assert.equal(["pending_confirmation", "confirmed", "cancelled", "completed"].includes(status), false, status);
  }
});

test("no financial action writes to catering_bookings", () => {
  const body = code(route);
  for (const forbidden of ["update(cateringBookings)", "insert(cateringBookings)", "delete(cateringBookings)"]) {
    assert.equal(body.includes(forbidden), false, forbidden);
  }
  // Read and row-locked, and that is all.
  assert.ok(body.includes("FOR UPDATE"));
  assert.ok(body.includes("status: cateringBookings.status, agreedPrice: cateringBookings.agreedPrice, currency: cateringBookings.currency"));
});

test("no booking is confirmed, cancelled or completed by a payment", () => {
  const body = code(route);
  // No booking lifecycle column is ever written. The scan is over what is WRITTEN -- every `.values({...})` and
  // `.set({...})` in the file -- because the words themselves legitimately appear in reads and in the read-only
  // fallback a mutation's fresh view uses when the booking has vanished from under it.
  const written = [...body.matchAll(/\.(?:values|set)\(\{([\s\S]*?)\}\)/g)].map((match) => match[1]);
  assert.ok(written.length >= 6, `expected every write: ${written.length}`);
  for (const values of written) {
    for (const forbidden of ["confirmedAt", "completedAt", "cancelledAt", "customerConfirmedAt", "providerConfirmedAt", "bookingStatus"]) {
      assert.equal(values.includes(forbidden), false, `${forbidden} in ${values.slice(0, 60)}`);
    }
  }
  // And the booking table itself is never a write target, which the separation test above also asserts.
  assert.equal(body.includes("update(cateringBookings)"), false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Phases 2H, 2I, 2J, 2K
 * ------------------------------------------------------------------------------------------------------------- */

test("payments are not Phase 2H tasks, and no second feed or messaging surface is created", () => {
  const body = code(route);
  for (const forbidden of ["cateringBookingTasks", "cateringBookingConversations", "cateringBookingMessages", "cateringBookingFiles"]) {
    assert.equal(body.includes(forbidden), false, forbidden);
  }
  // The EXISTING activity feed is the one this phase writes to, and the only one.
  assert.ok(body.includes("insert(cateringBookingActivity)"));
  assert.equal((body.match(/eventType: "billing_/g) ?? []).length, 4);
});

test("no Phase 2J execution or 2K closeout record is read or written by billing", () => {
  const body = code(route);
  for (const forbidden of ["cateringBookingExecution", "cateringBookingEquipment", "cateringBookingCloseout", "cateringBookingCloseoutItems"]) {
    assert.equal(body.includes(forbidden), false, forbidden);
  }
});

test("operational closeout is NOT blocked by an outstanding balance", () => {
  // A deliberate product position, stated rather than assumed: operational wrap-up and financial settlement are
  // distinct, and a caterer who has finished packing up should not be told they have not because an invoice is
  // open. If that is ever to change it is a product decision, taken openly -- so Phase 2K's readiness must have no
  // financial input at all, which is what this asserts.
  const closeoutPolicy = code(read("server/services/catering-booking-closeout-policy.ts"));
  for (const financial of ["billing", "invoice", "payment", "deposit", "balance", "amountCents", "agreedPrice"]) {
    assert.equal(closeoutPolicy.toLowerCase().includes(financial.toLowerCase()), false, financial);
  }
});

test("no earlier phase imports Phase 2L, so none of their behaviour can change with it", () => {
  for (const file of [
    "server/routes/catering-bookings.ts",
    "server/routes/catering-booking-operations.ts",
    "server/routes/catering-booking-closeout.ts",
    "server/services/catering-booking-closeout-policy.ts",
    "client/src/components/catering/BookingCloseout.tsx",
    "client/src/components/catering/BookingExecution.tsx",
  ]) {
    const full = path.join(repoRoot, file);
    if (!fs.existsSync(full)) continue;
    assert.equal(fs.readFileSync(full, "utf8").includes("catering-booking-billing"), false, file);
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * No money moves, and nothing says it did
 * ------------------------------------------------------------------------------------------------------------- */

test("this phase touches no payment processor at all", () => {
  for (const source of [route, contract, policy, component]) {
    const body = code(source);
    for (const forbidden of ["square", "Square", "stripe", "Stripe", "paymentLinks", "WebhooksHelper", "getSquareClient", "SQUARE_"]) {
      assert.equal(body.includes(forbidden), false, forbidden);
    }
  }
});

test("no webhook, checkout session or client success claim exists to be trusted", () => {
  const body = code(route);
  for (const forbidden of ["webhook", "checkout", "paymentIntent", "sourceId", "nonce", "verifySignature"]) {
    assert.equal(body.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});

test("the customer is given no payment button, because there is nothing behind one", () => {
  const body = code(component);
  // Every mutation call site is inside a `provider &&` branch or a provider-only handler; the customer's view is
  // read-only by construction. The word "Pay" never appears as a control.
  for (const forbidden of [">Pay<", "Pay now", "Pay deposit", "Pay balance", "Checkout", "Card details"]) {
    assert.equal(body.includes(forbidden), false, forbidden);
  }
  assert.ok(body.includes("const provider = role === \"provider\";"));
});

test("the disclosure is unambiguous for both actors and is rendered on every view", () => {
  assert.match(CATERING_BILLING_DISCLOSURE.customer, /does not take catering payments/);
  assert.match(CATERING_BILLING_DISCLOSURE.provider, /does not process catering payments/);
  assert.ok(component.includes("provider ? CATERING_BILLING_DISCLOSURE.provider : CATERING_BILLING_DISCLOSURE.customer"));
  // Above the totals, in the section's own header, so it is read before any number is. (The first `<CardHeader>`
  // in the file belongs to the loading card, so the header holding the status badge is the one to look at.)
  const from = component.indexOf("<CardTitle>Payments</CardTitle>\n          <CardDescription");
  assert.notEqual(from, -1);
  const header = component.slice(component.indexOf("<CardHeader>", component.lastIndexOf("<CardHeader>", from)), component.indexOf("</CardHeader>", from));
  assert.ok(header.includes("CATERING_BILLING_DISCLOSURE"));
  assert.ok(header.indexOf("CATERING_BILLING_DISCLOSURE") < component.indexOf("Agreed total"), "before the first figure");
});

test("a recorded payment is never called paid without saying whose record it is", () => {
  const clientState = code(read("client/src/pages/services/catering-booking-billing-state.ts"));
  assert.ok(clientState.includes('return role === "provider" ? "Recorded by you" : "Recorded by your caterer";'));
  // And the component always renders the provenance beside the amount.
  assert.ok(code(component).includes("cateringPaymentProvenance(payment.source, role)"));
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Price changes
 * ------------------------------------------------------------------------------------------------------------- */

test("the agreed price is written once at booking creation and by nothing in this phase", () => {
  // The audit found exactly one writer, in the Phase 2G booking creation path, and no update anywhere. Phase 2L
  // therefore has no price to reconcile -- and adds no way to change one, which would be a lifecycle change.
  const bookings = read("server/routes/catering-bookings.ts");
  assert.equal((bookings.match(/agreedPrice:/g) ?? []).length, 1, "one writer, at creation");
  assert.ok(bookings.includes("insert(cateringBookings).values({"), "and it is an insert, never an update");
  // Phase 2L mentions the column only to READ it: in a select projection and in the types that carry it. It
  // appears in no `.values({...})` and no `.set({...})` anywhere in the route.
  const written = [...code(route).matchAll(/\.(?:values|set)\(\{([\s\S]*?)\}\)/g)].map((match) => match[1]);
  for (const values of written) assert.equal(values.includes("agreedPrice"), false, values.slice(0, 60));
});

test("an issued invoice is never rewritten to a different amount", () => {
  const updates = [...code(route).matchAll(/tx\.update\(cateringBookingInvoices\)\.set\(\{([^}]*)\}/g)].map((match) => match[1]);
  assert.equal(updates.length, 1);
  assert.ok(updates[0].includes('status: "void"'));
  assert.equal(updates[0].includes("amountCents"), false);
});
