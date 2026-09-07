import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMPTY_CATERING_FILE_DRAFTS, cateringFileDraftFor, cateringFileDraftIsEmpty, chooseCateringVisibility, completeCateringFileUpload, emptyCateringFileDraft, markCateringFileAttempted, mayUploadCateringFile, selectCateringFile, updateCateringFileDrafts, type CateringFileDrafts, type CateringSelectedFile } from "@/pages/services/catering-booking-files-state";
import { EMPTY_CATERING_IN_FLIGHT, EMPTY_CATERING_MUTATION_OUTCOMES, cateringMutationIsPending, cateringMutationOrigin, cateringMutationOutcomeFor, clearCateringMutationOutcome, enterCateringMutation, exitCateringMutation, recordCateringMutationOutcome, type CateringInFlight, type CateringMutationOrigin, type CateringMutationOutcomes } from "@/pages/services/catering-booking-mutation-origin";

/**
 * Booking-scoped upload drafts and booking-scoped file mutation outcomes.
 *
 * The Files section stays mounted across a route change, so an upload started on one booking can complete while
 * another is displayed. Two pieces of state used to be component-global and were therefore wrong across that
 * boundary:
 *
 *  - the DRAFT, which was emptied on every identity change. It carries the selected `File` AND the `requestId` that
 *    is the server's idempotency key for that upload. Losing it mid-flight meant a retry after an AMBIGUOUS failure
 *    minted a FRESH token, which the server is right to treat as a second upload -- so a request that had in fact
 *    been accepted got stored twice.
 *  - the OUTCOME slots, one apiece for upload and delete. A completion on the second booking overwrote the answer
 *    the first was still showing, and returning to it found its result gone.
 *
 * There is no DOM or React harness in this suite, so the component wiring is asserted structurally and the
 * behaviour is asserted by driving the real exported helpers through the same sequences the component drives them
 * through. One DOM fact is load-bearing and is deliberately NOT simulated: a file input cannot be repopulated
 * programmatically, so restoring a draft never refills the control. The retained `File` in application state is the
 * authoritative selection, and the last test below pins that the component renders it and never pretends otherwise.
 */
const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "BookingFiles.tsx"), "utf8");

type Chosen = CateringSelectedFile;
const A = cateringMutationOrigin("u1", "booking-a");
const B = cateringMutationOrigin("u1", "booking-b");
const ROLE = "provider" as const;
const pdf = (name: string): Chosen => ({ name, type: "application/pdf", size: 4096 });

/** The section's local state, minus everything these two findings do not touch. */
type Section = {
  identity: string;
  drafts: CateringFileDrafts<Chosen>;
  inFlight: CateringInFlight;
  uploadOutcomes: CateringMutationOutcomes;
  removeOutcomes: CateringMutationOutcomes;
  /** Every value the component ever writes into the file input's DOM value, in order. */
  inputWrites: string[];
};
type Attempt = { origin: CateringMutationOrigin; role: "provider" | "customer"; requestId: string; visibility: "provider" | "shared" };

