import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A RETRY MUST NEVER CREDIT MONEY TWICE.
 *
 * Financial idempotency needs more than ordinary CRUD does, because the thing being repeated is a credit. Phase 2L
 * defends it in three independent layers, and this file asserts all three are actually wired:
 *
 *  1. THE KEY. The client mints one key when the payment form OPENS and keeps it for that form's life, so a
 *     double-click, a browser retry, a proxy retry and a retry after a lost response are one attempt.
 *  2. THE CHECK, taken FIRST inside the transaction, before any validation that could refuse a replay of something
 *     already recorded. A replay resolves to what happened, not to a fresh judgement of whether it still could.
 *  3. THE INDEX. `(booking_id, idempotency_key)` is unique, so two requests arriving at once cannot both insert --
 *     the second fails inside its own transaction rather than crediting the money a second time.
 *
 * And the invoice side has its own: at most one live invoice of each kind per booking, so a double-issue is
 * impossible even if the derivation were somehow reached twice.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-billing.ts"), "utf8");
const migration = fs.readFileSync(path.join(here, "..", "migrations", "20260913_catering_booking_billing.sql"), "utf8");
const schema = fs.readFileSync(path.join(here, "..", "..", "shared", "schema", "domains", "social-content.ts"), "utf8");
const component = fs.readFileSync(path.join(here, "..", "..", "client", "src", "components", "catering", "BookingBilling.tsx"), "utf8");
const clientState = fs.readFileSync(path.join(here, "..", "..", "client", "src", "pages", "services", "catering-booking-billing-state.ts"), "utf8");

/* ------------------------------------------------------------------------------------------------------------- *
 * The key
 * ------------------------------------------------------------------------------------------------------------- */

test("the key is minted when the payment form opens, not when it is submitted", () => {
  assert.ok(component.includes("openCateringPaymentForm(identity, invoice, billing.asOfDate, cateringIdempotencyKey())"));
  // The submit reads the form's key. It does not mint one, which would make every retry a new attempt.
  assert.ok(component.includes("idempotencyKey: open.idempotencyKey"));
  const submit = component.slice(component.indexOf("const submitPayment = "), component.indexOf("const voidPayment = "));
  assert.equal(submit.includes("cateringIdempotencyKey()"), false, "a fresh key on retry would be no protection at all");
});

test("editing the form cannot change its key", () => {
  // The edit helper's patch type excludes it, so no keystroke and no re-render can replace an attempt's identity.
  assert.ok(clientState.includes('Partial<Omit<NonNullable<CateringPaymentForm>, "identity" | "invoiceId" | "idempotencyKey">>'));
});

