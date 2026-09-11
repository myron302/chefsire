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
  assert.equal(execution.includes("const [localIdentity, setLocalIdentity] = useState(identity);"), true);
  const effect = execution.slice(execution.indexOf("if (localIdentity === identity) return;"), execution.indexOf("}, [identity, localIdentity]);"));
  for (const setter of ["setTimelineDraft(EMPTY_CATERING_TIMELINE_DRAFT)", "setStaffDraft(EMPTY_CATERING_STAFF_DRAFT)", "setEquipmentDraft(EMPTY_CATERING_EQUIPMENT_DRAFT)", "setEditor(null)", "setNotice(null)"]) {
    assert.equal(effect.includes(setter), true, setter);
  }
  // No state setter moved into render alongside the ref.
  const beforeEffect = execution.slice(execution.indexOf("const identityRef = useRef(identity);"), execution.indexOf("const [localIdentity,"));
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

/* ---------------------------------------------------------------------------------------------------------------- *
 * P2 -- booking-local EDITOR state must be inert under another booking's identity
 * ---------------------------------------------------------------------------------------------------------------- */

/**
 * The same race, one layer up: not a callback reading a stale ref, but a RENDER reading stale state.
 *
 * React Query can hand back a cached execution payload for booking B the instant the route changes, so B renders
 * and commits immediately -- while every piece of booking-local state is still booking A's, because the effects
 * that reconcile them flush after the commit. A render condition that asked only "is there a value?" therefore put
 * A's load-in instructions, A's venue contact and A's provider-private notes on B's screen, with a submit path
 * already addressed to B.
 *
 * The fix is not to clear anything faster. It is to treat identity-tagged state as inert until its tag matches:
 * `accessForm` carries its own identity, and the drafts, the open editor and the notice are all reconciled by one
 * effect whose tag is now state rather than a ref, so render can read it.
 */

type AccessFormLike = {
  identity: string;
  value: { parkingInstructions: string; providerPrivateNotes: string } | null;
  review: { fields: string[] } | null;
};
/** The section's booking-local state, and the order React applies things in: commit, then passive effects. */
type Section = {
  /** The booking on screen -- the committed render. */
  identity: string;
  /** The booking the drafts, editor and notice currently belong to; moved by the reset effect. */
  localIdentity: string;
  accessForm: AccessFormLike;
  timelineDraft: { title: string };
  notice: string | null;
  pendingEffects: (() => void)[];
  /** Every request the section issued, so a submit that should not have happened is visible. */
  requests: { identity: string; path: string }[];
};

const EMPTY_DRAFT = { title: "" };

function openSection(identity: string): Section {
  return {
    identity, localIdentity: identity,
    accessForm: { identity, value: { parkingInstructions: "Two bays behind the hall", providerPrivateNotes: "The site manager is unreliable" }, review: null },
    timelineDraft: { title: "Half-typed run-of-show item" },
    notice: null,
    pendingEffects: [], requests: [],
  };
}
/** A committed render of another booking. Nothing local is reconciled yet -- that is what the effects are for. */
function renderBooking(section: Section, identity: string, cachedAccess: AccessFormLike["value"]) {
  section.identity = identity;
  section.pendingEffects.push(() => {
    if (section.localIdentity === identity) return;
    section.localIdentity = identity;
    section.timelineDraft = { ...EMPTY_DRAFT };
    section.notice = null;
  });
  section.pendingEffects.push(() => {
    // The access form reconciles against the authoritative payload, exactly as `reconcileCateringAccessForm` does.
    if (section.accessForm.identity === identity) return;
    section.accessForm = { identity, value: cachedAccess && { ...cachedAccess }, review: null };
  });
}
function flushSection(section: Section) {
  for (const effect of section.pendingEffects.splice(0)) effect();
}

/** Exactly the guards the component renders and submits behind. */
const accessFormIsCurrent = (section: Section) => section.accessForm.identity === section.identity && section.accessForm.value !== null;
const localStateIsCurrent = (section: Section) => section.localIdentity === section.identity;
/** What the access region actually puts on screen. */
function renderedAccess(section: Section) {
  return accessFormIsCurrent(section)
    ? { form: true, values: section.accessForm.value, review: section.accessForm.review }
    // The read-only view, rendered from the payload of the booking on screen -- never from the form.
    : { form: false, values: null, review: null };
}
function renderedTimelineDraft(section: Section) {
  return localStateIsCurrent(section) ? section.timelineDraft : EMPTY_DRAFT;
}
function renderedNotice(section: Section) {
  return localStateIsCurrent(section) ? section.notice : null;
}
function submitAccess(section: Section) {
  if (!accessFormIsCurrent(section)) return;
  section.requests.push({ identity: section.identity, path: "/execution/access" });
}
function submitTimeline(section: Section) {
  if (!localStateIsCurrent(section) || renderedTimelineDraft(section).title.trim() === "") return;
  section.requests.push({ identity: section.identity, path: "/execution/timeline" });
}

