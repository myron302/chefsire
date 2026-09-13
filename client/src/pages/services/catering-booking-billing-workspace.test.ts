import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_WORKSPACE_SECTION_IDS,
  cateringActivityBillingAmount,
  cateringActivityTaskTitle,
  cateringSectionLandingIdentity,
  cateringWorkspaceSectionFromHash,
  recordCateringSectionLanding,
  shouldLandOnCateringSection,
  EMPTY_CATERING_SECTION_LANDING,
} from "./catering-booking-workspace-state";
import { CATERING_BILLING_SECTION, cateringBillingSectionPath } from "@shared/catering-booking-billing";

/**
 * TWO WAYS PHASE 2L WAS INVISIBLE IN THE WORKSPACE IT LIVES IN.
 *
 * DEEP LINKS. Billing notifications link to `...#billing`, but the workspace's section allowlist did not contain
 * it. On a cold load the browser resolves the fragment while the page is still loading, and the recovery pass that
 * exists precisely for that case rejected `#billing` as unknown -- so a customer told they had been asked for a
 * deposit arrived at the top of the page with no idea where to look.
 *
 * ACTIVITY. All four billing events were emitted correctly and rendered as "Booking updated", which made a
 * financial history indistinguishable from an edited venue address.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const workspace = fs.readFileSync(path.join(repoRoot, "client", "src", "pages", "services", "catering-booking-workspace.tsx"), "utf8");
const state = fs.readFileSync(path.join(repoRoot, "client", "src", "pages", "services", "catering-booking-workspace-state.ts"), "utf8");
const labelsFrom = workspace.indexOf("const activityLabels");
const activityLabels = workspace.slice(labelsFrom, workspace.indexOf("};", labelsFrom) + 2);

/* ------------------------------------------------------------------------------------------------------------- *
 * Deep links
 * ------------------------------------------------------------------------------------------------------------- */

test("billing is one of the canonical workspace sections, and the constant is imported rather than respelled", () => {
  assert.ok((CATERING_WORKSPACE_SECTION_IDS as readonly string[]).includes(CATERING_BILLING_SECTION));
  assert.deepEqual([...CATERING_WORKSPACE_SECTION_IDS], ["communication", "files", "activity", "execution", "closeout", "billing"]);
  // Imported, so the allowlist and the link that notifications carry cannot drift apart.
  assert.ok(state.includes('import { CATERING_BILLING_SECTION, formatCateringMoney } from "@shared/catering-booking-billing";'));
  assert.ok(state.includes("CATERING_BILLING_SECTION] as const;"));
});

test("#billing resolves to a section, exactly as the sections before it do", () => {
  assert.equal(cateringWorkspaceSectionFromHash("#billing"), "billing");
  assert.equal(cateringWorkspaceSectionFromHash("billing"), "billing");
  for (const section of ["communication", "files", "activity", "execution", "closeout"]) {
    assert.equal(cateringWorkspaceSectionFromHash(`#${section}`), section, section);
  }
});

test("an unknown or hostile fragment is still rejected", () => {
  for (const hash of ["#payments", "#invoice", "#Billing", "#billing ", "#", "", "#../admin", "#billing;alert(1)"]) {
    assert.equal(cateringWorkspaceSectionFromHash(hash), null, JSON.stringify(hash));
  }
});

test("a cold load retries until billing renders, then lands once", () => {
  const identity = cateringSectionLandingIdentity("booking-a", cateringWorkspaceSectionFromHash("#billing"));
  assert.equal(identity, "booking-a:billing");

  // The component's own `land()`, modelled: it asks whether to land, and records ONLY once an element exists --
  // which is exactly what makes the loading render a retry rather than a missed chance.
  let landing = EMPTY_CATERING_SECTION_LANDING;
  const landed: string[] = [];
  const land = (elementExists: boolean) => {
    if (!shouldLandOnCateringSection(landing, identity)) {
      landing = recordCateringSectionLanding(landing, identity);
      return;
    }
    if (!elementExists) return;
    landing = recordCateringSectionLanding(landing, identity);
    landed.push(identity!);
  };

  land(false);                                    // the loading render: #billing is not on the page yet
  assert.deepEqual(landed, []);
  assert.equal(landing.landedOn, null, "nothing was recorded, so the next pass tries again");
  land(true);                                     // the render after the payload lands
  assert.deepEqual(landed, [identity]);
  land(true);                                     // any later pass
  assert.deepEqual(landed, [identity], "and it never lands twice");

  // The same mechanism, unchanged, for the sections that already used it.
  assert.ok(state.includes("const element = document.getElementById(section!);") === false, "the effect lives in the component");
  assert.ok(workspace.includes("if (!element) return;"), "the retry is the component's early return on a missing element");
});

test("both participants' notification links name the supported section", () => {
  for (const role of ["provider", "customer"] as const) {
    const link = cateringBillingSectionPath(role, "booking-a");
    assert.ok(link.endsWith("#billing"), link);
    assert.equal(cateringWorkspaceSectionFromHash(`#${link.split("#")[1]}`), "billing", link);
  }
  // The section element the link names actually exists on the card.
  const component = fs.readFileSync(path.join(repoRoot, "client", "src", "components", "catering", "BookingBilling.tsx"), "utf8");
  assert.equal((component.match(/id=\{CATERING_BILLING_SECTION\}/g) ?? []).length, 3, "loading, error and loaded renders all carry it");
});

