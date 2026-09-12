import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  observeCateringCloseoutTransition,
  type CateringCloseoutTransitionRecord,
} from "@/pages/services/catering-booking-closeout-state";

/**
 * THE TWO QUERIES ARE NOT SYNCHRONIZED, AND THE TRACKER USED TO ASSUME THEY WERE.
 *
 * Closing out and reopening each write a shared activity row in the same transaction as the state change. The
 * closeout card reads one query, which polls; the Activity panel reads the parent workspace query, which does not,
 * and lives in a different browser from the provider whose invalidation would have refreshed it.
 *
 * The tracker watched for a CHANGE, and treated its first observation as "record it, nothing to do". That is
 * correct only if the workspace was fetched no earlier than the closeout payload, and nothing guarantees that:
 *
 *   T1  the customer's workspace query resolves -- closeout open, no `booking_closed_out` row exists yet
 *   T2  the provider closes out: the closed state and the shared activity row are written together
 *   T3  the customer's closeout query resolves for the FIRST time, already reading `closedOut: true`
 *
 * At T3 there is no previous observation, so no transition is reported. Every later poll reports the same state and
 * is inert. The customer's feed is left permanently missing the event their own closeout card is displaying, with
 * nothing in the system that will ever correct it. Reopening has the same shape against a workspace cached while
 * the booking was closed.
 *
 * There is no shared revision between the two queries to compare, and inventing one would be inventing a fact. So
 * the rule is the minimal safe one: reconcile ONCE on the first authoritative observation of a booking, whatever it
 * says, and once per genuine transition thereafter.
 */

const A = "user-1:booking-a";
const B = "user-1:booking-b";