test("P2: booking B's first committed render contains none of booking A's access values", () => {
  const section = openSection(A);
  // B's payload is already cached, so B renders and commits at once -- before any effect has run.
  renderBooking(section, B, { parkingInstructions: "Loading bay on the north side", providerPrivateNotes: "B's own note" });
  assert.equal(section.pendingEffects.length, 2, "the reconciliation is still queued");
  const shown = renderedAccess(section);
  assert.equal(shown.form, false, "no editable form is offered for state that is not B's");
  assert.equal(shown.values, null);
  // Specifically: none of A's content, and above all not A's provider-private note.
  assert.equal(JSON.stringify(shown).includes("Two bays behind the hall"), false);
  assert.equal(JSON.stringify(shown).includes("site manager"), false, "A's provider-private note is not on B's screen");
  // Then reconciliation lands and B's own form appears, with B's values.
  flushSection(section);
  const afterFlush = renderedAccess(section);
  assert.equal(afterFlush.form, true);
  assert.equal(afterFlush.values!.parkingInstructions, "Loading bay on the north side");
  assert.equal(afterFlush.values!.providerPrivateNotes, "B's own note");
});

test("P2: the same holds when B has no access record at all", () => {
  const section = openSection(A);
  renderBooking(section, B, null);
  assert.equal(renderedAccess(section).form, false);
  assert.equal(JSON.stringify(renderedAccess(section)).includes("site manager"), false);
  // With no record, the form stays unavailable rather than falling back to the previous booking's values.
  flushSection(section);
  assert.equal(renderedAccess(section).form, false, "an empty access state offers no form");
  assert.equal(section.accessForm.identity, B, "but it is B's empty state now, not A's");
  assert.equal(section.accessForm.value, null);
});

test("P2: the old condition genuinely rendered A under B -- this is the leak, not a hypothetical", () => {
  const section = openSection(A);
  renderBooking(section, B, { parkingInstructions: "Loading bay on the north side", providerPrivateNotes: "B's own note" });
  // "is there a value?" was the whole test, and the answer was yes -- A's value.
  const oldCondition = section.accessForm.value !== null;
  assert.equal(oldCondition, true);
  assert.equal(section.accessForm.value!.parkingInstructions, "Two bays behind the hall");
  assert.equal(section.accessForm.value!.providerPrivateNotes, "site manager is unreliable".slice(0, 0) + "The site manager is unreliable");
  // And the submit path was already addressed to B, so saving would have written A's record onto B's booking.
  assert.equal(section.identity, B);
});

test("P2: a submit before reconciliation issues no request for either booking", () => {
  const section = openSection(A);
  renderBooking(section, B, { parkingInstructions: "Loading bay on the north side", providerPrivateNotes: "B's own note" });
  submitAccess(section);
  submitTimeline(section);
  assert.deepEqual(section.requests, [], "nothing is sent");
  // Nothing is settled or cleared either: A's form and A's draft are exactly as they were, waiting to be
  // reconciled. Isolation, not indiscriminate clearing.
  assert.equal(section.accessForm.identity, A);
  assert.equal(section.accessForm.value!.parkingInstructions, "Two bays behind the hall");
  assert.equal(section.timelineDraft.title, "Half-typed run-of-show item");
  // Once reconciliation lands, B's own form submits normally.
  flushSection(section);
  submitAccess(section);
  assert.deepEqual(section.requests, [{ identity: B, path: "/execution/access" }]);
});

test("P2: booking A's conflict, review and notice do not appear under booking B", () => {
  const section = openSection(A);
  section.accessForm.review = { fields: ["parkingInstructions"] };
  section.notice = "This run-of-show item changed somewhere else";
  renderBooking(section, B, { parkingInstructions: "Loading bay on the north side", providerPrivateNotes: "B's own note" });
  // The review lives inside the form, so gating the form gates it; the notice has its own guard.
  assert.equal(renderedAccess(section).review, null, "A's unresolved field disagreement is not B's");
  assert.equal(renderedNotice(section), null, "and neither is A's failure message");
  // A's own state is untouched and still waiting.
  assert.equal(section.accessForm.review!.fields[0], "parkingInstructions");
  assert.equal(section.notice, "This run-of-show item changed somewhere else");
  // After reconciliation B has neither, because they were never B's.
  flushSection(section);
  assert.equal(renderedAccess(section).review, null);
  assert.equal(renderedNotice(section), null);
});

test("P2: a half-typed create draft does not follow the participant to another booking", () => {
  const section = openSection(A);
  assert.equal(renderedTimelineDraft(section).title, "Half-typed run-of-show item", "A's own draft renders for A");
  renderBooking(section, B, null);
  assert.equal(renderedTimelineDraft(section).title, "", "and is inert the moment B is on screen");
  // An empty draft rather than a hidden form: it is the state the reset is one tick away from producing, so
  // nothing of A's appears and nothing jumps. Submitting it does nothing.
  submitTimeline(section);
  assert.deepEqual(section.requests, []);
  flushSection(section);
  assert.equal(section.timelineDraft.title, "", "and the reset has now genuinely cleared it");
});

