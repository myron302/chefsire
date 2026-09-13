import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cateringCloseoutRevision,
  observeCateringCloseoutTransition,
  type CateringCloseoutTransitionRecord,
} from "@/pages/services/catering-booking-closeout-state";
import type { CateringCloseoutRecordView } from "@shared/catering-booking-closeout";

/**
 * A BOOLEAN IS NOT THE LIFECYCLE.
 *
 * Reconciliation compared `closedOut` alone, which is only the whole story if at most one shared event happens
 * between two polls. It does not have to be:
 *
 *   T1  the customer polls: closed, reopenCount 0 -- the feed carries the original `booking_closed_out`
 *   T2  the provider reopens. A shared `booking_closeout_reopened` row is written in the same transaction
 *   T3  the provider closes again. Another shared `booking_closed_out` row is written
 *   T4  the customer polls, fifteen seconds after T1: closed, reopenCount 1
 *
 * `true === true`, so nothing was reported, nothing was refreshed, and the parent workspace query -- which does
 * not poll -- kept omitting BOTH rows until a focus refetch or a reload. Several cycles between polls hid several
 * more.
 *
 * The tracker now carries the record's shared lifecycle revision: `closedOut`, `closedOutAt`, `reopenCount` and
 * `lastReopenedAt`, normalized into one comparable string. Those are exactly the four fields
 * `serializeCloseoutRecord` gives a CUSTOMER -- `updatedAt` and `providerNotes` are provider-only and are
 * deliberately not read, so a private notes save neither refreshes a customer's feed nor becomes inferable from
 * one that did.
 */

const A = "user-1:booking-a";
const B = "user-1:booking-b";
const T1 = "2026-09-06T18:00:00.000Z";
const T2 = "2026-09-06T18:05:00.000Z";
const T3 = "2026-09-06T18:07:00.000Z";

const record = (patch: Partial<CateringCloseoutRecordView> = {}): CateringCloseoutRecordView =>
  ({ closedOut: true, closedOutAt: T1, reopenCount: 0, lastReopenedAt: null, ...patch });
const OPEN = record({ closedOut: false, closedOutAt: null });

