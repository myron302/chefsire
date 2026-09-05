import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_MESSAGE_MAX_LENGTH } from "@shared/catering-booking-communication";
import { CATERING_WORKSPACE_READ_ONLY_CODE } from "@shared/catering-booking-operations";
import { CATERING_COMMUNICATION_READ_ONLY_BANNER, EMPTY_CATERING_COMPOSER, EMPTY_CATERING_READ_MARK, EMPTY_CATERING_VIEWED, cateringReadableBoundary, completeCateringReadMark, hydrateCateringViewed, recordCateringViewedBoundary, failCateringReadMark, hydrateCateringReadMark, mayRetryCateringReadMark, retryCateringReadMark, shouldAutoMarkCateringConversationRead, startCateringReadMark, cateringMessageIsSendable, combineCateringMessagePages, completeCateringMessageSend, discardCateringMessageSend, editCateringComposer, failCateringMessageSend, formatCateringMessageTimestamp, hydrateCateringComposer, isCateringCommunicationReadOnly, latestCateringMessageId, maySendCateringMessage, nextCateringMessageCursor, retryCateringMessageSend, shouldMarkCateringConversationRead, startCateringMessageSend , EMPTY_CATERING_THREAD_VISIBILITY, cateringMessagePageKey, cateringThreadEndIsOnScreen, cateringCoverageFrontier, cateringUnreadRangeWasTraversed, cateringUnreadStart, cateringUnreadStartId, cateringViewGeneration, mayRecordCateringViewedBoundary, recordCateringMessageCoverage, recordCateringSentinelVisibility, recordCateringViewportVisibility } from "./catering-booking-communication-state";

const TOKEN = "11111111-1111-4111-8111-111111111111";
const OTHER_TOKEN = "22222222-2222-4222-8222-222222222222";
const composer = (text: string) => editCateringComposer(hydrateCateringComposer(EMPTY_CATERING_COMPOSER, "actor:booking"), text);
const message = (id: string) => ({ id, senderId: "provider", senderRole: "provider" as const, senderName: "Ada", text: id, createdAt: "2026-09-01T12:00:00.000Z", mine: true });

