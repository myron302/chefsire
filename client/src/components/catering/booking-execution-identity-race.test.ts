import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The origin guard has to be current at COMMIT, not at effect-flush.
 *
 * Every execution mutation already carries the booking that issued it, and `settlesHere` compares that origin
 * against a ref holding the booking on screen. The ref was written in a passive effect -- and passive effects flush
 * AFTER the commit. So there was a window: booking B rendered and was displayed, B's reset effect had not run yet,
 * and the ref still said A. A response for booking A that resolved inside that window passed `settlesHere`, was
 * accepted as belonging to the workspace on screen, and settled A's success or A's conflict into B's access form,
 * item editor, drafts and notice. The window is not theoretical -- a route change and a settling `fetch` promise
 * routinely land in the same event-loop turn.
 *
 * The ref is now assigned during render. The reset stays in an effect, because it sets state, and it keeps its own
 * record of which booking's drafts are in state -- it can no longer read the guard ref, which is current by the
 * time any effect runs.
 *
 * There is no DOM or React harness in this suite, so React's ordering contract is modelled directly below: a
 * commit, then the passive effects it queued. Both arrangements are modelled -- `sync: "render"` is the component
 * as it stands, `sync: "effect"` is the old one -- so each case is asserted to be handled AND asserted to have been
 * mishandled before. Without the counterfactual these tests would pass against the bug. The component's own wiring
 * is pinned structurally at the end.
 */

type Sync = "render" | "effect";
type Workspace = {
  sync: Sync;
  /** What `settlesHere` reads. */
  identityRef: string;
  /** What the reset effect compares against, so it fires once per genuine navigation. */
  settledRef: string;
  /** The booking React has committed and is displaying. */
  committed: string;
  /** Passive effects queued by the last commit and not yet flushed. */
  pending: (() => void)[];
  /** Component-local state, each value tagged with the booking that put it there. */
  state: { drafts: string; editor: string | null; notice: string | null; access: string };
  /** Query keys invalidated, in order, so origin-scoped refreshing can be checked separately from settlement. */
  invalidated: string[];
};

function mount(identity: string, sync: Sync): Workspace {
  return {
    sync, identityRef: identity, settledRef: identity, committed: identity, pending: [],
    state: { drafts: `${identity}: half-typed crew`, editor: `${identity}: item editor`, notice: null, access: `${identity}: access draft` },
    invalidated: [],
  };
}

/** A render that commits. Under the current arrangement the guard ref is written HERE, before anything else runs. */
function navigate(workspace: Workspace, identity: string) {
  workspace.committed = identity;
  if (workspace.sync === "render") workspace.identityRef = identity;
  workspace.pending.push(() => {
    // The old arrangement wrote the guard ref from inside this effect, which is what opened the window.
    if (workspace.sync === "effect") workspace.identityRef = identity;
    if (workspace.settledRef === identity) return;
    workspace.settledRef = identity;
    workspace.state.drafts = `${identity}: empty`;
    workspace.state.editor = null;
    workspace.state.notice = null;
  });
}
/** React flushing the passive effects the commit queued. */
function flush(workspace: Workspace) {
  for (const effect of workspace.pending.splice(0)) effect();
}
/**
 * A mutation completes. Invalidation is keyed on the ORIGIN and is unconditional -- the booking that was changed is
 * refreshed whether or not it is still displayed -- while local settlement is gated on `settlesHere`.
 */
function settle(workspace: Workspace, origin: string, outcome: "success" | "conflict") {
  workspace.invalidated.push(`${origin}:execution`, `${origin}:workspace`);
  if (origin !== workspace.identityRef) return;
  if (outcome === "success") {
    workspace.state.drafts = `${origin}: cleared`;
    workspace.state.editor = null;
    workspace.state.access = `${origin}: saved record`;
  } else {
    workspace.state.notice = `${origin}: this changed somewhere else`;
    workspace.state.access = `${origin}: conflicted`;
  }
}

const A = "u1:booking-a";
const B = "u1:booking-b";

