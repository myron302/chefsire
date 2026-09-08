import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringBookingFilePresencePrefix } from "@shared/catering-booking-files";
import { effectiveCateringEditable } from "@shared/catering-booking-operations";
import { EMPTY_CATERING_TERMINAL_SEEN, cateringMutationOrigin, cateringOriginWorkspaceInvalidations, cateringTerminalConvergenceIsDue, recordCateringTerminalConvergence, type CateringTerminalSeen } from "@/pages/services/catering-booking-mutation-origin";

/**
 * Terminal convergence belongs to a BOOKING, not to a boolean.
 *
 * When a section's own endpoint first reports a booking terminal, the parent workspace summary is stale -- it was
 * fetched once and does not poll -- so the section refreshes it, and the files section also runs one last presence
 * reconciliation for removals made just before the booking closed. That was latched in a single boolean cleared on
 * navigation, while the effect depended only on the editable reading. Moving from a terminal booking straight to
 * another terminal booking therefore left the reading unchanged at `false`: the effect never re-ran, the flag was
 * cleared but never set, and the second booking converged not at all. Its workspace kept whatever it had -- quite
 * possibly still editable, if its own fetch had failed -- and its final reconciliation never happened.
 *
 * Both sections now keep a ledger of the identities that have converged and watch the identity as well as the
 * reading. There is no React harness in this suite, so the effect is simulated over the real helpers and both
 * components are asserted structurally to be wired to them.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readFileSync(path.join(here, "BookingFiles.tsx"), "utf8");
const comms = fs.readFileSync(path.join(here, "BookingCommunication.tsx"), "utf8");

const A = cateringMutationOrigin("u1", "booking-a");
const B = cateringMutationOrigin("u1", "booking-b");
const key = (parts: readonly unknown[]) => JSON.stringify(parts);

/** One mounted section, navigating between bookings and receiving readings from its own endpoint. */
type Section = { identity: string; seen: CateringTerminalSeen; invalidated: string[]; presence: string[] };
const open = (origin: { identity: string }): Section => ({ identity: origin.identity, seen: EMPTY_CATERING_TERMINAL_SEEN, invalidated: [], presence: [] });
const navigate = (state: Section, origin: { identity: string }): Section => ({ ...state, identity: origin.identity });
/** The convergence effect, transcribed. `withPresence` is the files section; the conversation has no presence half. */
function observe(state: Section, origin: { identity: string; userId: string; bookingId: string }, observedEditable: boolean | undefined, withPresence = true): Section {
  if (!cateringTerminalConvergenceIsDue(state.seen, state.identity, observedEditable)) return state;
  return {
    ...state,
    seen: recordCateringTerminalConvergence(state.seen, state.identity),
    invalidated: [...state.invalidated, ...cateringOriginWorkspaceInvalidations(origin).map(key)],
    presence: withPresence ? [...state.presence, key(cateringBookingFilePresencePrefix(origin.userId, origin.bookingId))] : state.presence,
  };
}
const convergences = (state: Section, origin: { identity: string; userId: string; bookingId: string }) =>
  state.invalidated.filter((entry) => cateringOriginWorkspaceInvalidations(origin).map(key).includes(entry)).length;

test("1. a terminal booking converges once on its first observation", () => {
  let state = observe(open(A), A, false);
  assert.equal(convergences(state, A), cateringOriginWorkspaceInvalidations(A).length);
  assert.deepEqual(state.presence, [key(cateringBookingFilePresencePrefix("u1", "booking-a"))]);
  assert.equal(state.seen.has(A.identity), true);
});

test("2. its later polls converge nothing further", () => {
  let state = observe(open(A), A, false);
  const after = { invalidated: state.invalidated.length, presence: state.presence.length };
  for (let poll = 0; poll < 5; poll += 1) state = observe(state, A, false);
  assert.equal(state.invalidated.length, after.invalidated, "a closed booking's polls must not re-invalidate");
  assert.equal(state.presence.length, after.presence);
});

test("3. navigating from a terminal booking to another terminal booking converges the second", () => {
  let state = observe(open(A), A, false);
  // The reading does not change across the navigation: it was false for A and is false for B. That is exactly the
  // case a single flag missed.
  state = navigate(state, B);
  state = observe(state, B, false);
  assert.equal(convergences(state, B), cateringOriginWorkspaceInvalidations(B).length, "B must converge on its own");
  assert.equal(state.seen.has(B.identity), true);
});

test("4 & 5. B's own presence prefix and workspace keys are the ones invalidated", () => {
  let state = observe(open(A), A, false);
  const beforeB = state.invalidated.length;
  state = observe(navigate(state, B), B, false);
  assert.deepEqual(state.invalidated.slice(beforeB), cateringOriginWorkspaceInvalidations(B).map(key));
  assert.deepEqual(state.presence, [
    key(cateringBookingFilePresencePrefix("u1", "booking-a")),
    key(cateringBookingFilePresencePrefix("u1", "booking-b")),
  ]);
});

test("6. a parent cache still claiming B is editable is what the invalidation exists to correct", () => {
  // The section's own endpoint is authoritative and already refuses mutation; the invalidation is what makes the
  // rest of the workspace agree. Skipping it for B is how a stale editable summary survived.
  assert.equal(effectiveCateringEditable(true, false), false, "the section obeys its own reading either way");
  let state = observe(open(A), A, false);
  state = observe(navigate(state, B), B, false);
  assert.equal(convergences(state, B) > 0, true);
});

