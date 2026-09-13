import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_FINANCIAL_STATUSES,
  CATERING_FINANCIAL_STATUS_COPY,
  cateringDepositRequirement,
  cateringInvoiceAmountFor,
  cateringInvoiceHeadroomCents,
  cateringInvoiceState,
  cateringIssuableInvoiceKinds,
  cateringIssuanceKeepsPartition,
  deriveCateringBillingSummary,
  type CateringBillingFacts,
  type CateringFinancialStatus,
  type CateringInvoiceFact,
  type CateringPaymentFact,
} from "./catering-booking-billing";
import { resolveCateringPayment } from "../server/services/catering-booking-billing-policy";

/**
 * THE STATUS MATRIX: every combination of invoices and payments, and the one sentence each produces.
 *
 * This exists because arithmetic and language came apart. A provider whose deposit was paid, with the balance not
 * yet invoiced, was reported `balance_due` -- whose copy tells both parties the balance "has been requested". It
 * had not been: the provider was still being offered the button to request it, and the customer was being told to
 * pay something nobody had asked them for.
 *
 * So the rule is stated as a table, driven through the real derivation, and every row asserts the status AND that
 * the provider's available actions do not contradict the sentence the customer is shown. A future status that
 * recreates the mismatch has to get past this file to do it.
 */

const TOTAL = 200_000;
const TODAY = "2026-09-13";
const invoice = (patch: Partial<CateringInvoiceFact> = {}): CateringInvoiceFact =>
  ({ id: "inv-1", number: 1, kind: "deposit", amountCents: 50_000, currency: "USD", status: "issued", dueOn: null, issuedAt: "2026-09-01T00:00:00.000Z", ...patch });
const payment = (patch: Partial<CateringPaymentFact> = {}): CateringPaymentFact =>
  ({ id: "pay-1", invoiceId: "inv-d", amountCents: 50_000, currency: "USD", method: "cash", source: "provider_recorded", status: "recorded", receivedOn: "2026-09-02", ...patch });
const deposit = (patch: Partial<CateringInvoiceFact> = {}) => invoice({ id: "inv-d", number: 1, kind: "deposit", amountCents: 50_000, ...patch });
const balance = (patch: Partial<CateringInvoiceFact> = {}) => invoice({ id: "inv-b", number: 2, kind: "balance", amountCents: 150_000, ...patch });
const facts = (patch: Partial<CateringBillingFacts> = {}): CateringBillingFacts => ({
  bookingStatus: "confirmed", agreedTotalCents: TOTAL, currency: "USD",
  terms: { mode: "percentage", amountCents: null, percentBasisPoints: 2_500, dueOn: null },
  invoices: [], payments: [], asOfDate: TODAY, ...patch,
});

type Row = {
  name: string;
  state: CateringBillingFacts;
  status: CateringFinancialStatus;
  /** Whether a LIVE, payable invoice of that kind actually exists -- what "requested" has to be backed by. */
  liveDepositPayable: boolean;
  liveBalancePayable: boolean;
};

