import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMPTY_CATERING_FILE_LEDGER, EMPTY_CATERING_IN_FLIGHT, EMPTY_CATERING_UNSENT_MESSAGES, applyForCateringOrigin, expectCateringFileAddition, expectCateringFileRemoval, cateringMutationIsPending, cateringMutationOrigin, cateringMutationOutcome, cateringOriginFileInvalidations, cateringOriginIsCurrent, cateringOriginMessageInvalidations, cateringOriginWorkspaceInvalidations, cateringUnsentMessage, clearCateringUnsentMessage, enterCateringMutation, exitCateringMutation, observeCateringFileSnapshot, recordCateringUnsentMessage, visibleCateringMutationOutcome, type CateringFileLedger, type CateringInFlight, type CateringMutationOrigin, type CateringMutationOutcome, type CateringUnsentMessages } from "@/pages/services/catering-booking-mutation-origin";
import { EMPTY_CATERING_COMPOSER, EMPTY_CATERING_READ_MARK, completeCateringMessageSend, completeCateringReadMark, editCateringComposer, failCateringMessageSend, failCateringReadMark, hydrateCateringComposer, hydrateCateringReadMark, maySendCateringMessage, startCateringMessageSend, startCateringReadMark, type CateringComposerState, type CateringReadMarkState } from "@/pages/services/catering-booking-communication-state";
import { completeCateringFileUpload, emptyCateringFileDraft, markCateringFileAttempted, selectCateringFile, type CateringFileDraft, type CateringSelectedFile } from "@/pages/services/catering-booking-files-state";