test("7. A's invalidations are never reused as B's", () => {
  let state = observe(open(A), A, false);
  state = observe(navigate(state, B), B, false);
  const aKeys = cateringOriginWorkspaceInvalidations(A).map(key);
  const bKeys = cateringOriginWorkspaceInvalidations(B).map(key);
  for (const entry of aKeys) assert.equal(bKeys.includes(entry), false, "the two bookings share no key");
  assert.equal(state.presence[0] !== state.presence[1], true);
});

test("8. a terminal booking followed by an editable one converges nothing for the editable one", () => {
  let state = observe(open(A), A, false);
  const after = state.invalidated.length;
  state = navigate(state, B);
  // B has not answered yet, then answers editable. Neither is a terminal observation.
  state = observe(state, B, undefined);
  state = observe(state, B, true);
  assert.equal(state.invalidated.length, after);
  assert.equal(state.seen.has(B.identity), false);
});

test("9. that same booking converges once when it later goes terminal", () => {
  let state = observe(open(A), A, false);
  state = observe(navigate(state, B), B, true);
  const before = state.invalidated.length;
  state = observe(state, B, false);
  assert.equal(state.invalidated.length - before, cateringOriginWorkspaceInvalidations(B).length);
  state = observe(state, B, false);
  state = observe(state, B, false);
  assert.equal(state.invalidated.length - before, cateringOriginWorkspaceInvalidations(B).length, "still once");
});

test("10. A to B and back converges each booking exactly once, with no loop", () => {
  let state = observe(open(A), A, false);
  for (let round = 0; round < 4; round += 1) {
    state = observe(navigate(state, B), B, false);
    state = observe(navigate(state, A), A, false);
  }
  assert.equal(convergences(state, A), cateringOriginWorkspaceInvalidations(A).length);
  assert.equal(convergences(state, B), cateringOriginWorkspaceInvalidations(B).length);
  assert.equal(state.presence.length, 2, "one final reconciliation per booking, however often it is revisited");
});

test("11. a reading of undefined is never mistaken for the booking just left", () => {
  // A freshly switched-to booking has no answer of its own yet. Treating that as terminal would converge B on A's
  // reading and then mark B as done, so B's real transition would be skipped.
  assert.equal(cateringTerminalConvergenceIsDue(EMPTY_CATERING_TERMINAL_SEEN, B.identity, undefined), false);
  assert.equal(cateringTerminalConvergenceIsDue(EMPTY_CATERING_TERMINAL_SEEN, B.identity, true), false);
  assert.equal(cateringTerminalConvergenceIsDue(EMPTY_CATERING_TERMINAL_SEEN, B.identity, false), true);
  // And recording is idempotent, so a double-invoked effect body converges once.
  const once = recordCateringTerminalConvergence(EMPTY_CATERING_TERMINAL_SEEN, A.identity);
  assert.equal(recordCateringTerminalConvergence(once, A.identity), once, "the same set object, so nothing re-runs");
});

test("12. the conversation section had the same bug and is fixed the same way", () => {
  // Same effect, same false-to-false navigation, same ledger. It has no presence half.
  let state = observe(open(A), A, false, false);
  state = observe(navigate(state, B), B, false, false);
  assert.equal(convergences(state, B), cateringOriginWorkspaceInvalidations(B).length);
  assert.deepEqual(state.presence, []);
  for (const [label, source] of [["files", files], ["communication", comms]] as const) {
    assert.equal(source.includes("const terminalSeenRef = useRef<CateringTerminalSeen>(EMPTY_CATERING_TERMINAL_SEEN);"), true, label);
    assert.equal(source.includes("if (!cateringTerminalConvergenceIsDue(terminalSeenRef.current, identity, observedEditable)) return;"), true, label);
    assert.equal(source.includes("terminalSeenRef.current = recordCateringTerminalConvergence(terminalSeenRef.current, identity);"), true, label);
    assert.equal(source.includes("}, [observedEditable, identity]);"), true, label);
    // The old boolean and the reset that went with it are gone from both.
    assert.equal(source.includes("useRef(false)"), false, label);
    assert.equal(source.includes("terminalSeenRef.current = false"), false, label);
    assert.equal(source.includes("terminalSeenRef.current = true"), false, label);
  }
});

test("13. convergence is refresh only: it re-enables no mutation and writes nothing", () => {
  for (const [label, source] of [["files", files], ["communication", comms]] as const) {
    const start = source.indexOf("// The first time this section's own endpoint reports");
    const effect = source.slice(start, source.indexOf("}, [observedEditable, identity]);", start));
    for (const forbidden of ["mutate(", ".insert(", "setSession", "applyDraft", "POST", "DELETE"]) {
      assert.equal(effect.includes(forbidden), false, `${label}: ${forbidden}`);
    }
    assert.equal(effect.includes("cache.invalidateQueries("), true, label);
    assert.equal(source.includes("cache.clear()"), false, label);
  }
  // And the read-only decision itself is unchanged: the section's own authoritative reading still closes it.
  assert.equal(effectiveCateringEditable(true, false), false);
  assert.equal(effectiveCateringEditable(false, undefined), false);
});