const MATRIX: Row[] = [
  {
    name: "no agreed price at all",
    state: facts({ agreedTotalCents: null }),
    status: "not_configured", liveDepositPayable: false, liveBalancePayable: false,
  },
  {
    // Zero is a real agreed price, and a booking at it owes nothing. Checked before any `paid >= total` arithmetic,
    // which would otherwise report it as settled with nothing invoiced and nothing recorded.
    name: "a complimentary booking: the agreed price is zero",
    state: facts({ agreedTotalCents: 0 }),
    status: "no_payment_required", liveDepositPayable: false, liveBalancePayable: false,
  },
  {
    // Counterfactual rows on a zero-dollar booking cannot arise through any Phase 2L write path -- an invoice and a
    // payment both need a positive amount -- but the derivation must not crash or change its answer if they exist.
    name: "a complimentary booking with counterfactual history",
    state: facts({ agreedTotalCents: 0, invoices: [deposit({ status: "void" })] }),
    status: "no_payment_required", liveDepositPayable: false, liveBalancePayable: false,
  },
  {
    name: "agreed price, nothing asked for",
    state: facts(),
    status: "not_invoiced", liveDepositPayable: false, liveBalancePayable: false,
  },
  {
    name: "deposit issued, unpaid",
    state: facts({ invoices: [deposit()] }),
    status: "deposit_due", liveDepositPayable: true, liveBalancePayable: false,
  },
  {
    name: "deposit issued, part paid",
    state: facts({ invoices: [deposit()], payments: [payment({ amountCents: 20_000 })] }),
    status: "deposit_due", liveDepositPayable: true, liveBalancePayable: false,
  },
  {
    name: "deposit fully paid, balance NOT yet requested",
    state: facts({ invoices: [deposit()], payments: [payment()] }),
    status: "balance_not_requested", liveDepositPayable: false, liveBalancePayable: false,
  },
  {
    name: "deposit fully paid, balance requested and unpaid",
    state: facts({ invoices: [deposit(), balance()], payments: [payment()] }),
    status: "balance_due", liveDepositPayable: false, liveBalancePayable: true,
  },
  {
    name: "balance requested and part paid",
    state: facts({ invoices: [deposit(), balance()], payments: [payment(), payment({ id: "pay-2", invoiceId: "inv-b", amountCents: 40_000 })] }),
    status: "balance_due", liveDepositPayable: false, liveBalancePayable: true,
  },
  {
    name: "everything requested and everything paid",
    state: facts({ invoices: [deposit(), balance()], payments: [payment(), payment({ id: "pay-2", invoiceId: "inv-b", amountCents: 150_000 })] }),
    status: "settled", liveDepositPayable: false, liveBalancePayable: false,
  },
  {
    name: "balance withdrawn while money remains",
    state: facts({ invoices: [deposit(), balance({ status: "void" })], payments: [payment()] }),
    status: "balance_not_requested", liveDepositPayable: false, liveBalancePayable: false,
  },
  {
    name: "a payment was taken back, so its invoice is payable again",
    state: facts({ invoices: [deposit()], payments: [payment({ status: "voided" })] }),
    status: "deposit_due", liveDepositPayable: true, liveBalancePayable: false,
  },
  {
    // Requests WERE made. "Nothing requested yet" would contradict the withdrawal rows rendered below the summary.
    name: "every invoice withdrawn, nothing credited",
    state: facts({ invoices: [deposit({ status: "void" }), balance({ status: "void" })] }),
    status: "no_active_invoice", liveDepositPayable: false, liveBalancePayable: false,
  },
  {
    name: "a single deposit issued and then withdrawn",
    state: facts({ invoices: [deposit({ status: "void" })] }),
    status: "no_active_invoice", liveDepositPayable: false, liveBalancePayable: false,
  },
  {
    // Its payments had to be taken back before it could be withdrawn, so nothing is credited and money remains.
    name: "a paid deposit whose payment and invoice were both taken back",
    state: facts({ invoices: [deposit({ status: "void" })], payments: [payment({ status: "voided" })] }),
    status: "no_active_invoice", liveDepositPayable: false, liveBalancePayable: false,
  },
  {
    // Everything owed is credited, so the agreement is finished however its invoices ended up.
    name: "the agreed total fully credited, with no live invoice left",
    state: facts({
      agreedTotalCents: 50_000,
      invoices: [deposit()],
      payments: [payment()],
    }),
    status: "settled", liveDepositPayable: false, liveBalancePayable: false,
  },
  {
    name: "no deposit configured: one balance for the whole total, unpaid",
    state: facts({ terms: { mode: "none", amountCents: null, percentBasisPoints: null, dueOn: null }, invoices: [balance({ amountCents: TOTAL })] }),
    status: "balance_due", liveDepositPayable: false, liveBalancePayable: true,
  },
  {
    name: "no deposit configured: that balance paid in full",
    state: facts({
      terms: { mode: "none", amountCents: null, percentBasisPoints: null, dueOn: null },
      invoices: [balance({ amountCents: TOTAL })],
      payments: [payment({ invoiceId: "inv-b", amountCents: TOTAL })],
    }),
    status: "settled", liveDepositPayable: false, liveBalancePayable: false,
  },
];

