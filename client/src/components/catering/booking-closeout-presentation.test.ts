import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_CLOSEOUT_CANCELLED_NOTICE,
  CATERING_CLOSEOUT_ITEM_KEYS,
  CATERING_CLOSEOUT_ITEM_STATE_LABELS,
  CATERING_CLOSEOUT_STATES,
  CATERING_CLOSEOUT_STATE_LABELS,
} from "@shared/catering-booking-closeout";
import { cateringCloseoutSignalVariant, cateringCloseoutStateVariant } from "@/pages/services/catering-booking-closeout-state";
import { CATERING_WORKSPACE_SECTION_IDS } from "@/pages/services/catering-booking-workspace-state";

/**
 * How the Phase 2K section presents itself: mobile usability, the workspace it lives in, and the guarantee that a
 * customer's interface has nowhere to render a provider-private fact even if one ever reached it.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingCloseout.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(here, "..", "..", "pages", "services", "catering-booking-workspace.tsx"), "utf8");

/* ----------------------------------------------------------------------------------------------------------- *
 * Mobile
 * ----------------------------------------------------------------------------------------------------------- */

test("every interactive control is at least a 44px touch target", () => {
  const controls = component.match(/<Button[^>]*>/g) ?? [];
  assert.ok(controls.length > 0);
  for (const control of controls) {
    assert.ok(/min-h-11/.test(control), `control is not touch sized: ${control}`);
  }
});

test("nothing in this section is a table, and no list scrolls sideways", () => {
  for (const forbidden of ["<table", "<thead", "<tbody", "overflow-x-scroll", "whitespace-nowrap"]) {
    assert.equal(component.includes(forbidden), false, forbidden);
  }
  // Long values wrap instead, so a filename or a note cannot push the page wider than the phone.
  assert.ok(component.includes("break-words"));
});

test("the checklist state is a row of plain buttons, not a picker inside a dialog", () => {
  assert.ok(component.includes("CATERING_CLOSEOUT_ITEM_STATES.map"));
  assert.ok(component.includes('aria-pressed={open.state === state}'));
  assert.equal(component.includes("<Dialog"), false);
  assert.equal(component.includes("<Select"), false);
});