function open(origin: CateringMutationOrigin): Section {
  return { identity: origin.identity, drafts: EMPTY_CATERING_FILE_DRAFTS, inFlight: EMPTY_CATERING_IN_FLIGHT, uploadOutcomes: EMPTY_CATERING_MUTATION_OUTCOMES, removeOutcomes: EMPTY_CATERING_MUTATION_OUTCOMES, inputWrites: [] };
}
const shown = (state: Section, role: "provider" | "customer" = ROLE) => cateringFileDraftFor(state.drafts, state.identity, role);
/** A route change. The DOM input is cleared; nothing else is. */
function navigate(state: Section, origin: CateringMutationOrigin): Section {
  return { ...state, identity: origin.identity, inputWrites: [...state.inputWrites, ""] };
}
function choose(state: Section, name: string, requestId: string): Section {
  return { ...state, drafts: updateCateringFileDrafts(state.drafts, state.identity, ROLE, (draft) => selectCateringFile(draft, pdf(name), requestId)) };
}
function visibility(state: Section, value: "provider" | "shared", mint: () => string): Section {
  return { ...state, drafts: updateCateringFileDrafts(state.drafts, state.identity, ROLE, (draft) => chooseCateringVisibility(draft, value, mint)) };
}
function submit(state: Section): { state: Section; attempt: Attempt } {
  const origin = state.identity === A.identity ? A : B;
  const draft = cateringFileDraftFor(state.drafts, origin.identity, ROLE);
  assert.equal(mayUploadCateringFile(draft, true, cateringMutationIsPending(state.inFlight, origin.identity)), true, "the section must be offering Upload");
  const attempt: Attempt = { origin, role: ROLE, requestId: draft.requestId!, visibility: draft.visibility! };
  return {
    state: {
      ...state,
      drafts: updateCateringFileDrafts(state.drafts, origin.identity, ROLE, markCateringFileAttempted),
      uploadOutcomes: clearCateringMutationOutcome(state.uploadOutcomes, origin),
      inFlight: enterCateringMutation(state.inFlight, origin),
    },
    attempt,
  };
}
let minted = 0;
const mint = () => `minted-${++minted}`;
function uploadSucceeded(state: Section, attempt: Attempt): Section {
  const resolved = completeCateringFileUpload(cateringFileDraftFor(state.drafts, attempt.origin.identity, attempt.role), attempt, attempt.role, mint);
  const wrote = resolved.cleared && attempt.origin.identity === state.identity;
  return {
    ...state,
    drafts: updateCateringFileDrafts(state.drafts, attempt.origin.identity, attempt.role, () => resolved.next),
    inFlight: exitCateringMutation(state.inFlight, attempt.origin),
    uploadOutcomes: recordCateringMutationOutcome(state.uploadOutcomes, attempt.origin, "succeeded"),
    inputWrites: wrote ? [...state.inputWrites, ""] : state.inputWrites,
  };
}
function uploadFailed(state: Section, attempt: Attempt, message: string): Section {
  return { ...state, inFlight: exitCateringMutation(state.inFlight, attempt.origin), uploadOutcomes: recordCateringMutationOutcome(state.uploadOutcomes, attempt.origin, "failed", message) };
}

// ---------------------------------------------------------------------------------------------------------------
// The draft, per booking.
// ---------------------------------------------------------------------------------------------------------------

test("1. navigating away and back restores the booking's own pending draft in full", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const started = submit(state);
  state = navigate(started.state, B);
  state = navigate(state, A);
  const draft = shown(state);
  assert.equal(draft.file?.name, "menu.pdf");
  assert.equal(draft.visibility, "shared");
  assert.equal(draft.requestId, "token-a", "the idempotency token must survive the round trip");
  assert.equal(draft.attempted, true, "and so must the record that it has been submitted");
});

test("2. the other booking gets its own empty draft, never a share of this one's", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = navigate(state, B);
  const draft = shown(state);
  assert.equal(draft.file, null);
  assert.equal(draft.requestId, null);
  assert.equal(draft.attempted, false);
  // And choosing on B leaves A exactly as it was.
  state = choose(state, "invoice.pdf", "token-b");
  assert.equal(cateringFileDraftFor(state.drafts, A.identity, ROLE).file?.name, "menu.pdf");
  assert.equal(cateringFileDraftFor(state.drafts, A.identity, ROLE).requestId, "token-a");
  assert.equal(cateringFileDraftFor(state.drafts, B.identity, ROLE).requestId, "token-b");
});

test("3. a retry after an ambiguous failure across navigation carries the ORIGINAL token", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const first = submit(state);
  state = navigate(first.state, B);
  // The request times out. Its outcome is unknowable from here: it may already have been accepted.
  state = uploadFailed(state, first.attempt, "Your file could not be uploaded");
  state = navigate(state, A);
  const before = minted;
  const retry = submit(state);
  assert.equal(retry.attempt.requestId, "token-a", "a retry that mints a new token is a second upload");
  assert.equal(minted, before, "nothing may be minted on a retry of the same intent");
  assert.equal(retry.attempt.visibility, first.attempt.visibility);
});

test("4. a retryable failure leaves the draft and its token untouched, on screen or off", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const started = submit(state);
  state = navigate(started.state, B);
  const before = cateringFileDraftFor(state.drafts, A.identity, ROLE);
  state = uploadFailed(state, started.attempt, "Your file could not be uploaded");
  assert.equal(cateringFileDraftFor(state.drafts, A.identity, ROLE), before, "a failure must not rewrite the draft at all");
  assert.equal(cateringMutationIsPending(state.inFlight, A.identity), false, "but it must release the booking's control");
});

