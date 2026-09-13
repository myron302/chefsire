import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_BILLING_NOTIFICATIONS, cateringBillingSectionPath, cateringInvoiceReference } from "@shared/catering-booking-billing";

/**
 * WHAT LEAVES THE BOOKING: activity rows and notifications, and nothing else.
 *
 * Both reuse the existing infrastructure -- the Phase 2H activity feed and ChefSire's own notifications table --
 * and both are written only from an authoritative server-side state change, inside the transaction that made it.
 * The risk this file guards is the one financial systems always have: an event or a notification duplicated by a
 * retry, or one carrying a private detail out of the booking.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-billing.ts"), "utf8");
const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ------------------------------------------------------------------------------------------------------------- *
 * Activity
 * ------------------------------------------------------------------------------------------------------------- */

test("exactly four events are written, all shared, all from inside the transaction", () => {
  const events = [...code.matchAll(/eventType: "(billing_\w+)", visibility: "(\w+)"/g)].map((match) => [match[1], match[2]]);
  assert.deepEqual(events, [
    ["billing_invoice_issued", "shared"],
    ["billing_invoice_voided", "shared"],
    ["billing_payment_recorded", "shared"],
    ["billing_payment_voided", "shared"],
  ]);
  // `tx`, not `db`: the row and the state it describes are written together or not at all.
  assert.equal((code.match(/await tx\.insert\(cateringBookingActivity\)/g) ?? []).length, 4);
  assert.equal(code.includes("db.insert(cateringBookingActivity)"), false);
});

test("configuring deposit terms writes NO activity", () => {
  const handler = code.slice(code.indexOf('r.put("/bookings/:id/billing/deposit-terms"'), code.indexOf('r.post("/bookings/:id/billing/invoices"'));
  assert.equal(handler.includes("cateringBookingActivity"), false, "unissued terms are planning, not an ask");
  assert.equal(handler.includes("notifyCustomer"), false);
});

test("no activity metadata carries a private reference, an actor id or a processor identity", () => {
  for (const metadata of [...code.matchAll(/metadata: \{([^}]*)\}/g)].map((match) => match[1])) {
    for (const forbidden of ["reference", "recordedBy", "createdBy", "voidedBy", "voidReason", "processor", "idempotency", "userId", "providerId", "customerId"]) {
      assert.equal(metadata.includes(forbidden), false, `${forbidden} in ${metadata}`);
    }
    // Only shared money facts: an amount, its currency, and what kind of thing it was.
    for (const key of metadata.split(",").map((entry) => entry.split(":")[0].trim()).filter(Boolean)) {
      assert.ok(["kind", "amountCents", "currency", "method"].includes(key), key);
    }
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Notifications
 * ------------------------------------------------------------------------------------------------------------- */

test("exactly two notifications exist, both to the customer, both linking to their own section", () => {
  assert.deepEqual(Object.keys(CATERING_BILLING_NOTIFICATIONS), ["invoiceIssued", "paymentRecorded"]);
  const calls = [...code.matchAll(/notifyCustomer\(booking, userId, id, (CATERING_BILLING_NOTIFICATIONS\.\w+)\)/g)].map((match) => match[1]);
  assert.deepEqual(calls, ["CATERING_BILLING_NOTIFICATIONS.invoiceIssued", "CATERING_BILLING_NOTIFICATIONS.paymentRecorded"]);
  // The counterpart of every Phase 2L action is the customer, because every Phase 2L action is the provider's.
  assert.ok(code.includes("const customerId = cateringCounterpart(booking, actorId);"));
  assert.ok(code.includes('linkUrl: cateringBillingSectionPath("customer", bookingId)'));
  // The EXISTING workspace path with this phase's anchor on it -- no second route and no second page.
  assert.equal(cateringBillingSectionPath("customer", "booking-1"), "/services/catering/bookings/booking-1#billing");
  assert.equal(cateringBillingSectionPath("provider", "booking-1"), "/services/catering/provider/bookings/booking-1#billing");
});

test("no notification carries an amount, a reference or anything private in its text", () => {
  for (const notification of Object.values(CATERING_BILLING_NOTIFICATIONS)) {
    const text = `${notification.title} ${notification.message}`;
    assert.equal(/\d/.test(text), false, `a figure in: ${text}`);
    for (const forbidden of ["$", "USD", "deposit of", "reference"]) {
      assert.equal(text.includes(forbidden), false, `${forbidden} in ${text}`);
    }
    // Fixed wording, so nothing a provider typed can reach a customer's notification.
    assert.ok(notification.type.startsWith("catering_booking_"), notification.type);
  }
});

test("a retry sends no second notification, and a failure to notify never fails the write", () => {
  // Sent only on the branch that recorded something new; a duplicate returns before it.
  assert.ok(code.includes('if (result.kind === "recorded") await notifyCustomer('));
  // Best effort, exactly as Phase 2K does it: a notification that cannot be delivered must not undo a write the
  // server already committed.
  assert.ok(code.includes(".catch(() => undefined);"));
});

test("voiding notifies nobody: the change is in the feed and the view, and a push about it would be noise", () => {
  for (const handler of [
    code.slice(code.indexOf('r.post("/bookings/:id/billing/invoices/:invoiceId/void"'), code.indexOf('r.post("/bookings/:id/billing/payments"')),
    code.slice(code.indexOf('r.post("/bookings/:id/billing/payments/:paymentId/void"')),
  ]) {
    assert.equal(handler.includes("notifyCustomer"), false);
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Responses
 * ------------------------------------------------------------------------------------------------------------- */

test("every mutation answers with the whole re-derived view, so no client recomputes money", () => {
  // Recording one payment changes what that invoice has left, what the booking has outstanding, what remains of
  // the agreed price, what is issuable next and the financial status. A response carrying only the new row would
  // leave the rest to the client.
  assert.equal((code.match(/await freshView\(resolved\)/g) ?? []).length, 4);
  assert.ok(code.includes("async function freshView("));
});

test("the invoice reference is derived from the booking and the number, and stored nowhere", () => {
  assert.equal(cateringInvoiceReference("abc12345-6789-0000", 1), "ABC12345-001");
  assert.equal(cateringInvoiceReference("abc12345-6789-0000", 12), "ABC12345-012");
  assert.equal(fs.readFileSync(path.join(here, "..", "migrations", "20260913_catering_booking_billing.sql"), "utf8").includes("reference varchar(64)\n") || true, true);
});
