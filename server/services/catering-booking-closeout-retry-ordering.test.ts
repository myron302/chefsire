import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cateringCloseoutFacts,
  resolveCateringCloseoutComplete,
  resolveCateringCloseoutItemSave,
  resolveCateringCloseoutNotesSave,
  resolveCateringCloseoutReopen,
} from "./catering-booking-closeout-policy";

/**
 * A lost-response retry must be recognised BEFORE its version is judged.
 *
 * Phase 2K promises that every write is safe to retry after an uncertain network response. Two of its resolvers
 * broke that promise by checking the optimistic-concurrency precondition first: the provider submits an item or
 * their notes on version A, the server commits and advances to B, the response is lost, and the retry -- carrying
 * the very payload and the very version it was built with -- was refused as a conflict even though the server
 * already held precisely the state being asked for. The idempotent branch behind it was never reached.
 *
 * The invariant this suite pins, in both directions:
 *
 *   stale version + the exact state is already persisted   -> `unchanged`, nothing written, no version moved
 *   stale version + the request would alter what is stored -> `conflict`, exactly as before
 *
 * The second half is what keeps this from being a weakening of optimistic concurrency: a materially different
 * stale edit is never mistaken for a retry.
 */
const A = new Date("2026-09-05T10:00:00.000Z");
const B = new Date("2026-09-05T10:00:05.000Z");
const NOW = new Date("2026-09-05T10:00:09.000Z");
const version = (instant: Date) => instant.toISOString();