test("5. a completion settles the ORIGINATING booking's draft even though another is displayed", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const started = submit(state);
  state = navigate(started.state, B);
  state = uploadSucceeded(state, started.attempt);
  const settled = cateringFileDraftFor(state.drafts, A.identity, ROLE);
  assert.equal(settled.file, null, "the spent draft must not be left offering Upload under a spent token");
  assert.equal(settled.requestId, null);
  assert.equal(state.drafts.has(A.identity), false, "a settled draft holds nothing, so it leaves the map");
});

test("6. that completion does not clear, re-token or touch the displayed booking's draft", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const started = submit(state);
  state = navigate(started.state, B);
  state = choose(state, "invoice.pdf", "token-b");
  const before = shown(state);
  state = uploadSucceeded(state, started.attempt);
  assert.equal(shown(state), before, "B's draft object must be preserved, not rebuilt");
  assert.equal(shown(state).requestId, "token-b");
});

test("7. a completion clears its own booking's draft only while it still matches that attempt", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const started = submit(state);
  // The participant picks a replacement on the SAME booking while the first upload is still running.
  state = choose(state, "replacement.pdf", "token-c");
  state = uploadSucceeded(state, started.attempt);
  const draft = shown(state);
  assert.equal(draft.file?.name, "replacement.pdf", "a newer selection must survive an older success");
  assert.equal(draft.requestId, "token-c");
});

test("8. a preserved draft still carrying the completed attempt's token is re-minted, per booking", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const started = submit(state);
  state = navigate(started.state, B);
  // Back on A, the provider changes their mind about visibility -- same file, same token until now.
  state = navigate(state, A);
  state = visibility(state, "provider", () => "token-a2");
  state = uploadSucceeded(state, started.attempt);
  const draft = shown(state);
  assert.equal(draft.file?.name, "menu.pdf");
  assert.notEqual(draft.requestId, "token-a", "the succeeded token is spent and must never be sent again");
  assert.equal(draft.visibility, "provider");
});

test("9. two bookings hold two pending drafts with two distinct tokens at once", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const a = submit(state);
  state = navigate(a.state, B);
  state = choose(state, "invoice.pdf", "token-b");
  state = visibility(state, "shared", mint);
  const b = submit(state);
  state = b.state;
  assert.equal(cateringMutationIsPending(state.inFlight, A.identity), true);
  assert.equal(cateringMutationIsPending(state.inFlight, B.identity), true);
  assert.notEqual(a.attempt.requestId, b.attempt.requestId);
  // A settles first, off screen. B is mid-flight and untouched.
  state = uploadSucceeded(state, a.attempt);
  assert.equal(state.drafts.has(A.identity), false);
  assert.equal(cateringFileDraftFor(state.drafts, B.identity, ROLE).requestId, "token-b");
  assert.equal(cateringMutationIsPending(state.inFlight, B.identity), true);
});

test("10. a booking's empty draft is its ROLE's empty draft, and empty entries are not stored", () => {
  // A customer has exactly one possible visibility and is never asked; a provider must choose deliberately.
  assert.equal(cateringFileDraftFor(EMPTY_CATERING_FILE_DRAFTS, A.identity, "customer").visibility, "shared");
  assert.equal(cateringFileDraftFor(EMPTY_CATERING_FILE_DRAFTS, A.identity, "provider").visibility, null);
  assert.equal(cateringFileDraftIsEmpty(emptyCateringFileDraft<Chosen>("customer"), "customer"), true);
  assert.equal(cateringFileDraftIsEmpty(emptyCateringFileDraft<Chosen>("customer"), "provider"), false, "a role's empty draft is not another's");
  // Clearing a selection returns the draft to empty, and the entry drops out rather than accumulating per booking.
  let drafts = updateCateringFileDrafts(EMPTY_CATERING_FILE_DRAFTS as CateringFileDrafts<Chosen>, A.identity, ROLE, (draft) => selectCateringFile(draft, pdf("menu.pdf"), "token-a"));
  assert.equal(drafts.size, 1);
  drafts = updateCateringFileDrafts(drafts, A.identity, ROLE, (draft) => selectCateringFile(draft, null));
  assert.equal(drafts.size, 0, "the map is bounded by the bookings being uploaded on, not by every booking visited");
  // And settling a booking that holds no entry is not a state change at all.
  assert.equal(updateCateringFileDrafts(drafts, B.identity, ROLE, (draft) => draft), drafts);
});