test("the composer is reset when the actor or booking changes, and kept otherwise", () => {
  const typed = composer("half typed");
  assert.equal(hydrateCateringComposer(typed, "actor:booking"), typed);
  assert.deepEqual(hydrateCateringComposer(typed, "other:booking"), { identity: "other:booking", text: "", pending: null });
});
test("a message must survive trimming and stay within the server's own bound", () => {
  assert.equal(cateringMessageIsSendable("hello"), true);
  for (const text of ["", "   ", "\n\t"]) assert.equal(cateringMessageIsSendable(text), false);
  assert.equal(cateringMessageIsSendable("a".repeat(CATERING_MESSAGE_MAX_LENGTH)), true);
  assert.equal(cateringMessageIsSendable("a".repeat(CATERING_MESSAGE_MAX_LENGTH + 1)), false);
});
test("a read-only booking and an empty composer both refuse to send", () => {
  assert.equal(maySendCateringMessage(composer("hi"), true), true);
  assert.equal(maySendCateringMessage(composer("hi"), false), false);
  assert.equal(maySendCateringMessage(composer("   "), true), false);
  assert.equal(maySendCateringMessage(composer("hi"), true, true), false);
});
test("a second press while a send is in flight is refused, which is what a double tap hits", () => {
  const started = startCateringMessageSend(composer("hi"), TOKEN)!;
  assert.equal(maySendCateringMessage(started.next, true), false);
  // And starting another send from that state is refused outright rather than producing a second request.
  assert.equal(startCateringMessageSend(started.next, OTHER_TOKEN), null);
});
test("a send carries the trimmed text and its own retry token", () => {
  const started = startCateringMessageSend(composer("  hello  "), TOKEN)!;
  assert.deepEqual(started.payload, { text: "hello", clientRequestId: TOKEN });
  assert.deepEqual(started.next.pending, { clientRequestId: TOKEN, text: "hello", status: "sending", error: null });
  // The text stays in the composer until the server accepts it, so a failure never loses it.
  assert.equal(started.next.text, "  hello  ");
});
test("only the send actually in flight clears the composer", () => {
  const started = startCateringMessageSend(composer("hi"), TOKEN)!;
  assert.deepEqual(completeCateringMessageSend(started.next, TOKEN), { identity: "actor:booking", text: "", pending: null });
  // A response for a send that is no longer the current one changes nothing.
  assert.equal(completeCateringMessageSend(started.next, OTHER_TOKEN), started.next);
});
test("a normal successful send clears a composer that still holds the submitted draft", () => {
  // Surrounding whitespace still counts as the same draft, because that is what was actually submitted.
  const started = startCateringMessageSend(composer("  hello  "), TOKEN)!;
  assert.equal(completeCateringMessageSend(started.next, TOKEN).text, "");
  assert.equal(completeCateringMessageSend(started.next, TOKEN).pending, null);
});
test("a send that succeeds while the participant has typed something new keeps the newer text", () => {
  const started = startCateringMessageSend(composer("hello"), TOKEN)!;
  const edited = editCateringComposer(started.next, "New draft");
  const done = completeCateringMessageSend(edited, TOKEN);
  assert.equal(done.text, "New draft");
  // The attempt is finished either way, so the composer is free to send the newer draft next.
  assert.equal(done.pending, null);
});
test("editing the composer after a failure never mutates the failed attempt's text", () => {
  const failed = failCateringMessageSend(startCateringMessageSend(composer("Original message"), TOKEN)!.next, TOKEN, "Network error");
  const edited = editCateringComposer(failed, "New draft");
  // Two separate values: the live draft moved on, the attempt kept exactly what it was started with.
  assert.equal(edited.text, "New draft");
  assert.equal(edited.pending?.text, "Original message");
  assert.equal(edited.pending?.status, "failed");
});
test("a successful retry sends the original text and does not destroy the newer composer edits", () => {
  const failed = failCateringMessageSend(startCateringMessageSend(composer("Original message"), TOKEN)!.next, TOKEN, "Network error");
  const edited = editCateringComposer(failed, "New draft");
  const retried = retryCateringMessageSend(edited)!;
  // The retry carries the original attempt, token and all -- not what is currently typed.
  assert.deepEqual(retried.payload, { text: "Original message", clientRequestId: TOKEN });
  assert.equal(retried.next.text, "New draft");
  // And when it succeeds, "New draft" survives and can be sent separately afterwards.
  const done = completeCateringMessageSend(retried.next, TOKEN);
  assert.equal(done.text, "New draft");
  assert.equal(done.pending, null);
  assert.equal(maySendCateringMessage(done, true), true);
});
test("a send that succeeds after the participant cleared the box does not resurrect the submitted text", () => {
  const started = startCateringMessageSend(composer("hello"), TOKEN)!;
  const cleared = editCateringComposer(started.next, "");
  assert.equal(completeCateringMessageSend(cleared, TOKEN).text, "");
});
test("a retry reuses the failed send's own token, which is what makes it idempotent on the server", () => {
  const started = startCateringMessageSend(composer("hi"), TOKEN)!;
  const failed = failCateringMessageSend(started.next, TOKEN, "Network error");
  assert.deepEqual(failed.pending, { clientRequestId: TOKEN, text: "hi", status: "failed", error: "Network error" });
  const retried = retryCateringMessageSend(failed)!;
  assert.equal(retried.payload.clientRequestId, TOKEN);
  assert.equal(retried.payload.text, "hi");
  assert.equal(retried.next.pending?.status, "sending");
  assert.equal(retried.next.pending?.error, null);
});
test("a stale failure never marks a newer send as failed, and a send in flight cannot be retried", () => {
  const started = startCateringMessageSend(composer("hi"), TOKEN)!;
  assert.equal(failCateringMessageSend(started.next, OTHER_TOKEN, "Network error"), started.next);
  assert.equal(retryCateringMessageSend(started.next), null);
  assert.equal(retryCateringMessageSend(EMPTY_CATERING_COMPOSER), null);
});
test("abandoning a failed send returns its text rather than throwing it away", () => {
  const failed = failCateringMessageSend(startCateringMessageSend(composer("hi"), TOKEN)!.next, TOKEN, "Network error");
  const discarded = discardCateringMessageSend({ ...failed, text: "" });
  assert.equal(discarded.text, "hi");
  assert.equal(discarded.pending, null);
  // A composer the participant has since typed into keeps what they typed instead.
  assert.equal(discardCateringMessageSend({ ...failed, text: "something else" }).text, "something else");
});
test("pages flatten into one chronological thread with no message shown twice", () => {
  const newest = { messages: [message("c"), message("d")], nextCursor: "c", editable: true };
  const older = { messages: [message("a"), message("b")], nextCursor: null, editable: true };
  assert.deepEqual(combineCateringMessagePages([newest, older]).map((m) => m.id), ["a", "b", "c", "d"]);
  // An overlapping refetch, or a send landing while an older page loads, still shows each message once.
  const overlapping = { messages: [message("b"), message("c")], nextCursor: null, editable: true };
  assert.deepEqual(combineCateringMessagePages([newest, overlapping]).map((m) => m.id), ["b", "c", "d"]);
  assert.deepEqual(combineCateringMessagePages([]), []);
});
test("the older-page boundary stops at the beginning of the conversation", () => {
  assert.equal(nextCateringMessageCursor({ nextCursor: "abc" }), "abc");
  assert.equal(nextCateringMessageCursor({ nextCursor: null }), undefined);
  assert.equal(nextCateringMessageCursor(undefined), undefined);
});
test("the read marker moves to the newest message shown, and only when there is something to mark", () => {
  assert.equal(latestCateringMessageId([message("a"), message("b")]), "b");
  assert.equal(latestCateringMessageId([]), null);
  assert.equal(shouldMarkCateringConversationRead("b", null, 2), true);
  // Nothing unread, nothing new, or an empty conversation all skip the request: looking does not write.
  assert.equal(shouldMarkCateringConversationRead("b", "b", 2), false);
  assert.equal(shouldMarkCateringConversationRead("b", null, 0), false);
  assert.equal(shouldMarkCateringConversationRead(null, null, 3), false);
});
test("a booking that closed mid-composition is classified so the section can refetch", () => {
  assert.equal(isCateringCommunicationReadOnly({ code: CATERING_WORKSPACE_READ_ONLY_CODE }), true);
  assert.equal(isCateringCommunicationReadOnly({ code: "something_else" }), false);
  assert.equal(isCateringCommunicationReadOnly(new Error("boom")), false);
  assert.equal(isCateringCommunicationReadOnly(null), false);
  assert.equal(CATERING_COMMUNICATION_READ_ONLY_BANNER.includes("readable"), true);
});
test("a message timestamp renders in the reader's locale and never throws on bad input", () => {
  assert.equal(formatCateringMessageTimestamp("not-a-date"), "");
  assert.equal(formatCateringMessageTimestamp("2026-09-01T12:00:00.000Z").length > 0, true);
});

