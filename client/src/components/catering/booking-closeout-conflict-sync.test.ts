import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  activeCateringCloseoutEditor,
  cateringCloseoutEditorFor,
  cateringCloseoutItemPayload,
  editCateringCloseoutEditor,
  markCateringCloseoutEditorConflict,
  mayReloadCateringCloseoutEditor,
  maySubmitCateringCloseoutEditor,
  observeCateringCloseoutTransition,
  settleCateringCloseoutEditor,
  type CateringCloseoutTransitionRecord,
} from "@/pages/services/catering-booking-closeout-state";
import type { CateringCloseoutItemView } from "@shared/catering-booking-closeout";

/**
 * Two things a conflicted checklist editor must not do, and one thing the closeout poll must.
 *
 * CONFLICT. A refused save marks the editor conflicted, blocks Save and offers Reload. But an ordinary local edit
 * cleared the flag -- while leaving `expectedUpdatedAt` exactly as stale as it was. Save re-enabled against the
 * version that had just been refused, Reload disappeared, and the provider could loop on 409 forever by doing
 * nothing but typing.
 *
 * SYNCHRONIZATION. Closing out and reopening each write a shared activity row in the SAME transaction as the state
 * change -- but the Activity panel lives in the parent workspace query, which does not poll, and one person's
 * invalidation cannot reach another person's browser. A customer watching their workspace would see the closeout
 * card update and the feed above it stay silent indefinitely.
 */
const IDENTITY = "user-1:booking-a";
const OTHER = "user-1:booking-b";
const V1 = "2026-09-05T10:00:00.000Z";
const V2 = "2026-09-05T10:00:05.000Z";