/* ------------------------------------------------------------------------------------------------------------- *
 * The matrix
 * ------------------------------------------------------------------------------------------------------------- */

for (const row of MATRIX) {
  test(`status: ${row.name}`, () => {
    assert.equal(deriveCateringBillingSummary(row.state).status, row.status);
  });
}

test("a status that says something was REQUESTED is always backed by a live payable invoice of that kind", () => {
  for (const row of MATRIX) {
    const summary = deriveCateringBillingSummary(row.state);
    if (summary.status === "deposit_due") assert.ok(row.liveDepositPayable, `${row.name}: deposit_due with no payable deposit`);
    if (summary.status === "balance_due") assert.ok(row.liveBalancePayable, `${row.name}: balance_due with no payable balance`);
    // And the converse: a payable live invoice is never described as not requested.
    if (row.liveBalancePayable) assert.notEqual(summary.status, "balance_not_requested", row.name);
    if (row.liveDepositPayable) assert.notEqual(summary.status, "balance_not_requested", row.name);
  }
});

test("no status claims money was requested while nothing is outstanding on an invoice", () => {
  for (const row of MATRIX) {
    const summary = deriveCateringBillingSummary(row.state);
    if (summary.outstandingInvoicedCents === 0) {
      assert.equal(summary.status === "deposit_due" || summary.status === "balance_due", false, row.name);
      // The affirmative claims, taken verbatim from the two `*_due` copies: those sentences may only be shown
      // where something really is outstanding. "Nothing has been requested yet" is the opposite claim and is fine.
      const copy = CATERING_FINANCIAL_STATUS_COPY[summary.status];
      for (const line of [copy.customer, copy.provider]) {
        for (const affirmative of ["has asked you for", "has been requested and is not fully covered"]) {
          assert.equal(line.includes(affirmative), false, `${row.name}: ${line}`);
        }
      }
    }
  }
});

