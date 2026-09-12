import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EMPTY_CATERING_CLOSEOUT_VERSIONS,
  adoptCateringCloseoutVersions,
  cateringCloseoutCompletePayload,
  cateringCloseoutEditorFor,
  cateringCloseoutItemPayload,
  cateringCloseoutNotesPayload,
  cateringCloseoutRebasedChecklist,
  cateringCloseoutRebasedRecord,
  cateringCloseoutReopenPayload,
  cateringCloseoutVersionsFromResponse,
  editCateringCloseoutForm,
  emptyCateringCloseoutForm,
  hydrateCateringCloseoutForm,
  laterCateringVersion,
  settleCateringCloseoutForm,
  type CateringCloseoutVersions,
} from "./catering-booking-closeout-state";
import type { CateringCloseoutItemView, CateringCloseoutRecordView } from "@shared/catering-booking-closeout";

/**
 * A successful mutation must advance the version the NEXT mutation states its precondition against, immediately --
 * not only once the invalidated query has refetched.
 *
 * The race this closes has no competing editor in it at all. One provider, one tab: they save their private notes
 * on record version A, the server writes and answers with version B, the mutation settles and `isPending` goes
 * false while the refetch is still in flight, and their very next action -- another save, a checklist edit,
 * completing closeout, reopening it -- states `expectedUpdatedAt: A`. The server then correctly refuses a conflict
 * that nobody caused.
 *
 * The narrow audit this finding prompted found the same shape on three more paths, and every one of them is
 * covered below: complete -> reopen, reopen -> complete/notes, and an item save -> reopening that item's editor.
 *
 * What must NOT regress while fixing it: newer text typed during a slow request is still the provider's, and
 * optimistic concurrency is still real -- a version another tab advanced past still wins.
 */
const IDENTITY = "user-1:booking-a";
const OTHER = "user-1:booking-b";
const A = "2026-09-05T10:00:00.000Z";
const B = "2026-09-05T10:00:05.000Z";
const C = "2026-09-05T10:00:09.000Z";

const record = (updatedAt: string | null): CateringCloseoutRecordView => ({
  closedOut: false, closedOutAt: null, reopenCount: 0, lastReopenedAt: null, updatedAt, providerNotes: null,
});
const item = (patch: Partial<CateringCloseoutItemView> = {}): CateringCloseoutItemView => ({
  key: "equipment_return_confirmed", label: "Equipment and rentals returned", description: "…",
  required: true, state: "pending", providerNote: null, resolvedAt: null, updatedAt: A, ...patch,
});
/** The component's own accessor, modelled: query record + whatever an accepted response has since returned. */
const rebased = (queryVersion: string | null, versions: CateringCloseoutVersions) =>
  cateringCloseoutRebasedRecord(record(queryVersion), versions, IDENTITY);
/** One accepted response being adopted, exactly as `onSuccess` does it. */
const accept = (versions: CateringCloseoutVersions, response: Record<string, unknown>, identity = IDENTITY) =>
  adoptCateringCloseoutVersions(versions, identity, cateringCloseoutVersionsFromResponse(response));

/* ----------------------------------------------------------------------------------------------------------- *
 * The reported finding: notes, immediate second save
 * ----------------------------------------------------------------------------------------------------------- */

test("a notes save immediately after a successful one uses the version that one returned, not the query's", () => {
  // 1. The first save goes out on version A.
  let versions = EMPTY_CATERING_CLOSEOUT_VERSIONS;
  assert.deepEqual(cateringCloseoutNotesPayload("first", rebased(A, versions).updatedAt ?? null), { providerNotes: "first", expectedUpdatedAt: A });
  // 2-3. The server writes and answers with B; the mutation settles.
  versions = accept(versions, { closeout: { ...record(B), providerNotes: "first" } });
  // 4-5. NO refetch has landed: the query still says A, and `isPending` is already false.
  const stillStale = A;
  // 6-7. The provider saves again straight away.
  const second = cateringCloseoutNotesPayload("second", rebased(stillStale, versions).updatedAt ?? null);
  // 8. It states B, so the server has no reason to refuse it.
  assert.equal(second.expectedUpdatedAt, B, "the second save must not state the version its predecessor advanced past");
});

test("without the ledger the second save would state the stale version, so the test above is not vacuous", () => {
  // The counterfactual: reading the query's record directly is exactly what produced the fabricated 409.
  assert.equal(cateringCloseoutNotesPayload("second", record(A).updatedAt ?? null).expectedUpdatedAt, A);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * In-flight edit protection must not regress
 * ----------------------------------------------------------------------------------------------------------- */

test("newer notes typed while a save is pending survive it, and the next save of them uses the returned version", () => {
  // 1. Submit A's text.
  const submitted = "text A";
  let form = editCateringCloseoutForm({ ...emptyCateringCloseoutForm(""), identity: IDENTITY }, submitted);
  // 2. The provider keeps typing while the request is in flight.
  form = editCateringCloseoutForm(form, "text B");
  // 3. The response for the FIRST text arrives and is settled against the exact snapshot that was sent.
  let versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: { ...record(B), providerNotes: submitted } });
  form = settleCateringCloseoutForm(form, IDENTITY, submitted, submitted);
  // 4. The newer text is untouched, and the form stays dirty so no poll may replace it.
  assert.equal(form.value, "text B", "a lost race must not destroy words typed since");
  assert.equal(form.dirty, true);
  // A hydration from the not-yet-refetched query still leaves the dirty form alone.
  assert.equal(hydrateCateringCloseoutForm(form, IDENTITY, submitted).value, "text B");
  // 5. And saving the newer text states the version the first save produced.
  assert.equal(cateringCloseoutNotesPayload(form.value, rebased(A, versions).updatedAt ?? null).expectedUpdatedAt, B);
});

