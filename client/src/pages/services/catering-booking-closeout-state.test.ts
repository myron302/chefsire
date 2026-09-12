import assert from "node:assert/strict";
import test from "node:test";
import {
  activeCateringCloseoutEditor,
  cateringCloseoutCompletePayload,
  cateringCloseoutEditorFor,
  cateringCloseoutFailureNotice,
  cateringCloseoutFormIsCurrent,
  cateringCloseoutItemPayload,
  cateringCloseoutNotesPayload,
  cateringCloseoutProgress,
  editCateringCloseoutEditor,
  editCateringCloseoutForm,
  emptyCateringCloseoutForm,
  hydrateCateringCloseoutForm,
  isCateringCloseoutConflict,
  isCateringCloseoutUnavailable,
  markCateringCloseoutEditorConflict,
  markCateringCloseoutFormConflict,
  mayEditCateringCloseoutNotes,
  mayReloadCateringCloseoutEditor,
  maySubmitCateringCloseoutEditor,
  outstandingCateringCloseoutItems,
  reconcileCateringCloseoutEditor,
  settleCateringCloseoutEditor,
  settleCateringCloseoutForm,
  shouldRefetchCloseoutAfterError,
} from "./catering-booking-closeout-state";
import {
  CATERING_CLOSEOUT_BLOCKED_CODE,
  CATERING_CLOSEOUT_NOT_AVAILABLE_CODE,
  CATERING_CLOSEOUT_VERSION_CONFLICT_CODE,
  type CateringCloseoutItemView,
} from "@shared/catering-booking-closeout";

/**
 * The pure client state behind the Phase 2K section.
 *
 * Two things are being pinned here and nothing else matters as much: that nothing belonging to booking A can render
 * or submit under booking B, and that a slow or lost response can never throw away words the participant has typed
 * since they submitted.
 */
const A = "user-1:booking-a";
const B = "user-1:booking-b";
const V1 = "2026-09-05T10:00:00.000Z";
const V2 = "2026-09-05T11:00:00.000Z";

