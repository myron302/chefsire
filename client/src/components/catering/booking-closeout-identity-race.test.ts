import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The origin guard has to be current at COMMIT, not at effect-flush.
 *
 * Every closeout mutation carries the booking that issued it, and `settlesHere` compares that origin against a ref
 * holding the booking on screen. If that ref were written in a passive effect there would be a window -- passive
 * effects flush AFTER the commit -- in which booking B is rendered and displayed, B's reset effect has not run, and
 * the ref still says A. A response for booking A resolving inside that window would pass `settlesHere`, be accepted
 * as belonging to the workspace on screen, and settle A's success or A's conflict into B's notes form, item editor
 * and notice. The window is not theoretical: a route change and a settling `fetch` promise routinely land in the
 * same event-loop turn.
 *
 * This is the exact defect Phase 2J ended on, and this section is built with the fix from its first line. The ref is
 * assigned during render. The reset stays in an effect, because it sets state, and it keeps its own record of which
 * booking's drafts are in state -- so render can ask the question too, and the stale window is simply inert rather
 * than merely narrow.
 *
 * There is no DOM or React harness in this suite, so React's ordering contract is modelled directly below: a
 * commit, then the passive effects it queued. BOTH arrangements are modelled -- `sync: "render"` is the component as
 * it stands, `sync: "effect"` is the one with the defect -- so each case is asserted to be handled AND asserted to
 * have been mishandled before. Without the counterfactual these tests would pass against the bug. The component's
 * own wiring is pinned structurally at the end.
 */

type Sync = "render" | "effect";
type Section = {
  sync: Sync;
  /** What `settlesHere` reads. */
  identityRef: string;
  /** What the reset effect compares against, so it fires once per genuine navigation. */
  localIdentity: string;
  /** The booking React has committed and is displaying. */
  committed: string;
  /** Passive effects queued by the last commit and not yet flushed. */
  pending: (() => void)[];
  /** Component-local state, each value tagged with the booking that put it there. */
  state: { notes: string; editor: string | null; notice: string | null };
  /** Query keys invalidated, in order, so origin-scoped refreshing is checked separately from settlement. */
  invalidated: string[];
};

function mount(identity: string, sync: Sync): Section {
  return {
    sync, identityRef: identity, localIdentity: identity, committed: identity, pending: [],
    state: { notes: `${identity}: half-written notes`, editor: `${identity}: item editor`, notice: null },
    invalidated: [],
  };
}

/** A render that commits. Under the current arrangement the guard ref is written HERE, before anything else runs. */
function navigate(section: Section, identity: string) {
  section.committed = identity;
  if (section.sync === "render") section.identityRef = identity;
  section.pending.push(() => {
    // The defective arrangement wrote the guard ref from inside this effect, which is what opened the window.
    if (section.sync === "effect") section.identityRef = identity;
    if (section.localIdentity === identity) return;
    section.localIdentity = identity;
    section.state = { notes: "", editor: null, notice: null };
  });
}
function flush(section: Section) {
  const queued = section.pending;
  section.pending = [];
  for (const effect of queued) effect();
}

/** A response for `origin` arriving now, doing exactly what the component's onSuccess/onError do. */
function settle(section: Section, origin: string, outcome: { notes?: string; editor?: string | null; notice?: string | null }) {
  // Always refresh the ORIGINATING booking, whichever booking is rendered now.
  section.invalidated.push(origin);
  if (origin !== section.identityRef) return;
  if (outcome.notes !== undefined) section.state.notes = outcome.notes;
  if (outcome.editor !== undefined) section.state.editor = outcome.editor;
  if (outcome.notice !== undefined) section.state.notice = outcome.notice;
}

/** What render may actually use: booking-local state is inert until the reset has reconciled it. */
function shown(section: Section) {
  const current = section.localIdentity === section.committed;
  return { notes: current ? section.state.notes : "", editor: current ? section.state.editor : null, notice: current ? section.state.notice : null };
}

test("a response for booking A cannot settle into booking B in the pre-effect window", () => {
  const section = mount("A", "render");
  navigate(section, "B");
  // B is committed and on screen; B's reset effect has NOT run yet.
  settle(section, "A", { notes: "A's saved notes", notice: "A's notice" });
  assert.equal(section.state.notes, "A: half-written notes", "A's response touched nothing");
  assert.equal(section.state.notice, null);
  flush(section);
  assert.equal(section.state.notes, "");
});

test("the defective arrangement is genuinely defective, so the test above is not vacuous", () => {
  const section = mount("A", "effect");
  navigate(section, "B");
  settle(section, "A", { notes: "A's saved notes", notice: "A's notice" });
  assert.equal(section.state.notes, "A's saved notes", "the old arrangement accepted it");
  assert.equal(section.state.notice, "A's notice");
});

