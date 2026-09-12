import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EMPTY_CATERING_CLOSEOUT_VERSIONS,
  adoptCateringCloseoutVersions,
  cateringCloseoutChecklistFromResponse,
  cateringCloseoutEditorFor,
  cateringCloseoutItemPayload,
  cateringCloseoutNotesPayload,
  cateringCloseoutRebasedRecord,
  cateringCloseoutVersionsFromResponse,
  editCateringCloseoutForm,
  emptyCateringCloseoutForm,
  hydrateCateringCloseoutForm,
  markCateringCloseoutFormConflict,
  mayEditCateringCloseoutNotes,
  rebaseCateringCloseoutFormVersion,
  type CateringCloseoutFormState,
} from "@/pages/services/catering-booking-closeout-state";
import type { CateringCloseoutItemView, CateringCloseoutRecordView } from "@shared/catering-booking-closeout";

/**
 * A concurrency version and the value it describes are one atomic pair, and this tab's own writes are not a
 * stranger's.
 *
 * PAIRING. A checklist save returns the whole authoritative checklist -- captured inside its transaction, while
 * the closeout advisory lock was still held -- so adopting VERSIONS from it while leaving the rendered VALUES
 * behind pulled the pair apart. Another tab's newer item B arrived as a version this client took and a value it
 * threw away; if the reconciliation refetch then failed, the next save of B would state B's newer version against
 * B's older text, the server would accept it, and the other tab's change would be silently gone.
 *
 * SELF-CONFLICT. The notes form correctly ignores a version another writer produced. But the provider's OWN
 * complete or reopen also advances `catering_booking_closeout.updatedAt`, and neither of them touches
 * `providerNotes` -- so treating those like a stranger's write made the provider conflict with themselves.
 */
const IDENTITY = "user-1:booking-a";
const OTHER = "user-1:booking-b";
const V1 = "2026-09-05T10:00:00.000Z";
const V2 = "2026-09-05T10:00:05.000Z";

const record = (updatedAt: string | null): CateringCloseoutRecordView => ({
  closedOut: false, closedOutAt: null, reopenCount: 0, lastReopenedAt: null, updatedAt, providerNotes: null,
});
const item = (key: string, value: string, version: string): CateringCloseoutItemView => ({
  key: key as CateringCloseoutItemView["key"], label: key, description: "…",
  required: true, state: "pending", providerNote: value, resolvedAt: null, updatedAt: version,
});
const hydrated = (text: string, version: string | null): CateringCloseoutFormState<string> =>
  hydrateCateringCloseoutForm(emptyCateringCloseoutForm(""), IDENTITY, text, version);

/* ----------------------------------------------------------------------------------------------------------- *
 * This tab's own complete / reopen rebases a dirty notes form
 * ----------------------------------------------------------------------------------------------------------- */

test("completing closeout while notes are dirty advances only the version, never the text", () => {
  // 1-2. Hydrated at V1, with an unsaved draft.
  const dirty = editCateringCloseoutForm(hydrated("stored", V1), "my unsaved words");
  // 3-4. THIS TAB completes closeout; the response carries the parent record at V2.
  const after = rebaseCateringCloseoutFormVersion(dirty, IDENTITY, V2);
  // 5-7. Text untouched, still dirty, still unconflicted -- and the version has moved.
  assert.equal(after.value, "my unsaved words");
  assert.equal(after.dirty, true);
  assert.equal(after.conflicted, false);
  assert.equal(after.baseVersion, V2);
  // 8. So the immediate notes save states V2 and the provider does not conflict with themselves.
  assert.equal(cateringCloseoutNotesPayload(after.value, after.baseVersion).expectedUpdatedAt, V2);
});

test("reopening closeout while notes are dirty behaves identically", () => {
  const dirty = editCateringCloseoutForm(hydrated("stored", V1), "still unsaved");
  const after = rebaseCateringCloseoutFormVersion(dirty, IDENTITY, V2);
  assert.equal(after.value, "still unsaved");
  assert.equal(after.baseVersion, V2);
  assert.equal(after.dirty, true);
});

test("without the rebase the provider would have conflicted with their own completion", () => {
  // The counterfactual: keeping V1 is right for a stranger's write and wrong for the provider's own.
  const dirty = editCateringCloseoutForm(hydrated("stored", V1), "my unsaved words");
  assert.equal(cateringCloseoutNotesPayload(dirty.value, dirty.baseVersion).expectedUpdatedAt, V1);
});