/**
 * Asynchronous booking mutations must complete against the booking that STARTED them.
 *
 * Both workspace sections stay mounted while the route's booking changes: only their props move. React Query invokes
 * a mutation's callbacks with the closure from the latest render, so anything those callbacks read from render scope
 * -- `bookingId`, a cache key built from it, an `invalidate()` helper, a boolean ref -- describes the booking on
 * screen rather than the one whose request just landed. Every consequence is real: the originating booking's caches
 * are never refreshed and stay stale, the displayed booking is invalidated for a change that did not touch it, its
 * own-mutation suppression is armed by another booking's upload and then swallows the counterpart change it was
 * supposed to announce, and one booking's success or error text is painted onto another.
 *
 * The rule the fix implements: a completion has an ORIGINATING booking, which is the authoritative target for cache
 * invalidation, suppression and the attempt's own result; and a CURRENTLY RENDERED booking, which may receive
 * visible local UI state only when the two are the same.
 *
 * There is no DOM or React Query harness in this suite, so the handlers are reproduced here over the very helpers
 * the components call, and the components are asserted structurally to be wired to those helpers -- the same split
 * used throughout Phase 2I.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const comms = fs.readFileSync(path.join(here, "BookingCommunication.tsx"), "utf8");
const filesSource = fs.readFileSync(path.join(here, "BookingFiles.tsx"), "utf8");
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const USER = "user-1";
const A = cateringMutationOrigin(USER, "booking-a");
const B = cateringMutationOrigin(USER, "booking-b");
const key = (parts: readonly unknown[]) => parts.join("|");

// ---------------------------------------------------------------------------------------------------------------
// Communication: the send and mark-read handlers, transcribed from the component.
// ---------------------------------------------------------------------------------------------------------------
type SendAttempt = { origin: CateringMutationOrigin; text: string; clientRequestId: string };
type ReadAttempt = { origin: CateringMutationOrigin; lastReadMessageId: string };
type Comms = {
  identity: string;
  composer: CateringComposerState;
  readMark: CateringReadMarkState;
  unsent: CateringUnsentMessages;
  outcome: CateringMutationOutcome | null;
  inFlight: CateringInFlight;
  invalidated: string[];
};

function openComms(origin: CateringMutationOrigin): Comms {
  return { identity: origin.identity, composer: hydrateCateringComposer(EMPTY_CATERING_COMPOSER, origin.identity), readMark: hydrateCateringReadMark(EMPTY_CATERING_READ_MARK, origin.identity), unsent: EMPTY_CATERING_UNSENT_MESSAGES, outcome: null, inFlight: EMPTY_CATERING_IN_FLIGHT, invalidated: [] };
}
/** The route changes while the component stays mounted: props move, local state is rehydrated for the new booking. */
function navigateComms(state: Comms, origin: CateringMutationOrigin): Comms {
  return { ...state, identity: origin.identity, composer: hydrateCateringComposer(state.composer, origin.identity), readMark: hydrateCateringReadMark(state.readMark, origin.identity) };
}
function typeMessage(state: Comms, text: string): Comms {
  return { ...state, composer: editCateringComposer(hydrateCateringComposer(state.composer, state.identity), text) };
}
function submitSend(state: Comms, origin: CateringMutationOrigin, clientRequestId: string): { state: Comms; attempt: SendAttempt } {
  const started = startCateringMessageSend(hydrateCateringComposer(state.composer, origin.identity), clientRequestId);
  assert.notEqual(started, null, "the composer must have something sendable");
  return { state: { ...state, composer: started!.next, outcome: null }, attempt: { origin, ...started!.payload } };
}
function sendSucceeded(state: Comms, attempt: SendAttempt): Comms {
  return {
    ...state,
    composer: applyForCateringOrigin(state.composer, attempt.origin, (s) => completeCateringMessageSend(s, attempt.clientRequestId)),
    unsent: clearCateringUnsentMessage(state.unsent, attempt.origin),
    outcome: cateringMutationOutcome(attempt.origin, "succeeded"),
    invalidated: [...state.invalidated, ...cateringOriginMessageInvalidations(attempt.origin).map(key)],
  };
}
function sendFailed(state: Comms, attempt: SendAttempt, message: string, readOnly: boolean): Comms {
  return {
    ...state,
    composer: applyForCateringOrigin(state.composer, attempt.origin, (s) => failCateringMessageSend(s, attempt.clientRequestId, message)),
    unsent: recordCateringUnsentMessage(state.unsent, attempt.origin, attempt.text),
    outcome: cateringMutationOutcome(attempt.origin, "failed", message),
    invalidated: readOnly ? [...state.invalidated, ...cateringOriginMessageInvalidations(attempt.origin).map(key)] : state.invalidated,
  };
}
function startRead(state: Comms, origin: CateringMutationOrigin, lastReadMessageId: string): { state: Comms; attempt: ReadAttempt } {
  const attempt: ReadAttempt = { origin, lastReadMessageId };
  return { state: { ...state, readMark: startCateringReadMark(hydrateCateringReadMark(state.readMark, origin.identity), lastReadMessageId), inFlight: enterCateringMutation(state.inFlight, origin) }, attempt };
}
function readSucceeded(state: Comms, attempt: ReadAttempt, serverMarkerId: string | null): Comms {
  return {
    ...state,
    readMark: applyForCateringOrigin(state.readMark, attempt.origin, (s) => completeCateringReadMark(s, serverMarkerId)),
    inFlight: exitCateringMutation(state.inFlight, attempt.origin),
    invalidated: [...state.invalidated, ...cateringOriginMessageInvalidations(attempt.origin).map(key)],
  };
}
function readFailed(state: Comms, attempt: ReadAttempt): Comms {
  return { ...state, readMark: applyForCateringOrigin(state.readMark, attempt.origin, (s) => failCateringReadMark(s, attempt.lastReadMessageId)), inFlight: exitCateringMutation(state.inFlight, attempt.origin) };
}
/** Whichever booking's keys were touched, expressed as the bookings they belong to. */
function touched(state: Comms | Files): string[] {
  return [...new Set(state.invalidated)];
}
function mentions(state: Comms | Files, origin: CateringMutationOrigin): boolean {
  return state.invalidated.some((entry) => entry.includes(origin.bookingId));
}

test("1. a send that lands after navigating away refreshes its OWN booking, and only that booking", () => {
  let state = openComms(A);
  state = typeMessage(state, "the tasting menu is confirmed");
  const sent = submitSend(state, A, "req-1");
  state = navigateComms(sent.state, B);
  state = sendSucceeded(state, sent.attempt);
  // A's message pages and A's workspace summary are both refreshed, because A is where the message landed.
  assert.deepEqual(touched(state).sort(), cateringOriginMessageInvalidations(A).map(key).sort());
  assert.equal(mentions(state, B), false, "B was invalidated for a completion that never touched it");
  // And nothing announces "Message sent." on B.
  assert.equal(visibleCateringMutationOutcome(state.outcome, B.identity), null);
  assert.equal(visibleCateringMutationOutcome(state.outcome, A.identity)?.status, "succeeded");
  // B's composer is untouched: no pending attempt, no text.
  assert.deepEqual(hydrateCateringComposer(state.composer, B.identity), { identity: B.identity, text: "", pending: null });
});

