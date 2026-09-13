import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_CLOSEOUT_CHECKLIST_LOCKED_NOTICE,
  cateringCloseoutChecklistIsEditable,
  type CateringCloseoutItemView,
} from "@shared/catering-booking-closeout";
import {
  activeCateringCloseoutEditor,
  cateringCloseoutEditorFor,
  mayEditCateringCloseoutNotes,
  maySubmitCateringCloseoutEditor,
  reconcileCateringCloseoutEditor,
  emptyCateringCloseoutForm,
} from "@/pages/services/catering-booking-closeout-state";

/**
 * The interface must not offer checklist edits the server will only refuse.
 *
 * The route enforces the closed-out boundary under its advisory lock, and that remains the backstop. But the
 * client gated its checklist controls on `actionable` alone -- "provider, on a served booking" -- which stays true
 * after closing out, because reopening and private notes are both still legitimate. So a closed-out booking still
 * rendered "Update this item", still opened an editor, and still let Save fire a request whose only possible
 * outcome was a refusal.
 *
 * There is a race in it too: open an editor, let another tab complete closeout, let this tab's poll bring
 * `closedOut: true`, and the already-open editor stayed usable.
 *
 * The fix is one narrower condition -- `actionable && !closedOut` -- applied to all four checklist paths: the
 * reconcile effect, the render path, the open control and the submit guard. Notes are deliberately untouched.
 */