test("an external poll still does NOT rebase a dirty form", () => {
  let dirty = editCateringCloseoutForm(hydrated("stored", V1), "mine");
  dirty = hydrateCateringCloseoutForm(dirty, IDENTITY, "theirs", V2);
  assert.equal(dirty.baseVersion, V1, "another writer's version is still refused");
  assert.equal(dirty.value, "mine");
});

test("a CONFLICTED notes form is not cured by completing or reopening", () => {
  const conflicted = markCateringCloseoutFormConflict(editCateringCloseoutForm(hydrated("stored", V1), "mine"));
  const after = rebaseCateringCloseoutFormVersion(conflicted, IDENTITY, V2);
  assert.equal(after, conflicted, "untouched, by reference");
  assert.equal(after.conflicted, true, "closing out resolves nothing about a competing notes edit");
  assert.equal(after.baseVersion, V1);
  assert.equal(mayEditCateringCloseoutNotes(after, IDENTITY, true, false), false, "Save stays blocked");
});

test("a rebase for another booking, or with no version, changes nothing", () => {
  const dirty = editCateringCloseoutForm(hydrated("stored", V1), "mine");
  assert.equal(rebaseCateringCloseoutFormVersion(dirty, OTHER, V2), dirty);
  assert.equal(rebaseCateringCloseoutFormVersion(dirty, IDENTITY, null), dirty);
  assert.equal(rebaseCateringCloseoutFormVersion(dirty, IDENTITY, V1), dirty, "and an identical version is a no-op");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Checklist values and versions stay paired
 * ----------------------------------------------------------------------------------------------------------- */

test("the ledger no longer carries checklist versions at all", () => {
  // The mechanism that could pair a new version with a stale value is gone, not merely guarded.
  const versions = adoptCateringCloseoutVersions(EMPTY_CATERING_CLOSEOUT_VERSIONS, IDENTITY, cateringCloseoutVersionsFromResponse({
    checklist: [item("equipment_return_confirmed", "B2", V2)],
  }));
  assert.deepEqual(Object.keys(versions).sort(), ["identity", "record"]);
  assert.equal(versions.record, null, "a checklist response advances no record version either");
});

test("an unrelated item's newer value and newer version arrive together, or not at all", () => {
  // Local A and B both at V1. Another tab changes B to B2/V2. This tab saves A; the response is the whole locked
  // snapshot, so B arrives complete.
  const installed = cateringCloseoutChecklistFromResponse({
    checklist: [item("equipment_return_confirmed", "A1", V2), item("final_documents_delivered", "B2", V2)],
  })!;
  const b = installed.find((entry) => entry.key === "final_documents_delivered")!;
  assert.equal(b.providerNote, "B2", "the value came with the version");
  assert.equal(b.updatedAt, V2);
  // Saving B afterwards therefore states V2 against B2 -- the pair the server actually holds.
  assert.equal(cateringCloseoutItemPayload(cateringCloseoutEditorFor(b, IDENTITY)).expectedUpdatedAt, V2);
  assert.equal(cateringCloseoutEditorFor(b, IDENTITY).note, "B2");
});

test("a reconciliation refetch failure cannot leave a stale value paired with a newer version", () => {
  // The install is the ONLY thing that moves a checklist version, and it moves the value in the same act -- so
  // whether or not the refetch that follows succeeds, the pair on screen is internally consistent.
  const rendered = [item("final_documents_delivered", "B1", V1)];
  const installed = cateringCloseoutChecklistFromResponse({ checklist: [item("final_documents_delivered", "B2", V2)] })!;
  // After the install (refetch then fails, changing nothing further):
  const afterFailedRefetch = installed;
  assert.equal(afterFailedRefetch[0].providerNote, "B2");
  assert.equal(afterFailedRefetch[0].updatedAt, V2);
  // Without an install there is simply no newer version anywhere to pair the old value with.
  assert.equal(rendered[0].providerNote, "B1");
  assert.equal(rendered[0].updatedAt, V1);
  for (const rows of [afterFailedRefetch, rendered]) {
    const editor = cateringCloseoutEditorFor(rows[0], IDENTITY);
    const paired = (editor.note === "B2" && editor.expectedUpdatedAt === V2) || (editor.note === "B1" && editor.expectedUpdatedAt === V1);
    assert.ok(paired, "value and version always belong to the same snapshot");
  }
});

test("saving B afterwards cannot silently overwrite the other tab's B2", () => {
  // Either the client holds B2/V2 -- in which case its save is an edit OF B2, not over it -- or it still holds
  // B1/V1, in which case the server refuses V1 as stale. The forbidden third state, B1 claiming V2, is unreachable.
  const installed = cateringCloseoutChecklistFromResponse({ checklist: [item("final_documents_delivered", "B2", V2)] })!;
  const fromInstalled = cateringCloseoutItemPayload(cateringCloseoutEditorFor(installed[0], IDENTITY));
  assert.equal(fromInstalled.expectedUpdatedAt, V2);
  const stillStale = cateringCloseoutItemPayload(cateringCloseoutEditorFor(item("final_documents_delivered", "B1", V1), IDENTITY));
  assert.equal(stillStale.expectedUpdatedAt, V1, "which the server refuses");
});

test("the record ledger has no pair to break, which is why it legitimately remains", () => {
  // Complete and reopen are idempotent state assertions carrying no client value, and the flags they change are
  // read raw from the query rather than through the ledger. The one field a client value could clobber --
  // `providerNotes` -- is owned by the form, which keeps its own text.
  const versions = adoptCateringCloseoutVersions(EMPTY_CATERING_CLOSEOUT_VERSIONS, IDENTITY, cateringCloseoutVersionsFromResponse({ closeout: record(V2) }));
  const rebasedRecord = cateringCloseoutRebasedRecord(record(V1), versions, IDENTITY);
  assert.equal(rebasedRecord.updatedAt, V2);
  assert.equal(rebasedRecord.closedOut, false, "the flags still come from the query, unrebased");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The component's own wiring
 * ----------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingCloseout.tsx"), "utf8");
const success = component.slice(component.indexOf("onSuccess: async (value, variables) => {"), component.indexOf("onError: async"));

test("the returned checklist snapshot is installed into the originating booking's cache entry", () => {
  assert.ok(success.includes("const returnedChecklist = cateringCloseoutChecklistFromResponse(value);"));
  assert.ok(success.includes("cache.setQueryData(cateringBookingCloseoutKey(started.userId, started.bookingId)"));
  // Merged into the existing payload; nothing is fabricated when this client holds none yet.
  assert.ok(success.includes("previous ? { ...previous, checklist: returnedChecklist } : previous"));
});

test("the install happens before the guard, so it lands even after navigating away", () => {
  assert.ok(success.indexOf("setQueryData") < success.indexOf("if (!settlesHere(started)) return;"));
  // And before the awaited refetch, so it does not depend on that refetch succeeding.
  assert.ok(success.indexOf("setQueryData") < success.indexOf("await reconciled;"));
});

test("the rows are read straight from the installed payload", () => {
  assert.ok(component.includes("const checklist = closeout.checklist ?? [];"));
  assert.equal(component.includes("cateringCloseoutRebasedChecklist"), false, "the version-only rebase is gone");
});

test("a non-notes record mutation rebases the notes form's version and nothing else", () => {
  assert.ok(success.includes("} else if (savedVersion) {"));
  assert.ok(success.includes("setNotesForm((current) => rebaseCateringCloseoutFormVersion(current, started.identity, savedVersion));"));
  // The notes save itself still settles text and version together, on the other branch.
  assert.ok(success.includes('settleCateringCloseoutForm(current, started.identity, variables.submittedNotes!, savedRecord?.providerNotes ?? "", savedVersion)'));
});

test("the previous corrections on this head are untouched", () => {
  assert.ok(component.includes("cateringCloseoutNotesPayload(notesForm.value, notesForm.baseVersion)"), "notes base version");
  assert.ok(component.includes('if (variables.settle === "notes" && isCateringCloseoutConflict(error))'), "error classification");
  assert.ok(component.includes("activeCateringCloseoutNotice(notice, identity)"), "notice identity");
  assert.ok(component.includes("observeCateringCloseoutTransition(transitionRef.current, identity, observedClosedOut)"), "activity sync");
  assert.ok(component.includes("cateringCloseoutChecklistIsEditable(actionable,"), "checklist lock");
  assert.ok(component.includes("await reconciled;"), "awaited reconciliation");
  assert.ok(component.includes("cateringCloseoutCanStillChange(polled.state.data?.bookingStatus)"), "polling predicate");
});
