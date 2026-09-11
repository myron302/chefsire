import assert from "node:assert/strict";
import test from "node:test";
import {
  CATERING_CLOSEOUT_BLOCKED_REFUSAL,
  CATERING_CLOSEOUT_CONFLICT_REFUSAL,
  CATERING_CLOSEOUT_NOT_AVAILABLE_REFUSAL,
  cateringCloseoutFacts,
  cateringCloseoutGuard,
  cateringCloseoutVersionMatches,
  resolveCateringCloseoutComplete,
  resolveCateringCloseoutItemSave,
  resolveCateringCloseoutNotesSave,
  resolveCateringCloseoutReopen,
  type CateringCloseoutSourceRows,
} from "./catering-booking-closeout-policy";
import { deriveCateringCloseout } from "@shared/catering-booking-closeout";

/**
 * The Phase 2K policy: the decisions every route takes against an authoritative locked row.
 *
 * Each resolver is a pure function of (persisted row, request, clock), so the behaviour that actually matters --
 * stale preconditions, retry idempotency, per-actor fact reduction -- is asserted without a database.
 */

const SERVED = { status: "completed" as const, completedAt: new Date("2026-09-01T18:00:00.000Z") };
const NOW = new Date("2026-09-05T10:00:00.000Z");
const LATER = new Date("2026-09-05T11:00:00.000Z");
const version = (instant: Date) => instant.toISOString();

/* ----------------------------------------------------------------------------------------------------------- *
 * The early guard
 * ----------------------------------------------------------------------------------------------------------- */

test("lifecycle is judged before the actor, so a cancelled booking answers the same way to either participant", () => {
  const cancelled = { status: "cancelled" as const, completedAt: null };
  assert.equal(cateringCloseoutGuard(cancelled, "provider"), "not_available");
  assert.equal(cateringCloseoutGuard(cancelled, "customer"), "not_available");
  // A customer probing a cancelled booking therefore learns nothing the booking record did not already tell them.
});

test("only the provider of a served booking is allowed through the guard", () => {
  assert.equal(cateringCloseoutGuard(SERVED, "provider"), "allowed");
  assert.equal(cateringCloseoutGuard(SERVED, "customer"), "forbidden");
  assert.equal(cateringCloseoutGuard({ status: "confirmed", completedAt: null }, "provider"), "not_available");
  assert.equal(cateringCloseoutGuard({ status: "pending_confirmation", completedAt: null }, "provider"), "not_available");
});