test("the request always carries it, and the schema requires it", () => {
  const shared = fs.readFileSync(path.join(here, "..", "..", "shared", "catering-booking-billing.ts"), "utf8");
  const recordSchema = shared.slice(shared.indexOf("export const cateringPaymentRecordSchema"));
  assert.ok(recordSchema.slice(0, recordSchema.indexOf("}).strict();")).includes("idempotencyKey: z.string().trim().min(8).max(64)"));
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The check, and its ordering
 * ------------------------------------------------------------------------------------------------------------- */

test("the duplicate check runs before any validation that could refuse a replay", () => {
  const handler = route.slice(route.indexOf('r.post("/bookings/:id/billing/payments"'), route.indexOf('r.post("/bookings/:id/billing/payments/:paymentId/void"'));
  const duplicate = handler.indexOf("const existing = rows.payments.find((payment) => payment.idempotencyKey === body.idempotencyKey);");
  const validation = handler.indexOf("const resolution = resolveCateringPayment({");
  assert.notEqual(duplicate, -1);
  assert.notEqual(validation, -1);
  assert.ok(duplicate < validation, "otherwise a retry of a payment that filled the invoice would be refused as overpayment");
  // And it is inside the transaction, past the lock, so it sees the row a concurrent first attempt just wrote.
  assert.ok(handler.indexOf("await lockBilling(tx, id);") < duplicate);
});

test("a duplicate writes nothing: no second credit, no second activity row, no second notification", () => {
  const handler = route.slice(route.indexOf('r.post("/bookings/:id/billing/payments"'), route.indexOf('r.post("/bookings/:id/billing/payments/:paymentId/void"'));
  // The duplicate branch returns immediately, so neither the insert nor the activity row below it is reached.
  const duplicateReturn = handler.indexOf('if (existing) return { kind: "duplicate" } as const;');
  assert.ok(duplicateReturn < handler.indexOf("await tx.insert(cateringBookingPayments)"));
  assert.ok(duplicateReturn < handler.indexOf('eventType: "billing_payment_recorded"'));
  // And the notification is sent only on the branch that actually recorded one.
  assert.ok(handler.includes('if (result.kind === "recorded") await notifyCustomer('));
  assert.ok(handler.includes('duplicate: result.kind === "duplicate"'), "and the caller is told it was a replay");
});

test("voiding is idempotent by STATE, judged before the precondition", () => {
  const invoiceVoid = route.indexOf('r.post("/bookings/:id/billing/invoices/:invoiceId/void"');
  const paymentVoid = route.indexOf('r.post("/bookings/:id/billing/payments/:paymentId/void"');
  assert.ok(invoiceVoid !== -1 && paymentVoid !== -1 && invoiceVoid < paymentVoid);
  for (const handler of [
    route.slice(invoiceVoid, route.indexOf('r.post("/bookings/:id/billing/payments"', invoiceVoid)),
    route.slice(paymentVoid),
  ]) {
    const already = handler.indexOf('return { kind: "already" } as const;');
    assert.notEqual(already, -1);
    const precondition = handler.indexOf("cateringBillingVersionMatches");
    // A retry after a lost response finds the row already void and reports success, rather than a conflict about a
    // change it made itself.
    if (precondition !== -1) assert.ok(already < precondition);
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The indexes
 * ------------------------------------------------------------------------------------------------------------- */

test("the payment key is unique per booking, in the migration and the schema", () => {
  assert.ok(migration.includes("CREATE UNIQUE INDEX IF NOT EXISTS catering_payments_idempotency_uidx ON catering_booking_payments(booking_id, idempotency_key) WHERE idempotency_key IS NOT NULL;"));
  assert.ok(schema.includes('uniqueIndex("catering_payments_idempotency_uidx").on(t.bookingId, t.idempotencyKey)'));
});

test("one processor charge can be credited exactly once, however often its webhook is delivered", () => {
  // Null in every row this phase writes, and the seam a later phase needs already constrained.
  assert.ok(migration.includes("CREATE UNIQUE INDEX IF NOT EXISTS catering_payments_processor_uidx ON catering_booking_payments(processor, processor_payment_id) WHERE processor_payment_id IS NOT NULL;"));
  assert.ok(schema.includes('uniqueIndex("catering_payments_processor_uidx").on(t.processor, t.processorPaymentId)'));
});

test("at most one live invoice of each kind per booking, so a double-issue cannot happen", () => {
  assert.ok(migration.includes("CREATE UNIQUE INDEX IF NOT EXISTS catering_invoices_live_kind_uidx ON catering_booking_invoices(booking_id, invoice_kind) WHERE status <> 'void';"));
  assert.ok(schema.includes('uniqueIndex("catering_invoices_live_kind_uidx").on(t.bookingId, t.invoiceKind)'));
  // A voided invoice leaves the slot free, which is what makes withdraw-and-reissue the way to change an ask.
  assert.ok(migration.includes("WHERE status <> 'void'"));
});

test("invoice numbers are unique per booking and allocated under the lock", () => {
  assert.ok(migration.includes("CREATE UNIQUE INDEX IF NOT EXISTS catering_invoices_number_uidx ON catering_booking_invoices(booking_id, invoice_number);"));
  const handler = route.slice(route.indexOf('r.post("/bookings/:id/billing/invoices"'));
  const allocation = handler.indexOf("const nextNumber = rows.invoices.reduce(");
  assert.ok(handler.indexOf("await lockBilling(tx, id);") < allocation, "two tabs cannot take the same number");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Concurrency
 * ------------------------------------------------------------------------------------------------------------- */

test("two tabs editing deposit terms cannot silently overwrite each other", () => {
  const handler = route.slice(route.indexOf('r.put("/bookings/:id/billing/deposit-terms"'), route.indexOf('r.post("/bookings/:id/billing/invoices"'));
  assert.ok(handler.includes("if (!cateringBillingVersionMatches(body.expectedUpdatedAt, existing?.updatedAt)) return { kind: \"conflict\" } as const;"));
  // Checked against the row this TRANSACTION holds, not the one the request was composed from.
  assert.ok(handler.indexOf("await lockBilling(tx, id);") < handler.indexOf("cateringBillingVersionMatches"));
});

test("the price an invoice is derived from is read under the booking's row lock", () => {
  const handler = route.slice(route.indexOf('r.post("/bookings/:id/billing/invoices"'), route.indexOf('r.post("/bookings/:id/billing/invoices/:invoiceId/void"'));
  const locked = handler.indexOf("const locked = await lockedBooking(tx, id);");
  const derived = handler.indexOf("const amountCents = cateringInvoiceAmountFor(");
  assert.ok(locked !== -1 && locked < derived, "so a tab showing a stale price cannot issue against it");
  assert.ok(route.includes("FOR UPDATE"));
});

test("an issued invoice is never edited in place", () => {
  // The only UPDATE on an invoice sets the void columns. An amount a customer was shown must not be able to become
  // a different amount that claims it was always that; withdrawing and reissuing is the only way to change an ask.
  const updates = [...route.matchAll(/tx\.update\(cateringBookingInvoices\)\.set\(\{([^}]*)\}/g)].map((match) => match[1]);
  assert.equal(updates.length, 1);
  assert.ok(updates[0].includes('status: "void"'));
  for (const forbidden of ["amountCents", "invoiceKind", "invoiceNumber", "currency", "issuedAt"]) {
    assert.equal(updates[0].includes(forbidden), false, forbidden);
  }
});

test("a payment row is never deleted, only marked voided", () => {
  assert.equal(route.includes("delete(cateringBookingPayments)"), false);
  assert.equal(route.includes("delete(cateringBookingInvoices)"), false);
  const updates = [...route.matchAll(/tx\.update\(cateringBookingPayments\)\.set\(\{([^}]*)\}/g)].map((match) => match[1]);
  assert.equal(updates.length, 1);
  assert.ok(updates[0].includes('status: "voided"'));
  assert.equal(updates[0].includes("amountCents"), false, "a credit's amount is history and stays as it was");
});

test("an invoice with credited payments cannot be withdrawn while they stand", () => {
  // Taking back the ask while keeping the credit would leave money recorded against nothing.
  assert.ok(route.includes('const credited = rows.payments.some((payment) => payment.invoiceId === invoiceId && payment.status === "recorded");'));
  assert.ok(route.includes('if (credited) return { kind: "refused"'));
});

test("only a provider-recorded payment can be taken back here", () => {
  // A processor-backed payment, when a later phase writes one, is the processor's fact and cannot be reversed by a
  // database toggle. There is no refund button anywhere in this phase.
  assert.ok(route.includes('if (payment.paymentSource !== "provider_recorded") {'));
  // No refund exists anywhere in this phase's CODE. The word appears only in a comment saying so, which is why the
  // comments are stripped before looking: a fake refund control is exactly what the audit forbade building.
  const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const source of [route, component, clientState]) {
    assert.equal(/refund/i.test(code(source)), false);
  }
});
