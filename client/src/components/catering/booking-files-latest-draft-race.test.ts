import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMPTY_CATERING_FILE_DRAFTS, cateringFileDraftFor, chooseCateringVisibility, completeCateringFileUpload, markCateringFileAttempted, mayUploadCateringFile, selectCateringFile, updateCateringFileDrafts, type CateringFileDraft, type CateringFileDrafts, type CateringSelectedFile } from "@/pages/services/catering-booking-files-state";
import { EMPTY_CATERING_IN_FLIGHT, EMPTY_CATERING_MUTATION_OUTCOMES, cateringMutationIsPending, cateringMutationOrigin, cateringMutationOutcomeFor, clearCateringMutationOutcome, enterCateringMutation, exitCateringMutation, recordCateringMutationOutcome, type CateringInFlight, type CateringMutationOrigin, type CateringMutationOutcomes } from "@/pages/services/catering-booking-mutation-origin";

/**
 * The completion must decide against the TRUE LATEST draft.
 *
 * The booking-scoped drafts are held in a ref as well as in React state, and the ref used to be a passive MIRROR of
 * the state: `useEffect(() => { draftsRef.current = drafts; }, [drafts])`. A passive effect runs after the commit,
 * so between a draft transition and that effect the two disagreed -- and an upload that resolved inside that window
 * read the PREVIOUS draft. It then judged that draft to still match the completing attempt, cleared it, and reset
 * the file input, destroying a replacement the participant had already chosen. The window is not theoretical: a
 * selection change and a settling `fetch` promise routinely land in the same event-loop turn.
 *
 * The fix inverts the relationship. The REF is authoritative and every transition writes it synchronously, through
 * one path, before mirroring into state for rendering. There is then no window at all: whatever the participant has
 * most recently done is what the completion reads.
 *
 * Both arrangements are modelled below -- the current one and the old passive mirror -- so each race case is
 * asserted to be handled AND asserted to have been mishandled before. Without the counterfactual these tests would
 * pass against the bug. There is no DOM or React harness in this suite, so every DOM write the component would make
 * is recorded instead, and the component's own wiring is pinned structurally at the end.
 */
const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "BookingFiles.tsx"), "utf8");

type Chosen = CateringSelectedFile;
const A = cateringMutationOrigin("u1", "booking-a");
const B = cateringMutationOrigin("u1", "booking-b");
const ROLE = "provider" as const;
const pdf = (name: string): Chosen => ({ name, type: "application/pdf", size: 4096 });
type Attempt = { origin: CateringMutationOrigin; role: "provider" | "customer"; requestId: string; visibility: "provider" | "shared" };

/**
 * The section's draft state under either arrangement.
 *
 * `ref` is what a completion reads. `committed` is what React has rendered. `mirror: "sync"` is the component as it
 * stands -- a transition writes both. `mirror: "effect"` is the old arrangement, where a transition writes only the
 * committed state and `flush()` stands for the passive effect that copies it across some time later.
 */
type Section = {
  identity: string;
  mirror: "sync" | "effect";
  ref: CateringFileDrafts<Chosen>;
  committed: CateringFileDrafts<Chosen>;
  inFlight: CateringInFlight;
  outcomes: CateringMutationOutcomes;
  /** Every value written into the file input's DOM value, in order. */
  inputWrites: string[];
  minted: number;
  canMutate: boolean;
};
function open(origin: CateringMutationOrigin, mirror: "sync" | "effect"): Section {
  return { identity: origin.identity, mirror, ref: EMPTY_CATERING_FILE_DRAFTS, committed: EMPTY_CATERING_FILE_DRAFTS, inFlight: EMPTY_CATERING_IN_FLIGHT, outcomes: EMPTY_CATERING_MUTATION_OUTCOMES, inputWrites: [], minted: 0, canMutate: true };
}
/** `applyDraft`: one path, ref first, then the render mirror. Under the old arrangement the ref lags. */
function applyDraft(state: Section, target: string, targetRole: "provider" | "customer", apply: (draft: CateringFileDraft<Chosen>) => CateringFileDraft<Chosen>): Section {
  const next = updateCateringFileDrafts(state.mirror === "sync" ? state.ref : state.committed, target, targetRole, apply);
  return state.mirror === "sync" ? { ...state, ref: next, committed: next } : { ...state, committed: next };
}
/** The passive mirroring effect of the OLD arrangement. Under the current one there is nothing to flush. */
const flush = (state: Section): Section => ({ ...state, ref: state.committed });
/** What a completion sees. */
const authoritative = (state: Section, identity: string, role: "provider" | "customer" = ROLE) => cateringFileDraftFor(state.ref, identity, role);
/** What the participant sees. */
const rendered = (state: Section, role: "provider" | "customer" = ROLE) => cateringFileDraftFor(state.committed, state.identity, role);