test("landing identities stay per booking, so booking A's landing does not suppress booking B's", () => {
  const onA = cateringSectionLandingIdentity("booking-a", "billing");
  const onB = cateringSectionLandingIdentity("booking-b", "billing");
  assert.notEqual(onA, onB);
  const landing = recordCateringSectionLanding(EMPTY_CATERING_SECTION_LANDING, onA);
  assert.equal(shouldLandOnCateringSection(landing, onB, true), true);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Activity labels
 * ------------------------------------------------------------------------------------------------------------- */

test("all four billing events have their own label, and none falls back to the generic one", () => {
  const labels: Record<string, string> = {
    billing_invoice_issued: "Payment requested",
    billing_invoice_voided: "Payment request withdrawn",
    billing_payment_recorded: "Payment recorded by caterer",
    billing_payment_voided: "Payment record withdrawn",
  };
  for (const [event, label] of Object.entries(labels)) {
    assert.ok(activityLabels.includes(`${event}: "${label}"`), `${event} → ${label}`);
  }
  assert.equal(new Set(Object.values(labels)).size, 4, "and the four are distinguishable from each other");
});

test("the wording never claims ChefSire processed, captured or refunded anything", () => {
  // The labels themselves, with the comment above them removed: the comment says the words this must not use.
  const billingPart = activityLabels.slice(activityLabels.indexOf("billing_invoice_issued: "));
  for (const forbidden of ["processed", "captured", "Refund", "refund", "completed", "Paid", "Received"]) {
    assert.equal(billingPart.includes(forbidden), false, forbidden);
  }
  // "Recorded by caterer" is the strongest truthful claim: the caterer was paid directly and wrote it down.
  assert.ok(billingPart.includes("Payment recorded by caterer"));
});

test("every earlier phase's label is unchanged", () => {
  for (const [event, label] of [
    ["booking_offered", "Booking terms offered"],
    ["booking_completed", "Event marked complete"],
    ["shared_file_uploaded", "File shared"],
    ["provider_execution_milestone_completed", "Event-day milestone completed"],
    ["booking_closed_out", "Post-event closeout completed"],
    ["booking_closeout_reopened", "Post-event closeout reopened"],
  ] as const) {
    assert.ok(workspace.includes(`${event}: "${label}"`), `${event} → ${label}`);
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Activity metadata
 * ------------------------------------------------------------------------------------------------------------- */

test("a billing row renders its shared amount, and an invoice row says which kind it was", () => {
  assert.equal(cateringActivityBillingAmount({ eventType: "billing_invoice_issued", metadata: { kind: "deposit", amountCents: 50_000, currency: "USD" } }), "Deposit · $500.00");
  assert.equal(cateringActivityBillingAmount({ eventType: "billing_invoice_voided", metadata: { kind: "balance", amountCents: 150_000, currency: "USD" } }), "Remaining balance · $1,500.00");
  assert.equal(cateringActivityBillingAmount({ eventType: "billing_payment_recorded", metadata: { amountCents: 30_000, currency: "USD", method: "cash" } }), "$300.00");
});

test("it reads ONLY the shared keys, so nothing private could ever be rendered from it", () => {
  const rendered = cateringActivityBillingAmount({
    eventType: "billing_payment_recorded",
    // Every private thing a billing row could ever carry, present at once. None of it reaches the output.
    metadata: {
      amountCents: 30_000, currency: "USD",
      reference: "INTERNAL-LEDGER-4471", idempotencyKey: "key-abcdefgh", processor: "square",
      processorPaymentId: "sq-XYZ", recordedBy: "user-provider", voidReason: "typo", providerId: "user-provider",
    },
  });
  assert.equal(rendered, "$300.00");
  for (const secret of ["INTERNAL", "key-abcdefgh", "square", "sq-XYZ", "user-provider", "typo"]) {
    assert.equal(rendered!.includes(secret), false, secret);
  }
  // And the server writes none of them in the first place -- this is the second line, not the first.
  const route = fs.readFileSync(path.join(repoRoot, "server", "routes", "catering-booking-billing.ts"), "utf8");
  for (const metadata of [...route.matchAll(/metadata: \{([^}]*)\}/g)].map((match) => match[1])) {
    for (const secret of ["reference", "idempotency", "processor", "recordedBy", "voidReason"]) {
      assert.equal(metadata.includes(secret), false, `${secret} in ${metadata}`);
    }
  }
});

test("it is allowlisted by event type, so no other family can be read through it", () => {
  for (const eventType of ["details_updated", "shared_file_uploaded", "booking_closed_out", "shared_equipment_added", ""]) {
    assert.equal(cateringActivityBillingAmount({ eventType, metadata: { amountCents: 1, currency: "USD" } }), null, eventType);
  }
  // And the task-title reader is unchanged, including that it ignores billing rows.
  assert.equal(cateringActivityTaskTitle({ eventType: "billing_invoice_issued", metadata: { taskTitle: "x" } }), null);
  assert.equal(cateringActivityTaskTitle({ eventType: "shared_requirement_added", metadata: { taskTitle: "Dietary list" } }), "Dietary list");
});

test("a malformed or absent amount renders nothing rather than a broken figure", () => {
  for (const metadata of [null, undefined, "500", [], {}, { amountCents: "500", currency: "USD" }, { amountCents: 500 },
    { amountCents: 500, currency: "usd" }, { amountCents: -500, currency: "USD" }, { amountCents: Number.NaN, currency: "USD" }]) {
    assert.equal(cateringActivityBillingAmount({ eventType: "billing_payment_recorded", metadata }), null, JSON.stringify(metadata));
  }
});

test("the feed renders the amount beside the label, and keeps it readable on a phone", () => {
  assert.ok(workspace.includes("const billingAmount = cateringActivityBillingAmount(item);"));
  assert.ok(workspace.includes('{billingAmount && <p className="break-words text-sm tabular-nums">{billingAmount}</p>}'));
});