const itemView = (patch: Partial<CateringCloseoutItemView> = {}): CateringCloseoutItemView => ({
  key: "equipment_return_confirmed", label: "Equipment and rentals returned", description: "…",
  required: true, state: "pending", providerNote: null, resolvedAt: null, updatedAt: V1, ...patch,
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Error classification
 * ----------------------------------------------------------------------------------------------------------- */

test("a conflict is not retryable and keeps the edit; a transport failure is retryable and keeps it too", () => {
  const conflict = cateringCloseoutFailureNotice({ message: "x", code: CATERING_CLOSEOUT_VERSION_CONFLICT_CODE });
  assert.equal(conflict.retryable, false, "the same stale precondition would be refused again");
  assert.equal(conflict.keepsEdit, true);
  const offline = cateringCloseoutFailureNotice({ message: "network", offline: true });
  assert.equal(offline.retryable, true);
  assert.equal(offline.keepsEdit, true);
});

test("a coded refusal refetches; a transport failure does not", () => {
  for (const code of [CATERING_CLOSEOUT_VERSION_CONFLICT_CODE, CATERING_CLOSEOUT_NOT_AVAILABLE_CODE, CATERING_CLOSEOUT_BLOCKED_CODE]) {
    assert.equal(shouldRefetchCloseoutAfterError({ message: "x", code }), true, code);
  }
  // The request may have been applied and its response lost, and a refetch on a connection that just failed is
  // likely to fail too.
  assert.equal(shouldRefetchCloseoutAfterError({ message: "x", offline: true }), false);
  assert.equal(shouldRefetchCloseoutAfterError(null), false);
});

test("the two coded refusals are told apart", () => {
  assert.equal(isCateringCloseoutConflict({ message: "", code: CATERING_CLOSEOUT_VERSION_CONFLICT_CODE }), true);
  assert.equal(isCateringCloseoutUnavailable({ message: "", code: CATERING_CLOSEOUT_NOT_AVAILABLE_CODE }), true);
  assert.equal(isCateringCloseoutConflict({ message: "", code: CATERING_CLOSEOUT_NOT_AVAILABLE_CODE }), false);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Identity scoping
 * ----------------------------------------------------------------------------------------------------------- */

test("a form belonging to another booking is replaced wholesale, never merged", () => {
  const dirtyA = editCateringCloseoutForm({ ...emptyCateringCloseoutForm("stored"), identity: A }, "half-typed on A");
  const onB = hydrateCateringCloseoutForm(dirtyA, B, "B's stored notes");
  assert.equal(onB.identity, B);
  assert.equal(onB.value, "B's stored notes", "nothing of A's draft survives into B");
  assert.equal(onB.dirty, false);
});

test("a dirty form is left alone by a poll, so unsaved writing is never quietly replaced", () => {
  const dirty = editCateringCloseoutForm({ ...emptyCateringCloseoutForm("old"), identity: A }, "mine");
  assert.equal(hydrateCateringCloseoutForm(dirty, A, "theirs").value, "mine");
});

test("a form refused as stale keeps its text and stays conflicted until the provider resolves it", () => {
  const conflicted = markCateringCloseoutFormConflict(editCateringCloseoutForm({ ...emptyCateringCloseoutForm(""), identity: A }, "mine"));
  const polled = hydrateCateringCloseoutForm(conflicted, A, "theirs", "2026-09-05T11:00:00.000Z");
  assert.equal(polled.value, "mine", "the participant's words survive the conflict");
  assert.equal(polled.conflicted, true, "and a poll does not resolve it -- only the explicit reload does");
});

test("a form cannot be submitted while it belongs to another booking", () => {
  const formA = { ...emptyCateringCloseoutForm("A notes"), identity: A };
  assert.equal(cateringCloseoutFormIsCurrent(formA, B), false);
  assert.equal(mayEditCateringCloseoutNotes(formA, B, true, false), false);
  assert.equal(mayEditCateringCloseoutNotes(formA, A, true, false), true);
});

test("an editor opened on booking A never renders under booking B", () => {
  const editor = cateringCloseoutEditorFor(itemView(), A);
  assert.equal(activeCateringCloseoutEditor(editor, B, "equipment_return_confirmed", true), null);
  assert.equal(activeCateringCloseoutEditor(editor, A, "equipment_return_confirmed", true)?.identity, A);
  // And a foreign editor is dropped outright on reconciliation rather than being carried across.
  assert.equal(reconcileCateringCloseoutEditor(editor, B, true), null);
});

test("an editor is refused while the booking is not actionable, in both directions", () => {
  const editor = cateringCloseoutEditorFor(itemView(), A);
  assert.equal(activeCateringCloseoutEditor(editor, A, "equipment_return_confirmed", false), null);
  assert.equal(reconcileCateringCloseoutEditor(editor, A, false), null);
  assert.equal(maySubmitCateringCloseoutEditor(editor, false, false), false);
});

test("an edit aimed at another booking's editor is ignored", () => {
  const editor = cateringCloseoutEditorFor(itemView(), A);
  const attempted = editCateringCloseoutEditor(editor, B, "equipment_return_confirmed", { note: "B's words" });
  assert.equal(attempted?.note, "", "the edit did not land");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Conflict recovery
 * ----------------------------------------------------------------------------------------------------------- */

test("a conflicted editor is marked rather than closed, and saving is disabled until it is reloaded", () => {
  const editor = markCateringCloseoutEditorConflict(cateringCloseoutEditorFor(itemView(), A), "equipment_return_confirmed");
  assert.equal(editor?.conflicted, true);
  assert.equal(maySubmitCateringCloseoutEditor(editor!, true, false), false);
  assert.equal(editor?.note, "", "the provider's words stay on screen");
});

test("reload is offered only once the refetch has actually landed a different version", () => {
  const editor = markCateringCloseoutEditorConflict(cateringCloseoutEditorFor(itemView({ updatedAt: V1 }), A), "equipment_return_confirmed");
  // Still the version that was refused: reloading would conflict again, which reads as the control being broken.
  assert.equal(mayReloadCateringCloseoutEditor(editor, A, [itemView({ updatedAt: V1 })]), false);
  assert.equal(mayReloadCateringCloseoutEditor(editor, A, [itemView({ updatedAt: V2 })]), true);
  // And never for another booking's editor.
  assert.equal(mayReloadCateringCloseoutEditor(editor, B, [itemView({ updatedAt: V2 })]), false);
});

test("an unconflicted editor is never offered a reload", () => {
  const editor = cateringCloseoutEditorFor(itemView(), A);
  assert.equal(mayReloadCateringCloseoutEditor(editor, A, [itemView({ updatedAt: V2 })]), false);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Settlement
 * ----------------------------------------------------------------------------------------------------------- */

test("an accepted save closes the editor only if the provider has not kept typing", () => {
  const editor = editCateringCloseoutEditor(cateringCloseoutEditorFor(itemView(), A), A, "equipment_return_confirmed", { state: "completed", note: "sent" });
  const closed = settleCateringCloseoutEditor(editor, { identity: A, key: "equipment_return_confirmed", state: "completed", note: "sent" }, itemView({ updatedAt: V2 }));
  assert.equal(closed, null);
});

test("newer words are kept and rebased onto the version the save produced", () => {
  const editor = editCateringCloseoutEditor(cateringCloseoutEditorFor(itemView(), A), A, "equipment_return_confirmed", { state: "completed", note: "newer words" });
  const settled = settleCateringCloseoutEditor(editor, { identity: A, key: "equipment_return_confirmed", state: "completed", note: "sent" }, itemView({ updatedAt: V2 }));
  assert.equal(settled?.note, "newer words");
  assert.equal(settled?.expectedUpdatedAt, V2, "so the next attempt can actually succeed");
});

test("a completion for booking A cannot settle booking B's editor", () => {
  const editorB = cateringCloseoutEditorFor(itemView(), B);
  const settled = settleCateringCloseoutEditor(editorB, { identity: A, key: "equipment_return_confirmed", state: "completed", note: "A's note" }, itemView({ updatedAt: V2 }));
  assert.equal(settled, editorB, "untouched");
});

test("a notes save settles only the exact value that was submitted", () => {
  const live = editCateringCloseoutForm({ ...emptyCateringCloseoutForm(""), identity: A }, "newer");
  const untouched = settleCateringCloseoutForm(live, A, "submitted", "saved");
  assert.equal(untouched.value, "newer", "a lost race must not destroy words typed since");
  const settled = settleCateringCloseoutForm({ ...live, value: "submitted" }, A, "submitted", "saved");
  assert.equal(settled.value, "saved");
  assert.equal(settled.dirty, false);
});

test("a notes completion for booking A cannot settle booking B's form", () => {
  const formB = editCateringCloseoutForm({ ...emptyCateringCloseoutForm(""), identity: B }, "B's notes");
  assert.equal(settleCateringCloseoutForm(formB, A, "B's notes", "A's saved notes").value, "B's notes");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Payloads
 * ----------------------------------------------------------------------------------------------------------- */

test("a first touch sends no precondition, and a repeat touch sends the one it was opened against", () => {
  const first = cateringCloseoutItemPayload(cateringCloseoutEditorFor(itemView({ updatedAt: null }), A));
  assert.equal("expectedUpdatedAt" in first, false);
  const repeat = cateringCloseoutItemPayload(cateringCloseoutEditorFor(itemView({ updatedAt: V1 }), A));
  assert.equal(repeat.expectedUpdatedAt, V1);
});

test("an empty note is sent as null, not as an empty string", () => {
  const payload = cateringCloseoutItemPayload(cateringCloseoutEditorFor(itemView({ providerNote: "   " }), A));
  assert.equal(payload.providerNote, null);
  assert.deepEqual(cateringCloseoutNotesPayload("  ", null), { providerNotes: null });
  assert.deepEqual(cateringCloseoutNotesPayload("real", V1), { providerNotes: "real", expectedUpdatedAt: V1 });
});

test("no payload ever carries a participant, an actor or a role", () => {
  const payloads = [
    cateringCloseoutItemPayload(cateringCloseoutEditorFor(itemView(), A)),
    cateringCloseoutNotesPayload("x", V1),
    cateringCloseoutCompletePayload({ closedOut: false, closedOutAt: null, reopenCount: 0, lastReopenedAt: null, updatedAt: V1 }),
  ];
  for (const payload of payloads) {
    for (const forged of ["providerId", "customerId", "role", "closedOutBy", "resolvedBy", "actorId"]) {
      assert.equal(forged in payload, false, `${forged} must never be sent`);
    }
  }
});

test("a completion with no record yet sends no precondition", () => {
  assert.deepEqual(cateringCloseoutCompletePayload({ closedOut: false, closedOutAt: null, reopenCount: 0, lastReopenedAt: null, updatedAt: null }), {});
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Presentation
 * ----------------------------------------------------------------------------------------------------------- */

test("progress is computed from the payload, never from a stored number", () => {
  const items = [itemView({ state: "completed" }), itemView({ key: "final_documents_delivered", state: "not_applicable" }), itemView({ key: "review_request_handled" })];
  assert.deepEqual(cateringCloseoutProgress(items), { resolved: 2, total: 3 });
  assert.deepEqual(outstandingCateringCloseoutItems(items).map((item) => item.key), ["review_request_handled"]);
});