const choose = (state: Section, name: string, requestId: string) => applyDraft(state, state.identity, ROLE, (draft) => selectCateringFile(draft, pdf(name), requestId));
const setVisibility = (state: Section, value: "provider" | "shared") => {
  let minted = state.minted;
  const next = applyDraft(state, state.identity, ROLE, (draft) => chooseCateringVisibility(draft, value, () => `minted-${++minted}`));
  return { ...next, minted };
};
const navigate = (state: Section, origin: CateringMutationOrigin): Section => ({ ...state, identity: origin.identity, inputWrites: [...state.inputWrites, ""] });

function submit(state: Section): { state: Section; attempt: Attempt } {
  const origin = state.identity === A.identity ? A : B;
  // The component reads the token it is about to spend from the authoritative store too.
  const current = authoritative(state, origin.identity);
  assert.equal(mayUploadCateringFile(current, state.canMutate, cateringMutationIsPending(state.inFlight, origin.identity)), true, "the section must be offering Upload");
  const attempt: Attempt = { origin, role: ROLE, requestId: current.requestId!, visibility: current.visibility! };
  const next = applyDraft(state, origin.identity, ROLE, markCateringFileAttempted);
  return { state: { ...next, inFlight: enterCateringMutation(next.inFlight, origin), outcomes: clearCateringMutationOutcome(next.outcomes, origin) }, attempt };
}
/** The upload's `onSuccess`, transcribed. */
function uploadSucceeded(state: Section, attempt: Attempt): Section {
  let minted = state.minted;
  const resolved = completeCateringFileUpload(authoritative(state, attempt.origin.identity, attempt.role), attempt, attempt.role, () => `minted-${++minted}`);
  const settled = applyDraft(state, attempt.origin.identity, attempt.role, () => resolved.next);
  const wrote = resolved.cleared && attempt.origin.identity === state.identity;
  return {
    ...settled,
    minted,
    inFlight: exitCateringMutation(settled.inFlight, attempt.origin),
    outcomes: recordCateringMutationOutcome(settled.outcomes, attempt.origin, "succeeded"),
    inputWrites: wrote ? [...settled.inputWrites, ""] : settled.inputWrites,
  };
}
function uploadFailed(state: Section, attempt: Attempt, message: string): Section {
  return { ...state, inFlight: exitCateringMutation(state.inFlight, attempt.origin), outcomes: recordCateringMutationOutcome(state.outcomes, attempt.origin, "failed", message) };
}
/** The exact Codex sequence: choose, submit, replace, and resolve before anything mirrors state into the ref. */
function raceSequence(mirror: "sync" | "effect", replacement: (state: Section) => Section): Section {
  let state = open(A, mirror);
  state = choose(state, "foo.pdf", "token-foo");
  state = setVisibility(state, "shared");
  state = flush(state);
  const started = submit(state);
  state = flush(started.state);
  state = replacement(state);
  // NO flush here: this is the window the passive mirror left open.
  return uploadSucceeded(state, started.attempt);
}

// ---------------------------------------------------------------------------------------------------------------
// The race itself.
// ---------------------------------------------------------------------------------------------------------------

