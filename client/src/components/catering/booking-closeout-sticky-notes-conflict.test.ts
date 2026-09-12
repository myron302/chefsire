import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  discardCateringCloseoutForm,
  editCateringCloseoutEditor,
  editCateringCloseoutForm,
  emptyCateringCloseoutForm,
  hydrateCateringCloseoutForm,
  markCateringCloseoutEditorConflict,
  markCateringCloseoutFormConflict,
  mayDiscardCateringCloseoutNotes,
  mayEditCateringCloseoutNotes,
  maySubmitCateringCloseoutEditor,
  rebaseCateringCloseoutFormVersion,
  settleCateringCloseoutForm,
  type CateringCloseoutFormState,
} from "@/pages/services/catering-booking-closeout-state";

/**
 * TYPING IS NOT A RESOLUTION.
 *
 * The notes form cleared `conflicted` on every local edit. Nothing else about the form moved -- `baseVersion` still
 * held the version the server had just refused -- so a single keystroke after a 409 re-enabled Save, hid the
 * "discard my edits and reload" control that was the only genuine way out, and armed the next save with exactly the
 * precondition that had already been rejected. The provider could sit in that loop indefinitely: save, refused,
 * type, save, refused, with no competing writer needed to keep it going and nothing on screen explaining why.
 *
 * The checklist editor had already been corrected to keep its conflict through local edits. These tests hold the
 * notes form to the same principle, and assert the two helpers agree.
 */

const IDENTITY = "user-1:booking-a";
const V1 = "2026-09-05T10:00:00.000Z";
const V2 = "2026-09-05T10:00:05.000Z";
const V3 = "2026-09-05T10:00:09.000Z";

const hydrated = (text: string, version: string | null): CateringCloseoutFormState<string> =>
  hydrateCateringCloseoutForm(emptyCateringCloseoutForm(""), IDENTITY, text, version);
/** A draft the provider has written, saved, and had refused as stale. */
const conflictedDraft = () =>
  markCateringCloseoutFormConflict(editCateringCloseoutForm(hydrated("stored", V1), "my unsaved words"));

/* ------------------------------------------------------------------------------------------------------------- *
 * Editing after a conflict
 * ------------------------------------------------------------------------------------------------------------- */

test("one more keystroke after a conflict keeps the conflict, the stale version and the block on Save", () => {
  const form = editCateringCloseoutForm(conflictedDraft(), "my unsaved words!");

  assert.equal(form.conflicted, true, "typing does not resolve what two writers did");
  assert.equal(form.baseVersion, V1, "and does not move the version that was refused");
  assert.equal(form.dirty, true);
  assert.equal(form.value, "my unsaved words!", "the local draft still updates -- editing stays allowed");
  assert.equal(mayEditCateringCloseoutNotes(form, IDENTITY, true, false), false, "Save stays unavailable");
  assert.equal(mayDiscardCateringCloseoutNotes(form, IDENTITY), true, "and the explicit reload stays offered");
});

test("no number of edits clears it", () => {
  let form = conflictedDraft();
  for (const text of ["a", "ab", "abc", "abcd", "abcde", "", "restarted from nothing"]) {
    form = editCateringCloseoutForm(form, text);
    assert.equal(form.conflicted, true, `cleared after typing ${JSON.stringify(text)}`);
    assert.equal(form.baseVersion, V1, "and the version never drifts");
    assert.equal(mayEditCateringCloseoutNotes(form, IDENTITY, true, false), false, "Save never re-enables");
    assert.equal(mayDiscardCateringCloseoutNotes(form, IDENTITY), true, "the reload never disappears");
  }
  assert.equal(form.value, "restarted from nothing");
});