/** The component's effect: observe, store, then refresh the workspace if asked to. */
function run(sequence: readonly { identity: string; record: CateringCloseoutRecordView }[]) {
  let stored: CateringCloseoutTransitionRecord = null;
  const refreshed: string[] = [];
  const transitions: string[] = [];
  for (const step of sequence) {
    const observed = observeCateringCloseoutTransition(stored, step.identity, cateringCloseoutRevision(step.record));
    stored = observed.record;
    if (observed.transitioned) transitions.push(step.identity);
    if (observed.reconcile) refreshed.push(step.identity);
  }
  return { stored, refreshed, transitions };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * The race this closes
 * ------------------------------------------------------------------------------------------------------------- */

test("same boolean, newer reopen revision: the change is seen", () => {
  const { refreshed, transitions } = run([
    { identity: A, record: record({ closedOut: true, closedOutAt: T1, reopenCount: 0, lastReopenedAt: null }) },
    { identity: A, record: record({ closedOut: true, closedOutAt: T3, reopenCount: 1, lastReopenedAt: T2 }) },
  ]);
  assert.deepEqual(refreshed, [A, A], "the first observation, then the revision that moved under it");
  assert.deepEqual(transitions, [A], "and the second is a genuine transition, not a first observation");
});

test("a reopen and a reclose entirely between two polls invalidate the workspace exactly once", () => {
  // The feed the customer holds, and the rows the server writes while they are not looking.
  const workspaceActivity = ["booking_closed_out"];
  const serverActivity = ["booking_closed_out"];
  const refetch = () => { workspaceActivity.length = 0; workspaceActivity.push(...serverActivity); };

  let stored: CateringCloseoutTransitionRecord = observeCateringCloseoutTransition(null, A, cateringCloseoutRevision(record())).record;
  // Unseen: the provider reopens, then closes again. Both rows are written transactionally with the state.
  serverActivity.push("booking_closeout_reopened", "booking_closed_out");
  const next = observeCateringCloseoutTransition(stored, A, cateringCloseoutRevision(record({ closedOutAt: T3, reopenCount: 1, lastReopenedAt: T2 })));
  stored = next.record;
  assert.equal(next.reconcile, true);
  refetch();

  assert.deepEqual(workspaceActivity, ["booking_closed_out", "booking_closeout_reopened", "booking_closed_out"], "both missed rows arrive");
  // And the poll after it is inert: one refresh for the pair, not one per row.
  assert.equal(observeCateringCloseoutTransition(stored, A, cateringCloseoutRevision(record({ closedOutAt: T3, reopenCount: 1, lastReopenedAt: T2 }))).reconcile, false);
});

test("the counterfactual: comparing the boolean alone left both rows missing indefinitely", () => {
  const before = { closedOut: true, reopenCount: 0 };
  const after = { closedOut: true, reopenCount: 1 };
  assert.equal(before.closedOut === after.closedOut, true, "which is exactly why nothing was reported");
  // Ten more polls at the newer state would each have compared equal, too.
  let stored: CateringCloseoutTransitionRecord = { identity: A, revision: cateringCloseoutRevision(record()) };
  let refreshes = 0;
  for (let poll = 0; poll < 10; poll += 1) {
    const observed = observeCateringCloseoutTransition(stored, A, cateringCloseoutRevision(record({ closedOutAt: T3, reopenCount: 1, lastReopenedAt: T2 })));
    stored = observed.record;
    if (observed.reconcile) refreshes += 1;
  }
  assert.equal(refreshes, 1, "and with the revision, the first of those ten catches it and the rest are inert");
});

test("several cycles between polls still cost ONE refresh", () => {
  // reopenCount 1 -> 3 while `closedOut` never changes: three reopens and three recloses were missed.
  const { refreshed } = run([
    { identity: A, record: record({ reopenCount: 1, closedOutAt: T1, lastReopenedAt: T1 }) },
    { identity: A, record: record({ reopenCount: 3, closedOutAt: T3, lastReopenedAt: T2 }) },
    { identity: A, record: record({ reopenCount: 3, closedOutAt: T3, lastReopenedAt: T2 }) },
  ]);
  assert.deepEqual(refreshed, [A, A], "first observation, then one refresh for the whole gap");
  // The workspace refetch returns every new row at once, so synthesizing one invalidation per missed event would
  // buy nothing and cost three fetches.
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Which fields the revision reads, and which it must not
 * ------------------------------------------------------------------------------------------------------------- */

test("the revision is built from exactly the four fields a CUSTOMER is served", () => {
  const base = record();
  for (const patch of [
    { closedOut: false } as const,
    { closedOutAt: T3 } as const,
    { reopenCount: 1 } as const,
    { lastReopenedAt: T2 } as const,
  ]) {
    assert.notEqual(cateringCloseoutRevision({ ...base, ...patch }), cateringCloseoutRevision(base), JSON.stringify(patch));
  }
});

test("a provider-private change does NOT move it, so it triggers no customer activity refresh", () => {
  const before = record({ updatedAt: T1, providerNotes: "internal" });
  // A notes save advances `updatedAt` and rewrites `providerNotes`, and writes no shared activity at all.
  const afterNotesSave = record({ updatedAt: T3, providerNotes: "internal, revised" });
  assert.equal(cateringCloseoutRevision(afterNotesSave), cateringCloseoutRevision(before), "the same revision");

  const { refreshed } = run([{ identity: A, record: before }, { identity: A, record: afterNotesSave }]);
  assert.deepEqual(refreshed, [A], "the first observation only -- the private edit refreshed nothing");
});

test("a checklist edit cannot move it either, because it does not touch this record", () => {
  // Checklist state lives in its own table; the closeout record it would have to change is untouched by it.
  assert.equal(cateringCloseoutRevision(record()), cateringCloseoutRevision(record()), "nothing in the record moved");
  const { refreshed } = run([{ identity: A, record: record() }, { identity: A, record: record() }]);
  assert.deepEqual(refreshed, [A]);
});

test("the function reads no provider-only field, by inspection as well as by behaviour", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const state = fs.readFileSync(path.join(here, "../../pages/services/catering-booking-closeout-state.ts"), "utf8");
  const body = state.slice(state.indexOf("export function cateringCloseoutRevision"));
  const fn = body.slice(0, body.indexOf("\n}") + 2);
  for (const provider of ["updatedAt", "providerNotes", "resolvedBy", "closedOutBy", "lastReopenedBy", "updatedBy", "checklist"]) {
    assert.equal(fn.includes(provider), false, provider);
  }
  for (const shared of ["closedOut", "closedOutAt", "reopenCount", "lastReopenedAt"]) {
    assert.ok(fn.includes(shared), shared);
  }
});

test("instants are normalized, so an equivalent spelling of one moment is one revision", () => {
  assert.equal(
    cateringCloseoutRevision(record({ closedOutAt: "2026-09-06T18:00:00.000Z" })),
    cateringCloseoutRevision(record({ closedOutAt: "2026-09-06T18:00:00Z" })),
  );
  assert.notEqual(cateringCloseoutRevision(record({ closedOutAt: T1 })), cateringCloseoutRevision(record({ closedOutAt: T3 })));
  // An unparseable value is kept verbatim: equal to itself, and to nothing else.
  assert.equal(cateringCloseoutRevision(record({ closedOutAt: "nonsense" })), cateringCloseoutRevision(record({ closedOutAt: "nonsense" })));
  assert.notEqual(cateringCloseoutRevision(record({ closedOutAt: "nonsense" })), cateringCloseoutRevision(record({ closedOutAt: null })));
});

test("an absent instant is distinct from any present one", () => {
  assert.notEqual(cateringCloseoutRevision(record({ lastReopenedAt: null })), cateringCloseoutRevision(record({ lastReopenedAt: T2 })));
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Everything the previous rounds established, under the new comparison
 * ------------------------------------------------------------------------------------------------------------- */

test("a first observation still reconciles exactly once, open or closed", () => {
  assert.deepEqual(run([{ identity: A, record: record() }]).refreshed, [A]);
  assert.deepEqual(run([{ identity: A, record: OPEN }]).refreshed, [A]);
});

test("open -> closed and closed -> open each still reconcile once", () => {
  assert.deepEqual(run([
    { identity: A, record: OPEN },
    { identity: A, record: record() },
    { identity: A, record: record() },
  ]).refreshed, [A, A]);
  assert.deepEqual(run([
    { identity: A, record: record() },
    { identity: A, record: record({ closedOut: false, closedOutAt: null, reopenCount: 1, lastReopenedAt: T2 }) },
    { identity: A, record: record({ closedOut: false, closedOutAt: null, reopenCount: 1, lastReopenedAt: T2 }) },
  ]).refreshed, [A, A]);
});

test("many repeated identical polls stay bounded at one refresh", () => {
  const polls = Array.from({ length: 200 }, () => ({ identity: A, record: record({ reopenCount: 2, lastReopenedAt: T2 }) }));
  assert.deepEqual(run(polls).refreshed, [A]);
});

test("an unchanged revision returns the previous record by reference, so nothing churns", () => {
  const first = observeCateringCloseoutTransition(null, A, cateringCloseoutRevision(record()));
  const second = observeCateringCloseoutTransition(first.record, A, cateringCloseoutRevision(record()));
  assert.equal(second.record, first.record);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Identity isolation
 * ------------------------------------------------------------------------------------------------------------- */

test("A's revision cannot initialize B, invalidate B, or suppress B's own first reconciliation", () => {
  const { refreshed, transitions, stored } = run([
    { identity: A, record: record({ reopenCount: 4, lastReopenedAt: T2 }) },
    { identity: B, record: record({ reopenCount: 4, lastReopenedAt: T2 }) },
  ]);
  assert.deepEqual(refreshed, [A, B], "each reconciles its own workspace, once");
  assert.deepEqual(transitions, [], "and an identical revision under a DIFFERENT booking is still not a transition");
  assert.equal(stored?.identity, B);
});

test("A -> B -> A gives A a fresh first observation rather than replaying an old one", () => {
  assert.deepEqual(run([
    { identity: A, record: OPEN },
    { identity: B, record: OPEN },
    { identity: A, record: OPEN },
    { identity: A, record: OPEN },
  ]).refreshed, [A, B, A]);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Local complete and reopen
 * ------------------------------------------------------------------------------------------------------------- */

test("a locally accepted complete adopts its own returned revision, so the refetch it triggers is inert", () => {
  // The mutation invalidated the workspace itself; the tracker takes the record the response carried.
  let stored: CateringCloseoutTransitionRecord = observeCateringCloseoutTransition(null, A, cateringCloseoutRevision(OPEN)).record;
  const returned = record({ closedOutAt: T3 });
  stored = observeCateringCloseoutTransition(stored, A, cateringCloseoutRevision(returned)).record;
  const afterRefetch = observeCateringCloseoutTransition(stored, A, cateringCloseoutRevision(returned));
  assert.equal(afterRefetch.reconcile, false, "no duplicate invalidation");
  assert.equal(afterRefetch.transitioned, false);
});

test("a locally accepted reopen does the same, including its reopen count and instant", () => {
  let stored: CateringCloseoutTransitionRecord = observeCateringCloseoutTransition(null, A, cateringCloseoutRevision(record())).record;
  const returned = record({ closedOut: false, closedOutAt: null, reopenCount: 1, lastReopenedAt: T2 });
  stored = observeCateringCloseoutTransition(stored, A, cateringCloseoutRevision(returned)).record;
  assert.equal(observeCateringCloseoutTransition(stored, A, cateringCloseoutRevision(returned)).reconcile, false);
});

test("the returned record carries the provider's version too, and it still does not enter the revision", () => {
  // A provider's response includes `updatedAt`; the tracker adopts a revision that ignores it, so the customer-
  // shaped payload the next poll returns produces the SAME revision rather than a spurious transition.
  const withVersion = record({ closedOutAt: T3, updatedAt: T3, providerNotes: "internal" });
  const asPolled = record({ closedOutAt: T3 });
  assert.equal(cateringCloseoutRevision(withVersion), cateringCloseoutRevision(asPolled));
});
