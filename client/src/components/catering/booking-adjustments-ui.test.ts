import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The Phase 2P section is held to its UI contract against the component's own source, as the other billing sections are
 * in this suite: the repository has no DOM harness, so what is checked is what the markup and the wiring promise --
 * mobile-sized controls, labelled fields, an accessible confirmation, the external-refund disclaimer, scoped cache writes.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingAdjustments.tsx"), "utf8");
const billing = fs.readFileSync(path.join(here, "BookingBilling.tsx"), "utf8");
const server = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-adjustments.ts"), "utf8");
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("it lives inside the EXISTING billing card, not in a separate financial dashboard", () => {
  assert.ok(billing.includes('import BookingAdjustments from "./BookingAdjustments";'));
  assert.ok(billing.includes("<BookingAdjustments bookingId={bookingId} userId={userId} role={role} billing={billing} />"));
  assert.equal(/\/finance|dashboard/i.test(code(component)), false);
});

test("the provider's actions are labelled by what they do, and a refund is a RECORD of money returned outside ChefSire", () => {
  assert.ok(component.includes("CATERING_ADJUSTMENT_ACTION_LABEL[kind]"));
  assert.ok(component.includes("CATERING_REFUND_DISCLOSURE.helper"), "the disclaimer is on screen for the provider");
  assert.ok(component.includes("CATERING_REFUND_DISCLOSURE.customer"), "and for the customer");
  assert.ok(component.includes("Refunds recorded (returned outside ChefSire)"));
  const text = code(component);
  for (const forbidden of [/refund successful/i, /refunded to your card/i, />\s*Fix\s*</, /\bprocessed\b/i, /Pay now|Refund now|Issue refund/i]) assert.equal(forbidden.test(text), false, String(forbidden));
});

test("every field has a bound label, errors are announced, and money is read as text with a sign and a word", () => {
  for (const id of ["adjustment-amount", "adjustment-reason", "adjustment-payment", "adjustment-reference"]) {
    assert.ok(component.includes(`htmlFor={\`${id}-\${bookingId}\`}`), `label for ${id}`);
    assert.ok(component.includes(`id={\`${id}-\${bookingId}\`}`), `control ${id}`);
  }
  assert.ok(component.includes('role={showErrors && check?.ok === false && check.field === "amount" ? "alert" : undefined}'));
  assert.ok(component.includes("aria-invalid="));
  assert.ok(component.includes("aria-describedby="));
  assert.ok(component.includes("cateringAdjustmentAmountText(entry)"), "a sign, not only a colour");
  assert.ok(component.includes("cateringAdjustmentEffectSentence(entry, role)"), "one sentence for assistive technology");
  assert.ok(component.includes("CATERING_ADJUSTMENT_STATUS_LABEL[entry.status]"), "status in words");
  assert.ok(component.includes('aria-label="Adjustment history, oldest first"'));
  assert.equal(/text-(red|green)-\d/.test(component), false, "no colour classes carrying meaning");
});

test("it works on a phone: 44px controls, no table, wrapping text, stacked layout", () => {
  assert.equal(/<table|<thead|<tr[ >]/.test(component), false, "no desktop-only financial table");
  const buttons = [...component.matchAll(/<Button\b[^>]*>/g)].map((match) => match[0]);
  assert.ok(buttons.length >= 5);
  for (const button of buttons) assert.ok(button.includes("min-h-11") || /className="[^"]*min-h-11/.test(button), button.slice(0, 80));
  for (const control of component.match(/<Input\b[^>]*>/g) ?? []) assert.ok(control.includes("min-h-11"), control.slice(0, 80));
  assert.ok(component.includes("break-words"), "long reasons wrap");
  assert.ok(component.includes("tabular-nums"));
  assert.ok(component.includes("grid gap-3 sm:grid-cols-2"), "one column below sm");
  assert.ok(component.includes("flex flex-wrap"));
});

test("a financial write is confirmed in an accessible dialog that states its effect, and reversal needs a reason", () => {
  assert.ok(component.includes("<AlertDialog open={confirmation !== null}"), "a focus-trapping alert dialog, not window.confirm");
  assert.equal(component.includes("window.confirm"), false);
  assert.ok(component.includes("<AlertDialogTitle>{confirmation.title}</AlertDialogTitle>"));
  assert.ok(component.includes("<AlertDialogDescription>{confirmation.effect}</AlertDialogDescription>"));
  assert.ok(component.includes("confirmation.lines.map"), "type, amount, currency and reason are listed");
  assert.ok(component.includes("<AlertDialogCancel"));
  assert.ok(component.includes('reverseReason.trim() === ""'), "a reversal cannot be confirmed without its reason");
  assert.ok(component.includes('variant={confirming?.type === "reverse" ? "destructive" : "default"}'), "reversal is visibly dangerous");
  assert.ok(component.includes("disabled={pending"), "pending state disables the confirm");
  assert.ok(component.includes('{pending ? "Saving…"'), "and says it is saving");
});

