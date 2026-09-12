import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cateringCloseoutFailureNotice,
  cateringCloseoutNotesPayload,
  discardCateringCloseoutForm,
  editCateringCloseoutForm,
  emptyCateringCloseoutForm,
  hydrateCateringCloseoutForm,
  isCateringCloseoutConflict,
  markCateringCloseoutEditorConflict,
  markCateringCloseoutFormConflict,
  mayDiscardCateringCloseoutNotes,
  mayEditCateringCloseoutNotes,
  shouldRefetchCloseoutAfterError,
  type CateringCloseoutError,
  type CateringCloseoutFormState,
} from "@/pages/services/catering-booking-closeout-state";
import {
  CATERING_CLOSEOUT_BLOCKED_CODE,
  CATERING_CLOSEOUT_CLOSED_CODE,
  CATERING_CLOSEOUT_NOT_AVAILABLE_CODE,
  CATERING_CLOSEOUT_VERSION_CONFLICT_CODE,
} from "@shared/catering-booking-closeout";

/**
 * Only an optimistic-concurrency refusal is a conflict.
 *
 * The notes form was marked conflicted on ANY failed save. That was survivable while the flag was advisory -- the
 * next poll cleared it and the version advanced anyway -- but it stopped being so once a conflict became sticky
 * and Save-blocking: a dropped connection or a 500 then disabled Save, left "discard my edits" as the only visible
 * route out, and made the "try again" notice sitting beside the disabled button a lie. In the offline case there
 * may not even be a newer authoritative record to discard onto.
 *
 * The checklist path had always been classified correctly. This is the notes path being held to the same rule.
 */
const IDENTITY = "user-1:booking-a";
const V1 = "2026-09-05T10:00:00.000Z";
const V2 = "2026-09-05T10:00:05.000Z";

const hydrated = (text: string, version: string | null): CateringCloseoutFormState<string> =>
  hydrateCateringCloseoutForm(emptyCateringCloseoutForm(""), IDENTITY, text, version);
/** A dirty draft, as it stands when a save is fired. */
const dirtyDraft = () => editCateringCloseoutForm(hydrated("stored", V1), "my unsaved words");
/** What the component's error handler does, now that both paths share one classifier. */
const onNotesError = (form: CateringCloseoutFormState<string>, error: CateringCloseoutError) =>
  isCateringCloseoutConflict(error) ? markCateringCloseoutFormConflict(form) : form;

const CONFLICT: CateringCloseoutError = { message: "stale", code: CATERING_CLOSEOUT_VERSION_CONFLICT_CODE };
const TRANSPORT: CateringCloseoutError = { message: "Failed to fetch", offline: true };
const SERVER_500: CateringCloseoutError = { message: "Internal Server Error" };

/* ----------------------------------------------------------------------------------------------------------- *
 * The classifier itself
 * ----------------------------------------------------------------------------------------------------------- */

test("only the version-conflict code classifies as a conflict", () => {
  assert.equal(isCateringCloseoutConflict(CONFLICT), true);
  assert.equal(isCateringCloseoutConflict(TRANSPORT), false);
  assert.equal(isCateringCloseoutConflict(SERVER_500), false);
  // Every other coded Phase 2K refusal is a refusal, not a stale precondition.
  for (const code of [CATERING_CLOSEOUT_NOT_AVAILABLE_CODE, CATERING_CLOSEOUT_BLOCKED_CODE, CATERING_CLOSEOUT_CLOSED_CODE]) {
    assert.equal(isCateringCloseoutConflict({ message: "x", code }), false, code);
  }
});

/* ----------------------------------------------------------------------------------------------------------- *
 * A genuine conflict still conflicts
 * ----------------------------------------------------------------------------------------------------------- */

test("a true concurrency conflict marks the notes form, blocks Save and preserves the draft", () => {
  const form = onNotesError(dirtyDraft(), CONFLICT);
  assert.equal(form.conflicted, true);
  assert.equal(form.value, "my unsaved words", "the draft is preserved");
  assert.equal(form.baseVersion, V1, "and so is the version it was written against");
  assert.equal(mayEditCateringCloseoutNotes(form, IDENTITY, true, false), false, "Save blocked");
  assert.equal(mayDiscardCateringCloseoutNotes(form, IDENTITY), true, "the explicit way out is offered");
});