const item = (patch: Partial<CateringCloseoutItemView> = {}): CateringCloseoutItemView => ({
  key: "equipment_return_confirmed", label: "Equipment and rentals returned", description: "…",
  required: true, state: "pending", providerNote: null, resolvedAt: null, updatedAt: V1, ...patch,
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Checklist conflict persistence
 * ----------------------------------------------------------------------------------------------------------- */

test("editing the state of a conflicted editor does not clear the conflict", () => {
  // 1-5. Hydrated at V1, edited, another writer advances to V2, this save is refused.
  let editor = markCateringCloseoutEditorConflict(cateringCloseoutEditorFor(item(), IDENTITY), "equipment_return_confirmed");
  assert.equal(editor?.conflicted, true);
  // 6. The provider changes the state locally. `expectedUpdatedAt` is untouched by that, so the conflict stands.
  editor = editCateringCloseoutEditor(editor, IDENTITY, "equipment_return_confirmed", { state: "completed" });
  assert.equal(editor?.conflicted, true);
  assert.equal(editor?.expectedUpdatedAt, V1, "still the version that was refused");
});

test("editing the note of a conflicted editor does not clear the conflict either", () => {
  let editor = markCateringCloseoutEditorConflict(cateringCloseoutEditorFor(item(), IDENTITY), "equipment_return_confirmed");
  editor = editCateringCloseoutEditor(editor, IDENTITY, "equipment_return_confirmed", { note: "rewritten" });
  assert.equal(editor?.conflicted, true);
  assert.equal(editor?.note, "rewritten", "editing while conflicted is still allowed -- it is just not a resolution");
});

test("many local edits while conflicted never clear the flag", () => {
  let editor = markCateringCloseoutEditorConflict(cateringCloseoutEditorFor(item(), IDENTITY), "equipment_return_confirmed");
  for (const patch of [{ state: "completed" as const }, { note: "a" }, { state: "not_applicable" as const }, { note: "b" }]) {
    editor = editCateringCloseoutEditor(editor, IDENTITY, "equipment_return_confirmed", patch);
    assert.equal(editor?.conflicted, true);
  }
  assert.equal(editor?.expectedUpdatedAt, V1);
});

test("Save stays blocked and Reload stays offered throughout (8-9)", () => {
  let editor = markCateringCloseoutEditorConflict(cateringCloseoutEditorFor(item(), IDENTITY), "equipment_return_confirmed");
  editor = editCateringCloseoutEditor(editor, IDENTITY, "equipment_return_confirmed", { note: "changed my mind" });
  assert.equal(maySubmitCateringCloseoutEditor(editor!, true, false), false, "Save blocked");
  assert.equal(mayReloadCateringCloseoutEditor(editor, IDENTITY, [item({ updatedAt: V2 })]), true, "Reload offered");
});

test("the explicit reload adopts the authoritative row and version, and normal editing resumes (10-12)", () => {
  const conflicted = markCateringCloseoutEditorConflict(cateringCloseoutEditorFor(item(), IDENTITY), "equipment_return_confirmed");
  assert.equal(conflicted?.expectedUpdatedAt, V1);
  // Reloading rebuilds the editor from the authoritative row -- which is where V2 and the current values come from.
  const reloaded = cateringCloseoutEditorFor(item({ updatedAt: V2, state: "completed", providerNote: "theirs" }), IDENTITY);
  assert.equal(reloaded.conflicted, false);
  assert.equal(reloaded.expectedUpdatedAt, V2);
  assert.equal(reloaded.state, "completed");
  assert.equal(maySubmitCateringCloseoutEditor(reloaded, true, false), true);
  assert.equal(cateringCloseoutItemPayload(reloaded).expectedUpdatedAt, V2);
});

test("an accepted save still clears the conflict, because it genuinely resolves it", () => {
  // The one non-explicit path that may clear it: this editor's OWN save being accepted, which produces the new
  // version it rebases onto.
  const editor = editCateringCloseoutEditor(cateringCloseoutEditorFor(item(), IDENTITY), IDENTITY, "equipment_return_confirmed", { state: "completed", note: "newer" });
  const settled = settleCateringCloseoutEditor(editor, { identity: IDENTITY, key: "equipment_return_confirmed", state: "completed", note: "sent" }, item({ updatedAt: V2 }));
  assert.equal(settled?.conflicted, false);
  assert.equal(settled?.expectedUpdatedAt, V2);
});

test("a conflicted editor on a closed-out or foreign booking is still inert", () => {
  const editor = markCateringCloseoutEditorConflict(cateringCloseoutEditorFor(item(), IDENTITY), "equipment_return_confirmed");
  assert.equal(activeCateringCloseoutEditor(editor, OTHER, "equipment_return_confirmed", true), null);
  assert.equal(activeCateringCloseoutEditor(editor, IDENTITY, "equipment_return_confirmed", false), null, "checklist locked");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Closeout -> activity synchronization
 * ----------------------------------------------------------------------------------------------------------- */

/** Runs a sequence of observations, returning how many transitions were reported. */
function observe(sequence: readonly { identity: string; closedOut: boolean }[]): { transitions: number; record: CateringCloseoutTransitionRecord } {
  let record: CateringCloseoutTransitionRecord = null;
  let transitions = 0;
  for (const step of sequence) {
    const observed = observeCateringCloseoutTransition(record, step.identity, step.closedOut);
    record = observed.record;
    if (observed.transitioned) transitions += 1;
  }
  return { transitions, record };
}

test("a cross-user closeout is detected exactly once", () => {
  // Open, then the provider closes out and the customer's poll sees it.
  assert.equal(observe([
    { identity: IDENTITY, closedOut: false },
    { identity: IDENTITY, closedOut: true },
  ]).transitions, 1);
});

test("repeated polls reporting the same closed state do not repeat the invalidation", () => {
  assert.equal(observe([
    { identity: IDENTITY, closedOut: false },
    { identity: IDENTITY, closedOut: true },
    { identity: IDENTITY, closedOut: true },
    { identity: IDENTITY, closedOut: true },
    { identity: IDENTITY, closedOut: true },
  ]).transitions, 1, "one transition, four polls");
});

test("a cross-user reopen is detected exactly once, and repeats are inert", () => {
  assert.equal(observe([
    { identity: IDENTITY, closedOut: true },
    { identity: IDENTITY, closedOut: false },
    { identity: IDENTITY, closedOut: false },
    { identity: IDENTITY, closedOut: false },
  ]).transitions, 1);
});

test("a first observation is never a transition, even when it already reads closed", () => {
  // The workspace query is loading alongside it and needs no nudge; treating this as a transition would refetch
  // on every cold load.
  assert.equal(observe([{ identity: IDENTITY, closedOut: true }]).transitions, 0);
  assert.equal(observe([{ identity: IDENTITY, closedOut: false }]).transitions, 0);
});

test("an unchanged observation returns the previous record by reference, so nothing churns", () => {
  const first = observeCateringCloseoutTransition(null, IDENTITY, true);
  const second = observeCateringCloseoutTransition(first.record, IDENTITY, true);
  assert.equal(second.record, first.record);
  assert.equal(second.transitioned, false);
});

test("booking A's state cannot trigger an invalidation for booking B", () => {
  // Navigating A -> B records B and reports nothing, even though the flag differs between them.
  const afterA = observeCateringCloseoutTransition(null, IDENTITY, false);
  const onB = observeCateringCloseoutTransition(afterA.record, OTHER, true);
  assert.equal(onB.transitioned, false, "a different booking is never a transition");
  assert.deepEqual(onB.record, { identity: OTHER, closedOut: true });
});

test("navigating back to A starts its tracking fresh rather than replaying an old transition", () => {
  assert.equal(observe([
    { identity: IDENTITY, closedOut: false },
    { identity: OTHER, closedOut: true },
    { identity: IDENTITY, closedOut: true },
  ]).transitions, 0, "each arrival on a booking is a first observation for it");
});

test("a genuine transition after a navigation round trip is still detected", () => {
  assert.equal(observe([
    { identity: IDENTITY, closedOut: false },
    { identity: OTHER, closedOut: false },
    { identity: IDENTITY, closedOut: false },
    { identity: IDENTITY, closedOut: true },
  ]).transitions, 1);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The component's own wiring
 * ----------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingCloseout.tsx"), "utf8");

test("the detector runs from a ref, so observing costs no render and cannot feed itself", () => {
  assert.ok(component.includes("const transitionRef = useRef<CateringCloseoutTransitionRecord>(null);"));
  assert.ok(component.includes("const observed = observeCateringCloseoutTransition(transitionRef.current, identity, observedClosedOut);"));
  assert.ok(component.includes("transitionRef.current = observed.record;"));
  // Recorded BEFORE the invalidation, so the next poll reporting the same state is inert.
  const effect = component.slice(component.indexOf("const observedClosedOut = closeout?.closeout.closedOut;"), component.indexOf("}, [identity, observedClosedOut]);"));
  assert.ok(effect.indexOf("transitionRef.current = observed.record;") < effect.indexOf("if (observed.transitioned)"));
});

test("only the workspace query is invalidated, and only for the booking just observed", () => {
  const effect = component.slice(component.indexOf("const observedClosedOut = closeout?.closeout.closedOut;"), component.indexOf("}, [identity, observedClosedOut]);"));
  assert.ok(effect.includes('if (observed.transitioned) cache.invalidateQueries({ queryKey: ["catering", "booking-workspace", userId, bookingId] });'));
  // It must not invalidate the closeout query itself, which would be the loop.
  assert.equal(effect.includes("cateringBookingCloseoutKey"), false);
});

test("a local completion or reopening records its own result, so it does not double-invalidate", () => {
  assert.ok(component.includes('const settledClosedOut = (value.closeout as { closedOut?: boolean } | undefined)?.closedOut;'));
  assert.ok(component.includes("transitionRef.current = observeCateringCloseoutTransition(transitionRef.current, started.identity, settledClosedOut).record;"));
  // Recorded under the ORIGINATING booking, and only once the response is known to belong to the screen.
  const success = component.slice(component.indexOf("onSuccess: async (value, variables) => {"), component.indexOf("onError: async"));
  assert.ok(success.indexOf("if (!settlesHere(started)) return;") < success.indexOf("settledClosedOut"));
});

test("no transport, no second activity system, and no fabricated events were added", () => {
  for (const forbidden of ["WebSocket", "EventSource", "setInterval", "socket", "cateringBookingActivity", "eventType"]) {
    assert.equal(component.includes(forbidden), false, forbidden);
  }
});

test("the previous corrections on this head are untouched", () => {
  assert.ok(component.includes("cateringCloseoutNotesPayload(notesForm.value, notesForm.baseVersion)"), "notes base version");
  assert.ok(component.includes("activeCateringCloseoutNotice(notice, identity)"), "notice identity");
  assert.ok(component.includes("cateringCloseoutChecklistIsEditable(actionable,"), "checklist lock");
  assert.ok(component.includes("await reconciled;"), "awaited reconciliation");
  assert.ok(component.includes("cateringCloseoutCanStillChange(polled.state.data?.bookingStatus)"), "polling predicate");
});