test("2. a send that FAILS after navigating away keeps its failure on its own booking", () => {
  let state = openComms(A);
  state = typeMessage(state, "can we move the arrival time?");
  const sent = submitSend(state, A, "req-2");
  state = navigateComms(sent.state, B);
  state = sendFailed(state, sent.attempt, "Your message could not be sent", false);
  assert.equal(visibleCateringMutationOutcome(state.outcome, B.identity), null, "B must not show A's error");
  assert.equal(visibleCateringMutationOutcome(state.outcome, A.identity)?.message, "Your message could not be sent");
  // The preserved text belongs to A alone.
  assert.equal(cateringUnsentMessage(state.unsent, B.identity), null);
  assert.equal(cateringUnsentMessage(state.unsent, A.identity), "can we move the arrival time?");
  // B's composer holds neither the failed attempt nor its text.
  assert.equal(hydrateCateringComposer(state.composer, B.identity).pending, null);
  assert.equal(hydrateCateringComposer(state.composer, B.identity).text, "");
});

test("3. a mark-read that lands after navigating away refreshes its own booking's caches only", () => {
  let state = openComms(A);
  const read = startRead(state, A, "m-9");
  state = navigateComms(read.state, B);
  state = readSucceeded(state, read.attempt, "m-9");
  assert.deepEqual(touched(state).sort(), cateringOriginMessageInvalidations(A).map(key).sort());
  assert.equal(mentions(state, B), false, "B's unread state must not be invalidated by A's receipt");
  // B's own read state is untouched -- no marker, no attempt, no failure.
  assert.deepEqual(hydrateCateringReadMark(state.readMark, B.identity), { ...EMPTY_CATERING_READ_MARK, identity: B.identity });
});

test("4. a mark-read that FAILS after navigating away shows no retry or error on the other booking", () => {
  let state = openComms(A);
  const read = startRead(state, A, "m-9");
  state = navigateComms(read.state, B);
  state = readFailed(state, read.attempt);
  assert.equal(hydrateCateringReadMark(state.readMark, B.identity).failed, false, "B must not inherit A's read failure");
  assert.equal(state.invalidated.length, 0);
  // "Busy" is a statement about one booking: A's request no longer disables B's control, and it has settled anyway.
  assert.equal(cateringMutationIsPending(state.inFlight, B.identity), false);
  assert.equal(cateringMutationIsPending(state.inFlight, A.identity), false);
});

test("4b. while a receipt is genuinely in flight, only its own booking counts as busy", () => {
  let state = openComms(A);
  const read = startRead(state, A, "m-9");
  state = navigateComms(read.state, B);
  assert.equal(cateringMutationIsPending(state.inFlight, A.identity), true);
  assert.equal(cateringMutationIsPending(state.inFlight, B.identity), false, "A's request must not disable B's retry");
});

test("5. navigating away and back finds the originating booking's conversation refreshed", () => {
  let state = openComms(A);
  state = typeMessage(state, "confirming the headcount");
  const sent = submitSend(state, A, "req-5");
  state = navigateComms(sent.state, B);
  state = sendSucceeded(state, sent.attempt);
  state = navigateComms(state, A);
  // The refresh went to A while B was on screen, so returning to A does not depend on anything happening now.
  assert.equal(state.invalidated.includes(key(cateringOriginMessageInvalidations(A)[0])), true);
  assert.equal(state.invalidated.includes(key(cateringOriginWorkspaceInvalidations(A)[0])), true);
  // The composer was cleared for A when its own send completed, so nothing stale comes back with it.
  assert.equal(hydrateCateringComposer(state.composer, A.identity).pending, null);
  assert.equal(cateringUnsentMessage(state.unsent, A.identity), null, "a delivered message is not an unsent one");
});

test("6. a send that races the booking going terminal keeps the refused text", () => {
  let state = openComms(A);
  state = typeMessage(state, "adding two more guests");
  const sent = submitSend(state, A, "req-6");
  // The counterpart cancelled the booking first, so the server refuses the write with its canonical read-only code.
  state = sendFailed(sent.state, sent.attempt, "This booking is closed and can no longer be messaged", true);
  const failed = hydrateCateringComposer(state.composer, A.identity).pending;
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.text, "adding two more guests", "the refused text is preserved exactly");
  assert.equal(cateringUnsentMessage(state.unsent, A.identity), "adding two more guests");
  // The read-only refusal is what makes this section stale, so the originating booking is refetched.
  assert.deepEqual(touched(state).sort(), cateringOriginMessageInvalidations(A).map(key).sort());
});