test("only the destructive-ish reopen asks for confirmation", () => {
  const confirms = component.match(/window\.confirm\(/g) ?? [];
  assert.equal(confirms.length, 1);
  assert.ok(component.includes("Reopen this booking's closeout?"));
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Accessibility and the surrounding workspace
 * ----------------------------------------------------------------------------------------------------------- */

test("every section is labelled, and the loading and error states are announced", () => {
  for (const label of ["closeout-signals", "closeout-documents", "closeout-follow-up", "closeout-checklist", "closeout-notes", "closeout-action"]) {
    assert.ok(component.includes(`aria-labelledby="${label}"`), label);
    assert.ok(component.includes(`id="${label}"`), label);
  }
  assert.ok(component.includes('role="status"'));
  assert.ok(component.includes('role="alert"'));
});

test("the section is deep-linkable, so its notification actually lands on it", () => {
  assert.ok(component.includes("id={CATERING_CLOSEOUT_SECTION}"));
  assert.ok((CATERING_WORKSPACE_SECTION_IDS as readonly string[]).includes("closeout"));
});

test("the workspace renders closeout without gating it on the workspace's editable flag", () => {
  // That flag closes on a completed booking, which is exactly when closeout opens. The section re-derives its own
  // lifecycle from the authoritative booking instead.
  const at = workspace.indexOf("<BookingCloseout");
  assert.notEqual(at, -1);
  const element = workspace.slice(at, workspace.indexOf("/>", at));
  assert.equal(element.includes("editable"), false);
  assert.ok(element.includes("role={workspace.role}"));
});

test("the two closeout activity events have labels, so the Activity panel never says only 'Booking updated'", () => {
  assert.ok(workspace.includes('booking_closed_out: "Post-event closeout completed"'));
  assert.ok(workspace.includes('booking_closeout_reopened: "Post-event closeout reopened"'));
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Privacy in the interface
 * ----------------------------------------------------------------------------------------------------------- */

test("the checklist and the private notes render only under the provider branch", () => {
  for (const marker of ['aria-labelledby="closeout-checklist"', 'aria-labelledby="closeout-notes"', 'aria-labelledby="closeout-action"']) {
    const at = component.indexOf(marker);
    assert.notEqual(at, -1, marker);
    // Each is inside a `{provider && ...}` guard opened shortly before it.
    const preceding = component.slice(Math.max(0, at - 400), at);
    assert.ok(/\{provider &&/.test(preceding), `${marker} must be provider-gated`);
  }
});

test("the component renders what it was given and does not filter secrets out of a fuller response", () => {
  // A customer's payload carries no checklist key at all, so there is nothing here to hide -- and no place where a
  // field could be rendered by mistake if a serializer ever changed.
  // Built from the payload wholesale. The rebase it passes through only advances each item's concurrency version
  // to the freshest one an accepted save returned; it drops no item and reads no field a customer could have.
  assert.ok(component.includes("cateringCloseoutRebasedChecklist(closeout.checklist ?? [], versions, identity)"));
  assert.equal(/closeout\.checklist[?.\s]*\.filter/.test(component), false);
  assert.equal(component.includes("providerNote") && component.includes("role === \"customer\""), false);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Truthfulness
 * ----------------------------------------------------------------------------------------------------------- */

test("the interface never renders a payment, invoice, deposit, balance or refund", () => {
  const text = component.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for (const forbidden of ["invoice", "deposit", "refund", "balance", "Pay ", "amount due", "receipt"]) {
    assert.equal(new RegExp(forbidden, "i").test(text), false, forbidden);
  }
});

test("a booking with no served event renders a truthful statement and no actions at all", () => {
  const at = component.indexOf("if (!closeout.eventServiceOccurred)");
  assert.notEqual(at, -1);
  const branch = component.slice(at, component.indexOf("const checklist =", at));
  assert.ok(branch.includes("CATERING_CLOSEOUT_CANCELLED_NOTICE"));
  // A cancelled booking is never dressed up as a completed one, and the branch returns before any control renders.
  assert.equal(branch.includes("<Button"), false);
  assert.ok(CATERING_CLOSEOUT_CANCELLED_NOTICE.includes("cancelled"));
  assert.equal(CATERING_CLOSEOUT_CANCELLED_NOTICE.toLowerCase().includes("complete"), false);
});

test("the lifecycle branch reads the authoritative flag, never a date comparison", () => {
  assert.equal(/new Date\(\)/.test(component), false, "no client clock decides whether an event happened");
  assert.equal(/eventDate/.test(component), false);
});

test("every closeout state and item state has presentation, so nothing renders as a raw enum", () => {
  for (const state of CATERING_CLOSEOUT_STATES) {
    assert.equal(typeof CATERING_CLOSEOUT_STATE_LABELS[state], "string");
    assert.ok(["default", "secondary", "destructive", "outline"].includes(cateringCloseoutStateVariant(state)));
  }
  for (const key of CATERING_CLOSEOUT_ITEM_KEYS) assert.ok(key.length > 0);
  for (const state of ["pending", "completed", "not_applicable"] as const) {
    assert.equal(typeof CATERING_CLOSEOUT_ITEM_STATE_LABELS[state], "string");
  }
  assert.equal(cateringCloseoutSignalVariant("blocked"), "destructive");
  assert.equal(cateringCloseoutSignalVariant("ready"), "default");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Reuse, not reinvention
 * ----------------------------------------------------------------------------------------------------------- */

test("follow-up, review and rebooking CTAs all open EXISTING surfaces", () => {
  // The booking conversation Phase 2I already owns.
  assert.ok(component.includes("href={closeout.communicationPath}"));
  // The existing review flow, on the existing public provider page.
  assert.ok(component.includes("href={closeout.customerReview.reviewPath}") || component.includes("Link href={closeout.customerReview.reviewPath}"));
  // The existing inquiry flow, on the same page, carrying nothing from the booking.
  assert.ok(component.includes("closeout.rebookPath"));
  // The existing Phase 2I authorized download address.
  assert.ok(component.includes("cateringFileDownloadPath(bookingId, document.id)"));
});

test("nothing is auto-sent, and no consent is implied by the booking existing", () => {
  // Every follow-up control is a link the provider chooses to follow. There is no send, no template and no opt-in.
  assert.equal(/auto|subscribe|marketing|newsletter|mailing/i.test(component.replace(/\/\*[\s\S]*?\*\//g, "")), false);
  assert.equal(component.includes("/messages"), false);
});

test("the section polls on the shared workspace cadence and stops once closeout is settled", () => {
  assert.ok(component.includes("cateringWorkspacePollInterval("));
  assert.ok(component.includes("!polled.state.data?.closeout.closedOut"));
});
