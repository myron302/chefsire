import assert from "node:assert/strict";
import test from "node:test";
import {
  CATERING_BILLING_MAXIMUM_CENTS,
  CATERING_DEPOSIT_MODES,
  CATERING_FINANCIAL_STATUSES,
  CATERING_INVOICE_KINDS,
  CATERING_INVOICE_STATUSES,
  CATERING_PAYMENT_METHODS,
  CATERING_PAYMENT_SOURCES,
  cateringBalanceAmount,
  cateringBillingIsActionable,
  cateringCentsToDecimal,
  cateringDepositRequirement,
  cateringInvoiceAcceptsPayment,
  cateringInvoiceAmountFor,
  cateringInvoiceIsOverdue,
  cateringInvoiceState,
  cateringIssuableInvoiceKinds,
  cateringMoneyToCents,
  cateringPaidTowards,
  cateringPercentToBasisPoints,
  cateringPercentageOfCents,
  cateringRemainingOnInvoice,
  deriveCateringBillingSummary,
  formatCateringMoney,
  type CateringBillingFacts,
  type CateringInvoiceFact,
  type CateringPaymentFact,
} from "./catering-booking-billing";

/**
 * The Phase 2L money contract, exercised as both sides run it.
 *
 * Two things are being defended here above all. First, that no authoritative amount is ever a binary float: every
 * conversion below goes through integer arithmetic and the tests include the values that would expose a `* 100` on
 * a float. Second, that a total can only ever come from the ledger -- an invoice's paid state, a booking's
 * outstanding balance and its financial status are derived here and stored nowhere.
 */

const TODAY = "2026-09-13";
const invoice = (patch: Partial<CateringInvoiceFact> = {}): CateringInvoiceFact =>
  ({ id: "inv-1", number: 1, kind: "deposit", amountCents: 50_000, currency: "USD", status: "issued", dueOn: null, issuedAt: "2026-09-01T00:00:00.000Z", ...patch });
const payment = (patch: Partial<CateringPaymentFact> = {}): CateringPaymentFact =>
  ({ id: "pay-1", invoiceId: "inv-1", amountCents: 50_000, currency: "USD", method: "bank_transfer", source: "provider_recorded", status: "recorded", receivedOn: "2026-09-02", ...patch });