test("P2: a success for booking A cannot settle into booking B before the effects flush", () => {
  const workspace = mount(A, "render");
  // A save is in flight on A. The participant navigates: B renders and commits, its reset effect has NOT run.
  navigate(workspace, B);
  assert.equal(workspace.committed, B);
  assert.equal(workspace.pending.length, 1, "the reset is still queued");
  const before = { ...workspace.state };
  // A's response lands in exactly that window.
  settle(workspace, A, "success");
  assert.deepEqual(workspace.state, before, "nothing belonging to A reached the workspace on screen");
  // A's own data is still refreshed, because that is keyed on the origin rather than on what is displayed.
  assert.deepEqual(workspace.invalidated, [`${A}:execution`, `${A}:workspace`]);
});

test("P2: a conflict for booking A cannot raise a notice in booking B either", () => {
  const workspace = mount(A, "render");
  navigate(workspace, B);
  settle(workspace, A, "conflict");
  assert.equal(workspace.state.notice, null, "no notice for a booking that is not on screen");
  assert.equal(workspace.state.access, `${A}: access draft`, "and B's access form is untouched");
  assert.deepEqual(workspace.invalidated, [`${A}:execution`, `${A}:workspace`]);
});

test("P2: the old arrangement genuinely accepted both -- this is the race, not a hypothetical", () => {
  for (const outcome of ["success", "conflict"] as const) {
    const workspace = mount(A, "effect");
    navigate(workspace, B);
    // The guard ref still says A, because only the passive effect would have moved it.
    assert.equal(workspace.identityRef, A, "the stale identity is still accepted");
    settle(workspace, A, outcome);
    const settled = outcome === "success" ? workspace.state.access === `${A}: saved record` : workspace.state.notice !== null;
    assert.equal(settled, true, `${outcome}: booking A settled into the workspace showing booking B`);
  }
});

test("P2: the window is closed at the commit, not merely narrowed", () => {
  const workspace = mount(A, "render");
  navigate(workspace, B);
  // Rejected before the flush...
  settle(workspace, A, "success");
  assert.equal(workspace.state.access, `${A}: access draft`);
  // ...and still rejected after it, and after any number of further renders of B.
  flush(workspace);
  navigate(workspace, B);
  flush(workspace);
  settle(workspace, A, "success");
  assert.equal(workspace.state.access, `${A}: access draft`);
  assert.equal(workspace.state.drafts, `${B}: empty`, "B's own reset did happen");
});

test("P2: moving the ref out of the effect did not disable the reset", () => {
  const workspace = mount(A, "render");
  navigate(workspace, B);
  flush(workspace);
  // Drafts, editor and notice all belong to B now -- no spent idempotency token or half-typed record crossed over.
  assert.equal(workspace.state.drafts, `${B}: empty`);
  assert.equal(workspace.state.editor, null);
  assert.equal(workspace.state.notice, null);
  assert.equal(workspace.settledRef, B);
  // And it fires once per genuine navigation: re-rendering the same booking resets nothing.
  workspace.state.drafts = `${B}: half-typed again`;
  navigate(workspace, B);
  flush(workspace);
  assert.equal(workspace.state.drafts, `${B}: half-typed again`);
});

test("P2: the guard tracks what is displayed rather than latching", () => {
  const workspace = mount(A, "render");
  navigate(workspace, B);
  // Back to A before anything flushed. A IS on screen, so A's completion belongs here again.
  navigate(workspace, A);
  settle(workspace, A, "success");
  assert.equal(workspace.state.access, `${A}: saved record`);
  // While B's would now be refused.
  settle(workspace, B, "conflict");
  assert.equal(workspace.state.notice, null);
});

/* ---------------------------------------------------------------------------------------------------------------- *
 * The component's own wiring
 * ---------------------------------------------------------------------------------------------------------------- */

const componentDir = path.dirname(fileURLToPath(import.meta.url));
const execution = fs.readFileSync(path.join(componentDir, "BookingExecution.tsx"), "utf8");
const files = fs.readFileSync(path.join(componentDir, "BookingFiles.tsx"), "utf8");