/**
 * Automatic read marking must be bounded. A failed mark leaves unreadCount above zero and the marker unmoved, so an
 * effect keyed only on those would reissue the same request the instant the mutation returned to idle, forever.
 */
const readMark = (over: Partial<typeof EMPTY_CATERING_READ_MARK> = {}) => ({ ...EMPTY_CATERING_READ_MARK, identity: "actor:booking", ...over });
/** One pass of the component's effect: attempt if allowed, then apply the outcome. Returns the requests it issued. */
function runAutoMarkPasses(initial: ReturnType<typeof readMark>, latestId: string | null, unreadCount: number, passes: number, outcome: "success" | "failure") {
  let state = initial;
  const requests: string[] = [];
  for (let pass = 0; pass < passes; pass += 1) {
    if (!shouldAutoMarkCateringConversationRead(state, latestId, unreadCount)) continue;
    requests.push(latestId!);
    state = startCateringReadMark(state, latestId!);
    state = outcome === "success" ? completeCateringReadMark(state, latestId) : failCateringReadMark(state, latestId!);
  }
  return { state, requests };
}

test("an unread conversation triggers exactly one automatic mark-read", () => {
  const run = runAutoMarkPasses(readMark(), "m10", 3, 5, "success");
  assert.deepEqual(run.requests, ["m10"]);
  assert.equal(run.state.markedId, "m10");
  assert.equal(run.state.failed, false);
});
test("a successful mark records the marker the server reports, not the one requested", () => {
  // The server marker is monotonic, so a request that lost to a newer boundary is answered with that newer one.
  const marked = completeCateringReadMark(startCateringReadMark(readMark(), "m15"), "m20");
  assert.equal(marked.markedId, "m20");
  // Nothing left to attempt for m20, so no further request is issued.
  assert.equal(shouldAutoMarkCateringConversationRead(marked, "m20", 2), false);
});
test("a failed mark does not automatically fire again when the mutation returns to idle", () => {
  const failed = failCateringReadMark(startCateringReadMark(readMark(), "m10"), "m10");
  assert.equal(failed.failed, true);
  // The boundary is still unread and still unmarked, and yet no further automatic attempt is permitted.
  assert.equal(shouldMarkCateringConversationRead("m10", failed.markedId, 3), true);
  assert.equal(shouldAutoMarkCateringConversationRead(failed, "m10", 3), false);
});
test("a persistently failing mark issues exactly one request across many rerenders", () => {
  const run = runAutoMarkPasses(readMark(), "m10", 3, 50, "failure");
  assert.deepEqual(run.requests, ["m10"]);
});
test("a newer message is a new candidate and earns its own single automatic attempt", () => {
  // A failure for m10 must not block legitimate later progress.
  const failed = failCateringReadMark(startCateringReadMark(readMark(), "m10"), "m10");
  assert.equal(shouldAutoMarkCateringConversationRead(failed, "m11", 3), true);
  const run = runAutoMarkPasses(failed, "m11", 3, 20, "failure");
  assert.deepEqual(run.requests, ["m11"]);
});
test("a stale failure for a boundary that has moved on is ignored", () => {
  const attempted = startCateringReadMark(readMark(), "m11");
  assert.equal(failCateringReadMark(attempted, "m10"), attempted);
});
test("an explicit retry makes exactly one new request and cannot be double-clicked into two", () => {
  const failed = failCateringReadMark(startCateringReadMark(readMark(), "m10"), "m10");
  const retried = retryCateringReadMark(failed);
  assert.equal(retried.failed, false);
  const run = runAutoMarkPasses(retried, "m10", 3, 20, "failure");
  assert.deepEqual(run.requests, ["m10"]);
  // Retrying a state that has not failed changes nothing, so a second click issues nothing.
  assert.equal(retryCateringReadMark(retried), retried);
});
test("the retry affordance appears only after a failure that still has something to mark", () => {
  const failed = failCateringReadMark(startCateringReadMark(readMark(), "m10"), "m10");
  assert.equal(mayRetryCateringReadMark(failed, "m10", 3), true);
  // Nothing unread, nothing attempted, or already marked: no affordance.
  assert.equal(mayRetryCateringReadMark(failed, "m10", 0), false);
  assert.equal(mayRetryCateringReadMark(readMark(), "m10", 3), false);
  assert.equal(mayRetryCateringReadMark(completeCateringReadMark(failed, "m10"), "m10", 3), false);
});
test("reopening the conversation or switching booking is a deliberate, bounded fresh start", () => {
  const failed = failCateringReadMark(startCateringReadMark(readMark(), "m10"), "m10");
  // Same conversation: the recorded attempt survives a rerender, so no loop on remount of the same identity.
  assert.equal(hydrateCateringReadMark(failed, "actor:booking"), failed);
  // A different actor or booking resets, and then allows exactly one attempt for that conversation.
  const switched = hydrateCateringReadMark(failed, "actor:other-booking");
  assert.deepEqual(switched, { identity: "actor:other-booking", markedId: null, attemptedId: null, failed: false });
  assert.deepEqual(runAutoMarkPasses(switched, "m10", 3, 20, "failure").requests, ["m10"]);
});
test("nothing is attempted when there is nothing unread or no message at all", () => {
  assert.deepEqual(runAutoMarkPasses(readMark(), "m10", 0, 10, "success").requests, []);
  assert.deepEqual(runAutoMarkPasses(readMark(), null, 3, 10, "success").requests, []);
});