test("11. the identity a transition applies to is passed in, never read from anywhere ambient", () => {
  let drafts = updateCateringFileDrafts(EMPTY_CATERING_FILE_DRAFTS as CateringFileDrafts<Chosen>, A.identity, ROLE, (draft) => selectCateringFile(draft, pdf("menu.pdf"), "token-a"));
  const a = cateringFileDraftFor(drafts, A.identity, ROLE);
  drafts = updateCateringFileDrafts(drafts, B.identity, ROLE, (draft) => selectCateringFile(draft, pdf("invoice.pdf"), "token-b"));
  assert.equal(cateringFileDraftFor(drafts, A.identity, ROLE), a, "one booking's transition must leave every other one identical");
  // The same actor on two bookings, and two actors on one booking, are four distinct drafts.
  const other = cateringMutationOrigin("u2", "booking-a");
  assert.equal(cateringFileDraftFor(drafts, other.identity, ROLE).file, null);
  assert.notEqual(other.identity, A.identity);
});

test("12. the component keeps the draft across navigation and never pretends to refill the file input", () => {
  // The reset that destroyed the pending draft is gone; only the DOM control's own value resets with the booking.
  assert.equal(source.includes(`useEffect(() => { if (inputRef.current) inputRef.current.value = ""; terminalSeenRef.current = false; }, [identity]);`), true);
  assert.equal(source.includes("setDrafts(EMPTY_CATERING_FILE_DRAFTS)"), false);
  assert.equal(source.includes("emptyCateringFileDraft"), false, "the component has no way to blank a draft");
  // Every write to the input's value is the empty string: a file input cannot be repopulated, and nothing here
  // invents a path or a filename to put in it.
  const writes = [...source.matchAll(/inputRef\.current\.value = ([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual(writes, [`""`, `""`]);
  assert.equal(/inputRef\.current\.value = [^;]*draft/.test(source), false);
  assert.equal(/inputRef\.current\.files\s*=/.test(source), false);
  // The retained selection is named from the `File` itself, so a restored draft is visible and uploadable even
  // though the control beside it reads empty.
  assert.equal(source.includes("Ready to upload: {draft.file.name}"), true);
  assert.equal(source.includes("const draft = cateringFileDraftFor(drafts, identity, role);"), true);
});

// ---------------------------------------------------------------------------------------------------------------
// The outcome, per booking.
// ---------------------------------------------------------------------------------------------------------------

test("13. an outcome recorded for one booking is not announced on another", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const started = submit(state);
  state = navigate(started.state, B);
  state = uploadSucceeded(state, started.attempt);
  assert.equal(cateringMutationOutcomeFor(state.uploadOutcomes, B.identity), null);
  assert.equal(cateringMutationOutcomeFor(state.uploadOutcomes, A.identity)?.status, "succeeded");
});

test("14. a completion on one booking does not overwrite the answer another is still showing", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const a = submit(state);
  state = uploadFailed(a.state, a.attempt, "Your file could not be uploaded");
  state = navigate(state, B);
  state = choose(state, "invoice.pdf", "token-b");
  state = visibility(state, "shared", mint);
  const b = submit(state);
  state = uploadSucceeded(b.state, b.attempt);
  assert.equal(cateringMutationOutcomeFor(state.uploadOutcomes, B.identity)?.status, "succeeded");
  assert.equal(cateringMutationOutcomeFor(state.uploadOutcomes, A.identity)?.status, "failed", "A's failure must survive B's success");
  assert.equal(cateringMutationOutcomeFor(state.uploadOutcomes, A.identity)?.message, "Your file could not be uploaded");
});

test("15. returning to a booking finds its own outcome still there", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const started = submit(state);
  state = navigate(started.state, B);
  state = uploadFailed(state, started.attempt, "Your file could not be uploaded");
  state = navigate(state, A);
  assert.equal(cateringMutationOutcomeFor(state.uploadOutcomes, state.identity)?.message, "Your file could not be uploaded");
});

test("16. starting a new attempt clears that booking's outcome and no other's", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const a = submit(state);
  state = uploadFailed(a.state, a.attempt, "Your file could not be uploaded");
  state = navigate(state, B);
  state = choose(state, "invoice.pdf", "token-b");
  state = visibility(state, "shared", mint);
  const b = submit(state);
  state = b.state;
  assert.equal(cateringMutationOutcomeFor(state.uploadOutcomes, B.identity), null, "a new attempt starts under no previous answer");
  assert.equal(cateringMutationOutcomeFor(state.uploadOutcomes, A.identity)?.status, "failed", "and clears nobody else's");
  // Clearing a booking that holds no outcome is inert.
  assert.equal(clearCateringMutationOutcome(state.uploadOutcomes, B), state.uploadOutcomes);
});