test("P2: the execution section synchronizes its guard ref during render", () => {
  assert.equal(execution.includes("  const identityRef = useRef(identity);\n  identityRef.current = identity;"), true);
  // Not from any effect, in any shape.
  assert.equal(/useEffect\([^;]{0,200}identityRef\.current = identity/.test(execution), false);
  // Written exactly once, and before the mutation that reads it is even defined.
  assert.equal(execution.split("identityRef.current = identity;").length - 1, 1);
  assert.equal(execution.indexOf("identityRef.current = identity;") < execution.indexOf("const mutation = useMutation("), true);
  assert.equal(execution.includes("const settlesHere = (started: ExecutionOrigin) => started.identity === identityRef.current;"), true);
});

test("P2: the reset still sets state from an effect, against its own separate record", () => {
  assert.equal(execution.includes("const settledIdentityRef = useRef(identity);"), true);
  const effect = execution.slice(execution.indexOf("if (settledIdentityRef.current === identity) return;"), execution.indexOf("}, [identity]);"));
  for (const setter of ["setTimelineDraft(EMPTY_CATERING_TIMELINE_DRAFT)", "setStaffDraft(EMPTY_CATERING_STAFF_DRAFT)", "setEquipmentDraft(EMPTY_CATERING_EQUIPMENT_DRAFT)", "setEditor(null)", "setNotice(null)"]) {
    assert.equal(effect.includes(setter), true, setter);
  }
  // No state setter moved into render alongside the ref.
  const beforeEffect = execution.slice(execution.indexOf("const identityRef = useRef(identity);"), execution.indexOf("const settledIdentityRef"));
  for (const setter of ["setTimelineDraft(", "setStaffDraft(", "setEquipmentDraft(", "setEditor(", "setNotice("]) {
    assert.equal(beforeEffect.includes(setter), false, setter);
  }
});

test("P2 audit: the files section had the same guard, and it is synchronized the same way", () => {
  // Its ref guards an async completion too -- clearing the file input only when the upload's origin is still the
  // booking on screen -- and it was likewise written from a passive effect.
  assert.equal(files.includes("  const identityRef = useRef(identity);\n  identityRef.current = identity;"), true);
  assert.equal(files.includes("useEffect(() => { identityRef.current = identity; }, [identity]);"), false);
  assert.equal(files.includes('if (resolved.cleared && attempt.origin.identity === identityRef.current && inputRef.current) inputRef.current.value = "";'), true);
});

test("P2 audit: no other catering ref is an async guard synchronized only in an effect", () => {
  // The remaining refs in these sections are a different shape, and each is checked rather than assumed:
  //
  //  - `historyRef` is a render-loop accumulator. It is READ during render to carry the previous page of loaded
  //    records forward, and the effect that writes it is the point -- there is no async callback reading it.
  for (const source of [files, fs.readFileSync(path.join(componentDir, "BookingCommunication.tsx"), "utf8")]) {
    assert.equal(source.includes("useEffect(() => { historyRef.current = history; });"), true);
    assert.equal(/=>[^\n]*await[^\n]*historyRef\.current/.test(source), false);
  }
  //  - `deliveredRef`, `terminalSeenRef` and `ledgerRef` are latches whose guard and whose write sit in the SAME
  //    synchronous body, so neither can observe the other mid-flight.
  const communication = fs.readFileSync(path.join(componentDir, "BookingCommunication.tsx"), "utf8");
  assert.equal(communication.includes("if (latestId === null || deliveredRef.current === latestId) return;\n    deliveredRef.current = latestId;"), true);
  assert.equal(communication.includes("if (!cateringTerminalConvergenceIsDue(terminalSeenRef.current, identity, observedEditable)) return;\n    terminalSeenRef.current = recordCateringTerminalConvergence(terminalSeenRef.current, identity);"), true);
  //  - and the drafts a completion decides against are held in a module-scoped store written synchronously, which
  //    is the earlier fix for this same class rather than a ref at all.
  assert.equal(/useEffect\(\(\) => \{ draftsRef\.current = drafts/.test(files), false);
});
