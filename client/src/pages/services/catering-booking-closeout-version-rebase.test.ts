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
  cateringCloseoutChecklistFromResponse,
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
  form = settleCateringCloseoutForm(form, IDENTITY, submitted, submitted, B);
  // 4. The newer text is untouched, and the form stays dirty so no poll may replace it.
  assert.equal(form.value, "text B", "a lost race must not destroy words typed since");
  assert.equal(form.dirty, true);
  // A hydration from the not-yet-refetched query still leaves the dirty form alone.
  assert.equal(hydrateCateringCloseoutForm(form, IDENTITY, submitted, B).value, "text B");
  // 5. And saving the newer text states the version the first save produced.
  assert.equal(cateringCloseoutNotesPayload(form.value, rebased(A, versions).updatedAt ?? null).expectedUpdatedAt, B);
});

test("a settled clean form still adopts the returned version for its next save", () => {
  const submitted = "only text";
  let form = editCateringCloseoutForm({ ...emptyCateringCloseoutForm(""), identity: IDENTITY }, submitted);
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: { ...record(B), providerNotes: submitted } });
  form = settleCateringCloseoutForm(form, IDENTITY, submitted, submitted, B);
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
  // from the stale query row and conflict on the very next save. It is now the INSTALLED snapshot that carries the
  // fresh row -- value and version together -- so the reopened editor takes both.
  const installed = cateringCloseoutChecklistFromResponse({ checklist: [item({ state: "completed", updatedAt: B })] })!;
  assert.equal(installed[0].updatedAt, B);
  assert.equal(installed[0].state, "completed", "and the value it belongs to arrives with it");
  assert.equal(cateringCloseoutItemPayload(cateringCloseoutEditorFor(installed[0], IDENTITY)).expectedUpdatedAt, B);
});

test("the installed snapshot carries every key, including ones with no row yet", () => {
  const installed = cateringCloseoutChecklistFromResponse({
    checklist: [item({ updatedAt: B }), item({ key: "final_documents_delivered", updatedAt: null })],
  })!;
  assert.equal(installed[0].updatedAt, B);
  // A key with no row yet still reports null, which is exactly the precondition a first touch sends.
  assert.equal(installed[1].updatedAt, null);
  assert.equal("expectedUpdatedAt" in cateringCloseoutItemPayload(cateringCloseoutEditorFor(installed[1], IDENTITY)), false);
});

test("a checklist response does not touch the record version, and a record response carries no checklist", () => {
  // Each route returns exactly one of the two and changes exactly that one, so neither may invent the other.
  const fromItems = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { checklist: [item({ updatedAt: B })] });
  assert.equal(fromItems.record, null, "a checklist save does not advance the record version");
  assert.equal(rebased(A, fromItems).updatedAt, A);
  assert.equal(cateringCloseoutChecklistFromResponse({ closeout: record(B) }), null, "a record response installs no checklist");
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
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: { updatedAt: null } });
  assert.equal(versions.record, null);
  assert.equal(rebased(A, versions).updatedAt, A);
});

test("a malformed checklist installs nothing rather than replacing the rows with rubbish", () => {
  for (const malformed of ["nonsense", 42, null, undefined, [{ noKey: true }], [null]]) {
    assert.equal(cateringCloseoutChecklistFromResponse({ checklist: malformed }), null, String(malformed));
  }
  // A well-formed one installs.
  assert.equal(cateringCloseoutChecklistFromResponse({ checklist: [item({ updatedAt: B })] })?.length, 1);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Identity scoping
 * ----------------------------------------------------------------------------------------------------------- */

test("a version returned for booking A never rebases booking B", () => {
  const versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: record(C) }, IDENTITY);
  assert.equal(cateringCloseoutRebasedRecord(record(A), versions, OTHER).updatedAt, A);
});

test("adopting under another booking replaces the ledger rather than merging into it", () => {
  let versions = accept(EMPTY_CATERING_CLOSEOUT_VERSIONS, { closeout: record(C) }, IDENTITY);
  versions = accept(versions, { closeout: record(B) }, OTHER);
  assert.equal(versions.identity, OTHER);
  assert.equal(versions.record, B, "booking A's newer version did not survive into booking B");
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

test("completion and reopening state their precondition against the rebased record", () => {
  assert.ok(component.includes("const rebasedRecord = closeout ? cateringCloseoutRebasedRecord(closeout.closeout, versions, identity) : null;"));
  assert.ok(component.includes("cateringCloseoutCompletePayload(rebasedRecord)"));
  assert.ok(component.includes("cateringCloseoutReopenPayload(rebasedRecord)"));
  // Neither reads the query record's version directly, so a version this client's own write produced is used
  // immediately rather than only once the refetch lands.
  assert.equal(component.includes("closeout.closeout.updatedAt"), false);
  assert.equal(component.includes("closeout?.closeout.updatedAt"), false);
});

test("the notes form states ITS OWN base version, not the latest polled record's", () => {
  // Deliberately NOT the rebased record. A dirty draft must state the version its text was hydrated from, so
  // another tab's intervening save is refused as a conflict rather than silently overwritten. The rebased record
  // still feeds the CLEAN form's hydration, which is where this client's own writes reach it.
  assert.ok(component.includes("cateringCloseoutNotesPayload(notesForm.value, notesForm.baseVersion)"));
  assert.equal(component.includes("cateringCloseoutNotesPayload(notesForm.value, rebasedRecord"), false);
  assert.ok(component.includes("const notesAuthoritativeVersion = rebasedRecord?.updatedAt ?? null;"));
  assert.ok(component.includes("hydrateCateringCloseoutForm(current, identity, persistedNotes, notesAuthoritativeVersion)"));
});

test("the checklist editors are opened from the installed snapshot", () => {
  assert.ok(component.includes("const checklist = closeout.checklist ?? [];"), "read straight from the installed snapshot");
});

test("the version ledger is booking-local and is reset on navigation with the rest of the state", () => {
  const reset = component.slice(component.indexOf("if (localIdentity === identity) return;"), component.indexOf("}, [identity, localIdentity]);"));
  assert.ok(reset.includes("setVersions(EMPTY_CATERING_CLOSEOUT_VERSIONS);"));
});