test("polling between edits does not clear it either, and the pair together still does not", () => {
  let form = conflictedDraft();
  form = editCateringCloseoutForm(form, "adjusted");
  form = hydrateCateringCloseoutForm(form, IDENTITY, "what they wrote", V2);
  form = editCateringCloseoutForm(form, "adjusted again");
  assert.equal(form.conflicted, true);
  assert.equal(form.baseVersion, V1);
  assert.equal(form.value, "adjusted again");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * An ordinary edit is still an ordinary edit
 * ------------------------------------------------------------------------------------------------------------- */

test("editing a clean form marks it dirty and invents no conflict", () => {
  const form = editCateringCloseoutForm(hydrated("stored", V1), "my words");
  assert.equal(form.dirty, true);
  assert.equal(form.conflicted, false, "a conflict is something the SERVER reports, never something typing creates");
  assert.equal(form.baseVersion, V1, "and the version it was hydrated from travels with it");
  assert.equal(mayEditCateringCloseoutNotes(form, IDENTITY, true, false), true, "Save is available");
  assert.equal(mayDiscardCateringCloseoutNotes(form, IDENTITY), false, "and there is nothing to discard onto");
});

test("editing an already dirty, unconflicted form stays unconflicted", () => {
  let form = editCateringCloseoutForm(hydrated("stored", V1), "first");
  form = editCateringCloseoutForm(form, "second");
  form = editCateringCloseoutForm(form, "third");
  assert.equal(form.conflicted, false);
  assert.equal(form.dirty, true);
  assert.equal(form.value, "third");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The ways out, and only those
 * ------------------------------------------------------------------------------------------------------------- */

test("the explicit reload adopts the authoritative text AND its version together", () => {
  let form = conflictedDraft();
  form = editCateringCloseoutForm(form, "still mine");
  assert.equal(mayDiscardCateringCloseoutNotes(form, IDENTITY), true);

  const reloaded = discardCateringCloseoutForm(IDENTITY, "what they wrote", V2);
  assert.equal(reloaded.value, "what they wrote");
  assert.equal(reloaded.baseVersion, V2);
  assert.equal(reloaded.dirty, false);
  assert.equal(reloaded.conflicted, false);
  assert.equal(mayEditCateringCloseoutNotes(reloaded, IDENTITY, true, false), true, "and Save works again");
  assert.equal(mayDiscardCateringCloseoutNotes(reloaded, IDENTITY), false);
});

test("a booking identity reset clears it, because none of booking A's draft describes booking B", () => {
  const form = hydrateCateringCloseoutForm(conflictedDraft(), "user-1:booking-b", "b's notes", V2);
  assert.equal(form.identity, "user-1:booking-b");
  assert.equal(form.conflicted, false);
  assert.equal(form.value, "b's notes");
  assert.equal(form.baseVersion, V2);
});

test("this form's own accepted save clears it, because that installs matching text and version", () => {
  const conflicted = conflictedDraft();
  const settled = settleCateringCloseoutForm(conflicted, IDENTITY, "my unsaved words", "my unsaved words", V3);
  assert.equal(settled.conflicted, false, "the server accepted exactly these words at exactly this version");
  assert.equal(settled.value, "my unsaved words");
  assert.equal(settled.baseVersion, V3);
  assert.equal(settled.dirty, false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The same-tab parent rebase is unchanged, and still refuses to touch a conflict
 * ------------------------------------------------------------------------------------------------------------- */

test("a dirty, unconflicted draft still rebases on this tab's own complete or reopen, keeping every word", () => {
  const dirty = editCateringCloseoutForm(hydrated("stored", V1), "notes I am still writing");
  const rebased = rebaseCateringCloseoutFormVersion(dirty, IDENTITY, V1, V2);
  assert.equal(rebased.baseVersion, V2, "the parent record moved and this write provably left providerNotes alone");
  assert.equal(rebased.value, "notes I am still writing", "not a word is lost");
  assert.equal(rebased.dirty, true);
  assert.equal(rebased.conflicted, false);
  assert.equal(mayEditCateringCloseoutNotes(rebased, IDENTITY, true, false), true);
});

test("a CONFLICTED draft is not rebased by a complete or reopen -- that would launder a real conflict", () => {
  const conflicted = conflictedDraft();
  const after = rebaseCateringCloseoutFormVersion(conflicted, IDENTITY, V1, V2);
  assert.equal(after, conflicted, "returned untouched, by reference");
  assert.equal(after.conflicted, true);
  assert.equal(after.baseVersion, V1, "so Save cannot be re-armed against somebody else's newer record");
  assert.equal(mayEditCateringCloseoutNotes(after, IDENTITY, true, false), false);
  assert.equal(mayDiscardCateringCloseoutNotes(after, IDENTITY), true);
});

test("editing after that refused rebase still does not clear it", () => {
  let form = rebaseCateringCloseoutFormVersion(conflictedDraft(), IDENTITY, V1, V2);
  form = editCateringCloseoutForm(form, "typed after completing");
  assert.equal(form.conflicted, true);
  assert.equal(form.baseVersion, V1);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The two helpers agree
 * ------------------------------------------------------------------------------------------------------------- */

test("the checklist editor and the notes form now behave identically under a local edit", () => {
  const editor = markCateringCloseoutEditorConflict(
    { identity: IDENTITY, key: "equipment_returned", state: "outstanding", note: "", expectedUpdatedAt: V1, conflicted: false },
    "equipment_returned",
  );
  const editedEditor = editCateringCloseoutEditor(editor, IDENTITY, "equipment_returned", { note: "typed" });
  const editedForm = editCateringCloseoutForm(conflictedDraft(), "typed");

  assert.equal(editedEditor?.conflicted, true);
  assert.equal(editedForm.conflicted, true);
  assert.equal(editedEditor?.expectedUpdatedAt, V1, "neither moves the version it was refused at");
  assert.equal(editedForm.baseVersion, V1);
  assert.equal(maySubmitCateringCloseoutEditor(editedEditor!, true, false), false, "and neither can be submitted");
  assert.equal(mayEditCateringCloseoutNotes(editedForm, IDENTITY, true, false), false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The helper itself, and the component's wiring
 * ------------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const state = fs.readFileSync(path.join(here, "../../pages/services/catering-booking-closeout-state.ts"), "utf8");
const component = fs.readFileSync(path.join(here, "BookingCloseout.tsx"), "utf8");

test("the edit helper does not mention the conflict flag at all, so it cannot move it", () => {
  const body = state.slice(state.indexOf("export function editCateringCloseoutForm"));
  const fn = body.slice(0, body.indexOf("\n}") + 2);
  assert.equal(fn.includes("conflicted"), false, fn);
  assert.ok(fn.includes("return { ...current, value, dirty: true };"));
});

test("only the three explicit adoptions write conflicted: false onto a form", () => {
  // Every one of them installs an authoritative value and its matching version in the same expression.
  for (const owner of ["hydrateCateringCloseoutForm", "discardCateringCloseoutForm", "settleCateringCloseoutForm"]) {
    const body = state.slice(state.indexOf(`export function ${owner}`));
    assert.ok(body.slice(0, body.indexOf("\n}") + 2).includes("conflicted: false"), owner);
  }
  // And the rebase, which moves a version without a value, explicitly refuses to be one of them.
  const rebase = state.slice(state.indexOf("export function rebaseCateringCloseoutFormVersion"));
  const fn = rebase.slice(0, rebase.indexOf("\n}") + 2);
  assert.ok(fn.includes("if (current.conflicted) return current;"));
  assert.equal(fn.includes("conflicted: false"), false);
});

test("the component still routes typing through the edit helper and nothing else", () => {
  assert.ok(component.includes("setNotesForm((current) => editCateringCloseoutForm(current, event.target.value))"));
  // No local re-implementation that could quietly clear the flag on the way past.
  assert.equal(component.includes("conflicted: false"), false);
});