test("P2: navigating back reconciles to the booking's own state without contamination", () => {
  const section = openSection(A);
  renderBooking(section, B, { parkingInstructions: "Loading bay on the north side", providerPrivateNotes: "B's own note" });
  flushSection(section);
  assert.equal(renderedAccess(section).values!.parkingInstructions, "Loading bay on the north side");
  // Back to A. Before the effects run, B's values are inert on A's screen -- the guard is symmetrical.
  renderBooking(section, A, { parkingInstructions: "Two bays behind the hall", providerPrivateNotes: "The site manager is unreliable" });
  assert.equal(renderedAccess(section).form, false);
  assert.equal(JSON.stringify(renderedAccess(section)).includes("north side"), false, "B's values do not appear under A");
  flushSection(section);
  const back = renderedAccess(section);
  assert.equal(back.form, true);
  assert.equal(back.values!.parkingInstructions, "Two bays behind the hall");
  assert.equal(back.values!.providerPrivateNotes, "The site manager is unreliable");
  // And nothing of B's survived anywhere in A's state.
  assert.equal(JSON.stringify(section.accessForm).includes("north side"), false);
  assert.equal(JSON.stringify(section.accessForm).includes("B's own note"), false);
});

test("P2: the guards settle -- no render loop, and the reset still fires once per navigation", () => {
  const section = openSection(A);
  renderBooking(section, B, null);
  flushSection(section);
  assert.equal(section.localIdentity, B);
  // Re-rendering the same booking queues a reset that does nothing, so there is no loop to fall into.
  renderBooking(section, B, null);
  section.timelineDraft = { title: "A new draft, for B this time" };
  flushSection(section);
  assert.equal(section.timelineDraft.title, "A new draft, for B this time", "B's own draft is not cleared again");
  assert.equal(localStateIsCurrent(section), true);
});

test("P2: the component renders and submits behind exactly those guards", () => {
  // Access: one predicate, used by the render condition AND folded into the save rule, so the form and the button
  // and the handler cannot come to disagree.
  assert.equal(execution.includes("provider && canMutate && cateringAccessFormIsCurrent(accessForm, identity)"), true);
  assert.equal(execution.includes("maySaveCateringAccess(accessForm, identity, canMutate, pending)"), true);
  assert.equal((execution.match(/maySaveCateringAccess\(/g) ?? []).length, 2, "the button and the submit handler");
  // The old condition is gone entirely.
  assert.equal(execution.includes("canMutate && accessForm.value"), false);
  // Drafts: rendered from an identity-guarded value, and every submit checks the identity itself as well.
  for (const live of ["liveTimelineDraft", "liveStaffDraft", "liveEquipmentDraft"]) {
    assert.equal(execution.includes(`const ${live} = localStateIsCurrent ?`), true, live);
  }
  assert.equal((execution.match(/if \(!localStateIsCurrent \|\| !maySubmitCatering/g) ?? []).length, 3);
  // The notice is guarded by the same value, because the same effect clears it.
  assert.equal(execution.includes("{localStateIsCurrent && notice && <div role=\"alert\""), true);
  // And none of this is achieved by setting state during render.
  const beforeEffects = execution.slice(execution.indexOf("const identity = "), execution.indexOf("const query = useQuery("));
  for (const setter of ["setAccessForm(", "setTimelineDraft(", "setStaffDraft(", "setEquipmentDraft(", "setEditor(", "setNotice(", "setLocalIdentity("]) {
    assert.equal(beforeEffects.includes(setter), false, setter);
  }
});

test("P2 audit: every other piece of booking-local state is already identity-aware", () => {
  // The open item editor carries its own identity and is read through a helper that refuses a foreign one, so an
  // editor left open on A cannot render, submit or reload under B.
  assert.equal(execution.includes("activeCateringTimelineEditor(editor, identity, item.id, canMutate)"), true);
  assert.equal(execution.includes("mayReloadCateringTimelineEditor(editor, identity, items)"), true);
  // Reorder controls report an open editor only when it is this booking's.
  assert.equal(execution.includes("editorOpen: editor?.identity === identity"), true);
  // Milestones and the timeline list render from `execution`, the payload of the booking on screen, and hold no
  // local state of their own -- so there is nothing of a previous booking for them to show.
  assert.equal(execution.includes("execution.milestones && <section"), true);
  assert.equal(/milestone(Draft|Form|State)/.test(execution), false, "milestones keep no local draft");
  // `pending` is the single in-flight flag of one mutation queue. It is deliberately NOT booking-scoped: it carries
  // no booking content, and while a request is in flight it DISABLES controls, so leaving it global fails closed.
  // Scoping it would enable a second concurrent mutate against the one shared mutation object.
  assert.equal(execution.includes("const pending = mutation.isPending"), true);
});