/**
 * Fetching a message is not reading it. The read boundary must be the newest message actually DISPLAYED, or a
 * conversation whose first page overflows the viewport would be marked read the instant it mounted.
 */
const viewedState = (over: Partial<typeof EMPTY_CATERING_VIEWED> = {}) => ({ ...EMPTY_CATERING_VIEWED, identity: "actor:booking", ...over });

test("nothing is viewed until the end of the thread is actually on screen", () => {
  const fresh = viewedState();
  // Messages are loaded, but none has been displayed, so there is no boundary a read mark may use.
  assert.equal(cateringReadableBoundary(fresh, "actor:booking"), null);
  assert.equal(shouldAutoMarkCateringConversationRead(readMark(), cateringReadableBoundary(fresh, "actor:booking"), 5), false);
});
test("opening a conversation scrolled above the newest message leaves the unread count intact", () => {
  // The sentinel never intersected, so nothing was recorded and no request may be issued for m20.
  const fresh = viewedState();
  const run = runAutoMarkPasses(readMark(), cateringReadableBoundary(fresh, "actor:booking"), 5, 10, "success");
  assert.deepEqual(run.requests, []);
  assert.equal(run.state.markedId, null);
});
test("reaching the end of the thread records the newest displayed message and allows one mark", () => {
  const seen = recordCateringViewedBoundary(viewedState(), "m20");
  assert.equal(cateringReadableBoundary(seen, "actor:booking"), "m20");
  assert.deepEqual(runAutoMarkPasses(readMark(), "m20", 5, 10, "success").requests, ["m20"]);
});
test("the boundary never advances past what was displayed, and repeats are idempotent", () => {
  const seen = recordCateringViewedBoundary(viewedState(), "m20");
  // Observing the same boundary again changes nothing, so no second request is provoked.
  assert.equal(recordCateringViewedBoundary(seen, "m20"), seen);
  // A message that arrived but was never displayed cannot be recorded by anything other than the observer.
  assert.equal(cateringReadableBoundary(seen, "actor:booking"), "m20");
  // When the reader is at the bottom and newer messages append, the boundary follows them.
  assert.equal(recordCateringViewedBoundary(seen, "m21").viewedId, "m21");
});
test("an empty conversation records no viewed boundary", () => {
  const empty = viewedState();
  // Returned by reference, so nothing loaded provokes no state change and therefore no rerender loop.
  assert.equal(recordCateringViewedBoundary(empty, null), empty);
  assert.equal(cateringReadableBoundary(empty, "actor:booking"), null);
});
test("a viewed boundary from another actor or booking is never reused", () => {
  const seen = recordCateringViewedBoundary(viewedState(), "m20");
  assert.equal(cateringReadableBoundary(seen, "other:booking"), null);
  assert.deepEqual(hydrateCateringViewed(seen, "other:booking"), { identity: "other:booking", viewedId: null });
  // Same conversation: what was displayed stays displayed across rerenders.
  assert.equal(hydrateCateringViewed(seen, "actor:booking"), seen);
});