test("the three refusals carry distinct codes, so a client can tell refetch from reload from blocked", () => {
  const codes = [CATERING_CLOSEOUT_NOT_AVAILABLE_REFUSAL.code, CATERING_CLOSEOUT_CONFLICT_REFUSAL.code, CATERING_CLOSEOUT_BLOCKED_REFUSAL.code];
  assert.equal(new Set(codes).size, 3);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Optimistic concurrency
 * ----------------------------------------------------------------------------------------------------------- */

test("a version precondition compares the instant, not its spelling", () => {
  const current = { updatedAt: NOW };
  assert.equal(cateringCloseoutVersionMatches(current, NOW.toISOString()), true);
  assert.equal(cateringCloseoutVersionMatches(current, "2026-09-05T10:00:00Z"), true, "an equivalent ISO form still matches");
  assert.equal(cateringCloseoutVersionMatches(current, LATER.toISOString()), false);
});

test("a missing or malformed precondition fails closed on an existing row", () => {
  const current = { updatedAt: NOW };
  assert.equal(cateringCloseoutVersionMatches(current, undefined), false);
  assert.equal(cateringCloseoutVersionMatches(current, "not-a-date"), false);
});

test("an absent row accepts an absent precondition and refuses any version at all", () => {
  // A first touch has no row to be stale against, and a client claiming a version for one that does not exist is
  // describing something that never happened.
  assert.equal(cateringCloseoutVersionMatches(undefined, undefined), true);
  assert.equal(cateringCloseoutVersionMatches(undefined, NOW.toISOString()), false);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Checklist saves
 * ----------------------------------------------------------------------------------------------------------- */

const persisted = (patch: Partial<{ state: string; providerNote: string | null; resolvedAt: Date | null; updatedAt: Date }> = {}) => ({
  state: "pending", providerNote: null, resolvedAt: null, updatedAt: NOW, ...patch,
});

test("a first touch creates the item and stamps its resolution", () => {
  const outcome = resolveCateringCloseoutItemSave(undefined, { state: "completed" }, LATER);
  assert.equal(outcome.kind, "save");
  if (outcome.kind !== "save") return;
  assert.equal(outcome.state, "completed");
  assert.deepEqual(outcome.resolvedAt, LATER);
  assert.equal(outcome.resolvedIsNew, true);
});

test("a stale precondition conflicts and writes nothing", () => {
  const outcome = resolveCateringCloseoutItemSave(persisted({ updatedAt: LATER }), { state: "completed", expectedUpdatedAt: version(NOW) }, LATER);
  assert.equal(outcome.kind, "conflict");
});

test("a first touch that carries a version conflicts rather than quietly creating", () => {
  const outcome = resolveCateringCloseoutItemSave(undefined, { state: "completed", expectedUpdatedAt: version(NOW) }, LATER);
  assert.equal(outcome.kind, "conflict");
});

test("an identical resubmission is unchanged, so a retry cannot even move the concurrency version", () => {
  const row = persisted({ state: "completed", providerNote: "back in the van", resolvedAt: NOW });
  const outcome = resolveCateringCloseoutItemSave(row, { state: "completed", providerNote: "back in the van", expectedUpdatedAt: version(NOW) }, LATER);
  assert.equal(outcome.kind, "unchanged");
});

test("editing only a note keeps the instant the work was actually resolved at", () => {
  const row = persisted({ state: "completed", providerNote: "old", resolvedAt: NOW });
  const outcome = resolveCateringCloseoutItemSave(row, { state: "completed", providerNote: "new", expectedUpdatedAt: version(NOW) }, LATER);
  assert.equal(outcome.kind, "save");
  if (outcome.kind !== "save") return;
  assert.deepEqual(outcome.resolvedAt, NOW, "a note tidy-up does not rewrite when the work was done");
  assert.equal(outcome.resolvedIsNew, false);
});

test("moving an item back to pending clears its resolution, so the paired CHECK holds", () => {
  const row = persisted({ state: "completed", providerNote: "x", resolvedAt: NOW });
  const outcome = resolveCateringCloseoutItemSave(row, { state: "pending", expectedUpdatedAt: version(NOW) }, LATER);
  assert.equal(outcome.kind, "save");
  if (outcome.kind !== "save") return;
  assert.equal(outcome.resolvedAt, null);
  assert.equal(outcome.clearsResolution, true);
});

test("not_applicable resolves the item exactly as completion does", () => {
  const outcome = resolveCateringCloseoutItemSave(undefined, { state: "not_applicable" }, LATER);
  assert.equal(outcome.kind, "save");
  if (outcome.kind !== "save") return;
  assert.deepEqual(outcome.resolvedAt, LATER);
  assert.equal(outcome.clearsResolution, false);
});

test("an absent providerNote leaves the stored note alone; an explicit null clears it", () => {
  const row = persisted({ state: "completed", providerNote: "kept", resolvedAt: NOW });
  const untouched = resolveCateringCloseoutItemSave(row, { state: "not_applicable", expectedUpdatedAt: version(NOW) }, LATER);
  assert.equal(untouched.kind === "save" && untouched.providerNote, "kept");
  const cleared = resolveCateringCloseoutItemSave(row, { state: "completed", providerNote: null, expectedUpdatedAt: version(NOW) }, LATER);
  assert.equal(cleared.kind === "save" && cleared.providerNote, null);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Provider-private notes
 * ----------------------------------------------------------------------------------------------------------- */

test("the notes save has the same three outcomes and the same fail-closed precondition", () => {
  assert.equal(resolveCateringCloseoutNotesSave(undefined, { providerNotes: "first" }, NOW).kind, "save");
  assert.equal(resolveCateringCloseoutNotesSave(undefined, { providerNotes: "first", expectedUpdatedAt: version(NOW) }, NOW).kind, "conflict");
  const row = { providerNotes: "same", updatedAt: NOW };
  assert.equal(resolveCateringCloseoutNotesSave(row, { providerNotes: "same", expectedUpdatedAt: version(NOW) }, LATER).kind, "unchanged");
  assert.equal(resolveCateringCloseoutNotesSave(row, { providerNotes: "different", expectedUpdatedAt: version(LATER) }, LATER).kind, "conflict");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Completion and reopening
 * ----------------------------------------------------------------------------------------------------------- */

/** Nothing answered yet, so every required item is outstanding. */
const blockedFacts = cateringCloseoutFacts({
  booking: SERVED, record: undefined, equipment: [], items: [],
  outstandingSharedRequirementCount: 0, sharedDocumentCount: 0, customerReviewExists: false,
}, "provider");

test("an unanswered checklist blocks completion", () => {
  // Nothing has been answered, so every required item is outstanding.
  assert.ok(blockedFacts.unresolvedRequiredItemCount > 0);
  assert.equal(resolveCateringCloseoutComplete(undefined, blockedFacts, undefined, NOW).kind, "blocked");
});

test("a fully answered checklist allows completion", () => {
  const answered = cateringCloseoutFacts({
    booking: SERVED, record: undefined, equipment: [],
    items: [
      { itemKey: "equipment_return_confirmed", state: "not_applicable" },
      { itemKey: "final_documents_delivered", state: "completed" },
      { itemKey: "incident_follow_up_resolved", state: "not_applicable" },
      { itemKey: "final_admin_review_completed", state: "completed" },
    ],
    outstandingSharedRequirementCount: 0, sharedDocumentCount: 0, customerReviewExists: false,
  }, "provider");
  assert.equal(answered.unresolvedRequiredItemCount, 0);
  const outcome = resolveCateringCloseoutComplete(undefined, answered, undefined, NOW);
  assert.equal(outcome.kind, "close");
  assert.equal(deriveCateringCloseout(answered, "provider").mayCloseOut, true);
});

test("a retried completion is answered from the settled state, never as a conflict", () => {
  // The first attempt committed and moved the version; the retry carries the version it was built with. Judging the
  // version first would refuse a request that had already succeeded and leave the provider unsure what happened.
  const closed = { closedOutAt: NOW, reopenCount: 0, updatedAt: NOW };
  const outcome = resolveCateringCloseoutComplete(closed, blockedFacts, version(new Date("2026-01-01T00:00:00.000Z")), LATER);
  assert.equal(outcome.kind, "already_closed", "settled state is judged before the precondition");
});

test("a retried completion writes nothing, so no second activity row or notification can exist", () => {
  const closed = { closedOutAt: NOW, reopenCount: 0, updatedAt: NOW };
  const outcome = resolveCateringCloseoutComplete(closed, blockedFacts, version(NOW), LATER);
  assert.equal(outcome.kind, "already_closed");
  assert.equal("closedOutAt" in outcome && outcome.kind === "close", false, "nothing is scheduled to be written");
});

test("a stale completion on an OPEN record still conflicts", () => {
  const open = { closedOutAt: null, reopenCount: 0, updatedAt: LATER };
  assert.equal(resolveCateringCloseoutComplete(open, blockedFacts, version(NOW), LATER).kind, "conflict");
});

test("reopening is idempotent and audited", () => {
  const closed = { closedOutAt: NOW, reopenCount: 0, updatedAt: NOW };
  const outcome = resolveCateringCloseoutReopen(closed, version(NOW), LATER);
  assert.equal(outcome.kind, "reopen");
  if (outcome.kind !== "reopen") return;
  assert.equal(outcome.reopenCount, 1);
  assert.deepEqual(outcome.reopenedAt, LATER);
  // A retry of that reopen finds the record already open and writes nothing.
  const retried = resolveCateringCloseoutReopen({ closedOutAt: null, reopenCount: 1, updatedAt: LATER }, version(NOW), LATER);
  assert.equal(retried.kind, "already_open");
});

test("reopening a booking with no closeout record at all is a not-found, never an invented one", () => {
  assert.equal(resolveCateringCloseoutReopen(undefined, undefined, NOW).kind, "not_found");
});

test("a stale reopen on a CLOSED record conflicts", () => {
  assert.equal(resolveCateringCloseoutReopen({ closedOutAt: NOW, reopenCount: 0, updatedAt: LATER }, version(NOW), LATER).kind, "conflict");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Fact reduction
 * ----------------------------------------------------------------------------------------------------------- */

const rows = (patch: Partial<CateringCloseoutSourceRows> = {}): CateringCloseoutSourceRows => ({
  booking: SERVED,
  record: undefined,
  equipment: [],
  items: [],
  outstandingSharedRequirementCount: 0,
  sharedDocumentCount: 0,
  customerReviewExists: false,
  ...patch,
});

test("a customer's equipment count is built from shared rows alone", () => {
  const equipment = [
    { visibility: "provider_private", status: "in_use" },
    { visibility: "provider_private", status: "planned" },
    { visibility: "shared", status: "returned" },
  ];
  assert.equal(cateringCloseoutFacts(rows({ equipment }), "provider").outstandingEquipmentCount, 2);
  assert.equal(cateringCloseoutFacts(rows({ equipment }), "customer").outstandingEquipmentCount, 0);
});

test("a customer's facts carry no checklist numbers even when handed provider rows", () => {
  const items = [{ itemKey: "equipment_return_confirmed", state: "completed" }];
  const customer = cateringCloseoutFacts(rows({ items, record: { closedOutAt: null, providerNotes: "private" } }), "customer");
  assert.equal(customer.unresolvedRequiredItemCount, 0);
  assert.equal(customer.resolvedItemCount, 0);
  assert.equal(customer.equipmentItemResolved, false);
  assert.equal(customer.documentsItemResolved, false);
  assert.equal(customer.reviewItemResolved, false);
  assert.equal(customer.hasProviderNotes, false);
});

test("whitespace-only private notes are not progress", () => {
  assert.equal(cateringCloseoutFacts(rows({ record: { closedOutAt: null, providerNotes: "   " } }), "provider").hasProviderNotes, false);
  assert.equal(cateringCloseoutFacts(rows({ record: { closedOutAt: null, providerNotes: "real" } }), "provider").hasProviderNotes, true);
});

test("an unknown or absent item key reduces to pending rather than throwing", () => {
  const facts = cateringCloseoutFacts(rows({ items: [{ itemKey: "made_up", state: "completed" }] }), "provider");
  assert.equal(facts.resolvedItemCount, 0, "a key outside the allowlist contributes nothing");
  assert.equal(facts.unresolvedRequiredItemCount, 4);
});

test("the served flag comes from the booking, and a cancelled one is never served", () => {
  assert.equal(cateringCloseoutFacts(rows(), "provider").eventServiceOccurred, true);
  assert.equal(cateringCloseoutFacts(rows({ booking: { status: "cancelled", completedAt: new Date() } }), "provider").eventServiceOccurred, false);
});