test("A's conflict cannot mark an editor on B", () => {
  const section = mount("A", "render");
  navigate(section, "B");
  settle(section, "A", { editor: "A: conflicted editor" });
  assert.equal(section.state.editor, "A: item editor", "untouched");
});

test("the originating booking is refreshed even though nothing local is settled", () => {
  const section = mount("A", "render");
  navigate(section, "B");
  settle(section, "A", { notes: "A's saved notes" });
  // The data the response actually changed belongs to A, and its cache is keyed by A.
  assert.deepEqual(section.invalidated, ["A"]);
});

test("booking A's local state does not render under booking B, even for one committed render", () => {
  const section = mount("A", "render");
  navigate(section, "B");
  // The reset has not flushed, so the state still holds A's words -- and render must not use them.
  assert.deepEqual(shown(section), { notes: "", editor: null, notice: null });
  flush(section);
  assert.deepEqual(shown(section), { notes: "", editor: null, notice: null });
});

test("a response that arrives after the reset settles the booking it belongs to", () => {
  const section = mount("A", "render");
  navigate(section, "B");
  flush(section);
  settle(section, "B", { notes: "B's saved notes" });
  assert.equal(section.state.notes, "B's saved notes");
  assert.deepEqual(shown(section).notes, "B's saved notes");
});

test("navigating back to A does not resurrect A's old draft", () => {
  const section = mount("A", "render");
  navigate(section, "B");
  flush(section);
  navigate(section, "A");
  flush(section);
  assert.equal(section.state.notes, "", "each genuine navigation starts fresh");
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The component's own wiring
 * ----------------------------------------------------------------------------------------------------------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, "BookingCloseout.tsx"), "utf8");

test("the guard ref is assigned during render, not from an effect", () => {
  const at = component.indexOf("const identityRef = useRef(identity);");
  assert.notEqual(at, -1);
  const next = component.slice(at, at + 200);
  assert.ok(next.includes("identityRef.current = identity;"));
  // The assignment must not sit inside a useEffect body.
  assert.equal(/useEffect\(\(\) => \{[^}]*identityRef\.current/.test(component), false);
});

test("the reset effect keeps its own record of which booking's state is in state", () => {
  assert.ok(component.includes("const [localIdentity, setLocalIdentity] = useState(identity);"));
  assert.ok(component.includes("if (localIdentity === identity) return;"));
  assert.ok(component.includes("setLocalIdentity(identity);"));
  // It cannot read the guard ref, which is current by the time any effect runs.
  const effect = component.slice(component.indexOf("useEffect(() => {\n    if (localIdentity === identity) return;"), component.indexOf("const localStateIsCurrent"));
  assert.equal(effect.includes("identityRef"), false);
});

test("render guards every piece of booking-local state on the reconciled identity", () => {
  assert.ok(component.includes("const localStateIsCurrent = localIdentity === identity;"));
  assert.ok(component.includes("notesAreCurrent ? notesForm.value : \"\""));
  assert.ok(component.includes("const notesAreCurrent = localStateIsCurrent && cateringCloseoutFormIsCurrent(notesForm, identity)"));
});

test("every mutation carries its own origin and addresses the originating booking", () => {
  assert.ok(component.includes("const origin = (): CloseoutOrigin => ({ identity, bookingId, userId });"));
  assert.ok(component.includes("`/api/catering/bookings/${started.bookingId}${path}`"));
  for (const call of component.match(/mutation\.mutate\(\{[^}]*/g) ?? []) {
    assert.ok(call.includes("origin: origin()"), call);
  }
});

test("both completions invalidate by origin and settle only when the origin is on screen", () => {
  assert.ok(component.includes("cache.invalidateQueries({ queryKey: cateringBookingCloseoutKey(started.userId, started.bookingId) })"));
  assert.ok(component.includes("const settlesHere = (started: CloseoutOrigin) => started.identity === identityRef.current;"));
  // Both callbacks still refuse a foreign origin. The two spellings differ only in that the refusal path now
  // drains its own reconciliation first, so the guard is asserted per callback rather than by counting one literal.
  const success = component.slice(component.indexOf("onSuccess: async (value, variables) => {"), component.indexOf("onError: async"));
  const failure = component.slice(component.indexOf("onError: async (error: CateringCloseoutError, variables) => {"), component.indexOf("const pending = mutation.isPending;"));
  assert.ok(success.includes("if (!settlesHere(started)) return;"), "onSuccess guards");
  assert.ok(failure.includes("if (!settlesHere(started)) { await reconciled; return; }"), "onError guards");
});

test("every submit handler re-checks the identity before writing", () => {
  assert.ok(component.includes("if (!localStateIsCurrent || open.identity !== identity) return;"));
  assert.ok(component.includes("if (!localStateIsCurrent || !mayEditCateringCloseoutNotes(notesForm, identity, actionable, pending)) return;"));
});
