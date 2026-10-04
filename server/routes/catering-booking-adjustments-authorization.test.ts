import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The Phase 2P route surface, held to the authorization and trust rules the earlier phases established. The behaviour is
 * proved over real HTTP in `catering-billing-adjustments-http.test.ts`; this guards the wiring a later edit could break:
 * a route added without `requireAuth`, a booking resolved some other way, or an actor taken from a request body.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-adjustments.ts"), "utf8");
const service = fs.readFileSync(path.join(here, "..", "services", "catering-booking-adjustments.ts"), "utf8");
const index = fs.readFileSync(path.join(here, "index.ts"), "utf8");
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const declarations = [...route.matchAll(/r\.(get|post|put|patch|delete)\("([^"]+)",\s*([A-Za-z]+)/g)].map((match) => ({ method: match[1], path: match[2], middleware: match[3] }));

test("there are exactly two routes, both authenticated, both writes, inside the existing billing namespace", () => {
  assert.deepEqual(declarations.map((d) => `${d.method} ${d.path}`), ["post /bookings/:id/billing/adjustments", "post /bookings/:id/billing/adjustments/:entryId/reverse"]);
  for (const declaration of declarations) assert.equal(declaration.middleware, "requireAuth");
  assert.ok(index.includes('r.use("/catering", cateringBookingAdjustmentsRouter);'));
});

test("the booking is resolved through ownedCateringBooking, and a customer is refused before any write", () => {
  assert.equal((route.match(/ownedCateringBooking\(/g) ?? []).length, 1);
  assert.ok(route.includes("const userId = req.user!.id;"));
  assert.ok(route.includes('if (role !== "provider") { res.status(403)'));
  assert.equal((route.match(/resolveProvider\(req as never, res\)/g) ?? []).length, 2, "every route goes through the one resolver");
});

test("no identity is read from a request body, query or path, and the service re-checks the provider under the lock", () => {
  for (const forbidden of ["req.body.providerId", "req.body.userId", "req.body.role", "req.body.customerId", "body.providerId", "body.role", "req.query"]) assert.equal(route.includes(forbidden), false, forbidden);
  assert.ok(code(service).includes("providerOnly(booking, input.userId)"));
  assert.ok(code(service).includes("lockCateringBilling(tx, input.bookingId);\n  const booking = await lockedBooking(tx, input.bookingId);"), "advisory lock first, then the booking row lock, as Phase 2L does");
});

test("a notification is sent only after commit, only for something new, and a failure cannot undo the write", () => {
  const body = code(route);
  assert.ok(body.includes('if (result.kind === "created") await notifyCustomer('));
  assert.ok(body.includes('if (result.kind === "reversed") await notifyCustomer('));
  assert.ok(body.includes(".catch(() => undefined);"));
  assert.ok(body.indexOf("db.transaction(") < body.indexOf("notifyCustomer(resolved.booking"), "after the transaction has returned");
});

test("every ledger write is judged inside its transaction, and nothing in the route touches a processor or invents a transaction id", () => {
  const all = code(route) + code(service);
  for (const forbidden of ["square", "stripe", "paymentLink", "payout", "transactionId", "processorPaymentId", "refundPayment"]) assert.equal(all.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  assert.ok(code(service).includes("resolveCateringAdjustment("));
  assert.ok(code(service).includes("resolveCateringAdjustmentReversal("));
});

test("the ledger is never deleted from or updated outside a reversal", () => {
  const all = code(route) + code(service);
  assert.equal(/\.delete\(cateringBookingAdjustments\)/.test(all), false);
  const updates = all.match(/\.update\(cateringBookingAdjustments\)/g) ?? [];
  assert.equal(updates.length, 1, "the one reversal update");
  assert.ok(all.includes('.set({ status: "reversed"'));
});