/**
 * "The end of the thread is on screen" is a conjunction of two independent observations, collected for one exact
 * message boundary.
 *
 * The two-observation part is because the message list is its own scroll container: intersection within it is
 * satisfied by any thread short enough not to scroll, including one sitting entirely below the fold, which
 * Communication routinely is several workspace sections down. The exact-boundary part is because
 * IntersectionObserver reports asynchronously: evidence gathered while message A was newest must never authorize
 * marking a message B that arrived afterwards and may have pushed the sentinel out of sight.
 */
const A = "message-a";
const B = "message-b";
/**
 * Visibility, traversal and the read boundary.
 *
 * Seeing where the unread range begins and seeing where it ends does not mean the middle was read. A reader can
 * scroll until the first unread message appears, then drag the scrollbar thumb straight to the bottom: both
 * endpoints are genuinely observed, every message between them never entered the viewport, and marking the newest
 * one read sweeps all of them. Coverage is therefore tracked message by message and collapsed into a contiguous
 * frontier from the authoritative unread start.
 */
const mine = (id: string) => ({ id, mine: true });
const theirs = (id: string) => ({ id, mine: false });
const NONE = cateringUnreadStart([], 0);
const gen = (latestId: string | null, pageKey: string, start = NONE) => cateringViewGeneration(latestId, pageKey, start);
/** The bottom sentinel seen in both roots -- live evidence that the end of the thread is on screen now. */
const seeBottom = (state = EMPTY_CATERING_THREAD_VISIBILITY, g = gen(A, "1:3:end")) =>
  recordCateringViewportVisibility(recordCateringSentinelVisibility(state, g, true), g, true);
/** Messages actually observed in the viewport, in whatever order the callbacks happen to arrive. */
const see = (state: typeof EMPTY_CATERING_THREAD_VISIBILITY, g: ReturnType<typeof gen>, ...ids: string[]) =>
  recordCateringMessageCoverage(state, g, ids);
const ids = (loaded: readonly { id: string }[]) => loaded.map((message) => message.id);
/** A genuine uninterrupted traversal from `fromId` to the end of the loaded list. */
const traverse = (state: typeof EMPTY_CATERING_THREAD_VISIBILITY, g: ReturnType<typeof gen>, loaded: readonly { id: string }[], fromId: string) =>
  see(state, g, ...ids(loaded).slice(ids(loaded).indexOf(fromId)));

test("nothing is on screen until both bottom halves have been positively observed", () => {
  const g = gen(A, "1:3:end");
  assert.equal(cateringThreadEndIsOnScreen(EMPTY_CATERING_THREAD_VISIBILITY, g), false);
  assert.equal(cateringThreadEndIsOnScreen(recordCateringSentinelVisibility(EMPTY_CATERING_THREAD_VISIBILITY, g, true), g), false);
  assert.equal(cateringThreadEndIsOnScreen(recordCateringViewportVisibility(EMPTY_CATERING_THREAD_VISIBILITY, g, true), g), false);
  assert.equal(cateringThreadEndIsOnScreen(seeBottom(), g), true);
});

test("either bottom half going away withdraws the observation, and the halves do not interfere", () => {
  const g = gen(A, "1:3:end");
  const both = seeBottom();
  assert.equal(cateringThreadEndIsOnScreen(recordCateringViewportVisibility(both, g, false), g), false);
  assert.equal(cateringThreadEndIsOnScreen(recordCateringSentinelVisibility(both, g, false), g), false);
  assert.equal(recordCateringSentinelVisibility(both, g, false).sentinelInViewport, true);
  assert.equal(recordCateringSentinelVisibility(both, g, true), both);
  assert.equal(recordCateringViewportVisibility(both, g, true), both);
});

test("evidence collected for one newest message can never authorize another", () => {
  const held = seeBottom();
  assert.equal(cateringThreadEndIsOnScreen(held, gen(A, "1:3:end")), true);
  assert.equal(cateringThreadEndIsOnScreen(held, gen(B, "1:3:end")), false);
  const oneFresh = recordCateringSentinelVisibility(held, gen(B, "1:3:end"), true);
  assert.equal(oneFresh.sentinelInViewport, false);
  assert.equal(cateringThreadEndIsOnScreen(seeBottom(oneFresh, gen(B, "1:3:end")), gen(B, "1:3:end")), true);
});