test("the customer is read-only: no control exists for them, and an empty state is explained", () => {
  assert.ok(component.includes("provider && current && actions && actions.kinds.length > 0 && !open"));
  assert.ok(component.includes("const reversible = provider && current"));
  assert.ok(component.includes("{provider && entry.reference &&"), "the provider's note is theirs alone");
  assert.ok(component.includes("No additional charges, credits or refunds have been recorded on this booking."));
  assert.ok(component.includes("You have not recorded any charge, credit or refund on this booking."));
  assert.ok(component.includes("A refund may be due"));
  assert.ok(component.includes("It is not a refund until they record that they returned it."));
});

test("no balance is computed in React: the component sums nothing and renders only the server's derived figures", () => {
  const text = code(component);
  assert.equal(/\.reduce\(/.test(text), false);
  assert.equal(/Cents\s*[-+*/]\s*\w*Cents|Cents\s*[-+]\s*\d/.test(text), false, "no arithmetic on cents");
  for (const field of ["originalAgreedCents", "adjustmentChargesCents", "adjustmentCreditsCents", "obligationCents", "paidTotalCents", "refundsRecordedCents", "netReceivedCents", "balanceDueCents", "refundPotentiallyDueCents"]) assert.ok(text.includes(`summary.${field}`), field);
});

test("cache writes are actor- and resource-scoped, the response is installed whole, and the cache is never cleared", () => {
  const text = code(component);
  assert.ok(text.includes("cache.setQueryData(cateringBookingBillingKey(variables.userId, variables.bookingId)"));
  assert.ok(text.includes("cateringAdjustmentInvalidationKeys({ surfaceUserId: variables.userId, bookingId: variables.bookingId })"));
  for (const broad of ["cache.clear(", "removeQueries()", "resetQueries()", "invalidateQueries()", "queryClient.clear"]) assert.equal(text.includes(broad), false, broad);
  assert.ok(text.includes("isCurrentCateringAdjustmentTarget(identityRef.current, variables.started)"), "a stale response is dropped");
  assert.ok(text.includes("identityRef.current = identity;"), "identity is assigned during render, not in an effect");
});

test("every request is a JSON POST to a route the server registers, and a lost response keeps the form and its key", () => {
  for (const [method, route] of [["post", "/bookings/:id/billing/adjustments"], ["post", "/bookings/:id/billing/adjustments/:entryId/reverse"]]) assert.ok(server.includes(`r.${method}("${route}"`), route);
  assert.ok(component.includes('method: "POST"'));
  assert.ok(component.includes('"Content-Type": "application/json"'));
  assert.ok(component.includes("cateringBookingAdjustmentsPath(bookingId)") && component.includes("cateringBookingAdjustmentReversePath(bookingId, entry.id)"));
  assert.ok(component.includes("offline: true"), "a transport failure is retryable");
  assert.ok(component.includes("INDETERMINATE"), "an unreadable 2xx is not treated as success");
  assert.ok(component.includes("settleCateringAdjustmentForm(open, variables.started, variables.submitted!, newKey())"));
});

test("the request body never names an actor", () => {
  const text = code(component);
  for (const forbidden of ["providerId", "customerId", "recordedBy", "userId:", "role:"]) assert.equal(new RegExp(`body[^\\n]*${forbidden}`).test(text), false, forbidden);
});

test("the billing card states the payable cap, offers no payment at a zero cap, and says why", () => {
  assert.ok(billing.includes("cateringPaymentCap(invoice) > 0 && <Button"), "Record a payment is offered only while something may be recorded");
  assert.ok(billing.includes("cateringPaymentCap(invoice) === 0"));
  assert.ok(billing.includes("your customer now owes nothing further on this booking"));
  assert.ok(billing.includes('aria-describedby="catering-payment-amount-help"'));
  assert.ok(billing.includes("because credits have reduced what your customer owes"));
  assert.equal(/remainingCents\s*[-+]/.test(billing), false, "no accounting in React");
});

test("a refund-created request is called a further balance request, never a new charge, and the note says what stays untouched", () => {
  assert.ok(billing.includes('"Further balance request"'));
  assert.ok(billing.includes('"Request further balance"'));
  assert.equal(billing.includes("Added since the balance"), false);
  assert.ok(billing.includes('kind === "adjustment" && <p className="w-full text-xs text-muted-foreground">'));
  assert.ok(billing.includes("Your earlier requests, payments and records stay exactly as they are."));
  assert.equal(/card|charged|processor|Stripe|Square/i.test(billing.slice(billing.indexOf("This asks for the part of the balance"), billing.indexOf("stay exactly as they are."))), false, "no processor implication");
});

test("overdue is shown only from the server's derived flags, never recomputed in React", () => {
  assert.ok(billing.includes("summary.hasOverdue"));
  assert.ok(billing.includes("invoice.overdue"));
  assert.equal(/dueOn\s*[<>]|asOfDate\s*[<>]|new Date\(\)/.test(billing.replace(/\/\*[\s\S]*?\*\//g, "")), false);
});