test("7. once the booking is terminal the refused text stays visible and read-only, with nothing to press", () => {
  let state = openComms(A);
  state = typeMessage(state, "adding two more guests");
  const sent = submitSend(state, A, "req-7");
  state = sendFailed(sent.state, sent.attempt, "This booking is closed and can no longer be messaged", true);
  // Sending and retrying are both refused for a booking the endpoint reports terminal.
  assert.equal(maySendCateringMessage(hydrateCateringComposer(state.composer, A.identity), false), false);
  assert.equal(cateringUnsentMessage(state.unsent, A.identity), "adding two more guests");
  // The component renders that text in the terminal branch, read-only, alongside the closed-booking banner.
  const terminal = comms.slice(comms.indexOf(`: <div className="space-y-3">`), comms.indexOf("</CardContent></Card>;"));
  assert.equal(terminal.includes("{CATERING_COMMUNICATION_READ_ONLY_BANNER}"), true, "the closed-booking banner must still appear");
  assert.equal(terminal.includes("Unsent message"), true);
  assert.equal(terminal.includes("readOnly value={unsentText}"), true);
  assert.equal(comms.includes("const unsentText = pending?.text ?? cateringUnsentMessage(unsent, identity);"), true);
  // No control that could send, retry or discard survives into the terminal rendering.
  assert.equal(terminal.includes("<Button"), false, "a terminal booking must offer no send or retry control");
  assert.equal(terminal.includes("onSubmit"), false);
  assert.equal(terminal.includes("send.mutate"), false);
  // The retry handler refuses independently of what is rendered.
  const retryHandler = comms.slice(comms.indexOf("const retry = ()"), comms.indexOf("const pending ="));
  assert.equal(retryHandler.includes("if (!canSend) return;"), true);
});

test("8. a preserved unsent message never appears on another booking", () => {
  let state = openComms(A);
  state = typeMessage(state, "adding two more guests");
  const sent = submitSend(state, A, "req-8");
  state = sendFailed(sent.state, sent.attempt, "This booking is closed and can no longer be messaged", true);
  state = navigateComms(state, B);
  assert.equal(cateringUnsentMessage(state.unsent, B.identity), null, "B must not show A's unsent message");
  assert.equal(hydrateCateringComposer(state.composer, B.identity).pending, null);
  assert.equal(visibleCateringMutationOutcome(state.outcome, B.identity), null);
});

test("9. returning to the booking still finds its unsent message available to copy", () => {
  let state = openComms(A);
  state = typeMessage(state, "adding two more guests");
  const sent = submitSend(state, A, "req-9");
  state = sendFailed(sent.state, sent.attempt, "This booking is closed and can no longer be messaged", true);
  state = navigateComms(state, B);
  state = navigateComms(state, A);
  assert.equal(cateringUnsentMessage(state.unsent, A.identity), "adding two more guests");
  // Nothing here is persisted: it is local recovery state for this mount, and it is honest about being local.
  assert.equal(comms.includes("it is not saved anywhere"), true);
});

// ---------------------------------------------------------------------------------------------------------------
// Files: the upload, delete and boundary handlers, transcribed from the component.
// ---------------------------------------------------------------------------------------------------------------
type Chosen = CateringSelectedFile;
type UploadAttempt = { origin: CateringMutationOrigin; requestId: string; visibility: "provider" | "shared" };
type Files = {
  identity: string;
  draft: CateringFileDraft<Chosen>;
  ledger: CateringFileLedger;
  inFlight: CateringInFlight;
  uploadOutcome: CateringMutationOutcome | null;
  removeOutcome: CateringMutationOutcome | null;
  invalidated: string[];
};
const ROLE = "provider" as const;
const pdf = (name: string): Chosen => ({ name, type: "application/pdf", size: 2048 });