test("that conflict still survives polling and still needs an explicit reload", () => {
  let form = onNotesError(dirtyDraft(), CONFLICT);
  form = hydrateCateringCloseoutForm(form, IDENTITY, "theirs", V2);
  assert.equal(form.conflicted, true, "a poll is still not a resolution");
  assert.equal(form.baseVersion, V1);
  form = editCateringCloseoutForm(form, "rewritten");
  assert.equal(form.conflicted, true, "and neither is typing: only an explicit adoption resolves it");
  assert.equal(form.value, "rewritten", "though the provider may still adjust their words");
  assert.equal(form.baseVersion, V1, "against the version that was refused, which is why Save stays blocked");
  assert.equal(mayEditCateringCloseoutNotes(form, IDENTITY, true, false), false, "Save still blocked");
  assert.equal(mayDiscardCateringCloseoutNotes(form, IDENTITY), true, "the reload is still offered");
  // The reload remains the way to adopt the authoritative record.
  const reloaded = discardCateringCloseoutForm(IDENTITY, "theirs", V2);
  assert.equal(reloaded.conflicted, false);
  assert.equal(reloaded.baseVersion, V2);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Ordinary failures do not
 * ----------------------------------------------------------------------------------------------------------- */

test("a transport failure leaves the form entirely alone", () => {
  const before = dirtyDraft();
  const after = onNotesError(before, TRANSPORT);
  assert.equal(after, before, "untouched, by reference");
  assert.equal(after.conflicted, false);
  assert.equal(after.dirty, true);
  assert.equal(after.value, "my unsaved words");
  assert.equal(after.baseVersion, V1);
});

test("a non-conflict server failure leaves the form entirely alone too", () => {
  const before = dirtyDraft();
  const after = onNotesError(before, SERVER_500);
  assert.equal(after, before, "untouched, by reference");
  assert.equal(after.conflicted, false);
  assert.equal(after.baseVersion, V1);
});

test("every other coded refusal also leaves the form unconflicted", () => {
  for (const code of [CATERING_CLOSEOUT_NOT_AVAILABLE_CODE, CATERING_CLOSEOUT_BLOCKED_CODE, CATERING_CLOSEOUT_CLOSED_CODE]) {
    assert.equal(onNotesError(dirtyDraft(), { message: "x", code }).conflicted, false, code);
  }
});

test("without the classifier these would all have been marked conflicted, so the tests are not vacuous", () => {
  // The counterfactual: the unconditional mark is exactly what disabled Save on a dropped connection.
  for (const error of [TRANSPORT, SERVER_500]) {
    const marked = markCateringCloseoutFormConflict(dirtyDraft());
    assert.equal(marked.conflicted, true);
    assert.equal(mayEditCateringCloseoutNotes(marked, IDENTITY, true, false), false, `would have blocked Save on ${error.message}`);
  }
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Retry after a transient failure
 * ----------------------------------------------------------------------------------------------------------- */

test("Save is usable again the moment the mutation settles, and retries the same draft", () => {
  const form = onNotesError(dirtyDraft(), TRANSPORT);
  // While the request was in flight, `pending` blocked Save. Once it settles, nothing else does.
  assert.equal(mayEditCateringCloseoutNotes(form, IDENTITY, true, true), false, "blocked while pending");
  assert.equal(mayEditCateringCloseoutNotes(form, IDENTITY, true, false), true, "usable again once settled");
  // And the retry states the same draft against the same version -- which is what makes it a retry.
  assert.deepEqual(cateringCloseoutNotesPayload(form.value, form.baseVersion), { providerNotes: "my unsaved words", expectedUpdatedAt: V1 });
});

test("no discard is forced: the escape is not even offered for an ordinary failure", () => {
  for (const error of [TRANSPORT, SERVER_500]) {
    assert.equal(mayDiscardCateringCloseoutNotes(onNotesError(dirtyDraft(), error), IDENTITY), false, error.message);
  }
});

test("the notice beside the button is now truthful about retrying", () => {
  // A retryable notice next to a Save the false conflict had disabled was the misleading combination.
  const transport = cateringCloseoutFailureNotice(TRANSPORT);
  assert.equal(transport.retryable, true);
  assert.equal(mayEditCateringCloseoutNotes(onNotesError(dirtyDraft(), TRANSPORT), IDENTITY, true, false), true, "and Save agrees");
  // A conflict is correctly reported as NOT retryable, and Save is correctly blocked.
  const conflict = cateringCloseoutFailureNotice(CONFLICT);
  assert.equal(conflict.retryable, false);
  assert.equal(mayEditCateringCloseoutNotes(onNotesError(dirtyDraft(), CONFLICT), IDENTITY, true, false), false);
});

test("a transport failure asks for no refetch, so nothing delays the retry", () => {
  assert.equal(shouldRefetchCloseoutAfterError(TRANSPORT), false);
  assert.equal(shouldRefetchCloseoutAfterError(CONFLICT), true);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The checklist path was already right, and stays right
 * ----------------------------------------------------------------------------------------------------------- */

test("the checklist editor is marked only on a genuine conflict, unchanged", () => {
  const editor = { identity: IDENTITY, key: "equipment_return_confirmed" as const, state: "pending" as const, note: "", expectedUpdatedAt: V1, conflicted: false };
  const onItemError = (error: CateringCloseoutError) =>
    isCateringCloseoutConflict(error) ? markCateringCloseoutEditorConflict(editor, "equipment_return_confirmed") : editor;
  assert.equal(onItemError(CONFLICT)?.conflicted, true);
  assert.equal(onItemError(TRANSPORT)?.conflicted, false);
  assert.equal(onItemError(SERVER_500)?.conflicted, false);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The component's own wiring, and the same-class audit
 * ----------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingCloseout.tsx"), "utf8");
const failure = component.slice(component.indexOf("onError: async (error: CateringCloseoutError, variables) => {"), component.indexOf("const pending = mutation.isPending;"));

test("both conflict marks share one classifier", () => {
  assert.ok(failure.includes('if (variables.settle === "notes" && isCateringCloseoutConflict(error)) setNotesForm(markCateringCloseoutFormConflict);'));
  assert.ok(failure.includes('if (variables.settle === "item" && variables.itemKey && isCateringCloseoutConflict(error)) {'));
  // The unconditional mark is gone.
  assert.equal(failure.includes('if (variables.settle === "notes") setNotesForm'), false);
});

test("every conflict mark in the handler is behind the classifier", () => {
  const marks = failure.split("\n").filter((line) => /markCateringCloseout\w*Conflict/.test(line) && !line.trim().startsWith("//"));
  assert.equal(marks.length, 2, "exactly two, notes and checklist");
  for (const mark of marks) {
    // Either on the guarded line itself, or inside the guarded block immediately above it.
    const guarded = mark.includes("isCateringCloseoutConflict(error)")
      || failure.slice(0, failure.indexOf(mark)).trimEnd().endsWith("isCateringCloseoutConflict(error)) {");
    assert.ok(guarded, mark.trim());
  }
});

test("completion and reopening set no sticky state on failure at all", () => {
  // Their controls are gated on `pending` and on authoritative payload values, neither of which an error touches,
  // so an ordinary failure cannot disable them permanently.
  assert.equal(failure.includes("setVersions("), false, "no version is adopted from a failure");
  assert.ok(component.includes("disabled={pending || !closeout.readiness.mayCloseOut}"));
  assert.ok(component.includes("!closeout || !rebasedRecord || !actionable || pending || !closeout.closeout.closedOut"));
});

test("the only state a failure writes is the notice, the two guarded conflicts, and the reconciliation await", () => {
  // Anchored on the `setX` convention -- a bare `set\w+` also matches `settlesHere`, which is a guard, not a setter.
  const setters = Array.from(failure.matchAll(/\bset([A-Z]\w+)\(/g)).map((match) => match[1]);
  assert.deepEqual(Array.from(new Set(setters)).sort(), ["Editor", "NotesForm", "Notice"]);
});

test("the previous corrections on this head are untouched", () => {
  assert.ok(component.includes("cateringCloseoutNotesPayload(notesForm.value, notesForm.baseVersion)"), "notes base version");
  assert.ok(component.includes("activeCateringCloseoutNotice(notice, identity)"), "notice identity");
  assert.ok(component.includes("observeCateringCloseoutTransition(transitionRef.current, identity, observedClosedOut)"), "activity sync");
  assert.ok(component.includes("cateringCloseoutChecklistIsEditable(actionable,"), "checklist lock");
  assert.ok(component.includes("await reconciled;"), "awaited reconciliation");
  assert.ok(component.includes("cateringCloseoutCanStillChange(polled.state.data?.bookingStatus)"), "polling predicate");
});
