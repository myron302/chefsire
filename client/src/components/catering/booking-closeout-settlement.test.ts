import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EMPTY_CATERING_CLOSEOUT_VERSIONS,
  adoptCateringCloseoutVersions,
  cateringCloseoutNotesPayload,
  cateringCloseoutRebasedRecord,
  cateringCloseoutVersionsFromResponse,
  editCateringCloseoutForm,
  emptyCateringCloseoutForm,
  settleCateringCloseoutForm,
} from "@/pages/services/catering-booking-closeout-state";
import type { CateringCloseoutRecordView } from "@shared/catering-booking-closeout";

/**
 * A mutation must not report itself finished while the query governing its dependent controls still holds the
 * PRE-mutation payload.
 *
 * Every control on this card reads the closeout query: `readiness.mayCloseOut` gates "Mark closeout complete",
 * `closeout.closedOut` chooses between that button and "Reopen closeout", and the checklist rows render from
 * `checklist`. Firing the invalidation without holding onto it let `isPending` go false first, which opened a
 * window where the provider could act on a payload their own last write had already invalidated -- move a required
 * item back to pending, then immediately click a still-enabled "Mark closeout complete" and be answered with a
 * blocked 409 describing a state the screen was no longer showing.
 *
 * `query-core` awaits `options.onSuccess` BEFORE it dispatches success (mutation.js: `await this.options.onSuccess`
 * then `this.#dispatch({ type: "success" })`), so returning the refetch promise genuinely keeps `isPending` true.
 * That library ordering is what the model below encodes, and both arrangements are modelled -- `awaited: true` is
 * the component as it stands, `awaited: false` is the one with the window -- so each case is asserted to be handled
 * AND asserted to have been mishandled before.
 */
type Payload = { mayCloseOut: boolean; closedOut: boolean; itemResolved: boolean };
type Harness = {
  awaited: boolean;
  /** What the closeout query currently holds, i.e. what every control renders from. */
  cache: Payload;
  /** `mutation.isPending`. */
  pending: boolean;
  /** A refetch that has been started and not yet delivered. */
  inFlight: (() => void) | null;
};

const mount = (cache: Payload, awaited: boolean): Harness => ({ awaited, cache, pending: false, inFlight: null });

/**
 * One mutation, run the way `query-core` runs it: the request settles, `onSuccess` runs, and success is dispatched
 * only once `onSuccess` has resolved. When the callback holds the refetch, the dispatch waits for it.
 */
function mutate(harness: Harness, nextCache: Payload) {
  harness.pending = true;
  const deliver = () => { harness.cache = nextCache; };
  if (harness.awaited) {
    // The callback returns the refetch, so the dispatch that clears `pending` is behind it.
    harness.inFlight = () => { deliver(); harness.pending = false; harness.inFlight = null; };
  } else {
    // The old arrangement: the refetch is started, success is dispatched immediately, the payload lands later.
    harness.pending = false;
    harness.inFlight = () => { deliver(); harness.inFlight = null; };
  }
}
/** The network delivering the refetch the mutation started. */
const deliverRefetch = (harness: Harness) => harness.inFlight?.();

/** Exactly the component's own gate: `disabled={pending || !closeout.readiness.mayCloseOut}`. */
const completeIsActionable = (harness: Harness) => !harness.pending && harness.cache.mayCloseOut;
/** Exactly the component's own branch: closed-out renders Reopen, otherwise it renders Mark complete. */
const shownAction = (harness: Harness) => (harness.cache.closedOut ? "reopen" : "complete");

/* ----------------------------------------------------------------------------------------------------------- *
 * The reported race: a checklist change must close the stale-action window
 * ----------------------------------------------------------------------------------------------------------- */