/** The component's effect, exactly: observe, store the record, then refresh the workspace if asked to. */
function run(observations: ReadonlyArray<{ identity: string; closedOut: boolean }>) {
  let record: CateringCloseoutTransitionRecord = null;
  const refreshed: string[] = [];
  const transitions: string[] = [];
  for (const { identity, closedOut } of observations) {
    const observed = observeCateringCloseoutTransition(record, identity, closedOut);
    record = observed.record;
    if (observed.transitioned) transitions.push(identity);
    // Addressed by the identity just observed -- the component keys the invalidation the same way.
    if (observed.reconcile) refreshed.push(identity);
  }
  return { record, refreshed, transitions };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * The first observation
 * ------------------------------------------------------------------------------------------------------------- */

test("a first observation that is ALREADY CLOSED reconciles the workspace exactly once", () => {
  const { refreshed, transitions } = run([{ identity: A, closedOut: true }]);
  assert.deepEqual(refreshed, [A]);
  assert.deepEqual(transitions, [], "and is still not reported as a transition, because nothing was seen to change");
});

test("a second identical closed poll adds nothing", () => {
  assert.deepEqual(run([
    { identity: A, closedOut: true },
    { identity: A, closedOut: true },
  ]).refreshed, [A]);
});

test("a first observation that is OPEN reconciles once too", () => {
  // The workspace may equally have been cached while the booking was closed, before a reopen.
  const { refreshed, transitions } = run([{ identity: A, closedOut: false }]);
  assert.deepEqual(refreshed, [A]);
  assert.deepEqual(transitions, []);
});

test("repeated open polls add nothing", () => {
  assert.deepEqual(run([
    { identity: A, closedOut: false },
    { identity: A, closedOut: false },
    { identity: A, closedOut: false },
  ]).refreshed, [A]);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * The race itself
 * ------------------------------------------------------------------------------------------------------------- */

test("the stale-workspace-before-first-closeout race is now closed", () => {
  // T1: the workspace resolved before the provider acted, so it holds no `booking_closed_out` row.
  const workspaceActivity: string[] = [];
  const serverActivity: string[] = [];
  const refetchWorkspace = () => { workspaceActivity.length = 0; workspaceActivity.push(...serverActivity); };

  // T2: the provider closes out. State and activity are written in one transaction, in THEIR browser's absence.
  serverActivity.push("booking_closed_out");

  // T3: this customer's closeout query resolves for the first time, already closed.
  let record: CateringCloseoutTransitionRecord = null;
  const observed = observeCateringCloseoutTransition(record, A, true);
  record = observed.record;
  if (observed.reconcile) refetchWorkspace();

  assert.deepEqual(workspaceActivity, ["booking_closed_out"], "the feed now carries the event the card is showing");
  assert.equal(observed.transitioned, false, "no transition is fabricated to achieve that");

  // And the next poll is inert: the refresh happened once, not every fifteen seconds.
  const again = observeCateringCloseoutTransition(record, A, true);
  assert.equal(again.reconcile, false);
  assert.equal(again.record, record, "the previous record is returned by reference");
});

test("the counterfactual: treating a first observation as nothing to do left the feed empty forever", () => {
  const workspaceActivity: string[] = [];
  const serverActivity = ["booking_closed_out"];
  let record: CateringCloseoutTransitionRecord = null;
  for (let poll = 0; poll < 10; poll += 1) {
    const observed = observeCateringCloseoutTransition(record, A, true);
    record = observed.record;
    // The OLD rule, reconciling only on a reported transition.
    if (observed.transitioned) { workspaceActivity.length = 0; workspaceActivity.push(...serverActivity); }
  }
  assert.deepEqual(workspaceActivity, [], "ten polls, and the event never arrives");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Real transitions still reconcile, once each
 * ------------------------------------------------------------------------------------------------------------- */

test("open -> closed: once for the first observation, once for the transition, nothing for the repeats", () => {
  const { refreshed, transitions } = run([
    { identity: A, closedOut: false },
    { identity: A, closedOut: false },
    { identity: A, closedOut: true },
    { identity: A, closedOut: true },
    { identity: A, closedOut: true },
  ]);
  assert.deepEqual(refreshed, [A, A]);
  assert.deepEqual(transitions, [A]);
});

test("closed -> open: the same shape for a reopen", () => {
  const { refreshed, transitions } = run([
    { identity: A, closedOut: true },
    { identity: A, closedOut: false },
    { identity: A, closedOut: false },
  ]);
  assert.deepEqual(refreshed, [A, A]);
  assert.deepEqual(transitions, [A]);
});

test("closing and reopening repeatedly reconciles once per real change and never more", () => {
  const { refreshed } = run([
    { identity: A, closedOut: false },
    { identity: A, closedOut: true },
    { identity: A, closedOut: false },
    { identity: A, closedOut: true },
  ]);
  assert.equal(refreshed.length, 4, "one first observation plus three transitions");
});

test("a long run of identical polls stays bounded", () => {
  const polls = Array.from({ length: 200 }, () => ({ identity: A, closedOut: true }));
  assert.deepEqual(run(polls).refreshed, [A], "two hundred polls, one refresh");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Booking identity
 * ------------------------------------------------------------------------------------------------------------- */

test("booking A's observation does not initialize booking B, and B gets its own first reconciliation", () => {
  const { refreshed, transitions } = run([
    { identity: A, closedOut: true },
    { identity: B, closedOut: true },
  ]);
  assert.deepEqual(refreshed, [A, B], "each booking reconciles its own workspace, once");
  assert.deepEqual(transitions, [], "and A's closed state is never read as B having moved");
});

test("A's state can never refresh B's workspace, whatever the two states are", () => {
  for (const [a, b] of [[true, false], [false, true], [true, true], [false, false]] as const) {
    const { refreshed } = run([{ identity: A, closedOut: a }, { identity: B, closedOut: b }]);
    assert.deepEqual(refreshed, [A, B], `${a} then ${b}`);
    // The second entry is addressed to B, so nothing about A's state chose B's query key.
    assert.equal(refreshed[1], B);
  }
});

test("navigating back to A reconciles A once more, which is correct rather than merely tolerated", () => {
  // A's tracker was overwritten by B, so on return the closeout payload is a first observation again -- and A's
  // workspace really may have been refetched, or expired, while the participant was away.
  const { refreshed } = run([
    { identity: A, closedOut: false },
    { identity: B, closedOut: false },
    { identity: A, closedOut: false },
    { identity: A, closedOut: false },
  ]);
  assert.deepEqual(refreshed, [A, B, A], "and the repeat after the return is still inert");
});

test("the record always describes the booking last observed", () => {
  assert.deepEqual(run([{ identity: A, closedOut: true }, { identity: B, closedOut: false }]).record, { identity: B, closedOut: false });
});

/* ------------------------------------------------------------------------------------------------------------- *
 * No loops
 * ------------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingCloseout.tsx"), "utf8");
const effect = component.slice(
  component.indexOf("const observedClosedOut = closeout?.closeout.closedOut;"),
  component.indexOf("}, [identity, observedClosedOut]);"),
);

test("the refresh targets the workspace query only -- never the query this observation is read from", () => {
  assert.ok(effect.includes('if (observed.reconcile) cache.invalidateQueries({ queryKey: ["catering", "booking-workspace", userId, bookingId] });'));
  assert.equal(effect.includes("cateringBookingCloseoutKey"), false, "invalidating the closeout query here would be the loop");
});

test("the record is stored before the refresh is issued, so a first observation is first exactly once", () => {
  assert.ok(effect.indexOf("transitionRef.current = observed.record;") < effect.indexOf("if (observed.reconcile)"));
});

test("the effect depends only on the identity and the observed state, so it cannot re-run on its own output", () => {
  assert.ok(component.includes("}, [identity, observedClosedOut]);"));
  assert.equal(effect.includes("useState"), false, "it writes a ref, which renders nothing");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * A local completion or reopening
 * ------------------------------------------------------------------------------------------------------------- */

test("a locally accepted complete or reopen records its own result, so the refetch it triggers is inert", () => {
  // The mutation has already invalidated the workspace itself; this is what stops that being duplicated.
  let record: CateringCloseoutTransitionRecord = observeCateringCloseoutTransition(null, A, false).record;
  record = observeCateringCloseoutTransition(record, A, true).record;   // the mutation response
  const afterRefetch = observeCateringCloseoutTransition(record, A, true);
  assert.equal(afterRefetch.reconcile, false, "the payload that follows is an identical, inert observation");
  assert.equal(afterRefetch.transitioned, false);
});

test("that bookkeeping runs only past the settles-here guard, so it cannot touch another booking's tracker", () => {
  const success = component.slice(component.indexOf("onSuccess: async (value, variables) => {"), component.indexOf("onError: async"));
  assert.ok(success.indexOf("if (!settlesHere(started)) return;") < success.indexOf("settledClosedOut"));
  assert.ok(success.includes("transitionRef.current = observeCateringCloseoutTransition(transitionRef.current, started.identity, settledClosedOut).record;"));
});

test("no transport, no second activity system and no fabricated events were added for any of this", () => {
  for (const forbidden of ["WebSocket", "EventSource", "setInterval", "cateringBookingActivity", "eventType"]) {
    assert.equal(component.includes(forbidden), false, forbidden);
  }
});