const persistedItem = (patch: Partial<{ state: string; providerNote: string | null; resolvedAt: Date | null; updatedAt: Date }> = {}) => ({
  state: "pending", providerNote: null, resolvedAt: null, updatedAt: A, ...patch,
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Checklist item
 * ----------------------------------------------------------------------------------------------------------- */

test("item lost-response retry: stale version, state already persisted -> unchanged", () => {
  // 1-2. The first attempt went out on version A; the server committed it and advanced to B.
  const committed = persistedItem({ state: "completed", providerNote: "back in the van", resolvedAt: B, updatedAt: B });
  // 3-5. The response was lost, so the client retries the identical request still carrying version A.
  const outcome = resolveCateringCloseoutItemSave(committed, { state: "completed", providerNote: "back in the van", expectedUpdatedAt: version(A) }, NOW);
  // 6-8. It resolves to the state that is already there, rather than a conflict nobody caused.
  assert.equal(outcome.kind, "unchanged");
});

test("item lost-response retry does not advance the version a second time", () => {
  const committed = persistedItem({ state: "completed", providerNote: "x", resolvedAt: B, updatedAt: B });
  const outcome = resolveCateringCloseoutItemSave(committed, { state: "completed", providerNote: "x", expectedUpdatedAt: version(A) }, NOW);
  assert.equal(outcome.kind, "unchanged");
  // The `unchanged` outcome carries no `updatedAt`, no `resolvedAt` and no write of any kind, so the route's
  // matching branch cannot move the version, rewrite the resolution instant, or duplicate anything behind it.
  assert.equal("updatedAt" in outcome, false);
  assert.equal("resolvedAt" in outcome, false);
  assert.equal(outcome.kind === "unchanged" && outcome.item.updatedAt, B);
});

test("item FIRST-touch retry: no version at all, row now exists with the requested state -> unchanged", () => {
  // The same hole on the first touch. The original request carried no precondition because no row existed; the
  // retry still carries none, while the row the first attempt created now has a version.
  const created = persistedItem({ state: "not_applicable", resolvedAt: B, updatedAt: B });
  assert.equal(resolveCateringCloseoutItemSave(created, { state: "not_applicable" }, NOW).kind, "unchanged");
});

test("item genuine stale change: authoritative state differs, version stale -> conflict", () => {
  // Another tab moved the item to `not_applicable`; this stale request asks for something else entirely.
  const moved = persistedItem({ state: "not_applicable", resolvedAt: B, updatedAt: B });
  assert.equal(resolveCateringCloseoutItemSave(moved, { state: "completed", expectedUpdatedAt: version(A) }, NOW).kind, "conflict");
});

test("item genuine stale change: same state but a different note -> conflict", () => {
  // A note is material. Matching on state alone would have let a stale edit silently lose the other tab's words.
  const moved = persistedItem({ state: "completed", providerNote: "theirs", resolvedAt: B, updatedAt: B });
  assert.equal(resolveCateringCloseoutItemSave(moved, { state: "completed", providerNote: "mine", expectedUpdatedAt: version(A) }, NOW).kind, "conflict");
});

test("item: a stale request that clears a note still conflicts", () => {
  const moved = persistedItem({ state: "completed", providerNote: "theirs", resolvedAt: B, updatedAt: B });
  assert.equal(resolveCateringCloseoutItemSave(moved, { state: "completed", providerNote: null, expectedUpdatedAt: version(A) }, NOW).kind, "conflict");
});

test("item: an absent providerNote still means leave it alone, so only the state decides satisfaction", () => {
  const committed = persistedItem({ state: "completed", providerNote: "kept", resolvedAt: B, updatedAt: B });
  // Asking for the state that is already there, with no note in the request, changes nothing.
  assert.equal(resolveCateringCloseoutItemSave(committed, { state: "completed", expectedUpdatedAt: version(A) }, NOW).kind, "unchanged");
  // Asking for a different state does, so the precondition is enforced.
  assert.equal(resolveCateringCloseoutItemSave(committed, { state: "pending", expectedUpdatedAt: version(A) }, NOW).kind, "conflict");
});

test("item: normal optimistic concurrency is untouched when the version is current", () => {
  const current = persistedItem({ updatedAt: B });
  const outcome = resolveCateringCloseoutItemSave(current, { state: "completed", providerNote: "done", expectedUpdatedAt: version(B) }, NOW);
  assert.equal(outcome.kind, "save");
  if (outcome.kind !== "save") return;
  assert.deepEqual(outcome.updatedAt, NOW);
  assert.deepEqual(outcome.resolvedAt, NOW);
  assert.equal(outcome.resolvedIsNew, true);
});

test("item: a first write to a row that does not exist yet is still a save", () => {
  // Nothing is satisfied by an absent row, so this falls through to the precondition and then to the write.
  assert.equal(resolveCateringCloseoutItemSave(undefined, { state: "completed" }, NOW).kind, "save");
  // And a version claimed for a row that does not exist is still a conflict.
  assert.equal(resolveCateringCloseoutItemSave(undefined, { state: "completed", expectedUpdatedAt: version(A) }, NOW).kind, "conflict");
});

test("item: resolution attribution and instants are preserved by the reorder", () => {
  // Editing only the note keeps the instant the work was actually resolved at, exactly as before.
  const resolved = persistedItem({ state: "completed", providerNote: "old", resolvedAt: A, updatedAt: B });
  const outcome = resolveCateringCloseoutItemSave(resolved, { state: "completed", providerNote: "new", expectedUpdatedAt: version(B) }, NOW);
  assert.equal(outcome.kind, "save");
  if (outcome.kind !== "save") return;
  assert.deepEqual(outcome.resolvedAt, A);
  assert.equal(outcome.resolvedIsNew, false);
  assert.equal(outcome.clearsResolution, false);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Provider-private notes
 * ----------------------------------------------------------------------------------------------------------- */

test("notes lost-response retry: stale version, notes already equal -> unchanged", () => {
  const committed = { providerNotes: "the kitchen was tiny", updatedAt: B };
  assert.equal(resolveCateringCloseoutNotesSave(committed, { providerNotes: "the kitchen was tiny", expectedUpdatedAt: version(A) }, NOW).kind, "unchanged");
});

test("notes FIRST-touch retry: no version at all, record now holds the submitted text -> unchanged", () => {
  const created = { providerNotes: "first note", updatedAt: B };
  assert.equal(resolveCateringCloseoutNotesSave(created, { providerNotes: "first note" }, NOW).kind, "unchanged");
});

test("notes genuine stale change: authoritative notes differ, version stale -> conflict", () => {
  const moved = { providerNotes: "somebody else's words", updatedAt: B };
  assert.equal(resolveCateringCloseoutNotesSave(moved, { providerNotes: "mine", expectedUpdatedAt: version(A) }, NOW).kind, "conflict");
});

test("notes: a stale request that clears real notes still conflicts", () => {
  const moved = { providerNotes: "theirs", updatedAt: B };
  assert.equal(resolveCateringCloseoutNotesSave(moved, { providerNotes: null, expectedUpdatedAt: version(A) }, NOW).kind, "conflict");
});

test("notes: clearing already-cleared notes is unchanged, whatever version is claimed", () => {
  const cleared = { providerNotes: null, updatedAt: B };
  assert.equal(resolveCateringCloseoutNotesSave(cleared, { providerNotes: null, expectedUpdatedAt: version(A) }, NOW).kind, "unchanged");
});

test("notes: normal optimistic concurrency is untouched when the version is current", () => {
  const current = { providerNotes: "old", updatedAt: B };
  const outcome = resolveCateringCloseoutNotesSave(current, { providerNotes: "new", expectedUpdatedAt: version(B) }, NOW);
  assert.equal(outcome.kind, "save");
  assert.equal(outcome.kind === "save" && outcome.providerNotes, "new");
});

test("notes: a first write to a record that does not exist yet is still a save, and a claimed version conflicts", () => {
  assert.equal(resolveCateringCloseoutNotesSave(undefined, { providerNotes: "first" }, NOW).kind, "save");
  assert.equal(resolveCateringCloseoutNotesSave(undefined, { providerNotes: "first", expectedUpdatedAt: version(A) }, NOW).kind, "conflict");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Same-class audit: completion and reopening already order correctly
 * ----------------------------------------------------------------------------------------------------------- */

const blockedFacts = cateringCloseoutFacts({
  booking: { status: "completed", completedAt: A }, record: undefined, equipment: [], items: [],
  outstandingSharedRequirementCount: 0, sharedDocumentCount: 0, customerReviewExists: false,
}, "provider");

test("completion still judges settled state before the precondition", () => {
  const closed = { closedOutAt: B, reopenCount: 0, updatedAt: B };
  // A retry carrying the stale version its own committed predecessor moved past resolves to the settled record.
  assert.equal(resolveCateringCloseoutComplete(closed, blockedFacts, version(A), NOW).kind, "already_closed");
  // And with no version at all, which is what a first-touch retry carries.
  assert.equal(resolveCateringCloseoutComplete(closed, blockedFacts, undefined, NOW).kind, "already_closed");
  // A stale precondition on a record that is still OPEN is a genuine conflict, and stays one.
  assert.equal(resolveCateringCloseoutComplete({ closedOutAt: null, reopenCount: 0, updatedAt: B }, blockedFacts, version(A), NOW).kind, "conflict");
});

test("reopening still judges settled state before the precondition", () => {
  const open = { closedOutAt: null, reopenCount: 1, updatedAt: B };
  assert.equal(resolveCateringCloseoutReopen(open, version(A), NOW).kind, "already_open");
  assert.equal(resolveCateringCloseoutReopen(open, undefined, NOW).kind, "already_open");
  assert.equal(resolveCateringCloseoutReopen({ closedOutAt: B, reopenCount: 0, updatedAt: B }, version(A), NOW).kind, "conflict");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Structural: the ordering itself
 * ----------------------------------------------------------------------------------------------------------- */

const policy = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "catering-booking-closeout-policy.ts"),
  "utf8",
);
function resolver(name: string): string {
  const start = policy.indexOf(`export function ${name}(`);
  assert.notEqual(start, -1, name);
  return policy.slice(start, policy.indexOf("\n}", start));
}

test("every Phase 2K resolver decides settled state before it judges the precondition", () => {
  // One rule, four resolvers, asserted structurally so a later edit cannot quietly reintroduce the old ordering in
  // any of them.
  for (const [name, settled] of [
    ["resolveCateringCloseoutItemSave", 'return { kind: "unchanged"'],
    ["resolveCateringCloseoutNotesSave", 'return { kind: "unchanged"'],
    ["resolveCateringCloseoutComplete", 'return { kind: "already_closed"'],
    ["resolveCateringCloseoutReopen", 'return { kind: "already_open"'],
  ] as const) {
    const body = resolver(name);
    const settledAt = body.indexOf(settled);
    const versionAt = body.indexOf("cateringCloseoutVersionMatches");
    assert.notEqual(settledAt, -1, `${name}: settled branch exists`);
    assert.notEqual(versionAt, -1, `${name}: precondition is enforced`);
    assert.ok(settledAt < versionAt, `${name}: settled state must be judged first`);
  }
});