test("a settled clean form still adopts the returned version for its next save", () => {
  const submitted = "only text";
  let form = editCateringCloseoutForm({ ...emptyCateringCloseoutForm(""), identity: IDENTITY }, submitted);
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: { ...record(B), providerNotes: submitted } });
  form = settleCateringCloseoutForm(form, IDENTITY, submitted, submitted);
  assert.equal(form.dirty, false, "the form settled clean, as it should");
  assert.equal(cateringCloseoutNotesPayload("edited again", rebased(A, versions).updatedAt ?? null).expectedUpdatedAt, B);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Cross-mutation version handoff
 * ----------------------------------------------------------------------------------------------------------- */

test("a version a notes save returned is used by an immediate complete and by an immediate reopen", () => {
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: record(B) });
  assert.deepEqual(cateringCloseoutCompletePayload(rebased(A, versions)), { expectedUpdatedAt: B });
  assert.deepEqual(cateringCloseoutReopenPayload(rebased(A, versions)), { expectedUpdatedAt: B });
});

test("complete -> reopen: reopening straight after closing out uses the completion's returned version", () => {
  // The audit's first same-class case, and the likeliest sequence of all: the provider closes out, notices
  // something, and undoes it before any refetch has landed.
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: { ...record(B), closedOut: true, closedOutAt: B }, duplicate: false });
  assert.deepEqual(cateringCloseoutReopenPayload(rebased(A, versions)), { expectedUpdatedAt: B });
});

test("reopen -> complete and reopen -> notes both use the reopening's returned version", () => {
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: { ...record(B), reopenCount: 1 } });
  assert.deepEqual(cateringCloseoutCompletePayload(rebased(A, versions)), { expectedUpdatedAt: B });
  assert.equal(cateringCloseoutNotesPayload("after reopen", rebased(A, versions).updatedAt ?? null).expectedUpdatedAt, B);
});

test("an idempotent retry's returned version is adopted too, so the retry does not strand the client", () => {
  // A completion answered `duplicate: true` still reports the authoritative record; ignoring it would leave the
  // next write stating a version the first attempt had already moved past.
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: { ...record(B), closedOut: true, closedOutAt: B }, duplicate: true });
  assert.deepEqual(cateringCloseoutReopenPayload(rebased(A, versions)), { expectedUpdatedAt: B });
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The checklist's own instance of the same race
 * ----------------------------------------------------------------------------------------------------------- */

test("an item editor reopened straight after that item's save uses the version the save returned", () => {
  // The audit's second same-class case. A successful item save closes the editor; reopening it used to rebuild it
  // from the stale query row and conflict on the very next save.
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { checklist: [item({ state: "completed", updatedAt: B })] });
  const [rebasedItem] = cateringCloseoutRebasedChecklist([item({ updatedAt: A })], versions, IDENTITY);
  assert.equal(rebasedItem.updatedAt, B);
  assert.equal(cateringCloseoutItemPayload(cateringCloseoutEditorFor(rebasedItem, IDENTITY)).expectedUpdatedAt, B);
});

test("an item save advances only its own item's version, and no other item's", () => {
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { checklist: [item({ updatedAt: B }), item({ key: "final_documents_delivered", updatedAt: null })] });
  const list = cateringCloseoutRebasedChecklist(
    [item({ updatedAt: A }), item({ key: "final_documents_delivered", updatedAt: null })],
    versions, IDENTITY,
  );
  assert.equal(list[0].updatedAt, B);
  // A key with no row yet still reports null, which is exactly the precondition a first touch sends.
  assert.equal(list[1].updatedAt, null);
  assert.equal("expectedUpdatedAt" in cateringCloseoutItemPayload(cateringCloseoutEditorFor(list[1], IDENTITY)), false);
});

test("a checklist response does not touch the record version, and a record response does not touch item versions", () => {
  // Each route returns exactly one of the two and changes exactly that one, so the ledger must not invent the other.
  const fromItems = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { checklist: [item({ updatedAt: B })] });
  assert.equal(fromItems.record, null);
  assert.equal(rebased(A, fromItems).updatedAt, A);
  const fromRecord = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: record(B) });
  assert.deepEqual(fromRecord.items, {});
  assert.equal(cateringCloseoutRebasedChecklist([item({ updatedAt: A })], fromRecord, IDENTITY)[0].updatedAt, A);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Optimistic concurrency is not weakened
 * ----------------------------------------------------------------------------------------------------------- */