test("1-5. a replacement chosen while TA is pending survives TA's completion, and the input is not reset", () => {
  const state = raceSequence("sync", (current) => choose(current, "bar.pdf", "token-bar"));
  assert.equal(rendered(state).file?.name, "bar.pdf", "the newer selection must survive");
  assert.equal(rendered(state).requestId, "token-bar");
  assert.deepEqual(state.inputWrites, [], "the control still holds bar.pdf, so it must not be blanked");
  assert.equal(state.minted, 0, "a preserved draft that carries its OWN token is not re-minted");
  // And the old passive mirror got every one of those wrong.
  const stale = raceSequence("effect", (current) => choose(current, "bar.pdf", "token-bar"));
  assert.equal(rendered(stale).file, null, "the stale read cleared the replacement");
  assert.deepEqual(stale.inputWrites, [""], "and blanked the control that was holding it");
});

test("6. a visibility change made while TA is pending is preserved, and its token is re-minted", () => {
  const state = raceSequence("sync", (current) => setVisibility(current, "provider"));
  assert.equal(rendered(state).file?.name, "foo.pdf", "same file, different intent: the draft stands");
  assert.equal(rendered(state).visibility, "provider");
  assert.notEqual(rendered(state).requestId, "token-foo", "TA's token is spent and must never be sent again");
  const stale = raceSequence("effect", (current) => setVisibility(current, "provider"));
  assert.equal(rendered(stale).file, null, "the stale read saw shared/foo.pdf and cleared a provider-only draft");
});

test("7. a file AND a visibility change together are both preserved", () => {
  const state = raceSequence("sync", (current) => setVisibility(choose(current, "bar.pdf", "token-bar"), "provider"));
  assert.equal(rendered(state).file?.name, "bar.pdf");
  assert.equal(rendered(state).visibility, "provider");
  assert.equal(rendered(state).requestId, "token-bar");
  assert.deepEqual(state.inputWrites, []);
});

test("8. an unchanged draft that still matches exactly IS cleared, and the input is reset", () => {
  const state = raceSequence("sync", (current) => current);
  assert.equal(rendered(state).file, null);
  assert.equal(rendered(state).requestId, null);
  assert.equal(state.ref.has(A.identity), false, "a settled draft holds nothing and leaves the map");
  assert.deepEqual(state.inputWrites, [""], "the control was showing exactly what was uploaded");
  assert.equal(cateringMutationOutcomeFor(state.outcomes, A.identity)?.status, "succeeded");
});

test("9. a newer attempt TB on the same booking is not cleared by the older TA settling", () => {
  let state = open(A, "sync");
  state = choose(state, "foo.pdf", "token-foo");
  state = setVisibility(state, "shared");
  const ta = submit(state);
  state = ta.state;
  // TA fails ambiguously, which frees the control; the participant picks something else and uploads that. A late
  // TA callback then arrives anyway -- it had in fact been accepted server-side.
  state = uploadFailed(state, ta.attempt, "Your file could not be uploaded");
  state = choose(state, "bar.pdf", "token-bar");
  const tb = submit(state);
  state = uploadSucceeded(tb.state, ta.attempt);
  assert.equal(rendered(state).file?.name, "bar.pdf", "TA must not clear TB's draft");
  assert.equal(rendered(state).requestId, "token-bar", "nor re-token it");
  assert.equal(rendered(state).attempted, true, "and TB's own submitted state stands");
  assert.deepEqual(state.inputWrites, [], "nor blank the control holding TB's file");
});

test("10. a completion on A leaves B's draft untouched, whichever is displayed", () => {
  let state = open(A, "sync");
  state = choose(state, "foo.pdf", "token-foo");
  state = setVisibility(state, "shared");
  const ta = submit(state);
  state = navigate(ta.state, B);
  state = choose(state, "invoice.pdf", "token-b");
  const before = rendered(state);
  state = uploadSucceeded(state, ta.attempt);
  assert.equal(rendered(state), before, "B's draft object must be preserved, not rebuilt");
  assert.deepEqual(state.inputWrites, [""], "only the navigation wrote to the control");
  assert.equal(authoritative(state, A.identity).file, null, "A's own draft did settle");
});

test("11. rapid consecutive replacements while TA is pending keep the newest", () => {
  const state = raceSequence("sync", (current) => choose(choose(choose(current, "one.pdf", "token-1"), "two.pdf", "token-2"), "three.pdf", "token-3"));
  assert.equal(rendered(state).file?.name, "three.pdf");
  assert.equal(rendered(state).requestId, "token-3");
  assert.deepEqual(state.inputWrites, []);
});