function openFiles(origin: CateringMutationOrigin): Files {
  return { identity: origin.identity, draft: emptyCateringFileDraft<Chosen>(ROLE), ledger: EMPTY_CATERING_FILE_LEDGER, inFlight: EMPTY_CATERING_IN_FLIGHT, uploadOutcome: null, removeOutcome: null, invalidated: [] };
}
/** The draft and the file input reset with the booking on screen; the ledger is keyed by booking and does not. */
function navigateFiles(state: Files, origin: CateringMutationOrigin): Files {
  return { ...state, identity: origin.identity, draft: emptyCateringFileDraft<Chosen>(ROLE) };
}
function chooseFile(state: Files, name: string, requestId: string): Files {
  return { ...state, draft: selectCateringFile(state.draft, pdf(name), requestId) };
}
function submitUpload(state: Files, origin: CateringMutationOrigin): { state: Files; attempt: UploadAttempt } {
  const attempt: UploadAttempt = { origin, requestId: state.draft.requestId!, visibility: state.draft.visibility! };
  return { state: { ...state, draft: markCateringFileAttempted(state.draft), uploadOutcome: null, inFlight: enterCateringMutation(state.inFlight, origin) }, attempt };
}
function uploadSucceeded(state: Files, attempt: UploadAttempt, fileId: string): Files {
  let draft = state.draft;
  // Visible local state only when the completion belongs to the booking still on screen.
  if (cateringOriginIsCurrent(attempt.origin, state.identity)) draft = completeCateringFileUpload(draft, attempt, ROLE, () => "minted").next;
  return {
    ...state,
    draft,
    // The exact addition the server's own answer says to expect, on the ORIGINATING booking.
    ledger: expectCateringFileAddition(state.ledger, attempt.origin, fileId),
    inFlight: exitCateringMutation(state.inFlight, attempt.origin),
    uploadOutcome: cateringMutationOutcome(attempt.origin, "succeeded"),
    invalidated: [...state.invalidated, ...cateringOriginFileInvalidations(attempt.origin).map(key)],
  };
}
function uploadFailed(state: Files, attempt: UploadAttempt, message: string): Files {
  return { ...state, inFlight: exitCateringMutation(state.inFlight, attempt.origin), uploadOutcome: cateringMutationOutcome(attempt.origin, "failed", message), invalidated: [...state.invalidated, ...cateringOriginFileInvalidations(attempt.origin).map(key)] };
}
function removeSucceeded(state: Files, origin: CateringMutationOrigin, fileId: string): Files {
  return { ...state, ledger: expectCateringFileRemoval(state.ledger, origin, fileId), removeOutcome: cateringMutationOutcome(origin, "succeeded"), invalidated: [...state.invalidated, ...cateringOriginFileInvalidations(origin).map(key)] };
}
function removeFailed(state: Files, origin: CateringMutationOrigin, message: string): Files {
  return { ...state, removeOutcome: cateringMutationOutcome(origin, "failed", message), invalidated: [...state.invalidated, ...cateringOriginFileInvalidations(origin).map(key)] };
}
/** One poll landing: the newest authoritative page, newest first, for the booking on screen. */
function observeBoundary(state: Files, origin: CateringMutationOrigin, snapshot: readonly string[] | null): { state: Files; refreshed: boolean } {
  const observed = observeCateringFileSnapshot(state.ledger, origin.identity, snapshot);
  const refreshed = observed.refreshActivity;
  return { state: { ...state, ledger: observed.next, invalidated: refreshed ? [...state.invalidated, ...cateringOriginWorkspaceInvalidations(origin).map(key)] : state.invalidated }, refreshed };
}

test("10. an upload that lands after navigating away refreshes its own booking's files and workspace", () => {
  let state = openFiles(A);
  state = chooseFile(state, "menu.pdf", "up-1");
  const started = submitUpload(state, A);
  state = navigateFiles(started.state, B);
  state = uploadSucceeded(state, started.attempt, "a2");
  assert.deepEqual(touched(state).sort(), cateringOriginFileInvalidations(A).map(key).sort());
  assert.equal(mentions(state, B), false, "B must not be invalidated by A's upload");
  assert.equal(visibleCateringMutationOutcome(state.uploadOutcome, B.identity), null, "B must not announce A's upload");
});

test("11. a successful upload expects its exact addition, on its own booking alone", () => {
  let state = openFiles(A);
  state = chooseFile(state, "menu.pdf", "up-2");
  const started = submitUpload(state, A);
  state = navigateFiles(started.state, B);
  state = uploadSucceeded(state, started.attempt, "a2");
  assert.deepEqual([...(state.ledger.pending.get(A.identity)?.additions ?? [])], ["a2"]);
  assert.equal(state.ledger.pending.has(B.identity), false);
});

test("12. the next counterpart change on the other booking is still announced", () => {
  let state = openFiles(A);
  state = chooseFile(state, "menu.pdf", "up-3");
  const started = submitUpload(state, A);
  state = navigateFiles(started.state, B);
  state = uploadSucceeded(state, started.attempt, "a2");
  // B's first poll is a baseline: a booking's existing list is not a change.
  const baseline = observeBoundary(state, B, ["b1"]);
  assert.equal(baseline.refreshed, false);
  state = baseline.state;
  // The counterpart shares a file on B. A's expectation is A's, so nothing absorbs this and Activity is refreshed.
  const counterpart = observeBoundary(state, B, ["b2", "b1"]);
  assert.equal(counterpart.refreshed, true, "A's upload must not swallow B's counterpart change");
  state = counterpart.state;
  assert.equal(state.invalidated.includes(key(cateringOriginWorkspaceInvalidations(B)[0])), true);
  // A's expectation is still intact, waiting for A's own page rather than having been spent on B.
  assert.deepEqual([...(state.ledger.pending.get(A.identity)?.additions ?? [])], ["a2"]);
});

