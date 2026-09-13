import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  activeCateringCloseoutNotice,
  cateringCloseoutNotesPayload,
  discardCateringCloseoutForm,
  editCateringCloseoutForm,
  emptyCateringCloseoutForm,
  hydrateCateringCloseoutForm,
  markCateringCloseoutFormConflict,
  mayDiscardCateringCloseoutNotes,
  mayEditCateringCloseoutNotes,
  settleCateringCloseoutForm,
  type CateringCloseoutFormState,
} from "./catering-booking-closeout-state";

/**
 * A dirty form's concurrency version must travel WITH its text, and a transient notice must never speak for
 * another booking.
 *
 * VERSION. The notes form deliberately keeps unsaved words when a poll brings in a newer record -- but it was
 * taking `expectedUpdatedAt` from that freshly polled record. So a draft written against V1 claimed to be based on
 * the V2 another tab had just written, the server accepted it, and the other tab's words were silently gone. The
 * version the form submits now comes from the form itself, and only two things move it: a clean hydration, and
 * this form's own accepted save.
 *
 * NOTICE. Every other piece of booking-local state here carries its identity. The notice did not -- and it is the
 * one inside `role="alert"`, so on a navigation to an already-cached booking B, booking A's refusal was not merely
 * shown under B but announced there.
 */
const IDENTITY = "user-1:booking-a";
const OTHER = "user-1:booking-b";
const V1 = "2026-09-05T10:00:00.000Z";
const V2 = "2026-09-05T10:00:05.000Z";
const V3 = "2026-09-05T10:00:09.000Z";

/** A form freshly hydrated from the authoritative record, as the component's effect does it. */
const hydrated = (text: string, version: string | null): CateringCloseoutFormState<string> =>
  hydrateCateringCloseoutForm(emptyCateringCloseoutForm(""), IDENTITY, text, version);
/** What the submit actually sends. */
const submitted = (form: CateringCloseoutFormState<string>) => cateringCloseoutNotesPayload(form.value, form.baseVersion);

/* ----------------------------------------------------------------------------------------------------------- *
 * The reported defect
 * ----------------------------------------------------------------------------------------------------------- */

test("a dirty draft ignores a version another tab advanced the record to", () => {
  // 1-2. Hydrated at V1, then edited locally.
  let form = hydrated("their notes", V1);
  form = editCateringCloseoutForm(form, "my unsaved notes");
  // 3-5. Another tab saves, the server advances to V2, and this tab's poll receives it.
  form = hydrateCateringCloseoutForm(form, IDENTITY, "somebody else's notes", V2);
  // 6. The local text survives, as it always did...
  assert.equal(form.value, "my unsaved notes");
  // 7-8. ...and so does the version it was written against. That is the fix.
  assert.equal(form.baseVersion, V1, "a poll must not advance a dirty form's version");
  // 9-10. So the save states V1, and the server refuses it instead of silently overwriting V2.
  assert.equal(submitted(form).expectedUpdatedAt, V1);
});

test("without the fix that draft would have claimed the newer version, so the test above is not vacuous", () => {
  // The counterfactual: reading the freshly polled record is exactly what produced the silent lost update.
  const polledRecordVersion = V2;
  assert.equal(cateringCloseoutNotesPayload("my unsaved notes", polledRecordVersion).expectedUpdatedAt, V2);
});