test("12. a failure leaves the latest draft entirely intact", () => {
  let state = open(A, "sync");
  state = choose(state, "foo.pdf", "token-foo");
  state = setVisibility(state, "shared");
  const ta = submit(state);
  state = choose(ta.state, "bar.pdf", "token-bar");
  const before = rendered(state);
  state = uploadFailed(state, ta.attempt, "Your file could not be uploaded");
  assert.equal(rendered(state), before, "a failure must not rewrite the draft at all");
  assert.equal(state.minted, 0);
});

test("13. an ambiguous failure and retry of the SAME intent still carries TA's original token", () => {
  let state = open(A, "sync");
  state = choose(state, "foo.pdf", "token-foo");
  state = setVisibility(state, "shared");
  const ta = submit(state);
  state = uploadFailed(ta.state, ta.attempt, "Your file could not be uploaded");
  const retry = submit(state);
  assert.equal(retry.attempt.requestId, "token-foo", "a retry that mints a new token is a second upload");
  assert.equal(retry.attempt.visibility, ta.attempt.visibility);
  assert.equal(state.minted, 0, "the completion path change must not mint on a retry");
});

test("14. A -> B -> A during TA reintroduces no stale read: the draft returns and the completion still resolves it", () => {
  let state = open(A, "sync");
  state = choose(state, "foo.pdf", "token-foo");
  state = setVisibility(state, "shared");
  const ta = submit(state);
  state = navigate(ta.state, B);
  state = navigate(state, A);
  assert.equal(rendered(state).requestId, "token-foo", "A's pending draft comes back in full");
  // Back on A the participant replaces the file, and TA lands immediately afterwards.
  state = choose(state, "bar.pdf", "token-bar");
  state = uploadSucceeded(state, ta.attempt);
  assert.equal(rendered(state).file?.name, "bar.pdf");
  assert.deepEqual(state.inputWrites, ["", ""], "the two navigations wrote to the control; the completion did not");
});

test("15. a booking going terminal while TA is pending re-enables nothing and destroys nothing", () => {
  let state = open(A, "sync");
  state = choose(state, "foo.pdf", "token-foo");
  state = setVisibility(state, "shared");
  const ta = submit(state);
  // The next poll reports the booking closed.
  state = { ...ta.state, canMutate: false };
  state = uploadSucceeded(state, ta.attempt);
  assert.equal(mayUploadCateringFile(rendered(state), state.canMutate, false), false, "a terminal booking accepts no upload");
  // And a draft that was NOT settled by the completion is still held, not silently discarded.
  let held = open(A, "sync");
  held = choose(held, "foo.pdf", "token-foo");
  held = setVisibility(held, "shared");
  const pending = submit(held);
  held = choose(pending.state, "bar.pdf", "token-bar");
  held = { ...held, canMutate: false };
  held = uploadSucceeded(held, pending.attempt);
  assert.equal(rendered(held).file?.name, "bar.pdf");
  assert.equal(mayUploadCateringFile(rendered(held), held.canMutate, false), false);
});

test("16. the DOM reset happens only for the draft the completion actually cleared", () => {
  // Cleared and displayed: written.
  assert.deepEqual(raceSequence("sync", (current) => current).inputWrites, [""]);
  // Cleared but displaying another booking: not written -- that control belongs to the other booking now.
  let away = open(A, "sync");
  away = choose(away, "foo.pdf", "token-foo");
  away = setVisibility(away, "shared");
  const ta = submit(away);
  away = navigate(ta.state, B);
  const beforeWrites = away.inputWrites.length;
  away = uploadSucceeded(away, ta.attempt);
  assert.equal(away.inputWrites.length, beforeWrites, "an off-screen completion must not touch the shared control");
  // Not cleared: never written, however displayed.
  assert.deepEqual(raceSequence("sync", (current) => choose(current, "bar.pdf", "token-bar")).inputWrites, []);
});

