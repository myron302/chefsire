import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cateringBalanceAmount,
  cateringInvoiceAmountFor,
  cateringInvoiceHeadroomCents,
  cateringIssuableInvoiceKinds,
  cateringIssuanceKeepsPartition,
  cateringLiveInvoicedCents,
  deriveCateringBillingSummary,
  type CateringBillingFacts,
  type CateringInvoiceFact,
  type CateringInvoiceKind,
  type CateringPaymentFact,
} from "./catering-booking-billing";

/**
 * THE PARTITION INVARIANT: live invoices never sum to more than the agreed total.
 *
 * The first version of the issuance rule asked only "does a live deposit already exist", which missed the case
 * where a live BALANCE had already claimed the whole agreed amount:
 *
 *   1. the provider issues a full balance for the agreed 2000.00
 *   2. later they configure 25% deposit terms
 *   3. the deposit is issuable, because there is no live deposit
 *   4. the booking now asks the customer for 2500.00 against a 2000.00 agreement
 *
 * The same hole from the other side: a deposit is issued, a balance is derived from it, the deposit is voided, the
 * terms are increased, and the reissued deposit sits beside the old balance.
 *
 * The rule is now expressed as HEADROOM -- the agreed total less everything live -- plus the ordering fact that a
 * balance is by definition the rest of the money, so nothing may be added beside one.
 */

const TODAY = "2026-09-13";
const TOTAL = 200_000;
const invoice = (patch: Partial<CateringInvoiceFact> = {}): CateringInvoiceFact =>
  ({ id: "inv-1", number: 1, kind: "deposit", amountCents: 50_000, currency: "USD", status: "issued", dueOn: null, issuedAt: "2026-09-01T00:00:00.000Z", ...patch });
const payment = (patch: Partial<CateringPaymentFact> = {}): CateringPaymentFact =>
  ({ id: "pay-1", invoiceId: "inv-1", amountCents: 10_000, currency: "USD", method: "cash", source: "provider_recorded", status: "recorded", receivedOn: "2026-09-02", ...patch });
const facts = (patch: Partial<CateringBillingFacts> = {}): CateringBillingFacts => ({
  bookingStatus: "confirmed", agreedTotalCents: TOTAL, currency: "USD",
  terms: { mode: "percentage", amountCents: null, percentBasisPoints: 2_500, dueOn: null },
  invoices: [], payments: [], asOfDate: TODAY, ...patch,
});

const deposit = (amountCents: number, patch: Partial<CateringInvoiceFact> = {}) => invoice({ id: "inv-d", number: 1, kind: "deposit", amountCents, ...patch });
const balance = (amountCents: number, patch: Partial<CateringInvoiceFact> = {}) => invoice({ id: "inv-b", number: 2, kind: "balance", amountCents, ...patch });

/** The invariant itself, asserted over any state. */
const holds = (state: CateringBillingFacts) =>
  state.agreedTotalCents === null || cateringLiveInvoicedCents(state) <= state.agreedTotalCents;

/* ------------------------------------------------------------------------------------------------------------- *
 * The ordinary progression
 * ------------------------------------------------------------------------------------------------------------- */

test("no invoices: a configured deposit is issuable, and so is a full balance", () => {
  const state = facts();
  assert.deepEqual(cateringIssuableInvoiceKinds(state), ["deposit", "balance"]);
  assert.equal(cateringInvoiceAmountFor("deposit", state), 50_000);
  assert.equal(cateringInvoiceAmountFor("balance", state), TOTAL);
  assert.equal(cateringInvoiceHeadroomCents(state), TOTAL);
});

test("a live deposit: the balance is the total minus it, and no second deposit is issuable", () => {
  const state = facts({ invoices: [deposit(50_000)] });
  assert.deepEqual(cateringIssuableInvoiceKinds(state), ["balance"]);
  assert.equal(cateringBalanceAmount(state), 150_000);
  assert.equal(cateringInvoiceHeadroomCents(state), 150_000);
  assert.equal(50_000 + cateringBalanceAmount(state), TOTAL, "the two exactly partition the agreed total");
});