const IDENTITY = "user-1:booking-a";
const item = (patch: Partial<CateringCloseoutItemView> = {}): CateringCloseoutItemView => ({
  key: "equipment_return_confirmed", label: "Equipment and rentals returned", description: "…",
  required: true, state: "completed", providerNote: null, resolvedAt: null, updatedAt: "2026-09-05T10:00:00.000Z", ...patch,
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The condition
 * ----------------------------------------------------------------------------------------------------------- */

test("checklist editing needs an actionable closeout that is also still OPEN", () => {
  assert.equal(cateringCloseoutChecklistIsEditable(true, false), true, "provider, served, open");
  assert.equal(cateringCloseoutChecklistIsEditable(true, true), false, "closed out");
  assert.equal(cateringCloseoutChecklistIsEditable(false, false), false, "not actionable at all");
  assert.equal(cateringCloseoutChecklistIsEditable(false, true), false);
});

test("it is strictly narrower than actionability, which is the whole point", () => {
  // `actionable` stays true after closing out, because reopening and private notes both remain legitimate.
  const actionable = true;
  assert.notEqual(cateringCloseoutChecklistIsEditable(actionable, true), actionable);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Closed-out presentation
 * ----------------------------------------------------------------------------------------------------------- */

test("a closed-out closeout opens no editor for mutation", () => {
  const editable = cateringCloseoutChecklistIsEditable(true, true);
  const editor = cateringCloseoutEditorFor(item(), IDENTITY);
  assert.equal(activeCateringCloseoutEditor(editor, IDENTITY, "equipment_return_confirmed", editable), null);
});

test("a closed-out closeout cannot submit a checklist mutation", () => {
  const editable = cateringCloseoutChecklistIsEditable(true, true);
  assert.equal(maySubmitCateringCloseoutEditor(cateringCloseoutEditorFor(item(), IDENTITY), editable, false), false);
});

test("an OPEN closeout still does both, so the lock is not over-applied", () => {
  const editable = cateringCloseoutChecklistIsEditable(true, false);
  const editor = cateringCloseoutEditorFor(item(), IDENTITY);
  assert.equal(activeCateringCloseoutEditor(editor, IDENTITY, "equipment_return_confirmed", editable)?.identity, IDENTITY);
  assert.equal(maySubmitCateringCloseoutEditor(editor, editable, false), true);
});

test("the provider is pointed at the existing reopen action rather than left guessing", () => {
  assert.ok(CATERING_CLOSEOUT_CHECKLIST_LOCKED_NOTICE.includes("read-only"));
  assert.ok(CATERING_CLOSEOUT_CHECKLIST_LOCKED_NOTICE.toLowerCase().includes("reopen closeout"));
  // It names the remedy; it does not perform it.
  assert.equal(/automatic|automatically|we will/i.test(CATERING_CLOSEOUT_CHECKLIST_LOCKED_NOTICE), false);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * An editor opened before the transition
 * ----------------------------------------------------------------------------------------------------------- */

test("an editor open when closeout closes becomes inert on the RENDER path, before any effect flushes", () => {
  // 1-2. The provider opens an editor while closeout is open.
  const editor = cateringCloseoutEditorFor(item(), IDENTITY);
  assert.notEqual(activeCateringCloseoutEditor(editor, IDENTITY, "equipment_return_confirmed", cateringCloseoutChecklistIsEditable(true, false)), null);
  // 3-4. Another tab completes closeout and this tab's poll brings it in. The editor state still exists...
  const editable = cateringCloseoutChecklistIsEditable(true, true);
  // ...but the render path already refuses it, so there is no committed render in which it is usable.
  assert.equal(activeCateringCloseoutEditor(editor, IDENTITY, "equipment_return_confirmed", editable), null);
});

test("the reconcile effect then drops that editor entirely", () => {
  const editor = cateringCloseoutEditorFor(item(), IDENTITY);
  assert.equal(reconcileCateringCloseoutEditor(editor, IDENTITY, cateringCloseoutChecklistIsEditable(true, true)), null);
  // And leaves it alone while closeout is still open.
  assert.equal(reconcileCateringCloseoutEditor(editor, IDENTITY, cateringCloseoutChecklistIsEditable(true, false)), editor);
});

test("no request can be issued from that stale editor even if its state survives a render", () => {
  // The submit guard is the defence in depth: hiding the control is not relied on alone.
  const editor = cateringCloseoutEditorFor(item(), IDENTITY);
  assert.equal(maySubmitCateringCloseoutEditor(editor, cateringCloseoutChecklistIsEditable(true, true), false), false);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Reopen restores editability
 * ----------------------------------------------------------------------------------------------------------- */

test("after an explicit reopen the checklist becomes editable again", () => {
  // Closed: nothing is offered.
  assert.equal(cateringCloseoutChecklistIsEditable(true, true), false);
  // The provider reopens, the authoritative payload comes back with `closedOut: false`...
  const reopened = cateringCloseoutChecklistIsEditable(true, false);
  assert.equal(reopened, true);
  // ...and both the editor and its submit work normally again.
  const editor = cateringCloseoutEditorFor(item(), IDENTITY);
  assert.notEqual(activeCateringCloseoutEditor(editor, IDENTITY, "equipment_return_confirmed", reopened), null);
  assert.equal(maySubmitCateringCloseoutEditor(editor, reopened, false), true);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Notes are deliberately untouched
 * ----------------------------------------------------------------------------------------------------------- */

test("provider notes stay editable after closeout: the checklist lock is not applied to them", () => {
  const form = { ...emptyCateringCloseoutForm("my notes"), identity: IDENTITY };
  // Notes read `actionable`, which is still true on a closed-out booking -- matching the server, which allows them.
  assert.equal(mayEditCateringCloseoutNotes(form, IDENTITY, true, false), true);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The component's own wiring
 * ----------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingCloseout.tsx"), "utf8");

test("the narrower condition is derived once, from the authoritative payload", () => {
  assert.ok(component.includes("const checklistEditable = cateringCloseoutChecklistIsEditable(actionable, Boolean(closeout?.closeout.closedOut));"));
});

test("all four checklist paths use it", () => {
  assert.ok(component.includes("reconcileCateringCloseoutEditor(current, identity, checklistEditable)"), "reconcile effect");
  assert.ok(component.includes("}, [identity, checklistEditable]);"), "and re-runs when it changes");
  assert.ok(component.includes("activeCateringCloseoutEditor(editor, identity, item.key, checklistEditable)"), "render path");
  assert.ok(component.includes("maySubmitCateringCloseoutEditor(open, checklistEditable, pending)"), "submit guard");
  assert.ok(component.includes(": checklistEditable && <Button variant=\"outline\" className=\"mt-2 min-h-11\""), "the open control");
  assert.ok(component.includes("editable={checklistEditable}"), "the editor's Save button");
});

test("no checklist path still gates on bare actionability", () => {
  for (const stale of [
    "activeCateringCloseoutEditor(editor, identity, item.key, actionable)",
    "maySubmitCateringCloseoutEditor(open, actionable, pending)",
    "reconcileCateringCloseoutEditor(current, identity, actionable)",
  ]) {
    assert.equal(component.includes(stale), false, stale);
  }
});

test("notes and the closeout actions keep using actionability, unchanged", () => {
  // Notes: editable after closeout by design.
  assert.ok(component.includes("mayEditCateringCloseoutNotes(notesForm, identity, actionable, pending)"));
  // Completion is already impossible when closed, because the server derives `mayCloseOut: false` for a closed
  // record -- so its gate needed no narrowing and did not get one.
  assert.ok(component.includes("!actionable || pending || !closeout.readiness.mayCloseOut"));
  // Reopen's precondition IS being closed out, so it must stay available exactly there.
  assert.ok(component.includes("!actionable || pending || !closeout.closeout.closedOut"));
  // And the section holding the reopen control still renders on a closed booking.
  assert.ok(component.includes("{provider && actionable && <section aria-labelledby=\"closeout-action\""));
});

test("the locked notice renders only for a provider whose checklist is locked", () => {
  assert.ok(component.includes("{actionable && !checklistEditable && <p"));
  assert.ok(component.includes("{CATERING_CLOSEOUT_CHECKLIST_LOCKED_NOTICE}"));
});

test("checklist values stay readable while locked: only the edit controls are gated", () => {
  // The rows render from the payload unconditionally; nothing about rendering a value consults editability.
  assert.ok(component.includes("{checklist.map((item) => {"));
  assert.ok(component.includes("{CATERING_CLOSEOUT_ITEM_STATE_LABELS[item.state]}"));
  assert.ok(component.includes("{item.providerNote && !open &&"));
});

test("nothing reopens implicitly from the checklist", () => {
  const checklistSection = component.slice(component.indexOf('aria-labelledby="closeout-checklist"'), component.indexOf('aria-labelledby="closeout-notes"'));
  assert.equal(checklistSection.includes("/closeout/reopen"), false);
  assert.equal(checklistSection.includes("reopenCloseout"), false);
  // The single reopen call site is still the explicit action.
  assert.equal((component.match(/path: "\/closeout\/reopen"/g) ?? []).length, 1);
});

test("the previous corrections on this head are untouched", () => {
  assert.ok(component.includes("await reconciled;"), "awaited reconciliation");
  assert.ok(component.includes("adoptCateringCloseoutVersions(current, started.identity,"), "immediate version adoption");
  assert.ok(component.includes("cateringCloseoutCanStillChange(polled.state.data?.bookingStatus)"), "polling predicate");
  assert.equal(component.includes("You can ask them in the booking conversation"), false, "provider copy");
});