test("a genuine another-tab edit now conflicts rather than silently overwriting", () => {
  let form = hydrated("original", V1);
  form = editCateringCloseoutForm(form, "mine");
  form = hydrateCateringCloseoutForm(form, IDENTITY, "theirs", V2);
  // The submitted precondition is the one the provider actually saw, so the server's stale check fires.
  assert.notEqual(submitted(form).expectedUpdatedAt, V2);
  assert.equal(submitted(form).expectedUpdatedAt, V1);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * What DOES move the version
 * ----------------------------------------------------------------------------------------------------------- */

test("a clean form hydrates both its text and its version", () => {
  const clean = hydrated("stored", V1);
  assert.equal(clean.dirty, false);
  const polled = hydrateCateringCloseoutForm(clean, IDENTITY, "newer stored", V2);
  assert.equal(polled.value, "newer stored");
  assert.equal(polled.baseVersion, V2, "there is nothing to lose, so moving with the record is safe");
});

test("this form's own accepted save advances its version", () => {
  let form = hydrated("stored", V1);
  form = editCateringCloseoutForm(form, "mine");
  assert.equal(form.baseVersion, V1);
  // The save is accepted and the server answers with V2.
  form = settleCateringCloseoutForm(form, IDENTITY, "mine", "mine", V2);
  assert.equal(form.baseVersion, V2);
  assert.equal(form.dirty, false);
  // An immediate second edit and save therefore state V2, with no refetch involved.
  form = editCateringCloseoutForm(form, "mine again");
  assert.equal(submitted(form).expectedUpdatedAt, V2);
});

test("typing during a save keeps the newer words AND advances the version", () => {
  // Submit draft A from V1...
  let form = editCateringCloseoutForm(hydrated("stored", V1), "draft A");
  // ...then keep typing while the request is in flight.
  form = editCateringCloseoutForm(form, "draft B");
  // The response for A returns V2.
  form = settleCateringCloseoutForm(form, IDENTITY, "draft A", "draft A", V2);
  assert.equal(form.value, "draft B", "the newer words are not overwritten by the older submitted text");
  assert.equal(form.dirty, true, "and the form stays dirty, so a poll cannot replace them either");
  assert.equal(form.baseVersion, V2, "but the version this form's own save produced is adopted");
  assert.equal(submitted(form).expectedUpdatedAt, V2, "so the next save of B succeeds rather than conflicting");
});

test("a first save on a booking with no record yet states no precondition at all", () => {
  const form = editCateringCloseoutForm(hydrated("", null), "first notes");
  assert.equal(form.baseVersion, null);
  assert.equal("expectedUpdatedAt" in submitted(form), false);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Conflict handling
 * ----------------------------------------------------------------------------------------------------------- */

test("a refused save keeps its text, its version AND its conflict through hydration", () => {
  let form = editCateringCloseoutForm(hydrated("stored", V1), "mine");
  form = markCateringCloseoutFormConflict(form);
  // A poll is not a resolution. Clearing the flag while keeping the stale version was the worst of both: saving
  // re-enabled, the discard control vanished, and the next save stated the very version that had just been
  // refused -- an unbreakable 409 loop.
  form = hydrateCateringCloseoutForm(form, IDENTITY, "theirs", V2);
  assert.equal(form.value, "mine");
  assert.equal(form.baseVersion, V1);
  assert.equal(form.conflicted, true, "still conflicted, so Save stays blocked and Reload stays offered");
  assert.equal(mayEditCateringCloseoutNotes(form, IDENTITY, true, false), false);
  assert.equal(mayDiscardCateringCloseoutNotes(form, IDENTITY), true);
});

test("repeated polling while conflicted never clears it, however many arrive", () => {
  let form = markCateringCloseoutFormConflict(editCateringCloseoutForm(hydrated("stored", V1), "mine"));
  for (const [text, version] of [["theirs", V2], ["theirs again", V3], ["and again", V3]] as const) {
    form = hydrateCateringCloseoutForm(form, IDENTITY, text, version);
    assert.equal(form.conflicted, true);
    assert.equal(form.value, "mine");
    assert.equal(form.baseVersion, V1);
  }
});

test("the full reported loop is broken end to end", () => {
  // 1-2. Hydrated at V1, edited locally.
  let form = editCateringCloseoutForm(hydrated("stored", V1), "mine");
  // 3-5. An external writer advances to V2 and this save is refused.
  form = markCateringCloseoutFormConflict(form);
  // 6-9. The refetch arrives carrying V2; nothing about the form moves, and Save stays blocked.
  form = hydrateCateringCloseoutForm(form, IDENTITY, "theirs", V2);
  assert.equal(form.conflicted, true);
  assert.equal(form.baseVersion, V1);
  assert.equal(mayEditCateringCloseoutNotes(form, IDENTITY, true, false), false);
  // 10-12. The provider explicitly reloads, adopting the CURRENT authoritative text and version.
  form = discardCateringCloseoutForm(IDENTITY, "theirs", V2);
  assert.equal(form.conflicted, false);
  assert.equal(form.dirty, false);
  assert.equal(form.value, "theirs");
  // 13. And the next edit and save state V2, so they succeed.
  form = editCateringCloseoutForm(form, "mine, rewritten");
  assert.equal(mayEditCateringCloseoutNotes(form, IDENTITY, true, false), true);
  assert.equal(submitted(form).expectedUpdatedAt, V2);
});

test("an explicit reload uses whatever is authoritative at the moment it is chosen", () => {
  const conflicted = markCateringCloseoutFormConflict(editCateringCloseoutForm(hydrated("stored", V1), "mine"));
  assert.equal(conflicted.baseVersion, V1);
  // The record moved on again while they were deciding; the reload takes the newest, not the one that refused.
  const reloaded = discardCateringCloseoutForm(IDENTITY, "newest", V3);
  assert.equal(reloaded.baseVersion, V3);
  assert.equal(reloaded.value, "newest");
});

test("the explicit discard is the escape, and it is the only thing that takes the newer record", () => {
  const conflicted = markCateringCloseoutFormConflict(editCateringCloseoutForm(hydrated("stored", V1), "mine"));
  assert.equal(mayDiscardCateringCloseoutNotes(conflicted, IDENTITY), true);
  // Saving is blocked until they choose.
  assert.equal(mayEditCateringCloseoutNotes(conflicted, IDENTITY, true, false), false);
  const discarded = discardCateringCloseoutForm(IDENTITY, "theirs", V2);
  assert.equal(discarded.value, "theirs");
  assert.equal(discarded.baseVersion, V2);
  assert.equal(discarded.dirty, false);
  assert.equal(discarded.conflicted, false);
});

test("the discard is offered only on a conflicted form belonging to this booking", () => {
  const clean = hydrated("stored", V1);
  assert.equal(mayDiscardCateringCloseoutNotes(clean, IDENTITY), false);
  const conflicted = markCateringCloseoutFormConflict(editCateringCloseoutForm(clean, "mine"));
  assert.equal(mayDiscardCateringCloseoutNotes(conflicted, OTHER), false);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Cross-booking isolation of the version
 * ----------------------------------------------------------------------------------------------------------- */

test("booking A's draft and version never survive into booking B", () => {
  const onA = editCateringCloseoutForm(hydrated("A's notes", V1), "A's unsaved words");
  const onB = hydrateCateringCloseoutForm(onA, OTHER, "B's notes", V3);
  assert.equal(onB.identity, OTHER);
  assert.equal(onB.value, "B's notes");
  assert.equal(onB.baseVersion, V3);
  assert.equal(onB.dirty, false);
});

test("a settlement for booking A cannot advance booking B's version", () => {
  // Built under B's identity, which is what makes the guard the thing under test.
  const onB = editCateringCloseoutForm(
    hydrateCateringCloseoutForm(emptyCateringCloseoutForm(""), OTHER, "B's notes", V3),
    "B's words",
  );
  const settled = settleCateringCloseoutForm(onB, IDENTITY, "A's words", "A's saved", V2);
  assert.equal(settled, onB, "untouched");
  assert.equal(settled.baseVersion, V3, "B's version is not advanced by A's save");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The notice identity
 * ----------------------------------------------------------------------------------------------------------- */

test("a notice created on booking A does not render under booking B", () => {
  const notice = { identity: IDENTITY, message: "A's save was refused", retryable: false };
  assert.equal(activeCateringCloseoutNotice(notice, OTHER), null);
  assert.equal(activeCateringCloseoutNotice(notice, IDENTITY), notice);
});

test("an absent notice is simply absent for either booking", () => {
  assert.equal(activeCateringCloseoutNotice(null, IDENTITY), null);
  assert.equal(activeCateringCloseoutNotice(null, OTHER), null);
});

test("booking B's own notice renders normally", () => {
  const notice = { identity: OTHER, message: "B's save was refused", retryable: true };
  assert.equal(activeCateringCloseoutNotice(notice, OTHER)?.message, "B's save was refused");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The component's own wiring
 * ----------------------------------------------------------------------------------------------------------- */

const component = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "catering", "BookingCloseout.tsx"),
  "utf8",
);

test("the submit reads the FORM's version, and the hydration feeds only a clean form the record's", () => {
  assert.ok(component.includes("cateringCloseoutNotesPayload(notesForm.value, notesForm.baseVersion)"));
  assert.ok(component.includes("hydrateCateringCloseoutForm(current, identity, persistedNotes, notesAuthoritativeVersion)"));
  assert.ok(component.includes("const notesAuthoritativeVersion = rebasedRecord?.updatedAt ?? null;"));
  // The effect re-runs when the authoritative version moves, so a clean form keeps up with it.
  assert.ok(component.includes("}, [identity, provider, persistedNotes, notesAuthoritativeVersion, Boolean(closeout)]);"));
});

test("the accepted save hands its returned version to the settlement", () => {
  assert.ok(component.includes('settleCateringCloseoutForm(current, started.identity, variables.submittedNotes!, savedRecord?.providerNotes ?? "", savedVersion)'));
  assert.ok(component.includes('const savedVersion = typeof savedRecord?.updatedAt === "string" ? savedRecord.updatedAt : null;'));
});

test("the notice carries the originating booking and is read on the render path", () => {
  assert.ok(component.includes("setNotice({ identity: started.identity, message: outcome.message, retryable: outcome.retryable });"));
  assert.ok(component.includes("const shownNotice = localStateIsCurrent ? activeCateringCloseoutNotice(notice, identity) : null;"));
  // The alert renders from the guarded value, never from the raw state.
  assert.ok(component.includes('{shownNotice && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" role="alert">'));
  assert.equal(component.includes("{notice && <div"), false, "the unguarded render is gone");
  assert.equal(component.includes("{notice.message}"), false);
});

test("the conflicted notes form offers its explicit escape and blocks saving until then", () => {
  assert.ok(component.includes("mayDiscardCateringCloseoutNotes(notesForm, identity)"));
  assert.ok(component.includes("discardCateringCloseoutForm(identity, persistedNotes, notesAuthoritativeVersion)"));
  assert.ok(component.includes("Discard my edits and reload"));
});

test("the previous corrections on this head are untouched", () => {
  assert.ok(component.includes("await reconciled;"), "awaited reconciliation");
  assert.ok(component.includes("cateringCloseoutChecklistIsEditable(actionable,"), "checklist lock");
  assert.ok(component.includes("cateringCloseoutCanStillChange(polled.state.data?.bookingStatus)"), "polling predicate");
  assert.ok(component.includes("cateringCloseoutCompletePayload(rebasedRecord)"), "record-mutation rebasing");
  assert.equal(component.includes("You can ask them in the booking conversation"), false, "provider copy");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Same-class audit: every piece of booking-local transient state
 * ----------------------------------------------------------------------------------------------------------- */

test("every local state in the component is identity-carrying and read through an identity guard", () => {
  // Enumerated from the component rather than assumed, so a state added later without a guard fails here.
  const declared = Array.from(component.matchAll(/const \[(\w+), set\w+\] = useState/g)).map((match) => match[1]);
  assert.deepEqual(declared, ["notesForm", "editor", "notice", "versions", "localIdentity"]);
  // Each of the four booking-local values carries its own identity in its shape...
  assert.ok(component.includes("emptyCateringCloseoutForm(\"\")"), "notesForm: CateringCloseoutFormState carries identity");
  assert.ok(component.includes("cateringCloseoutEditorFor(item, identity)"), "editor: built with the identity");
  assert.ok(component.includes("setNotice({ identity: started.identity,"), "notice: tagged with its origin");
  assert.ok(component.includes("adoptCateringCloseoutVersions(current, started.identity,"), "versions: installed under the origin");
  // ...and each is read through a guard on the RENDER path, not merely cleared by a passive effect.
  assert.ok(component.includes("const notesAreCurrent = localStateIsCurrent && cateringCloseoutFormIsCurrent(notesForm, identity);"));
  assert.ok(component.includes("activeCateringCloseoutEditor(editor, identity, item.key, checklistEditable)"));
  assert.ok(component.includes("const shownNotice = localStateIsCurrent ? activeCateringCloseoutNotice(notice, identity) : null;"));
  assert.ok(component.includes("cateringCloseoutRebasedRecord(closeout.closeout, versions, identity)"));
  // `localIdentity` is the guard itself.
  assert.ok(component.includes("const localStateIsCurrent = localIdentity === identity;"));
});

test("all four booking-local values are reset together on a genuine navigation", () => {
  const reset = component.slice(component.indexOf("if (localIdentity === identity) return;"), component.indexOf("}, [identity, localIdentity]);"));
  for (const cleared of ["setNotesForm(", "setEditor(null)", "setNotice(null)", "setVersions("]) {
    assert.ok(reset.includes(cleared), cleared);
  }
});

test("no transient banner is rendered from anything but the query payload or a guarded local value", () => {
  // The other messages on the card are derived from the authoritative payload, which is keyed per booking by the
  // query cache, so they cannot describe a different booking than the one on screen.
  for (const derived of ["CATERING_CLOSEOUT_CHECKLIST_LOCKED_NOTICE", "CATERING_CLOSEOUT_CONVERSATION_NOTE", "CATERING_CLOSEOUT_CANCELLED_NOTICE"]) {
    assert.ok(component.includes(derived), derived);
  }
  // The mutation's own pending flag disables controls rather than displaying another booking's content, so it is
  // conservative rather than a leak -- but nothing renders text from it.
  assert.equal(/\{pending &&[^}]*message/.test(component), false);
});