test("the page key changes on a prepend, on a new message, and on the pagination flip", () => {
  const base = [{ messages: [{}, {}] }];
  assert.notEqual(cateringMessagePageKey(base, true), cateringMessagePageKey(base, false));
  assert.notEqual(cateringMessagePageKey(base, false), cateringMessagePageKey([...base, { messages: [{}] }], false));
  assert.notEqual(cateringMessagePageKey(base, false), cateringMessagePageKey([{ messages: [{}, {}, {}] }], false));
  assert.equal(cateringMessagePageKey(base, false), cateringMessagePageKey([{ messages: [{}, {}] }], false));
  assert.equal(cateringMessagePageKey(undefined, true), "0:0:more");
  assert.equal(cateringMessagePageKey([], false), "0:0:end");
});

test("the required boundary is the endpoint's own, resolved only once that message is loaded", () => {
  const loaded = [theirs("m1"), mine("m2"), theirs("m3"), theirs("m4")];
  assert.deepEqual(cateringUnreadStart(loaded, 99, true, "m3"), { kind: "message", id: "m3" });
  assert.deepEqual(cateringUnreadStart(loaded, 99, true, "m0"), { kind: "unresolved" });
  assert.deepEqual(cateringUnreadStart(loaded, 99, true, null), { kind: "none" });
  // Fallback for a page cached before the field existed: the previous derivation, unchanged.
  assert.deepEqual(cateringUnreadStart(loaded, 2), { kind: "message", id: "m3" });
  assert.deepEqual(cateringUnreadStart(loaded, 0), { kind: "none" });
  assert.deepEqual(cateringUnreadStart(loaded, 9), { kind: "unresolved" });
  assert.deepEqual(cateringUnreadStart(loaded, 99, true), { kind: "unresolved" });
});

/** The frontier: an unbroken run from the unread start, computed from message order, never from callback order. */
test("1 & 2. the endpoint jump -- start seen, bottom seen, middle skipped -- marks nothing", () => {
  const loaded = [theirs("m1"), theirs("m2"), theirs("m3"), theirs("m4"), theirs("m5")];
  const start = cateringUnreadStart(loaded, 99, true, "m1");
  const g = gen("m5", "1:5:end", start);
  // The reader sees the first unread message, then drags the scrollbar straight to the bottom.
  const jumped = seeBottom(see(EMPTY_CATERING_THREAD_VISIBILITY, g, "m1", "m5"), g);
  assert.equal(cateringThreadEndIsOnScreen(jumped, g), true, "the bottom really is on screen");
  assert.equal(cateringCoverageFrontier(loaded, "m1", jumped.covered), "m1", "the run stops at the first gap");
  assert.equal(mayRecordCateringViewedBoundary(jumped, g, false, start, loaded), false);
});

test("3. a continuous traversal reaches the newest message and is allowed exactly then", () => {
  const loaded = [theirs("m1"), theirs("m2"), theirs("m3"), theirs("m4")];
  const start = cateringUnreadStart(loaded, 99, true, "m1");
  const g = gen("m4", "1:4:end", start);
  let state = EMPTY_CATERING_THREAD_VISIBILITY;
  for (const id of ["m1", "m2", "m3"]) {
    state = see(state, g, id);
    assert.equal(mayRecordCateringViewedBoundary(seeBottom(state, g), g, false, start, loaded), false, id);
  }
  state = seeBottom(see(state, g, "m4"), g);
  assert.equal(cateringCoverageFrontier(loaded, "m1", state.covered), "m4");
  assert.equal(mayRecordCateringViewedBoundary(state, g, false, start, loaded), true);
});

test("4. out-of-order callbacks are ordered by the MESSAGE list, not by arrival", () => {
  const loaded = [theirs("m1"), theirs("m2"), theirs("m3")];
  const start = cateringUnreadStart(loaded, 99, true, "m1");
  const g = gen("m3", "1:3:end", start);
  // m3 arrives before m2. The frontier cannot pass the gap at m2 however late or early anything landed.
  let state = see(EMPTY_CATERING_THREAD_VISIBILITY, g, "m1");
  state = see(state, g, "m3");
  assert.equal(cateringCoverageFrontier(loaded, "m1", state.covered), "m1");
  // The missing observation lands; the run joins up and advances deterministically.
  state = see(state, g, "m2");
  assert.equal(cateringCoverageFrontier(loaded, "m1", state.covered), "m3");
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(state, g), g, false, start, loaded), true);
});

test("5, 6 & 7. one or many unseen middle messages block, and filling the gap later releases", () => {
  const loaded = [theirs("m1"), theirs("m2"), theirs("m3"), theirs("m4"), theirs("m5")];
  const start = cateringUnreadStart(loaded, 99, true, "m1");
  const g = gen("m5", "1:5:end", start);
  // Everything except m3.
  let state = see(EMPTY_CATERING_THREAD_VISIBILITY, g, "m1", "m2", "m4", "m5");
  assert.equal(cateringCoverageFrontier(loaded, "m1", state.covered), "m2");
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(state, g), g, false, start, loaded), false);
  // Two gaps behave the same way.
  let sparse = see(EMPTY_CATERING_THREAD_VISIBILITY, g, "m1", "m4", "m5");
  assert.equal(cateringCoverageFrontier(loaded, "m1", sparse.covered), "m1");
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(sparse, g), g, false, start, loaded), false);
  // Scrolling back to fill the gap joins the runs.
  state = see(state, g, "m3");
  assert.equal(cateringCoverageFrontier(loaded, "m1", state.covered), "m5");
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(state, g), g, false, start, loaded), true);
});

