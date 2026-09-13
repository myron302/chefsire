import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cateringInvoiceIsOverdue,
  cateringInvoiceState,
  deriveCateringBillingSummary,
  type CateringBillingFacts,
  type CateringInvoiceFact,
} from "@shared/catering-booking-billing";

/**
 * A BALANCE COULD NEVER BE GIVEN A DUE DATE, SO IT COULD NEVER BE OVERDUE.
 *
 * The only client path to issuing one sent `{ kind }` and nothing else. The server sources a balance's `dueOn`
 * exclusively from that request -- a deposit falls back to its terms, a balance has no terms to fall back to -- so
 * every balance invoice created through the UI persisted `null`. The whole overdue apparatus below it, in the
 * summary, in the invoice list, in the badges, was unreachable for the one invoice a caterer most wants a date on.
 *
 * The fix is a due-date field beside each issue button, which also removes an asymmetry: the deposit's terms date
 * is now visible, and overridable, at the moment of asking rather than only when the terms were set.
 */

const TODAY = "2026-09-13";
const invoice = (patch: Partial<CateringInvoiceFact> = {}): CateringInvoiceFact =>
  ({ id: "inv-b", number: 2, kind: "balance", amountCents: 150_000, currency: "USD", status: "issued", dueOn: null, issuedAt: "2026-09-01T00:00:00.000Z", ...patch });
const facts = (invoices: CateringInvoiceFact[]): CateringBillingFacts => ({
  bookingStatus: "confirmed", agreedTotalCents: 200_000, currency: "USD",
  terms: { mode: "percentage", amountCents: null, percentBasisPoints: 2_500, dueOn: "2026-09-20" },
  invoices, payments: [], asOfDate: TODAY,
});

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingBilling.tsx"), "utf8");
const route = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "routes", "catering-booking-billing.ts"), "utf8");
/** Comments stripped, so a scan for a word tests the CODE rather than the prose explaining its absence. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ------------------------------------------------------------------------------------------------------------- *
 * What a dateless balance costs
 * ------------------------------------------------------------------------------------------------------------- */

test("the counterfactual: a balance with no due date can never be overdue, however long it stands", () => {
  const dateless = invoice({ dueOn: null });
  assert.equal(cateringInvoiceState(dateless, []), "issued");
  for (const asOf of ["2026-09-13", "2027-01-01", "2030-01-01"]) {
    assert.equal(cateringInvoiceIsOverdue(dateless, [], asOf), false, asOf);
  }
  const summary = deriveCateringBillingSummary(facts([dateless]));
  assert.equal(summary.hasOverdue, false);
  assert.equal(summary.nextDueOn, null);
  assert.equal(summary.nextDueIsOverdue, false);
});

test("with a date it behaves like every other invoice", () => {
  const dated = invoice({ dueOn: "2026-09-12" });
  assert.equal(cateringInvoiceIsOverdue(dated, [], TODAY), true);
  const summary = deriveCateringBillingSummary(facts([dated]));
  assert.equal(summary.hasOverdue, true);
  assert.equal(summary.nextDueOn, "2026-09-12");
  assert.equal(summary.nextDueIsOverdue, true);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The client offers one, for both kinds
 * ------------------------------------------------------------------------------------------------------------- */

test("each issuable kind gets its own due-date input, prefilled for the deposit from its terms", () => {
  assert.ok(component.includes('<Label htmlFor={`catering-issue-due-${kind}`}>Due by (optional)</Label>'));
  assert.ok(component.includes('<Input id={`catering-issue-due-${kind}`} className="min-h-11" type="date"'));
  // Untouched, a deposit shows the date its terms already carry; a balance has none to show.
  assert.ok(component.includes('value={issueDueOn[kind] ?? (kind === "deposit" ? terms?.dueOn ?? "" : "")}'));
});

test("the chosen date is sent, and no amount ever is", () => {
  const issue = code(component.slice(component.indexOf("const issueInvoice ="), component.indexOf("const voidInvoice =")));
  assert.ok(issue.includes('body: { kind, ...(touched ? { dueOn: dueOn === "" ? null : dueOn } : {}) },'));
  for (const forbidden of ["amount", "amountCents", "total"]) {
    assert.equal(issue.includes(forbidden), false, forbidden);
  }
});

test("an untouched field sends nothing, so a deposit still inherits its terms date", () => {
  const issue = code(component.slice(component.indexOf("const issueInvoice ="), component.indexOf("const voidInvoice =")));
  assert.ok(issue.includes("const touched = issueDueOn[kind] !== undefined;"));
  // Absent means fall back; present means honoured. The server reads it exactly that way.
  assert.ok(route.includes('dueOn: body.dueOn !== undefined ? body.dueOn : (body.kind === "deposit" ? facts.terms.dueOn : null),'));
  assert.equal(route.includes('dueOn: body.dueOn ?? (body.kind === "deposit"'), false, "the ?? swallowed an explicit null");
});

test("clearing the deposit's date means cleared, not reinstated from the terms", () => {
  // `??` treated an explicit null as absent, so a provider who cleared the field at the moment of asking had the
  // terms date silently put back on the invoice -- the one thing they had just said they did not want.
  const issue = code(component.slice(component.indexOf("const issueInvoice ="), component.indexOf("const voidInvoice =")));
  assert.ok(issue.includes('dueOn: dueOn === "" ? null : dueOn'), "an emptied field is sent as an explicit null");
  const schema = fs.readFileSync(path.join(here, "..", "..", "..", "..", "shared", "catering-booking-billing.ts"), "utf8");
  const issueSchema = schema.slice(schema.indexOf("export const cateringInvoiceIssueSchema"));
  assert.ok(issueSchema.slice(0, issueSchema.indexOf("}).strict();")).includes("dueOn: cateringBillingDateSchema.nullable().optional()"), "which the schema accepts");
});

test("the drafts are identity-scoped and cleared with every other piece of booking-local state", () => {
  assert.ok(component.includes("const [issueDueOn, setIssueDueOn] = useState<Record<string, string>>({});"));
  const reset = component.slice(component.indexOf("if (localIdentity === identity) return;"), component.indexOf("const localStateIsCurrent"));
  assert.ok(reset.includes("setIssueDueOn({});"), "so booking A's date cannot reach booking B's invoice");
  assert.ok(reset.includes("setTermsForm(") && reset.includes("setPaymentForm(null);"), "alongside the rest");
});

test("the control is usable on a phone, like every other one in the section", () => {
  // The whole issue block, from the wrapper that lays it out down to its close.
  const from = component.indexOf("(billing.issuablePreview ?? []).map(({ kind, amountCents })");
  const block = component.slice(from, component.indexOf("</div>)}", from) + 8);
  assert.ok(block.includes("catering-issue-due-"), "the slice covers the control");
  assert.ok(block.includes("min-h-11"), "the input");
  assert.ok(block.includes('<Button className="min-h-11"'), "and the button beside it");
  assert.ok(block.includes("flex-wrap"), "which wrap rather than overflow");
  assert.ok(block.includes("min-w-0 flex-1"), "and the field may shrink");
});