test("a version another tab advanced past still wins over an adopted one", () => {
  // Adopting our own accepted write's version is not a licence to ignore a newer authoritative one. Once the
  // refetch lands carrying C, that is what the next write states -- exactly as it would have before the ledger.
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: record(B) });
  assert.equal(rebased(C, versions).updatedAt, C);
});

test("the ledger never moves a version backwards, however responses are ordered", () => {
  let versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: record(C) });
  versions = accept(versions, { closeout: record(B) });
  assert.equal(versions.record, C, "an out-of-order response cannot undo a newer version");
});

test("no precondition is ever fabricated for a record that does not exist yet", () => {
  // A first write must send no precondition at all, which is what the server reads as a first touch.
  assert.deepEqual(cateringCloseoutCompletePayload(rebased(null, EMPTY_CATERING_CLOSEOUT_VERSIONS)), {});
  assert.deepEqual(cateringCloseoutNotesPayload("first", rebased(null, EMPTY_CATERING_CLOSEOUT_VERSIONS).updatedAt ?? null), { providerNotes: "first" });
});

test("versions are compared as instants, not spellings", () => {
  assert.equal(laterCateringVersion("2026-09-05T10:00:00.000Z", "2026-09-05T10:00:00Z"), "2026-09-05T10:00:00.000Z");
  assert.equal(laterCateringVersion(A, B), B);
  assert.equal(laterCateringVersion(B, A), B);
  // An unparseable or absent value never wins, and never erases a real one.
  assert.equal(laterCateringVersion(A, "not-a-date"), A);
  assert.equal(laterCateringVersion(null, A), A);
  assert.equal(laterCateringVersion(null, null), null);
});

test("a malformed response advances nothing rather than poisoning the ledger", () => {
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: { updatedAt: null }, checklist: "nonsense" });
  assert.equal(versions.record, null);
  assert.deepEqual(versions.items, {});
  assert.equal(rebased(A, versions).updatedAt, A);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Identity scoping
 * ----------------------------------------------------------------------------------------------------------- */

test("a version returned for booking A never rebases booking B", () => {
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: record(C) }, IDENTITY);
  assert.equal(cateringCloseoutRebasedRecord(record(A), versions, OTHER).updatedAt, A);
  assert.equal(cateringCloseoutRebasedChecklist([item({ updatedAt: A })], versions, OTHER)[0].updatedAt, A);
});

test("adopting under another booking replaces the ledger rather than merging into it", () => {
  let versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: record(C), checklist: [item({ updatedAt: C })] }, IDENTITY);
  versions = accept(versions, { closeout: record(B) }, OTHER);
  assert.equal(versions.identity, OTHER);
  assert.equal(versions.record, B, "booking A's newer version did not survive into booking B");
  assert.deepEqual(versions.items, {}, "and neither did its item versions");
});

test("the rebase is a no-op that preserves object identity when nothing is fresher", () => {
  const source = record(C);
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: record(A) });
  assert.equal(cateringCloseoutRebasedRecord(source, versions, IDENTITY), source);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The component's own wiring
 * ----------------------------------------------------------------------------------------------------------- */

const component = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "catering", "BookingCloseout.tsx"),
  "utf8",
);

test("the returned versions are adopted before anything else settles", () => {
  const success = component.slice(component.indexOf("onSuccess: async (value, variables) => {"), component.indexOf("onError: async"));
  const adoptAt = success.indexOf("setVersions((current) => adoptCateringCloseoutVersions");
  assert.notEqual(adoptAt, -1, "the adoption happens on every accepted response");
  assert.ok(adoptAt < success.indexOf("setEditor("), "before the editor settles");
  assert.ok(adoptAt < success.indexOf("setNotesForm("), "before the notes form settles");
  // And under the ORIGINATING booking, so a response for a booking left behind cannot advance another's versions.
  assert.ok(success.includes("adoptCateringCloseoutVersions(current, started.identity,"));
});

test("every record mutation states its precondition against the rebased record", () => {
  assert.ok(component.includes("const rebasedRecord = closeout ? cateringCloseoutRebasedRecord(closeout.closeout, versions, identity) : null;"));
  assert.ok(component.includes("cateringCloseoutNotesPayload(notesForm.value, rebasedRecord?.updatedAt ?? null)"));
  assert.ok(component.includes("cateringCloseoutCompletePayload(rebasedRecord)"));
  assert.ok(component.includes("cateringCloseoutReopenPayload(rebasedRecord)"));
  // No mutation may read the query record's version directly any more.
  assert.equal(component.includes("closeout.closeout.updatedAt"), false);
  assert.equal(component.includes("closeout?.closeout.updatedAt"), false);
});

test("the checklist editors are opened from the rebased list", () => {
  assert.ok(component.includes("const checklist = cateringCloseoutRebasedChecklist(closeout.checklist ?? [], versions, identity);"));
});

test("the version ledger is booking-local and is reset on navigation with the rest of the state", () => {
  const reset = component.slice(component.indexOf("if (localIdentity === identity) return;"), component.indexOf("}, [identity, localIdentity]);"));
  assert.ok(reset.includes("setVersions(EMPTY_CATERING_CLOSEOUT_VERSIONS);"));
});