test("8, 9 & 10. a prepend makes messages available, never viewed, and coverage crosses pages only by viewing", () => {
  // The newest page is fully traversed; then older history is prepended and the range widens.
  const newest = [theirs("m4"), theirs("m5")];
  const firstStart = cateringUnreadStart(newest, 99, true, "m4");
  const g1 = gen("m5", "1:2:more", firstStart);
  const traversedNewest = seeBottom(traverse(EMPTY_CATERING_THREAD_VISIBILITY, g1, newest, "m4"), g1);
  // Still blocked: an older page can be fetched.
  assert.equal(mayRecordCateringViewedBoundary(traversedNewest, g1, true, firstStart, newest), false);
  // The older page lands. Scroll restoration keeps the reader at the bottom, so the bottom is immediately visible.
  const full = [theirs("m1"), theirs("m2"), theirs("m3"), ...newest];
  const start = cateringUnreadStart(full, 99, true, "m1");
  const g2 = gen("m5", "2:5:end", start);
  const afterPrepend = seeBottom(traversedNewest, g2);
  assert.equal(cateringThreadEndIsOnScreen(afterPrepend, g2), true);
  // Loading is not viewing: the required range changed, so the earlier coverage does not answer this question.
  assert.equal(mayRecordCateringViewedBoundary(afterPrepend, g2, false, start, full), false);
  // Reading the newly loaded history, then returning to the bottom, is what allows it.
  const traversedAll = seeBottom(traverse(afterPrepend, g2, full, "m1"), g2);
  assert.equal(mayRecordCateringViewedBoundary(traversedAll, g2, false, start, full), true);
});

test("11. a capped backlog is resolvable and, once genuinely traversed, readable", () => {
  const loaded = [theirs("m001"), theirs("m002"), theirs("m003")];
  const start = cateringUnreadStart(loaded, 99, true, "m001");
  assert.deepEqual(start, { kind: "message", id: "m001" });
  const g = gen("m003", "3:3:end", start);
  // Endpoints only: still nothing.
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(see(EMPTY_CATERING_THREAD_VISIBILITY, g, "m001", "m003"), g), g, false, start, loaded), false);
  // Full traversal: allowed.
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(traverse(EMPTY_CATERING_THREAD_VISIBILITY, g, loaded, "m001"), g), g, false, start, loaded), true);
});

test("12. a new incoming message keeps existing coverage but extends what must be covered", () => {
  const loaded = [theirs("m1"), theirs("m2")];
  const start = cateringUnreadStart(loaded, 99, true, "m1");
  const before = gen("m2", "1:2:end", start);
  const covered = seeBottom(traverse(EMPTY_CATERING_THREAD_VISIBILITY, before, loaded, "m1"), before);
  assert.equal(mayRecordCateringViewedBoundary(covered, before, false, start, loaded), true);
  // m3 arrives. The server marker has not moved, so the required range is unchanged and the coverage stands -- but
  // the frontier no longer reaches the newest message.
  const grown = [...loaded, theirs("m3")];
  const after = gen("m3", "1:3:end", start);
  const restated = seeBottom(covered, after);
  assert.equal(cateringCoverageFrontier(grown, "m1", restated.covered), "m2", "old coverage survives");
  assert.equal(mayRecordCateringViewedBoundary(restated, after, false, start, grown), false);
  assert.equal(mayRecordCateringViewedBoundary(see(restated, after, "m3"), after, false, start, grown), true);
});

test("13. the reader's own messages are part of the chronology and cannot be skipped past", () => {
  const loaded = [theirs("m1"), mine("m2"), theirs("m3")];
  const start = cateringUnreadStart(loaded, 99, true, "m1");
  const g = gen("m3", "1:3:end", start);
  // Skipping over the own message leaves a gap exactly as skipping an incoming one would.
  const skipped = seeBottom(see(EMPTY_CATERING_THREAD_VISIBILITY, g, "m1", "m3"), g);
  assert.equal(cateringCoverageFrontier(loaded, "m1", skipped.covered), "m1");
  assert.equal(mayRecordCateringViewedBoundary(skipped, g, false, start, loaded), false);
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(traverse(EMPTY_CATERING_THREAD_VISIBILITY, g, loaded, "m1"), g), g, false, start, loaded), true);
});

