import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The Phase 2L route surface, held to the authorization and trust rules the earlier phases established.
 *
 * There is no HTTP or database harness in this suite -- the catering tests are structural and unit-level
 * throughout -- so the guarantees that live in the wiring are asserted against the route file's own source. That
 * is weaker than a live request, and it is exactly what catches the class of mistake that matters here: a route
 * added later that forgets `requireAuth`, resolves a booking some other way, or accepts an amount from a client.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-billing.ts"), "utf8");
const shared = fs.readFileSync(path.join(here, "..", "..", "shared", "catering-booking-billing.ts"), "utf8");
const index = fs.readFileSync(path.join(here, "index.ts"), "utf8");

/** Every route declaration in the file, as `METHOD path` with the middleware that follows it. */
const declarations = [...route.matchAll(/r\.(get|post|put|patch|delete)\("([^"]+)",\s*([A-Za-z]+)/g)]
  .map((match) => ({ method: match[1], path: match[2], middleware: match[3] }));

test("every route is authenticated, and there are no others", () => {
  assert.equal(declarations.length, 6, declarations.map((d) => `${d.method} ${d.path}`).join(", "));
  for (const declaration of declarations) {
    assert.equal(declaration.middleware, "requireAuth", `${declaration.method} ${declaration.path}`);
  }
});

test("the surface is one read and five provider mutations, inside the existing catering namespace", () => {
  assert.deepEqual(declarations.map((d) => `${d.method} ${d.path}`), [
    "get /bookings/:id/billing",
    "put /bookings/:id/billing/deposit-terms",
    "post /bookings/:id/billing/invoices",
    "post /bookings/:id/billing/invoices/:invoiceId/void",
    "post /bookings/:id/billing/payments",
    "post /bookings/:id/billing/payments/:paymentId/void",
  ]);
  assert.ok(index.includes('r.use("/catering", cateringBookingBillingRouter);'), "mounted in the existing namespace");
});

test("every route resolves its booking through ownedCateringBooking and nothing else", () => {
  assert.ok(route.includes("const booking = await ownedCateringBooking(id, userId);"));
  // Every route goes through the one request resolver, and the ONLY way a booking row is obtained anywhere in the
  // file is `ownedCateringBooking` -- once there, and once when a mutation re-reads it to answer with a fresh view.
  assert.equal((route.match(/resolveRequest\(req as never, res,/g) ?? []).length, 6);
  const lookups = [...route.matchAll(/await (\w+)\((?:id|resolved\.id)[,)]/g)].map((match) => match[1]);
  for (const lookup of lookups) {
    assert.ok(["ownedCateringBooking", "billingRows", "lockBilling", "lockedBooking"].includes(lookup), lookup);
  }
  assert.equal((route.match(/ownedCateringBooking\(/g) ?? []).length, 2);
  // And the re-read is scoped to the acting user exactly as the first one is, so it cannot widen access.
  assert.ok(route.includes("await ownedCateringBooking(resolved.id, resolved.userId)"));
});

test("the actor is the session and never the request", () => {
  assert.ok(route.includes("const userId = req.user!.id;"));
  for (const forbidden of ["req.body.providerId", "req.body.customerId", "req.body.userId", "req.body.role", "req.body.actorId", "body.providerId", "body.customerId", "body.role"]) {
    assert.equal(route.includes(forbidden), false, forbidden);
  }
});

test("an unresolvable booking is a 404 with one message, so a guessed id reveals nothing", () => {
  assert.ok(route.includes("if (!booking) { refuse(res, CATERING_BILLING_NOT_FOUND_REFUSAL); return null; }"));
  assert.ok(route.includes('message: "Booking billing not found"') || fs.readFileSync(path.join(here, "..", "services", "catering-booking-billing-policy.ts"), "utf8").includes('message: "Booking billing not found"'));
});

test("every mutation is guarded before its transaction AND again against the locked booking", () => {
  assert.ok(route.includes("const guard = cateringBillingGuard(booking, userId);"));
  // Five transactions, each re-reading the booking under its row lock and refusing a cancellation that landed in
  // between. The early guard alone would be a check against a row the write never sees again.
  assert.equal((route.match(/const locked = await lockedBooking\(tx, id\);/g) ?? []).length, 4);
  assert.equal((route.match(/const booking = await lockedBooking\(tx, id\);/g) ?? []).length, 1);
  assert.equal((route.match(/status === "cancelled"\) return \{ kind: "not_available" \}/g) ?? []).length, 5);
});

test("every mutation serializes on the booking's own advisory lock", () => {
  assert.equal((route.match(/await lockBilling\(tx, id\);/g) ?? []).length, 5);
  assert.ok(route.includes("pg_advisory_xact_lock(hashtext(${`catering-billing:${bookingId}`}))"), "named per booking");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * What a client may never send
 * ------------------------------------------------------------------------------------------------------------- */

test("issuing an invoice has no amount field, in the schema or the route", () => {
  const schema = shared.slice(shared.indexOf("export const cateringInvoiceIssueSchema"));
  const body = schema.slice(0, schema.indexOf("}).strict();") + 12);
  assert.ok(body.includes("kind: z.enum(CATERING_INVOICE_KINDS)"));
  assert.ok(body.includes("dueOn:"));
  for (const forbidden of ["amount", "amountCents", "total", "currency"]) {
    assert.equal(body.includes(forbidden), false, forbidden);
  }
  // And the route derives it, under the lock, from the booking's own agreed price.
  assert.ok(route.includes("const amountCents = cateringInvoiceAmountFor(body.kind as CateringInvoiceKind, facts);"));
});

test("every request schema is strict, so an unexpected key is a 400 rather than something ignored", () => {
  const schemas = [...shared.matchAll(/export const (catering\w+Schema) = z\.object\(/g)].map((match) => match[1]);
  assert.ok(schemas.length >= 5, schemas.join(", "));
  for (const name of schemas) {
    const from = shared.indexOf(`export const ${name} = z.object(`);
    const strict = shared.indexOf("}).strict();", from);
    const nextExport = shared.indexOf("\nexport ", from + 1);
    assert.notEqual(strict, -1, name);
    assert.ok(nextExport === -1 || strict < nextExport, `${name} is not strict`);
  }
});

test("the currency is the booking's own on every write, never the client's", () => {
  // No request schema has a currency field, and no assignment anywhere reads one from a body. Every currency
  // written or reported comes from the locked booking or from the row it describes.
  assert.equal(shared.slice(shared.indexOf("export const cateringPaymentRecordSchema")).slice(0, 600).includes("currency"), false);
  assert.equal(route.includes("currency: body."), false);
  // Comments stripped, and a word boundary, so "concurrency: allocating..." in a comment is not read as an
  // assignment of a currency.
  const body = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const assignment of [...body.matchAll(/\bcurrency: ([\w.]+)/g)].map((match) => match[1])) {
    assert.ok(["locked.currency", "invoice.currency", "payment.currency", "cateringBookings.currency", "string"].includes(assignment), assignment);
  }
  // Both writes -- the invoice and the payment -- take it from the locked booking, and so does the resolution that
  // bounds a payment and the activity metadata that reports one.
  assert.equal((body.match(/currency: locked\.currency/g) ?? []).length, 5);
  for (const insert of ["await tx.insert(cateringBookingInvoices).values({", "await tx.insert(cateringBookingPayments).values({"]) {
    const from = body.indexOf(insert);
    assert.notEqual(from, -1, insert);
    assert.ok(body.slice(from, body.indexOf("});", from)).includes("currency: locked.currency"), insert);
  }
});

test("a payment's amount is bounded server-side before anything is credited", () => {
  assert.ok(route.includes("const resolution = resolveCateringPayment({"));
  // The RESOLVED amount is what is written. The client's own figure is parsed in exactly two places, and neither
  // of them is a write: once as an input to the resolver that bounds it, and once to compare a replayed request
  // against the payment it claims to be repeating.
  assert.ok(route.includes("amountCents: resolution.amountCents"));
  assert.equal((route.match(/amountCents: cateringMoneyToCents\(body\.amount\)/g) ?? []).length, 2);
  assert.ok(route.includes("const resolution = resolveCateringPayment({"));
  assert.ok(route.includes("cateringPaymentReplayMatches("));
  const insert = route.slice(route.indexOf("await tx.insert(cateringBookingPayments).values({"));
  const values = insert.slice(0, insert.indexOf("});"));
  assert.equal(values.includes("body.amount"), false, "the client's figure never reaches the ledger");
});

test("no route accepts a payment status, a paid flag or a processor identity from a client", () => {
  for (const forbidden of ["body.status", "body.paid", "body.processor", "body.processorPaymentId", "body.succeeded", "body.state"]) {
    assert.equal(route.includes(forbidden), false, forbidden);
  }
  // The source is written as a constant, so nothing a client sends can make a row claim to be processor-backed.
  assert.ok(route.includes('paymentSource: "provider_recorded"'));
});

test("nothing in this phase writes to catering_bookings", () => {
  // The booking is read and row-locked, and that is all. No Phase 2G status is moved by any financial action.
  assert.equal(route.includes("update(cateringBookings)"), false);
  assert.equal(route.includes("insert(cateringBookings)"), false);
  assert.equal(/FOR UPDATE/.test(route), true, "read and locked, never written");
});

test("no earlier phase's route file imports anything from Phase 2L", () => {
  // Billing depends on the earlier phases; none of them depends on billing. That one-way direction is what keeps a
  // Phase 2L change from being able to alter Phase 2G, 2H, 2I, 2J or 2K behaviour at all.
  for (const file of ["catering-bookings.ts", "catering-booking-operations.ts", "catering-booking-communication.ts", "catering-booking-execution.ts", "catering-booking-closeout.ts"]) {
    const full = path.join(here, file);
    if (!fs.existsSync(full)) continue;
    const source = fs.readFileSync(full, "utf8");
    assert.equal(source.includes("catering-booking-billing"), false, file);
  }
});