test("13. a delete that lands after navigating away invalidates and suppresses on its own booking only", () => {
  let state = openFiles(A);
  state = navigateFiles(state, B);
  state = removeSucceeded(state, A, "a1");
  assert.deepEqual(touched(state).sort(), cateringOriginFileInvalidations(A).map(key).sort());
  assert.equal(mentions(state, B), false);
  assert.deepEqual([...(state.ledger.pending.get(A.identity)?.removals ?? [])], ["a1"]);
  assert.equal(state.ledger.pending.has(B.identity), false);
  assert.equal(visibleCateringMutationOutcome(state.removeOutcome, B.identity), null);
});

test("14. a failed upload or delete arms suppression on no booking at all", () => {
  let state = openFiles(A);
  state = chooseFile(state, "menu.pdf", "up-4");
  const started = submitUpload(state, A);
  state = navigateFiles(started.state, B);
  state = uploadFailed(state, started.attempt, "Your file could not be uploaded");
  state = removeFailed(state, A, "This file could not be removed");
  assert.equal(state.ledger.pending.size, 0, "a failure changed nothing, so it expects nothing");
  // And a later counterpart change on either booking is therefore announced normally.
  let observed = observeBoundary(state, B, ["b1"]);
  state = observed.state;
  observed = observeBoundary(state, B, ["b2", "b1"]);
  assert.equal(observed.refreshed, true);
});

test("15. an idempotent duplicate retry expects nothing when the page already carries the file", () => {
  let state = openFiles(A);
  // A's page already shows a1, which is what the duplicate response hands back.
  state = observeBoundary(state, A, ["a1"]).state;
  state = chooseFile(state, "menu.pdf", "up-5");
  const started = submitUpload(state, A);
  state = navigateFiles(started.state, B);
  // The server answered from the idempotency ledger: this request created nothing, so no delta is its doing.
  state = uploadSucceeded(state, started.attempt, "a1");
  assert.equal(state.ledger.pending.size, 0);
  // The caches of the originating booking are still refreshed -- the file exists there, whoever's request made it.
  assert.deepEqual(touched(state).sort(), cateringOriginFileInvalidations(A).map(key).sort());
});

test("16. an upload completing after navigation leaves the other booking's draft exactly as it is", () => {
  let state = openFiles(A);
  state = chooseFile(state, "menu.pdf", "up-6");
  const started = submitUpload(state, A);
  state = navigateFiles(started.state, B);
  state = chooseFile(state, "invoice.pdf", "up-7");
  const before = state.draft;
  state = uploadSucceeded(state, started.attempt, "a2");
  assert.equal(state.draft, before, "A's completion must not clear or re-token B's draft");
  assert.equal(state.draft.file?.name, "invoice.pdf");
  assert.equal(state.draft.requestId, "up-7");
  assert.equal(state.draft.visibility, before.visibility);
});

test("17. a delete error stays on the booking it happened on", () => {
  let state = openFiles(A);
  state = navigateFiles(state, B);
  state = removeFailed(state, A, "This file could not be removed");
  assert.equal(visibleCateringMutationOutcome(state.removeOutcome, B.identity), null);
  assert.equal(visibleCateringMutationOutcome(state.removeOutcome, A.identity)?.message, "This file could not be removed");
});

test("18. returning to a booking still refreshes its Activity for a change made while away", () => {
  let state = openFiles(A);
  // A's own upload lands, arms A, and A's refreshed page consumes that arming without announcing anything.
  state = observeBoundary(state, A, ["a1"]).state;
  state = chooseFile(state, "menu.pdf", "up-8");
  const started = submitUpload(state, A);
  state = uploadSucceeded(state, started.attempt, "a2");
  let observed = observeBoundary(state, A, ["a2", "a1"]);
  assert.equal(observed.refreshed, false, "this actor's own upload is not announced twice");
  state = observed.state;
  // Away to B and back. The counterpart shared a file on A in the meantime.
  state = navigateFiles(state, B);
  state = navigateFiles(state, A);
  observed = observeBoundary(state, A, ["a3", "a2", "a1"]);
  assert.equal(observed.refreshed, true, "a counterpart change on the returned-to booking must refresh Activity");
  assert.equal(observed.state.invalidated.includes(key(cateringOriginWorkspaceInvalidations(A)[0])), true);
});