test("un-resolving a required item cannot leave a stale, still-enabled Mark closeout complete", () => {
  // 1. Everything required is answered, so completion is offered.
  const harness = mount({ mayCloseOut: true, closedOut: false, itemResolved: true }, true);
  assert.equal(completeIsActionable(harness), true);
  // 2-3. The provider moves a required item back to pending and the save succeeds.
  mutate(harness, { mayCloseOut: false, closedOut: false, itemResolved: false });
  // 4-6. The refreshed payload has NOT arrived yet -- and the button is not actionable in that gap.
  assert.equal(harness.pending, true, "the mutation is still pending through reconciliation");
  assert.equal(completeIsActionable(harness), false);
  // 7-8. Once it arrives, the control reflects the truth rather than being refused by the server.
  deliverRefetch(harness);
  assert.equal(harness.pending, false);
  assert.equal(harness.cache.mayCloseOut, false);
  assert.equal(completeIsActionable(harness), false, "no spurious 409 is reachable from the interface");
});

test("the unawaited arrangement really did open that window, so the test above is not vacuous", () => {
  const harness = mount({ mayCloseOut: true, closedOut: false, itemResolved: true }, false);
  mutate(harness, { mayCloseOut: false, closedOut: false, itemResolved: false });
  assert.equal(harness.pending, false, "it settled immediately");
  assert.equal(completeIsActionable(harness), true, "and the stale button was clickable -- the reported bug");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Completion
 * ----------------------------------------------------------------------------------------------------------- */

test("after a successful completion the pre-completion CTA is never actionable during the refresh gap", () => {
  const harness = mount({ mayCloseOut: true, closedOut: false, itemResolved: true }, true);
  mutate(harness, { mayCloseOut: false, closedOut: true, itemResolved: true });
  assert.equal(harness.pending, true);
  assert.equal(completeIsActionable(harness), false, "the old Mark complete cannot be clicked again");
  deliverRefetch(harness);
  assert.equal(shownAction(harness), "reopen", "and the refreshed state shows the closed-out presentation");
  assert.equal(harness.cache.closedOut, true);
});

test("the unawaited arrangement showed a settled pre-completion CTA after completing", () => {
  const harness = mount({ mayCloseOut: true, closedOut: false, itemResolved: true }, false);
  mutate(harness, { mayCloseOut: false, closedOut: true, itemResolved: true });
  assert.equal(shownAction(harness), "complete", "still offering to complete an already-completed closeout");
  assert.equal(completeIsActionable(harness), true);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Reopening
 * ----------------------------------------------------------------------------------------------------------- */

test("after a successful reopen the closed-out presentation is not exposed as settled", () => {
  const harness = mount({ mayCloseOut: false, closedOut: true, itemResolved: true }, true);
  assert.equal(shownAction(harness), "reopen");
  mutate(harness, { mayCloseOut: true, closedOut: false, itemResolved: true });
  assert.equal(harness.pending, true, "still reconciling, so nothing is offered as settled");
  deliverRefetch(harness);
  assert.equal(shownAction(harness), "complete", "the refreshed state shows the reopened presentation");
  assert.equal(harness.pending, false);
});

test("the unawaited arrangement left the closed-out presentation on screen as settled after a reopen", () => {
  const harness = mount({ mayCloseOut: false, closedOut: true, itemResolved: true }, false);
  mutate(harness, { mayCloseOut: true, closedOut: false, itemResolved: true });
  assert.equal(harness.pending, false);
  assert.equal(shownAction(harness), "reopen", "still offering to reopen an already-reopened closeout");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The earlier corrections are untouched
 * ----------------------------------------------------------------------------------------------------------- */

const A = "2026-09-05T10:00:00.000Z";
const B = "2026-09-05T10:00:05.000Z";
const record = (updatedAt: string | null): CateringCloseoutRecordView => ({
  closedOut: false, closedOutAt: null, reopenCount: 0, lastReopenedAt: null, updatedAt, providerNotes: null,
});

test("the returned version is still adopted immediately, before any reconciliation is awaited", () => {
  // Holding the refetch must not push version adoption behind it: an immediate consecutive write still states the
  // version this write produced, not the one the query holds until the refetch lands.
  const versions = adoptCateringCloseoutVersions(EMPTY_CATERING_CLOSEOUT_VERSIONS, "u:b", cateringCloseoutVersionsFromResponse({ closeout: record(B) }));
  const rebased = cateringCloseoutRebasedRecord(record(A), versions, "u:b");
  assert.equal(rebased.updatedAt, B);
  assert.equal(cateringCloseoutNotesPayload("second", rebased.updatedAt ?? null).expectedUpdatedAt, B);
});

test("newer notes typed during a slow save still survive it", () => {
  const submitted = "text A";
  let form = editCateringCloseoutForm({ ...emptyCateringCloseoutForm(""), identity: "u:b" }, submitted);
  form = editCateringCloseoutForm(form, "text B");
  form = settleCateringCloseoutForm(form, "u:b", submitted, submitted);
  assert.equal(form.value, "text B");
  assert.equal(form.dirty, true);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The component's own wiring
 * ----------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingCloseout.tsx"), "utf8");
const success = component.slice(component.indexOf("onSuccess: async (value, variables) => {"), component.indexOf("onError: async"));

test("both callbacks are async, so query-core awaits them before dispatching", () => {
  assert.ok(component.includes("onSuccess: async (value, variables) => {"));
  assert.ok(component.includes("onError: async (error: CateringCloseoutError, variables) => {"));
});

test("the closeout refetch is held and awaited; the workspace refetch is not", () => {
  assert.ok(success.includes("const reconciled = cache.invalidateQueries({ queryKey: cateringBookingCloseoutKey(started.userId, started.bookingId) })"));
  assert.ok(success.includes("await reconciled;"));
  // The Activity panel governs no control on this card, so holding the provider's buttons for it would serialize
  // an unrelated read.
  const workspaceLine = success.split("\n").find((line) => line.includes('"catering", "booking-workspace"'))!;
  assert.ok(workspaceLine.trim().startsWith("cache.invalidateQueries("), "fired, not held");
  assert.equal(workspaceLine.includes("await"), false);
});

test("the await is LAST, after every synchronous settlement", () => {
  const awaitAt = success.indexOf("await reconciled;");
  assert.notEqual(awaitAt, -1);
  for (const settlement of ["setVersions(", "setNotice(null)", "setEditor(", "setNotesForm("]) {
    assert.ok(success.indexOf(settlement) < awaitAt, `${settlement} must settle before the await`);
  }
});

test("a failed refetch cannot turn an accepted write into a reported failure", () => {
  assert.ok(success.includes(".catch(() => undefined)"));
});

test("a response for a booking left behind does not hold this booking's controls", () => {
  // The guard returns before the await on the success path, so a foreign booking's refetch never gates the
  // buttons on screen.
  const guardAt = success.indexOf("if (!settlesHere(started)) return;");
  assert.ok(guardAt !== -1 && guardAt < success.indexOf("await reconciled;"));
});

test("the refusal path reconciles too, and swallows a failed refetch so it cannot mask the real refusal", () => {
  const failure = component.slice(component.indexOf("onError: async (error: CateringCloseoutError, variables) => {"), component.indexOf("const pending = mutation.isPending;"));
  assert.ok(failure.includes("shouldRefetchCloseoutAfterError(error)"));
  assert.ok(failure.includes(".catch(() => undefined)"));
  assert.ok(failure.includes("await reconciled;"));
  // A refusal that needs no refetch awaits nothing at all.
  assert.ok(failure.includes(": undefined;"));
});

test("the polling and provider-copy corrections on this head are untouched", () => {
  assert.ok(component.includes("cateringCloseoutCanStillChange(polled.state.data?.bookingStatus)"));
  assert.ok(component.includes("CATERING_CLOSEOUT_PROVIDER_REVIEW_ABSENT"));
  assert.equal(component.includes("You can ask them in the booking conversation"), false);
  assert.ok(component.includes("{CATERING_CLOSEOUT_CONVERSATION_ACTION}"));
});