test("both issued: nothing further, and they sum to exactly the agreed total", () => {
  const state = facts({ invoices: [deposit(50_000), balance(150_000)] });
  assert.deepEqual(cateringIssuableInvoiceKinds(state), []);
  assert.equal(cateringLiveInvoicedCents(state), TOTAL);
  assert.equal(cateringInvoiceHeadroomCents(state), 0);
  assert.ok(holds(state));
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The hole this closes
 * ------------------------------------------------------------------------------------------------------------- */

test("a live BALANCE makes a deposit unissuable, whatever the terms say", () => {
  const state = facts({ invoices: [balance(TOTAL)] });
  assert.deepEqual(cateringIssuableInvoiceKinds(state), [], "a balance is the rest of the money; nothing goes beside it");
  assert.equal(cateringInvoiceAmountFor("deposit", state), null);
  assert.equal(cateringInvoiceHeadroomCents(state), 0);
});

test("configuring deposit terms AFTER a full balance does not make a deposit issuable", () => {
  // The exact reported sequence: full balance, then terms, then an attempted deposit.
  const before = facts({ invoices: [balance(TOTAL)], terms: { mode: "none", amountCents: null, percentBasisPoints: null, dueOn: null } });
  assert.deepEqual(cateringIssuableInvoiceKinds(before), []);
  const afterTerms = facts({ invoices: [balance(TOTAL)], terms: { mode: "percentage", amountCents: null, percentBasisPoints: 2_500, dueOn: null } });
  assert.deepEqual(cateringIssuableInvoiceKinds(afterTerms), [], "terms are a recipe, not an entitlement to ask again");
  assert.equal(cateringInvoiceAmountFor("deposit", afterTerms), null);
  // The counterfactual: this is what the old rule would have allowed.
  assert.equal(cateringLiveInvoicedCents(afterTerms) + 50_000 > TOTAL, true, "and it would have over-invoiced by 500.00");
  assert.equal(cateringIssuanceKeepsPartition(afterTerms, 50_000), false);
});

test("voiding the deposit and reissuing a LARGER one beside a live balance is blocked", () => {
  // 1-3. deposit 500, balance 1500, then the deposit is voided: 1500 is still being asked for.
  const state = facts({
    invoices: [deposit(50_000, { status: "void" }), balance(150_000)],
    terms: { mode: "percentage", amountCents: null, percentBasisPoints: 9_000, dueOn: null },
  });
  assert.equal(cateringLiveInvoicedCents(state), 150_000);
  assert.equal(cateringInvoiceHeadroomCents(state), 50_000);
  // 4-6. The terms now say 1800. Issuing it beside the live balance would ask for 3300 against a 2000 agreement.
  assert.deepEqual(cateringIssuableInvoiceKinds(state), [], "the live balance blocks it outright");
  assert.equal(cateringIssuanceKeepsPartition(state, 180_000), false, "and the headroom would refuse it anyway");
  assert.ok(holds(state));
});

test("even a deposit that WOULD fit is refused beside a live balance, because the set would be incoherent", () => {
  // 500 of headroom and terms that ask for exactly 500: arithmetically it fits, but a deposit after the balance is
  // not a division of the total. The way back is to withdraw the balance and issue the pair afresh.
  const state = facts({
    invoices: [deposit(50_000, { status: "void" }), balance(150_000)],
    terms: { mode: "fixed", amountCents: 50_000, percentBasisPoints: null, dueOn: null },
  });
  assert.equal(cateringInvoiceHeadroomCents(state), 50_000);
  assert.equal(cateringIssuanceKeepsPartition(state, 50_000), true, "the arithmetic alone would allow it");
  assert.deepEqual(cateringIssuableInvoiceKinds(state), [], "the ordering rule does not");
});

test("once the balance is withdrawn, the pair becomes issuable again at the current terms", () => {
  const state = facts({
    invoices: [deposit(50_000, { status: "void" }), balance(150_000, { status: "void" })],
    terms: { mode: "percentage", amountCents: null, percentBasisPoints: 9_000, dueOn: null },
  });
  assert.equal(cateringLiveInvoicedCents(state), 0, "voided invoices count for nothing live");
  assert.deepEqual(cateringIssuableInvoiceKinds(state), ["deposit", "balance"]);
  assert.equal(cateringInvoiceAmountFor("deposit", state), 180_000, "at the terms as they now stand");
  assert.equal(cateringInvoiceAmountFor("balance", state), TOTAL, "and the balance is the whole total until one is issued");
});

test("a deposit whose terms exceed the headroom is refused even with no balance in the way", () => {
  // Cannot arise through the deposit path today -- a deposit is capped at the agreed total and is the first thing
  // issued -- but the rule is stated in terms of the headroom so it holds for any live set, now and later.
  const state = facts({ invoices: [deposit(150_000)], terms: { mode: "fixed", amountCents: 100_000, percentBasisPoints: null, dueOn: null } });
  assert.equal(cateringInvoiceHeadroomCents(state), 50_000);
  assert.equal(cateringIssuanceKeepsPartition(state, 100_000), false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The invariant over every reachable state
 * ------------------------------------------------------------------------------------------------------------- */

test("no sequence of issuances the rules permit can breach the invariant", () => {
  // Every ordering of every issuable kind, driven only through the derivation, from several starting points.
  for (const terms of [
    { mode: "none", amountCents: null, percentBasisPoints: null, dueOn: null },
    { mode: "fixed", amountCents: 1, percentBasisPoints: null, dueOn: null },
    { mode: "fixed", amountCents: TOTAL, percentBasisPoints: null, dueOn: null },
    { mode: "percentage", amountCents: null, percentBasisPoints: 1, dueOn: null },
    { mode: "percentage", amountCents: null, percentBasisPoints: 10_000, dueOn: null },
  ] as const) {
    for (const order of [["deposit", "balance"], ["balance", "deposit"]] as CateringInvoiceKind[][]) {
      let state = facts({ terms });
      let number = 0;
      for (const kind of order) {
        const amount = cateringInvoiceAmountFor(kind, state);
        if (amount === null) continue;
        assert.ok(cateringIssuanceKeepsPartition(state, amount), `${JSON.stringify(terms)} ${kind}`);
        number += 1;
        state = { ...state, invoices: [...state.invoices, invoice({ id: `inv-${number}`, number, kind, amountCents: amount })] };
        assert.ok(holds(state), `breached after ${kind} with ${JSON.stringify(terms)}`);
      }
      assert.ok(cateringLiveInvoicedCents(state) <= TOTAL);
    }
  }
});

test("issuing what the derivation offers, then voiding and reissuing, never breaches it either", () => {
  let state = facts({ invoices: [deposit(50_000), balance(150_000)] });
  assert.ok(holds(state));
  // Void the deposit, raise the terms, and try everything the rules now allow.
  state = { ...state, invoices: [deposit(50_000, { status: "void" }), balance(150_000)], terms: { mode: "percentage", amountCents: null, percentBasisPoints: 10_000, dueOn: null } };
  for (const kind of cateringIssuableInvoiceKinds(state)) {
    const amount = cateringInvoiceAmountFor(kind, state)!;
    state = { ...state, invoices: [...state.invoices, invoice({ id: `inv-${kind}-2`, number: 9, kind, amountCents: amount })] };
    assert.ok(holds(state), kind);
  }
  assert.ok(holds(state));
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Payments reduce what is outstanding; they never touch a principal
 * ------------------------------------------------------------------------------------------------------------- */

test("a payment reduces the outstanding amount and leaves the invoice principal exactly as it was", () => {
  const one = deposit(50_000);
  const paid = facts({ invoices: [one, balance(150_000)], payments: [payment({ invoiceId: "inv-d", amountCents: 30_000 })] });
  assert.equal(one.amountCents, 50_000, "the principal is untouched");
  assert.equal(cateringLiveInvoicedCents(paid), TOTAL, "and so is what has been asked for in total");
  const summary = deriveCateringBillingSummary(paid);
  assert.equal(summary.paidTotalCents, 30_000);
  assert.equal(summary.outstandingInvoicedCents, 170_000);
  assert.equal(summary.remainingOfAgreedCents, 170_000);
});

test("payments do not create headroom: paying a deposit does not let another be issued", () => {
  const state = facts({ invoices: [deposit(50_000)], payments: [payment({ invoiceId: "inv-d", amountCents: 50_000 })] });
  assert.equal(cateringInvoiceHeadroomCents(state), 150_000, "the headroom is about what was ASKED, not what was paid");
  assert.deepEqual(cateringIssuableInvoiceKinds(state), ["balance"]);
  assert.equal(cateringInvoiceAmountFor("balance", state), 150_000);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The server does not trust the client's view of any of this
 * ------------------------------------------------------------------------------------------------------------- */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const route = fs.readFileSync(path.join(repoRoot, "server", "routes", "catering-booking-billing.ts"), "utf8");

test("issuance rechecks the invariant inside the transaction, under the advisory lock", () => {
  const handler = route.slice(route.indexOf('r.post("/bookings/:id/billing/invoices"'), route.indexOf('r.post("/bookings/:id/billing/invoices/:invoiceId/void"'));
  const lock = handler.indexOf("await lockBilling(tx, id);");
  const rows = handler.indexOf("const rows = await billingRows(tx, id);");
  const derive = handler.indexOf("const amountCents = cateringInvoiceAmountFor(");
  const recheck = handler.indexOf("if (!cateringIssuanceKeepsPartition(facts, amountCents))");
  const insert = handler.indexOf("await tx.insert(cateringBookingInvoices)");
  assert.ok(lock !== -1 && rows > lock && derive > rows && recheck > derive && insert > recheck,
    `ordering: lock ${lock}, rows ${rows}, derive ${derive}, recheck ${recheck}, insert ${insert}`);
  // The rows the invariant is judged against are read inside the transaction, not carried in from the request.
  assert.equal(handler.includes("body.invoices"), false);
  assert.equal(handler.includes("body.amount"), false);
  assert.equal(handler.includes("body.issuable"), false);
});

test("a direct request cannot bypass the UI, because eligibility is never an input", () => {
  // The issue schema carries a kind and an optional due date. There is no field in which a client could assert
  // that something is issuable, or for how much.
  const shared = fs.readFileSync(path.join(repoRoot, "shared", "catering-booking-billing.ts"), "utf8");
  const schema = shared.slice(shared.indexOf("export const cateringInvoiceIssueSchema"));
  const body = schema.slice(0, schema.indexOf("}).strict();"));
  assert.deepEqual([...body.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]), ["kind", "dueOn"]);
});

test("concurrent issuance is serialized by the booking's own advisory lock", () => {
  // Two tabs pressing Issue at once are ordered by the lock, so the second sees the first's row and is refused by
  // the same derivation -- and if it somehow were not, the live-kind unique index refuses the insert.
  assert.ok(route.includes("pg_advisory_xact_lock(hashtext(${`catering-billing:${bookingId}`}))"));
  const migration = fs.readFileSync(path.join(repoRoot, "server", "migrations", "20260913_catering_booking_billing.sql"), "utf8");
  assert.ok(migration.includes("CREATE UNIQUE INDEX IF NOT EXISTS catering_invoices_live_kind_uidx"));
});

test("the invariant is enforced in the application rather than by a stored total", () => {
  const migration = fs.readFileSync(path.join(repoRoot, "server", "migrations", "20260913_catering_booking_billing.sql"), "utf8");
  const ddl = migration.replace(/^\s*--.*$/gm, "");
  // The rule spans several rows of one table and a column of another, which no CHECK can express. The alternatives
  // would be a trigger or a running total, and a stored total is the duplicated financial truth this phase refuses.
  for (const forbidden of ["invoiced_total", "live_total", "outstanding_cents", "CREATE TRIGGER"]) {
    assert.equal(ddl.includes(forbidden), false, forbidden);
  }
});