// ---------------------------------------------------------------------------------------------------------------
// The components are actually wired this way.
// ---------------------------------------------------------------------------------------------------------------
test("19. no communication completion handler reads the booking from render scope", () => {
  const sendBlock = stripComments(comms.slice(comms.indexOf("const send = useMutation"), comms.indexOf("const markRead = useMutation")));
  const readBlock = stripComments(comms.slice(comms.indexOf("const markRead = useMutation"), comms.indexOf("// Any delivery of a newer message")));
  for (const [label, block] of [["send", sendBlock], ["markRead", readBlock]] as const) {
    // The render-scope key, the render-scope ids and the render-scope identity are all absent: only the attempt's
    // own origin decides which booking a completion belongs to.
    assert.equal(block.includes("messagesKey"), false, label);
    assert.equal(block.includes("cateringBookingWorkspaceKey"), false, label);
    assert.equal(block.includes("(userId, bookingId)"), false, label);
    assert.equal(block.includes("${bookingId}"), false, label);
    assert.equal(block.includes("attempt.origin"), true, label);
  }
  // Both completions invalidate through the origin, and both state updates are origin-guarded.
  assert.equal((comms.match(/cateringOriginMessageInvalidations\(attempt\.origin\)/g) ?? []).length, 3, "send success, read-only send failure, and read success");
  assert.equal(sendBlock.includes("applyForCateringOrigin(current, attempt.origin"), true);
  assert.equal(readBlock.includes("applyForCateringOrigin(current, attempt.origin"), true);
  // The requests themselves address the originating booking too, so a late-started fetch cannot cross bookings.
  assert.equal(comms.includes("`/api/catering/bookings/${attempt.origin.bookingId}/messages`"), true);
  assert.equal(comms.includes("`/api/catering/bookings/${attempt.origin.bookingId}/messages/read`"), true);
});

test("20. no file completion handler reads the booking from render scope", () => {
  const uploadBlock = stripComments(filesSource.slice(filesSource.indexOf("const upload = useMutation"), filesSource.indexOf("const remove = useMutation")));
  const removeBlock = stripComments(filesSource.slice(filesSource.indexOf("const remove = useMutation"), filesSource.indexOf("// A poll that finds the newest page")));
  for (const [label, block] of [["upload", uploadBlock], ["remove", removeBlock]] as const) {
    assert.equal(block.includes("filesKey"), false, label);
    assert.equal(block.includes("cateringBookingWorkspaceKey"), false, label);
    assert.equal(block.includes("(userId, bookingId)"), false, label);
    assert.equal(block.includes("${bookingId}"), false, label);
    assert.equal(block.includes("attempt.origin"), true, label);
  }
  // The zero-argument invalidate closure is gone: the helper now takes the origin it must refresh.
  assert.equal(filesSource.includes("const invalidateOrigin = (attemptOrigin: CateringMutationOrigin) => {"), true);
  assert.equal(/\bconst invalidate = \(\) =>/.test(filesSource), false, "a render-scope invalidate closure must not return");
  assert.equal(filesSource.includes("`/api/catering/bookings/${attempt.origin.bookingId}/files`"), true);
  assert.equal(filesSource.includes("`/api/catering/bookings/${attempt.origin.bookingId}/files/${attempt.fileId}`"), true);
  // The draft is the one piece of visible state an upload touches, and it is gated on the rendered booking.
  assert.equal(uploadBlock.includes("if (attempt.origin.identity === identityRef.current) {"), true);
  assert.equal(removeBlock.includes("setDraft"), false);
});

test("21. hook-level success, error and pending flags no longer drive either rendering", () => {
  for (const [label, source] of [["communication", comms], ["files", filesSource]] as const) {
    const code = stripComments(source);
    for (const flag of ["send.isSuccess", "send.isError", "upload.isSuccess", "upload.isError", "upload.isPending", "remove.isError", "remove.isPending", "markRead.isPending"]) {
      assert.equal(code.includes(flag), false, `${label}: ${flag} is a property of the hook, not of a booking`);
    }
  }
  // What replaced them is identity-scoped in both sections.
  assert.equal(comms.includes("visibleCateringMutationOutcome(sendOutcome, identity)"), true);
  assert.equal(filesSource.includes("visibleCateringMutationOutcome(uploadOutcome, identity)"), true);
  assert.equal(filesSource.includes("visibleCateringMutationOutcome(removeOutcome, identity)"), true);
  assert.equal(filesSource.includes("cateringMutationIsPending(uploadInFlight, identity)"), true);
  assert.equal(filesSource.includes("cateringMutationIsPending(removeInFlight, identity)"), true);
  assert.equal(comms.includes("cateringMutationIsPending(readInFlight, identity)"), true);
});