test("14 & 15. a tall message needs only to intersect, and a poll with the same ids neither resets nor invents", () => {
  const loaded = [theirs("m1"), theirs("m2")];
  const start = cateringUnreadStart(loaded, 99, true, "m1");
  const g = gen("m2", "1:2:end", start);
  // One intersecting observation per message is enough -- nothing requires an element to be wholly visible, which a
  // message taller than the viewport never can be.
  const covered = seeBottom(see(EMPTY_CATERING_THREAD_VISIBILITY, g, "m1", "m2"), g);
  assert.equal(mayRecordCateringViewedBoundary(covered, g, false, start, loaded), true);
  // A poll returns the same ids in new objects: coverage is keyed by id, so it neither resets nor grows.
  const repolled = see(covered, g, "m1", "m2");
  assert.equal(repolled, covered, "an observation that adds nothing returns the same object");
  assert.equal(cateringCoverageFrontier([theirs("m1"), theirs("m2")], "m1", repolled.covered), "m2");
});

test("an unfetched older page blocks everything, and no observations at all mark nothing", () => {
  const loaded = [theirs("m1"), theirs("m2")];
  const start = cateringUnreadStart(loaded, 99, true, "m1");
  const g = gen("m2", "1:2:more", start);
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(traverse(EMPTY_CATERING_THREAD_VISIBILITY, g, loaded, "m1"), g), g, true, start, loaded), false);
  // No IntersectionObserver at all: nothing is covered and nothing is on screen.
  const none = gen(A, "1:2:end", NONE);
  assert.equal(mayRecordCateringViewedBoundary(EMPTY_CATERING_THREAD_VISIBILITY, none, false, NONE, loaded), false);
  // Nothing unread still needs the bottom, and an unloaded conversation is never viewable.
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(EMPTY_CATERING_THREAD_VISIBILITY, none), none, false, NONE, loaded), true);
  const empty = gen(null, "0:0:end", NONE);
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(EMPTY_CATERING_THREAD_VISIBILITY, empty), empty, false, NONE, []), false);
});

test("an unresolved range is never traversable, and a frontier needs its start seen", () => {
  const loaded = [theirs("m1"), theirs("m2")];
  const unresolved = cateringUnreadStart(loaded, 99, true, "m0");
  const g = gen("m2", "1:2:end", unresolved);
  assert.equal(cateringUnreadRangeWasTraversed(see(seeBottom(EMPTY_CATERING_THREAD_VISIBILITY, g), g, "m1", "m2"), g, unresolved, loaded), false);
  // A frontier from a start that was never observed, or that is not loaded, is null rather than optimistic.
  assert.equal(cateringCoverageFrontier(loaded, "m1", new Set(["m2"])), null);
  assert.equal(cateringCoverageFrontier(loaded, "m9", new Set(["m9"])), null);
  assert.equal(cateringCoverageFrontier(loaded, null, new Set(["m1"])), null);
});

test("16, 17 & 18. bounded attempts, manual retry, and no send-side read", () => {
  const identity = "actor:booking";
  let mark = hydrateCateringReadMark(EMPTY_CATERING_READ_MARK, identity);
  assert.equal(shouldAutoMarkCateringConversationRead(mark, A, 3), true);
  mark = startCateringReadMark(mark, A);
  assert.equal(shouldAutoMarkCateringConversationRead(mark, A, 3), false, "one attempt per candidate");
  mark = failCateringReadMark(mark, A);
  assert.equal(shouldAutoMarkCateringConversationRead(mark, A, 3), false, "a failure must not re-fire the effect");
  // The manual control clears the recorded attempt, which buys exactly one more for the SAME boundary -- the reader
  // never has to re-read the thread because an HTTP request failed.
  assert.equal(mayRetryCateringReadMark(mark, A, 3), true);
  mark = retryCateringReadMark(mark);
  assert.equal(shouldAutoMarkCateringConversationRead(mark, A, 3), true);
  // Nothing here is reachable from sending: only a recorded viewed boundary feeds the mark path.
  let viewed = hydrateCateringViewed(EMPTY_CATERING_VIEWED, identity);
  assert.equal(cateringReadableBoundary(viewed, identity), null);
  viewed = recordCateringViewedBoundary(viewed, A);
  assert.equal(recordCateringViewedBoundary(viewed, A), viewed, "recording the same boundary twice is a no-op");
});

test("a mark-read failure preserves coverage, so the retry does not require re-reading", () => {
  const loaded = [theirs("m1"), theirs("m2")];
  const start = cateringUnreadStart(loaded, 99, true, "m1");
  const g = gen("m2", "1:2:end", start);
  const covered = seeBottom(traverse(EMPTY_CATERING_THREAD_VISIBILITY, g, loaded, "m1"), g);
  assert.equal(mayRecordCateringViewedBoundary(covered, g, false, start, loaded), true);
  // The request fails. Coverage is component state and nothing in the mark path touches it, so the same boundary is
  // still eligible for the one retry the control allows.
  assert.equal(mayRecordCateringViewedBoundary(covered, g, false, start, loaded), true);
});