test("17. a repeated completion callback is inert: no second clear, no second mint, no second DOM write", () => {
  let state = open(A, "sync");
  state = choose(state, "foo.pdf", "token-foo");
  state = setVisibility(state, "shared");
  const ta = submit(state);
  state = uploadSucceeded(ta.state, ta.attempt);
  assert.deepEqual(state.inputWrites, [""]);
  // The participant immediately starts a new selection, and the callback runs a second time.
  state = choose(state, "bar.pdf", "token-bar");
  const again = uploadSucceeded(state, ta.attempt);
  assert.equal(rendered(again).file?.name, "bar.pdf", "a repeat must not clear the new selection");
  assert.equal(rendered(again).requestId, "token-bar");
  assert.deepEqual(again.inputWrites, [""], "and must not write to the control a second time");
  assert.equal(again.minted, state.minted, "nor mint a second token");
});

test("18. one booking's transition is still invisible to another's completion decision", () => {
  // The identity is passed into every transition and every read, so a customer-role booking's draft is not even
  // reachable from a provider-role booking's completion, whatever the ref holds.
  let state = open(A, "sync");
  state = applyDraft(state, B.identity, "customer", (draft) => selectCateringFile(draft, pdf("customer.pdf"), "token-c"));
  state = choose(state, "foo.pdf", "token-foo");
  state = setVisibility(state, "shared");
  const ta = submit(state);
  state = uploadSucceeded(ta.state, ta.attempt);
  const other = cateringFileDraftFor(state.ref, B.identity, "customer");
  assert.equal(other.file?.name, "customer.pdf");
  assert.equal(other.requestId, "token-c");
  assert.equal(other.visibility, "shared", "and it keeps its own role's visibility");
});

// ---------------------------------------------------------------------------------------------------------------
// The component's wiring.
// ---------------------------------------------------------------------------------------------------------------

test("19. the ref is authoritative and written synchronously by the one transition path", () => {
  assert.equal(source.includes("const draftsRef = useRef<CateringFileDrafts>(EMPTY_CATERING_FILE_DRAFTS);"), true);
  // The passive mirror that created the window is gone.
  assert.equal(/useEffect\(\(\) => \{ draftsRef\.current = drafts/.test(source), false);
  // Exactly one place writes the ref, and it mirrors into state in the same breath.
  assert.equal((source.match(/draftsRef\.current = /g) ?? []).length, 1);
  assert.equal(/draftsRef\.current = next;\s*setDrafts\(next\);/.test(source), true);
  // Every transition goes through it, and none of them reaches setDrafts directly.
  assert.equal((source.match(/setDrafts\(/g) ?? []).length, 1);
  assert.equal((source.match(/applyDraft\(/g) ?? []).length, 4, "selection, visibility, submit and completion, and nothing else");
  // Both readers of the truth read the ref: the completion and the one place a token is spent.
  assert.equal(source.includes("completeCateringFileUpload(cateringFileDraftFor(draftsRef.current, attempt.origin.identity, attempt.role), attempt, attempt.role, () => crypto.randomUUID())"), true);
  assert.equal(source.includes("const current = cateringFileDraftFor(draftsRef.current, identity, role);"), true);
});

test("20. nothing non-idempotent happens inside a React state updater", () => {
  // A functional updater may be invoked more than once. Minting an idempotency token in one would produce two
  // different tokens, and a DOM write in one would run twice; both are why `applyDraft` exists.
  const updaters = [...source.matchAll(/set\w+\(\((\w+)\) => [\s\S]*?\);/g)].map((match) => match[0]);
  assert.notEqual(updaters.length, 0);
  for (const updater of updaters) {
    assert.equal(updater.includes("randomUUID"), false, updater.slice(0, 60));
    assert.equal(updater.includes("inputRef"), false, updater.slice(0, 60));
  }
  // The remaining functional updaters are the pure per-booking counters and outcome maps, which have no read-then-
  // decide step and are therefore safest as updaters.
  assert.equal(source.includes("setDrafts((current)"), false);
  // And the completion's own DOM write stands outside everything, guarded on a real clear.
  assert.equal(source.includes(`if (resolved.cleared && attempt.origin.identity === identityRef.current && inputRef.current) inputRef.current.value = "";`), true);
  const writes = [...source.matchAll(/inputRef\.current\.value = ([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual(writes, [`""`, `""`], "a file input can only ever be blanked, never repopulated");
});