test("22. the per-booking in-flight count tolerates two bookings being busy, and never goes negative", () => {
  let inFlight = enterCateringMutation(EMPTY_CATERING_IN_FLIGHT, A);
  inFlight = enterCateringMutation(inFlight, B);
  assert.equal(cateringMutationIsPending(inFlight, A.identity), true);
  assert.equal(cateringMutationIsPending(inFlight, B.identity), true);
  inFlight = exitCateringMutation(inFlight, A);
  assert.equal(cateringMutationIsPending(inFlight, A.identity), false);
  assert.equal(cateringMutationIsPending(inFlight, B.identity), true, "settling one booking must not settle the other");
  // Two concurrent requests on one booking settle independently, and an unmatched settle is inert.
  let both = enterCateringMutation(enterCateringMutation(EMPTY_CATERING_IN_FLIGHT, A), A);
  both = exitCateringMutation(both, A);
  assert.equal(cateringMutationIsPending(both, A.identity), true);
  both = exitCateringMutation(exitCateringMutation(both, A), A);
  assert.equal(cateringMutationIsPending(both, A.identity), false);
});

test("23. a preserved unsent message is per booking, and blank text preserves nothing", () => {
  let unsent = recordCateringUnsentMessage(EMPTY_CATERING_UNSENT_MESSAGES, A, "keep me");
  unsent = recordCateringUnsentMessage(unsent, B, "and me");
  assert.equal(cateringUnsentMessage(unsent, A.identity), "keep me");
  assert.equal(cateringUnsentMessage(unsent, B.identity), "and me");
  unsent = clearCateringUnsentMessage(unsent, A);
  assert.equal(cateringUnsentMessage(unsent, A.identity), null);
  assert.equal(cateringUnsentMessage(unsent, B.identity), "and me", "clearing one booking must not clear another");
  // Nothing to recover is not something to show.
  assert.equal(cateringUnsentMessage(recordCateringUnsentMessage(unsent, A, "   "), A.identity), null);
  assert.equal(clearCateringUnsentMessage(unsent, A), unsent, "clearing what is not held allocates nothing");
});

test("24. the file ledger announces a change once, per booking, and never on a baseline or a repeat", () => {
  let ledger = EMPTY_CATERING_FILE_LEDGER;
  // Nothing loaded yet is not a change.
  let step = observeCateringFileSnapshot(ledger, A.identity, null);
  assert.equal(step.refreshActivity, false);
  assert.equal(step.next, ledger);
  // First real observation is the baseline; repeating it does nothing.
  step = observeCateringFileSnapshot(ledger, A.identity, ["a1"]);
  assert.equal(step.refreshActivity, false);
  ledger = step.next;
  step = observeCateringFileSnapshot(ledger, A.identity, ["a1"]);
  assert.equal(step.refreshActivity, false);
  assert.equal(step.next, ledger, "an unchanged page allocates nothing");
  // A counterpart's change is announced; this actor's own expected change is absorbed exactly once.
  step = observeCateringFileSnapshot(ledger, A.identity, ["a2", "a1"]);
  assert.equal(step.refreshActivity, true);
  ledger = expectCateringFileAddition(step.next, A, "a3");
  assert.equal(expectCateringFileAddition(ledger, A, "a3"), ledger, "expecting the same addition twice is once");
  step = observeCateringFileSnapshot(ledger, A.identity, ["a3", "a2", "a1"]);
  assert.equal(step.refreshActivity, false, "this actor's own change is absorbed");
  ledger = step.next;
  assert.equal(ledger.pending.size, 0, "and the expectation is consumed");
  step = observeCateringFileSnapshot(ledger, A.identity, ["a4", "a3", "a2", "a1"]);
  assert.equal(step.refreshActivity, true, "the expectation is spent, so the next change is announced");
  // Every booking keeps its own baseline: B's first observation is still a baseline after all of A's history.
  assert.equal(observeCateringFileSnapshot(step.next, B.identity, ["b1"]).refreshActivity, false);
});