test("the provider's actions never contradict the sentence the customer is shown", () => {
  for (const row of MATRIX) {
    const summary = deriveCateringBillingSummary(row.state);
    const issuable = cateringIssuableInvoiceKinds(row.state);
    // "Balance due" and "Request balance" together would tell the provider the thing they are about to ask for has
    // already been asked for. It is exactly the contradiction the old status produced.
    if (summary.status === "balance_due") assert.equal(issuable.includes("balance"), false, `${row.name}: balance_due AND Request balance`);
    if (summary.status === "deposit_due") assert.equal(issuable.includes("deposit"), false, `${row.name}: deposit_due AND Request deposit`);
    // And the uninvoiced state is exactly where the button belongs.
    if (summary.status === "balance_not_requested") assert.deepEqual(issuable, ["balance"], row.name);
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The new status specifically
 * ------------------------------------------------------------------------------------------------------------- */

test("balance_not_requested tells both sides the truth: money remains, nobody has asked", () => {
  const copy = CATERING_FINANCIAL_STATUS_COPY.balance_not_requested;
  assert.equal(copy.label, "Balance not requested yet");
  assert.equal(copy.provider, "A remaining balance is still available to request.");
  assert.equal(copy.customer, "A remaining balance remains, but your caterer has not requested it yet.");
  // Never the old sentence, which was the actual defect.
  assert.notEqual(copy.customer, CATERING_FINANCIAL_STATUS_COPY.balance_due.customer);
  assert.equal(copy.customer.includes("has asked you"), false);
});

test("the totals under it are unchanged and still come from the ledger", () => {
  const state = facts({ invoices: [deposit()], payments: [payment()] });
  const summary = deriveCateringBillingSummary(state);
  assert.equal(summary.status, "balance_not_requested");
  assert.equal(summary.paidTotalCents, 50_000);
  assert.equal(summary.invoicedTotalCents, 50_000);
  assert.equal(summary.outstandingInvoicedCents, 0, "nothing is outstanding, because nothing is being asked for");
  assert.equal(summary.remainingOfAgreedCents, 150_000, "but money remains under the agreement");
  assert.equal(summary.uninvoicedCents, 150_000);
  assert.equal(summary.nextAmountDueCents, null, "and there is no next payment, because none has been requested");
  assert.equal(summary.nextDueOn, null);
});

test("issuing the balance moves it to balance_due, and paying that moves it to settled", () => {
  const afterDeposit = facts({ invoices: [deposit()], payments: [payment()] });
  assert.equal(deriveCateringBillingSummary(afterDeposit).status, "balance_not_requested");
  const afterIssue = facts({ invoices: [deposit(), balance()], payments: [payment()] });
  assert.equal(deriveCateringBillingSummary(afterIssue).status, "balance_due");
  assert.equal(deriveCateringBillingSummary(afterIssue).nextAmountDueCents, 150_000);
  const afterPaid = facts({ invoices: [deposit(), balance()], payments: [payment(), payment({ id: "pay-2", invoiceId: "inv-b", amountCents: 150_000 })] });
  assert.equal(deriveCateringBillingSummary(afterPaid).status, "settled");
});

test("every status in the enum is reachable through the derivation", () => {
  const reached = new Set(MATRIX.map((row) => deriveCateringBillingSummary(row.state).status));
  for (const status of CATERING_FINANCIAL_STATUSES) {
    assert.ok(reached.has(status), `${status} is never produced -- either the matrix or the enum is wrong`);
  }
});

test("every status has copy for both actors, and none of it is empty", () => {
  for (const status of CATERING_FINANCIAL_STATUSES) {
    const copy = CATERING_FINANCIAL_STATUS_COPY[status];
    for (const line of [copy.label, copy.provider, copy.customer]) {
      assert.ok(typeof line === "string" && line.trim().length > 0, status);
    }
    // ChefSire processes nothing, so no status may imply that it did.
    for (const forbidden of ["processed", "captured", "charged", "refund", "we have taken", "we received"]) {
      assert.equal(`${copy.provider} ${copy.customer}`.toLowerCase().includes(forbidden), false, `${status}: ${forbidden}`);
    }
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Nothing is persisted
 * ------------------------------------------------------------------------------------------------------------- */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(path.join(repoRoot, "server", "migrations", "20260913_catering_booking_billing.sql"), "utf8");

test("no financial status column was introduced, and none could be", () => {
  const ddl = migration.replace(/^\s*--.*$/gm, "");
  for (const forbidden of ["financial_status", "balance_not_requested", "balance_due", "settled", "not_invoiced"]) {
    assert.equal(ddl.includes(forbidden), false, forbidden);
  }
  // The statuses are a function of the rows, so a stored copy is the one thing that could disagree with them.
  const contract = fs.readFileSync(path.join(repoRoot, "shared", "catering-booking-billing.ts"), "utf8");
  assert.ok(contract.includes("function deriveCateringFinancialStatus("));
});

test("the invoice states the statuses are built on are still derived too", () => {
  assert.equal(cateringInvoiceState(deposit(), []), "issued");
  assert.equal(cateringInvoiceState(deposit(), [payment()]), "paid");
  assert.equal(cateringInvoiceState(deposit({ status: "void" }), [payment()]), "void");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Temporal accuracy: what the summary says about time must match what the history shows
 * ------------------------------------------------------------------------------------------------------------- */

test("'yet' is only ever used where nothing of that kind has EVER happened", () => {
  for (const row of MATRIX) {
    const summary = deriveCateringBillingSummary(row.state);
    const copy = CATERING_FINANCIAL_STATUS_COPY[summary.status];
    const everInvoiced = row.state.invoices.length > 0;
    for (const line of [copy.customer, copy.provider]) {
      // "Nothing has been requested yet" above a list of withdrawn requests is the contradiction this pins.
      if (everInvoiced) assert.equal(/not asked you for anything yet|Nothing has been requested from your customer yet/.test(line), false, `${row.name}: ${line}`);
    }
    // And the converse: a booking that really has never been invoiced is allowed to say so.
    if (!everInvoiced && summary.status === "not_invoiced") assert.ok(copy.customer.includes("yet"), row.name);
  }
});

test("no_active_invoice says what is true now and points at the history below it", () => {
  const copy = CATERING_FINANCIAL_STATUS_COPY.no_active_invoice;
  assert.equal(copy.label, "No active request");
  assert.match(copy.provider, /no active payment request right now/);
  assert.match(copy.customer, /no active payment request right now/);
  for (const line of [copy.provider, copy.customer]) {
    assert.match(line, /history below/, "so the withdrawn rows are explained rather than contradicted");
    assert.equal(line.includes("yet"), false, "nothing is pending; requests were made and taken back");
  }
});

test("not_invoiced and no_active_invoice are never confused for each other", () => {
  const never = facts();
  const withdrawn = facts({ invoices: [deposit({ status: "void" })] });
  assert.equal(deriveCateringBillingSummary(never).status, "not_invoiced");
  assert.equal(deriveCateringBillingSummary(withdrawn).status, "no_active_invoice");
  // Both have nothing live and nothing credited; only the history tells them apart.
  for (const state of [never, withdrawn]) {
    const summary = deriveCateringBillingSummary(state);
    assert.equal(summary.invoicedTotalCents, 0);
    assert.equal(summary.paidTotalCents, 0);
    assert.equal(summary.outstandingInvoicedCents, 0);
  }
});

test("withdrawing the only live invoice moves the status from due to no_active_invoice, not back to never", () => {
  assert.equal(deriveCateringBillingSummary(facts({ invoices: [deposit()] })).status, "deposit_due");
  assert.equal(deriveCateringBillingSummary(facts({ invoices: [deposit({ status: "void" })] })).status, "no_active_invoice");
  // And reissuing brings it back, because the slot the unique index guards is free again.
  assert.deepEqual(cateringIssuableInvoiceKinds(facts({ invoices: [deposit({ status: "void" })] })), ["deposit", "balance"]);
});

test("settled outranks having nothing live, so a fully credited agreement is not called inactive", () => {
  const paidInFull = facts({ agreedTotalCents: 50_000, invoices: [deposit()], payments: [payment()] });
  assert.equal(deriveCateringBillingSummary(paidInFull).status, "settled");
  assert.equal(deriveCateringBillingSummary(paidInFull).remainingOfAgreedCents, 0);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Zero-dollar bookings
 * ------------------------------------------------------------------------------------------------------------- */

const complimentary = facts({ agreedTotalCents: 0 });

test("a zero-dollar booking is no_payment_required, and never settled", () => {
  const summary = deriveCateringBillingSummary(complimentary);
  assert.equal(summary.status, "no_payment_required");
  assert.notEqual(summary.status, "settled", "nothing was paid, because nothing was owed");
  assert.equal(summary.agreedTotalCents, 0);
  assert.equal(summary.paidTotalCents, 0);
  assert.equal(summary.remainingOfAgreedCents, 0);
  assert.equal(summary.nextAmountDueCents, null);
});

test("neither party is told they paid, credited or settled anything", () => {
  const copy = CATERING_FINANCIAL_STATUS_COPY.no_payment_required;
  assert.equal(copy.label, "No payment required");
  assert.equal(copy.provider, "No payment is required for this booking.");
  assert.equal(copy.customer, "No payment is required for this booking.");
  for (const line of [copy.provider, copy.customer]) {
    for (const forbidden of ["paid", "settled", "credited", "balance due", "in full", "requested"]) {
      assert.equal(line.toLowerCase().includes(forbidden), false, `${forbidden} in "${line}"`);
    }
  }
  // And specifically not the sentence the old behaviour produced.
  assert.notEqual(copy.customer, CATERING_FINANCIAL_STATUS_COPY.settled.customer);
  assert.match(CATERING_FINANCIAL_STATUS_COPY.settled.customer, /in full/, "which really does claim payment");
});

test("nothing is issuable and nothing is payable on a zero-dollar booking", () => {
  // Both were already closed by the amount rules; this pins that they stay closed.
  assert.deepEqual(cateringIssuableInvoiceKinds(complimentary), []);
  assert.equal(cateringInvoiceAmountFor("deposit", complimentary), null);
  assert.equal(cateringInvoiceAmountFor("balance", complimentary), null);
  assert.equal(cateringInvoiceHeadroomCents(complimentary), 0);
  // Even with deposit terms configured, because a percentage or a capped fixed amount of zero is zero.
  for (const terms of [
    { mode: "percentage" as const, amountCents: null, percentBasisPoints: 5_000, dueOn: null },
    { mode: "fixed" as const, amountCents: 100_000, percentBasisPoints: null, dueOn: null },
  ]) {
    assert.deepEqual(cateringIssuableInvoiceKinds(facts({ agreedTotalCents: 0, terms })), [], JSON.stringify(terms));
    assert.equal(cateringDepositRequirement(terms, 0), 0, "the requirement itself is zero, so there is nothing to ask for");
  }
});

test("an invoice or a payment of nothing is refused, so a 'paid' state cannot be manufactured", () => {
  // The partition guard refuses a zero amount outright...
  assert.equal(cateringIssuanceKeepsPartition(complimentary, 0), false);
  assert.equal(cateringIssuanceKeepsPartition(facts(), 0), false, "on any booking, not just this one");
  // ...and a zero payment is refused by the resolver, whatever invoice it names.
  const live = invoice({ id: "inv-d", kind: "deposit", amountCents: 50_000 });
  const refused = resolveCateringPayment({
    amountCents: 0, currency: "USD", invoice: live, facts: facts({ invoices: [live] }), receivedOn: "2026-09-12",
  });
  assert.equal(refused.ok, false);
  // The database says the same thing independently.
  const ddl = migration.replace(/^\s*--.*$/gm, "");
  assert.ok(ddl.includes("CHECK (amount_cents > 0 AND amount_cents <= 9999999999)"));
  assert.equal((ddl.match(/CHECK \(amount_cents > 0/g) ?? []).length, 2, "the invoice and the payment");
});

test("a positive booking paid in full is still settled, so the zero case did not break the general one", () => {
  const paid = facts({
    agreedTotalCents: 50_000,
    invoices: [deposit({ amountCents: 50_000 })],
    payments: [payment({ amountCents: 50_000 })],
  });
  assert.equal(deriveCateringBillingSummary(paid).status, "settled");
  // And one cent short is not.
  const nearly = facts({
    agreedTotalCents: 50_000,
    invoices: [deposit({ amountCents: 50_000 })],
    payments: [payment({ amountCents: 49_999 })],
  });
  assert.equal(deriveCateringBillingSummary(nearly).status, "deposit_due");
});

test("the zero case is decided before the arithmetic that used to swallow it", () => {
  const contract = fs.readFileSync(path.join(repoRoot, "shared", "catering-booking-billing.ts"), "utf8");
  const derivation = contract.slice(contract.indexOf("function deriveCateringFinancialStatus("));
  const zero = derivation.indexOf('if (facts.agreedTotalCents === 0) return "no_payment_required";');
  const generic = derivation.indexOf("if (derived.paidTotalCents >= facts.agreedTotalCents) return \"settled\";");
  assert.ok(zero !== -1 && generic !== -1 && zero < generic);
});
