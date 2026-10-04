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
  assert.ok(component.includes("const reversible = provider && current && entry.reversible === true;"), "the server's verdict for this entry, never its kind");
  assert.equal(component.includes("reversibleKinds"), false);
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
  assert.ok(component.includes("cateringBookingAdjustmentsPath(bookingId)") && component.includes("cateringBookingAdjustmentReversePath(bookingId, latestReversalEntry.id)"));
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

test("the refund form states the selected payment's own remainder, disables spent payments, and takes it from the server's payload", () => {
  assert.ok(component.includes("payment.refundableCents ?? 0"));
  assert.ok(component.includes("disabled={(payment.refundableCents ?? 0) === 0}"));
  assert.ok(component.includes("left to record as returned"));
  assert.ok(component.includes("what is left of the selected payment, and never more than the"));
  assert.ok(component.includes("selectedPaymentRefundableCents: paymentId ?"));
  assert.ok(component.includes("cateringRefundLimitForForm(open, limits)"));
  assert.equal(/amountCents\s*[-+]\s*\w*[Rr]efund/.test(component), false, "no refund accounting in React");
});

test("a blocked entry shows no enabled Reverse control and says why, from the server's reason", () => {
  assert.ok(component.includes("entry.reversible === false ? entry.reversalBlockedReason ?? null : null"));
  assert.ok(component.includes("This entry cannot be reversed right now. {blockedReason}"));
  assert.ok(component.includes("{reversible && <Button variant=\"outline\""), "the button exists only for a reversible entry");
  assert.equal(/entry\.kind\s*===\s*"(charge|credit|refund)"[^\n]*Reverse/.test(component), false, "reversibility is never inferred from kind");
});

test("Take back is offered only for a payment the server says is voidable, and a blocked one says why", () => {
  assert.ok(billing.includes('payment.status === "recorded" && payment.voidable === true && <Button'));
  assert.ok(billing.includes('payment.voidable === false && payment.voidBlockedReason && <p'));
  assert.ok(billing.includes("This payment can't be taken back right now. {payment.voidBlockedReason}"));
  assert.equal(/payment\.status === "recorded" && <Button[^\n]*Take back/.test(billing), false, "no unconditional Take back button");
});

test("the amount-due row says what it is: the agreed remainder with no adjustments, the adjusted amount due once the ledger has moved", () => {
  assert.ok(billing.includes("Remaining of the agreed total"));
  assert.ok(billing.includes("Current amount due, with the adjustments recorded on this booking"));
  assert.ok(billing.includes("summary.balanceDueCents !== summary.remainingOfAgreedCents"), "the two server figures differ exactly when the ledger has moved what is due");
  assert.ok(billing.includes("money(summary.balanceDueCents)") && billing.includes("money(summary.remainingOfAgreedCents)"));
  assert.equal(/adjustmentChargesCents\s*[-+]|CreditsCents\s*[-+]/.test(billing), false, "no accounting in React");
});

test("an open form is gated on the latest server action list, closes cleanly when its kind leaves it, and cannot be submitted meanwhile", () => {
  assert.ok(component.includes("const kindStillAllowed = cateringAdjustmentFormStillAllowed(form, allowedKinds);"));
  assert.ok(component.includes("const open = kindStillAllowed ? activeCateringAdjustmentForm(form, identity, provider && current) : null;"), "render-gated: never submittable, even before the reset");
  const effect = component.slice(component.indexOf("useEffect(() => {\n    if (!provider || !current || !actions"), component.indexOf("const mutation = useMutation"));
  for (const part of ["setForm(null);", 'setConfirming((value) => (value?.type === "post" ? null : value));', "setShowErrors(false);", "CATERING_ADJUSTMENT_NO_LONGER_AVAILABLE_MESSAGE"]) assert.ok(effect.includes(part), part);
  assert.ok(component.includes("const confirmPost = () => {\n    if (!open || !check?.ok"), "confirmation cannot proceed without a still-allowed form");
  assert.ok(component.includes("actions.kinds.map((kind) =>"), "only the kinds the server lists are offered as buttons");
  assert.equal(/kinds\s*=\s*\[\s*"(charge|credit|refund)"/.test(component), false, "no UI-only kind list");
});

test("hiding unavailable actions never hides history: the ledger list does not depend on the action list", () => {
  const list = component.slice(component.indexOf("entries.length === 0"), component.indexOf("{provider && current && actions && actions.kinds.length > 0"));
  assert.equal(list.includes("actions.kinds"), false);
  assert.ok(list.includes("entries.map"));
});

test("an open reversal holds only an entry ID and reads every policy-bearing field from the latest payload", () => {
  assert.ok(component.includes('{ type: "reverse"; entryId: string }'), "no frozen entry object in state");
  assert.equal(/type: "reverse"; entry:/.test(component), false);
  assert.ok(component.includes("const latestReversalEntry = reversalEntryId === null ? undefined : billing.adjustments.find((entry) => entry.id === reversalEntryId);"));
  assert.ok(component.includes("const reversalActionable = reversalEntryId !== null && provider && cateringReversalDialogStillActionable(latestReversalEntry);"));
  assert.ok(component.includes("describeCateringReversalConfirmation(latestReversalEntry)"), "the dialog describes the latest entry, not the one it opened with");
  assert.ok(component.includes("latestReversalEntry.id"), "the request names the latest entry's id");
  assert.equal(/confirming\.entry\b/.test(component), false);
});

test("a stale reversal cannot be confirmed, and closing it clears the reason and tells the provider why", () => {
  assert.ok(component.includes('(reverseReason.trim() === "" || !reversalActionable)'), "Confirm is disabled the moment the latest payload says no");
  assert.ok(component.includes("if (!current || pending || reverseReason.trim() === \"\" || !reversalActionable || latestReversalEntry === undefined) return;"));
  const effect = component.slice(component.indexOf("if (reversalEntryId === null || !current || reversalActionable) return;"), component.indexOf("const mutation = useMutation"));
  for (const part of ["setConfirming(null);", 'setReverseReason("");', "cateringReversalNoLongerAvailableMessage(latestReversalEntry)"]) assert.ok(effect.includes(part), part);
  assert.ok(component.includes("const reversible = provider && current && entry.reversible === true;"), "a customer never gets the control");
});

test("the billing card keeps polling a cancelled booking that holds recorded money, from the payload it was handed", () => {
  assert.ok(billing.includes("cateringBillingCanStillChange(polled.state.data?.bookingStatus, polled.state.data)"));
});