const facts = (patch: Partial<CateringBillingFacts> = {}): CateringBillingFacts => ({
  bookingStatus: "confirmed",
  agreedTotalCents: 200_000,
  currency: "USD",
  terms: { mode: "percentage", amountCents: null, percentBasisPoints: 2_500, dueOn: null },
  invoices: [],
  payments: [],
  asOfDate: TODAY,
  ...patch,
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Money
 * ------------------------------------------------------------------------------------------------------------- */

test("decimal(12,2) becomes cents exactly, including the values a float would round", () => {
  assert.equal(cateringMoneyToCents("0.00"), 0);
  assert.equal(cateringMoneyToCents("1250.00"), 125_000);
  assert.equal(cateringMoneyToCents("1250.5"), 125_050, "one fractional digit is tenths, not hundredths");
  assert.equal(cateringMoneyToCents("1250"), 125_000);
  // 1.15 * 100 is 114.99999999999999 in binary floating point. The parser never multiplies a fraction.
  assert.equal(cateringMoneyToCents("1.15"), 115);
  assert.equal(cateringMoneyToCents("8.29"), 829);
  assert.equal(cateringMoneyToCents("1.005"), null, "three fractional digits are not a decimal(12,2)");
});

test("anything that is not a plain non-negative decimal is refused rather than guessed at", () => {
  for (const value of ["-1.00", "1,250.00", "1e3", "abc", "", " ", "$5.00", null, undefined, {}, NaN]) {
    assert.equal(cateringMoneyToCents(value as never), null, JSON.stringify(value));
  }
  assert.equal(cateringMoneyToCents("999999999999.99"), null, "beyond the phase's ceiling");
});

test("a number is accepted only when it is an exact whole number of major units", () => {
  assert.equal(cateringMoneyToCents(250), 25_000);
  assert.equal(cateringMoneyToCents(250.5), null, "a fractional number may already have lost precision");
  assert.equal(cateringMoneyToCents(-1), null);
});

test("cents round-trip to the decimal spelling the booking column uses", () => {
  for (const cents of [0, 5, 50, 115, 829, 125_000, CATERING_BILLING_MAXIMUM_CENTS]) {
    assert.equal(cateringMoneyToCents(cateringCentsToDecimal(cents)), cents, String(cents));
  }
  assert.equal(cateringCentsToDecimal(5), "0.05");
  assert.equal(cateringCentsToDecimal(125_000), "1250.00");
});

test("percentages are integer arithmetic, rounded half up", () => {
  assert.equal(cateringPercentageOfCents(200_000, 2_500), 50_000, "25% of 2000.00");
  assert.equal(cateringPercentageOfCents(100_01, 5_000), 5_001, "half a cent rounds up, not to even");
  assert.equal(cateringPercentageOfCents(333, 3_333), 111);
  assert.equal(cateringPercentageOfCents(0, 10_000), 0);
});

test("a typed percentage becomes basis points, and an unusable one becomes null", () => {
  assert.equal(cateringPercentToBasisPoints("25"), 2_500);
  assert.equal(cateringPercentToBasisPoints("12.5"), 1_250);
  assert.equal(cateringPercentToBasisPoints("0.01"), 1);
  assert.equal(cateringPercentToBasisPoints("100"), 10_000);
  for (const value of ["0", "0.00", "101", "-5", "", "abc", "50%"]) {
    assert.equal(cateringPercentToBasisPoints(value), null, value);
  }
});

test("formatting is currency aware and never throws inside a render", () => {
  assert.match(formatCateringMoney(125_000, "USD"), /1,250\.00/);
  assert.match(formatCateringMoney(125_000, "EUR"), /1,250\.00/);
  // An unrecognized code falls back rather than throwing, because this runs on a render path.
  assert.equal(formatCateringMoney(125_000, "XYZ".repeat(4)), "XYZXYZXYZXYZ 1250.00");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Invoice state, derived and never stored
 * ------------------------------------------------------------------------------------------------------------- */

test("the persisted statuses are three, and none of them is a payment fact", () => {
  assert.deepEqual([...CATERING_INVOICE_STATUSES], ["draft", "issued", "void"]);
  for (const forbidden of ["paid", "partially_paid", "overdue"]) {
    assert.equal((CATERING_INVOICE_STATUSES as readonly string[]).includes(forbidden), false, forbidden);
  }
});

test("an invoice's state comes from the ledger, and reaching the amount is what makes it paid", () => {
  const one = invoice();
  assert.equal(cateringInvoiceState(one, []), "issued");
  assert.equal(cateringInvoiceState(one, [payment({ amountCents: 10_000 })]), "partially_paid");
  assert.equal(cateringInvoiceState(one, [payment({ amountCents: 49_999 })]), "partially_paid");
  assert.equal(cateringInvoiceState(one, [payment({ amountCents: 50_000 })]), "paid");
  assert.equal(cateringInvoiceState(one, [payment({ amountCents: 20_000 }), payment({ id: "pay-2", amountCents: 30_000 })]), "paid", "several payments add up");
  assert.equal(cateringInvoiceState(invoice({ status: "draft" }), [payment()]), "draft");
  assert.equal(cateringInvoiceState(invoice({ status: "void" }), [payment()]), "void");
});

test("a voided payment counts for nothing, and one for another invoice counts for nothing here", () => {
  assert.equal(cateringPaidTowards("inv-1", [payment({ status: "voided" })]), 0);
  assert.equal(cateringPaidTowards("inv-1", [payment({ invoiceId: "inv-2" })]), 0);
  assert.equal(cateringInvoiceState(invoice(), [payment({ status: "voided" })]), "issued", "the credit is gone, so the ask is back");
});

test("overdue is a DATE comparison against the server's date, and only for something still owed", () => {
  const due = invoice({ dueOn: "2026-09-12" });
  assert.equal(cateringInvoiceIsOverdue(due, [], TODAY), true, "yesterday");
  assert.equal(cateringInvoiceIsOverdue(invoice({ dueOn: TODAY }), [], TODAY), false, "the day itself is not late");
  assert.equal(cateringInvoiceIsOverdue(invoice({ dueOn: "2026-09-14" }), [], TODAY), false);
  assert.equal(cateringInvoiceIsOverdue(invoice({ dueOn: null }), [], TODAY), false, "no due date, never overdue");
  assert.equal(cateringInvoiceIsOverdue(due, [payment()], TODAY), false, "a settled invoice is not overdue");
  assert.equal(cateringInvoiceIsOverdue(due, [payment({ amountCents: 1 })], TODAY), true, "a part-paid one still is");
  assert.equal(cateringInvoiceIsOverdue(invoice({ dueOn: "2026-09-12", status: "void" }), [], TODAY), false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Deposits
 * ------------------------------------------------------------------------------------------------------------- */

test("a percentage deposit is a percentage of the agreed total, capped at it", () => {
  assert.equal(cateringDepositRequirement({ mode: "percentage", amountCents: null, percentBasisPoints: 2_500, dueOn: null }, 200_000), 50_000);
  assert.equal(cateringDepositRequirement({ mode: "percentage", amountCents: null, percentBasisPoints: 10_000, dueOn: null }, 200_000), 200_000);
});

test("a fixed deposit is capped at the agreed total, because a deposit bigger than the job is not a deposit", () => {
  assert.equal(cateringDepositRequirement({ mode: "fixed", amountCents: 50_000, percentBasisPoints: null, dueOn: null }, 200_000), 50_000);
  assert.equal(cateringDepositRequirement({ mode: "fixed", amountCents: 500_000, percentBasisPoints: null, dueOn: null }, 200_000), 200_000);
});

test("a deposit that cannot be stated is null, never zero", () => {
  assert.equal(cateringDepositRequirement({ mode: "none", amountCents: null, percentBasisPoints: null, dueOn: null }, 200_000), null);
  // A percentage of an unknown total is unknowable. Zero would read as "no deposit", which is a different answer.
  assert.equal(cateringDepositRequirement({ mode: "percentage", amountCents: null, percentBasisPoints: 2_500, dueOn: null }, null), null);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * What may be issued, and for how much
 * ------------------------------------------------------------------------------------------------------------- */

test("the balance is the agreed total less the deposit already asked for, and the two can never exceed it", () => {
  const deposit = invoice({ id: "inv-d", kind: "deposit", amountCents: 50_000 });
  const state = facts({ invoices: [deposit] });
  assert.equal(cateringBalanceAmount(state), 150_000);
  assert.equal(deposit.amountCents + cateringBalanceAmount(state), state.agreedTotalCents);
});

test("with no deposit issued, the balance is the whole agreed total", () => {
  assert.equal(cateringBalanceAmount(facts()), 200_000);
});

test("a voided deposit frees its share back into the balance", () => {
  const voided = invoice({ id: "inv-d", kind: "deposit", amountCents: 50_000, status: "void" });
  assert.equal(cateringBalanceAmount(facts({ invoices: [voided] })), 200_000);
});

test("each kind may be issued once, and never twice", () => {
  assert.deepEqual(cateringIssuableInvoiceKinds(facts()), ["deposit", "balance"]);
  const withDeposit = facts({ invoices: [invoice({ id: "inv-d", kind: "deposit", amountCents: 50_000 })] });
  assert.deepEqual(cateringIssuableInvoiceKinds(withDeposit), ["balance"]);
  const both = facts({ invoices: [invoice({ id: "inv-d", kind: "deposit", amountCents: 50_000 }), invoice({ id: "inv-b", number: 2, kind: "balance", amountCents: 150_000 })] });
  assert.deepEqual(cateringIssuableInvoiceKinds(both), []);
});

test("nothing is issuable without an agreed price, or on a cancelled booking", () => {
  assert.deepEqual(cateringIssuableInvoiceKinds(facts({ agreedTotalCents: null })), []);
  assert.deepEqual(cateringIssuableInvoiceKinds(facts({ bookingStatus: "cancelled" })), []);
});

test("a booking with no deposit terms can still request its balance", () => {
  const none = facts({ terms: { mode: "none", amountCents: null, percentBasisPoints: null, dueOn: null } });
  assert.deepEqual(cateringIssuableInvoiceKinds(none), ["balance"]);
  assert.equal(cateringInvoiceAmountFor("balance", none), 200_000);
  assert.equal(cateringInvoiceAmountFor("deposit", none), null);
});

test("the amount an issue would be for is derived, and a kind that may not be issued has none", () => {
  assert.equal(cateringInvoiceAmountFor("deposit", facts()), 50_000);
  assert.equal(cateringInvoiceAmountFor("balance", facts()), 200_000);
  const both = facts({ invoices: [invoice({ id: "inv-d", kind: "deposit" }), invoice({ id: "inv-b", number: 2, kind: "balance", amountCents: 150_000 })] });
  assert.equal(cateringInvoiceAmountFor("deposit", both), null);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Payments against an invoice
 * ------------------------------------------------------------------------------------------------------------- */

test("what an invoice has left is its amount less what is credited, never below zero", () => {
  assert.equal(cateringRemainingOnInvoice(invoice(), []), 50_000);
  assert.equal(cateringRemainingOnInvoice(invoice(), [payment({ amountCents: 20_000 })]), 30_000);
  assert.equal(cateringRemainingOnInvoice(invoice(), [payment()]), 0);
});

test("a fully covered, draft, void or cancelled-booking invoice accepts nothing further", () => {
  assert.equal(cateringInvoiceAcceptsPayment(invoice(), facts({ invoices: [invoice()] })), true);
  assert.equal(cateringInvoiceAcceptsPayment(invoice(), facts({ invoices: [invoice()], payments: [payment()] })), false, "fully covered");
  assert.equal(cateringInvoiceAcceptsPayment(invoice({ status: "draft" }), facts()), false);
  assert.equal(cateringInvoiceAcceptsPayment(invoice({ status: "void" }), facts()), false);
  assert.equal(cateringInvoiceAcceptsPayment(invoice(), facts({ bookingStatus: "cancelled" })), false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The one canonical summary
 * ------------------------------------------------------------------------------------------------------------- */

test("a booking with no agreed price is not_configured, and no total pretends to be zero", () => {
  const summary = deriveCateringBillingSummary(facts({ agreedTotalCents: null }));
  assert.equal(summary.status, "not_configured");
  assert.equal(summary.agreedTotalCents, null);
  assert.equal(summary.remainingOfAgreedCents, null);
  assert.equal(summary.uninvoicedCents, null);
});

test("an agreed price with nothing asked for is not_invoiced", () => {
  const summary = deriveCateringBillingSummary(facts());
  assert.equal(summary.status, "not_invoiced");
  assert.equal(summary.invoicedTotalCents, 0);
  assert.equal(summary.paidTotalCents, 0);
  assert.equal(summary.remainingOfAgreedCents, 200_000);
  assert.equal(summary.uninvoicedCents, 200_000);
  assert.equal(summary.nextAmountDueCents, null);
});

test("a deposit outstanding is deposit_due, and the next amount is what that invoice has left", () => {
  const state = facts({ invoices: [invoice({ id: "inv-d", kind: "deposit", amountCents: 50_000, dueOn: "2026-09-20" })], payments: [payment({ invoiceId: "inv-d", amountCents: 20_000 })] });
  const summary = deriveCateringBillingSummary(state);
  assert.equal(summary.status, "deposit_due");
  assert.equal(summary.nextAmountDueCents, 30_000);
  assert.equal(summary.nextDueOn, "2026-09-20");
  assert.equal(summary.depositRequiredCents, 50_000);
  assert.equal(summary.depositPaidCents, 20_000);
  assert.equal(summary.outstandingInvoicedCents, 30_000);
  assert.equal(summary.remainingOfAgreedCents, 180_000);
});

test("the deposit is answered before the balance, whatever order the rows arrive in", () => {
  const balance = invoice({ id: "inv-b", number: 2, kind: "balance", amountCents: 150_000 });
  const deposit = invoice({ id: "inv-d", number: 1, kind: "deposit", amountCents: 50_000 });
  const summary = deriveCateringBillingSummary(facts({ invoices: [balance, deposit] }));
  assert.equal(summary.status, "deposit_due");
  assert.equal(summary.nextAmountDueCents, 50_000);
});

test("with the deposit settled, the balance is what is due", () => {
  const summary = deriveCateringBillingSummary(facts({
    invoices: [invoice({ id: "inv-d", number: 1, kind: "deposit", amountCents: 50_000 }), invoice({ id: "inv-b", number: 2, kind: "balance", amountCents: 150_000 })],
    payments: [payment({ invoiceId: "inv-d", amountCents: 50_000 })],
  }));
  assert.equal(summary.status, "balance_due");
  assert.equal(summary.nextAmountDueCents, 150_000);
  assert.equal(summary.paidTotalCents, 50_000);
  assert.equal(summary.remainingOfAgreedCents, 150_000);
});

test("settled needs BOTH nothing outstanding and the agreed total reached", () => {
  const everything = facts({
    invoices: [invoice({ id: "inv-d", number: 1, kind: "deposit", amountCents: 50_000 }), invoice({ id: "inv-b", number: 2, kind: "balance", amountCents: 150_000 })],
    payments: [payment({ invoiceId: "inv-d", amountCents: 50_000 }), payment({ id: "pay-2", invoiceId: "inv-b", amountCents: 150_000 })],
  });
  const summary = deriveCateringBillingSummary(everything);
  assert.equal(summary.status, "settled");
  assert.equal(summary.remainingOfAgreedCents, 0);
  assert.equal(summary.outstandingInvoicedCents, 0);
  assert.equal(summary.uninvoicedCents, 0);

  // A deposit paid in full while the balance has never been asked for is NOT settled: the money is not all in.
  const depositOnly = facts({
    invoices: [invoice({ id: "inv-d", kind: "deposit", amountCents: 50_000 })],
    payments: [payment({ invoiceId: "inv-d", amountCents: 50_000 })],
  });
  assert.equal(deriveCateringBillingSummary(depositOnly).status, "balance_due");
  assert.equal(deriveCateringBillingSummary(depositOnly).uninvoicedCents, 150_000);
});

test("no total can go negative, whatever the ledger holds", () => {
  // Payments larger than the invoice cannot be recorded through the server, but the derivation floors anyway.
  const summary = deriveCateringBillingSummary(facts({
    agreedTotalCents: 100_000,
    invoices: [invoice({ id: "inv-d", amountCents: 50_000 })],
    payments: [payment({ invoiceId: "inv-d", amountCents: 50_000 }), payment({ id: "pay-2", invoiceId: "inv-d", amountCents: 400_000 })],
  }));
  assert.equal(summary.outstandingInvoicedCents, 0);
  assert.equal(summary.remainingOfAgreedCents, 0);
  assert.equal(summary.uninvoicedCents, 50_000);
  assert.ok(summary.paidTotalCents >= 0);
});

test("hasOverdue looks at every issued invoice, not just the next one", () => {
  const state = facts({
    invoices: [
      invoice({ id: "inv-d", number: 1, kind: "deposit", amountCents: 50_000, dueOn: "2026-09-01" }),
      invoice({ id: "inv-b", number: 2, kind: "balance", amountCents: 150_000, dueOn: "2026-12-01" }),
    ],
  });
  const summary = deriveCateringBillingSummary(state);
  assert.equal(summary.hasOverdue, true);
  assert.equal(summary.nextDueIsOverdue, true);
  const future = deriveCateringBillingSummary(facts({ invoices: [invoice({ dueOn: "2026-12-01" })] }));
  assert.equal(future.hasOverdue, false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Lifecycle separation
 * ------------------------------------------------------------------------------------------------------------- */

test("billing is open for every booking status except cancelled, and invents no status of its own", () => {
  assert.equal(cateringBillingIsActionable("pending_confirmation"), true, "caterers take deposits before confirmation");
  assert.equal(cateringBillingIsActionable("confirmed"), true);
  assert.equal(cateringBillingIsActionable("completed"), true, "balances are settled after service");
  assert.equal(cateringBillingIsActionable("cancelled"), false);
});

test("no financial status is a booking status, and no booking status is a financial one", () => {
  for (const status of CATERING_FINANCIAL_STATUSES) {
    assert.equal(["pending_confirmation", "confirmed", "cancelled", "completed"].includes(status), false, status);
  }
  for (const forbidden of ["paid", "deposit_paid", "payment_due"]) {
    assert.equal((CATERING_FINANCIAL_STATUSES as readonly string[]).includes(forbidden), false, forbidden);
  }
  // A confirmed booking with a deposit outstanding is the ordinary case, and both domains describe it at once.
  const summary = deriveCateringBillingSummary(facts({ bookingStatus: "confirmed", invoices: [invoice({ kind: "deposit" })] }));
  assert.equal(summary.status, "deposit_due");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The enums this phase deliberately kept small
 * ------------------------------------------------------------------------------------------------------------- */

test("there are exactly two invoice kinds, and no adjustment kind", () => {
  assert.deepEqual([...CATERING_INVOICE_KINDS], ["deposit", "balance"]);
  // An adjustment would bill beyond the agreed price, and `agreed_price` is written once at booking creation and
  // never updated by anything in the repository -- so there would be no agreement behind the difference.
  assert.equal((CATERING_INVOICE_KINDS as readonly string[]).includes("adjustment"), false);
});

test("every payment method is something that happened outside ChefSire", () => {
  assert.deepEqual([...CATERING_PAYMENT_METHODS], ["cash", "bank_transfer", "card_in_person", "cheque", "other"]);
  for (const forbidden of ["chefsire", "online", "card", "square", "stripe"]) {
    assert.equal((CATERING_PAYMENT_METHODS as readonly string[]).includes(forbidden), false, forbidden);
  }
});

test("the deposit modes and payment sources are exactly what the constraints allow", () => {
  assert.deepEqual([...CATERING_DEPOSIT_MODES], ["none", "fixed", "percentage"]);
  assert.deepEqual([...CATERING_PAYMENT_SOURCES], ["provider_recorded", "processor"]);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * A price or terms change does not rewrite what was already asked for
 * ------------------------------------------------------------------------------------------------------------- */

test("an ISSUED deposit does not change when the deposit terms change", () => {
  // The amount is snapshotted onto the invoice when it is issued. Terms are the recipe; the invoice is the ask.
  const issued = invoice({ id: "inv-d", kind: "deposit", amountCents: 50_000 });
  const before = deriveCateringBillingSummary(facts({ invoices: [issued] }));
  const afterTermsChange = deriveCateringBillingSummary(facts({
    invoices: [issued],
    terms: { mode: "percentage", amountCents: null, percentBasisPoints: 9_000, dueOn: null },
  }));
  assert.equal(afterTermsChange.invoicedTotalCents, before.invoicedTotalCents, "what was asked for is unchanged");
  assert.equal(afterTermsChange.nextAmountDueCents, 50_000);
  // The requirement the terms now describe DOES move -- it is a different number, and it is reported as its own
  // field rather than being written over the invoice.
  assert.equal(before.depositRequiredCents, 50_000);
  assert.equal(afterTermsChange.depositRequiredCents, 180_000);
});

test("and the balance still completes the agreed total against the invoice that exists, not the new terms", () => {
  const issued = invoice({ id: "inv-d", kind: "deposit", amountCents: 50_000 });
  const state = facts({ invoices: [issued], terms: { mode: "percentage", amountCents: null, percentBasisPoints: 9_000, dueOn: null } });
  assert.equal(cateringBalanceAmount(state), 150_000);
  assert.equal(issued.amountCents + cateringBalanceAmount(state), 200_000);
});

test("withdrawing and reissuing is the only way to change an ask, and it frees the slot to do so", () => {
  const withdrawn = invoice({ id: "inv-d", kind: "deposit", amountCents: 50_000, status: "void" });
  const state = facts({ invoices: [withdrawn], terms: { mode: "percentage", amountCents: null, percentBasisPoints: 9_000, dueOn: null } });
  assert.deepEqual(cateringIssuableInvoiceKinds(state), ["deposit", "balance"]);
  assert.equal(cateringInvoiceAmountFor("deposit", state), 180_000, "at the terms as they now stand");
  // And the withdrawn invoice keeps its own amount: history is not rewritten to look as though it was always 1800.
  assert.equal(withdrawn.amountCents, 50_000);
});