test("17. two bookings can each hold their own distinct failure", () => {
  let outcomes = recordCateringMutationOutcome(EMPTY_CATERING_MUTATION_OUTCOMES, A, "failed", "This file could not be removed");
  outcomes = recordCateringMutationOutcome(outcomes, B, "failed", "This booking is closed");
  assert.equal(cateringMutationOutcomeFor(outcomes, A.identity)?.message, "This file could not be removed");
  assert.equal(cateringMutationOutcomeFor(outcomes, B.identity)?.message, "This booking is closed");
  // Each outcome is stamped with the booking it belongs to, so a mis-keyed read cannot silently show the wrong one.
  assert.equal(cateringMutationOutcomeFor(outcomes, A.identity)?.identity, A.identity);
});

test("18. the upload and delete answers stay separate, per booking", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const started = submit(state);
  state = uploadFailed(state, started.attempt, "Your file could not be uploaded");
  state = { ...state, removeOutcomes: recordCateringMutationOutcome(state.removeOutcomes, A, "succeeded") };
  assert.equal(cateringMutationOutcomeFor(state.uploadOutcomes, A.identity)?.status, "failed");
  assert.equal(cateringMutationOutcomeFor(state.removeOutcomes, A.identity)?.status, "succeeded");
  assert.equal(cateringMutationOutcomeFor(state.removeOutcomes, B.identity), null);
});

test("19. one booking can hold at most one attempt of each kind, so no stale answer can displace a newer one", () => {
  let state = open(A);
  state = choose(state, "menu.pdf", "token-a");
  state = visibility(state, "shared", mint);
  const started = submit(state);
  state = started.state;
  // While A's upload is running the section refuses to start a second one ON A -- which is what makes one entry
  // per booking one entry per attempt. B is unaffected, and that is the whole point of the per-booking count.
  state = choose(state, "replacement.pdf", "token-c");
  assert.equal(mayUploadCateringFile(shown(state), true, cateringMutationIsPending(state.inFlight, A.identity)), false);
  assert.equal(cateringMutationIsPending(state.inFlight, B.identity), false);
  // Once it settles, the next attempt's answer replaces this one's on that booking alone.
  state = uploadSucceeded(state, started.attempt);
  assert.equal(cateringMutationOutcomeFor(state.uploadOutcomes, A.identity)?.status, "succeeded");
  const next = submit(state);
  assert.equal(cateringMutationOutcomeFor(next.state.uploadOutcomes, A.identity), null);
  const failed = uploadFailed(next.state, next.attempt, "Your file could not be uploaded");
  assert.equal(cateringMutationOutcomeFor(failed.uploadOutcomes, A.identity)?.status, "failed");
});

test("20. the component reads and writes both answers per booking, with no single slot left", () => {
  assert.equal(source.includes("const [uploadOutcomes, setUploadOutcomes] = useState<CateringMutationOutcomes>(EMPTY_CATERING_MUTATION_OUTCOMES);"), true);
  assert.equal(source.includes("const [removeOutcomes, setRemoveOutcomes] = useState<CateringMutationOutcomes>(EMPTY_CATERING_MUTATION_OUTCOMES);"), true);
  assert.equal(source.includes("cateringMutationOutcomeFor(uploadOutcomes, identity)"), true);
  assert.equal(source.includes("cateringMutationOutcomeFor(removeOutcomes, identity)"), true);
  // The single slots and their unconditional resets are gone.
  assert.equal(/setUploadOutcome\(|setRemoveOutcome\(/.test(source), false);
  assert.equal(source.includes("visibleCateringMutationOutcome"), false);
  // Every write names the booking it belongs to: the ORIGINATING one on a completion, the displayed one when a
  // control starts an attempt.
  const writes = [...source.matchAll(/set(?:Upload|Remove)Outcomes\(\(current\) => (\w+)\(current, ([\w.]+)/g)].map((match) => `${match[1]}(${match[2]})`);
  assert.deepEqual(writes, [
    "recordCateringMutationOutcome(attempt.origin)",
    "recordCateringMutationOutcome(attempt.origin)",
    "recordCateringMutationOutcome(attempt.origin)",
    "recordCateringMutationOutcome(attempt.origin)",
    "clearCateringMutationOutcome(origin)",
    "clearCateringMutationOutcome(origin)",
  ]);
});
