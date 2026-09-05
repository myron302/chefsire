import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_MESSAGE_MAX_LENGTH } from "@shared/catering-booking-communication";
import { CATERING_WORKSPACE_READ_ONLY_CODE } from "@shared/catering-booking-operations";
import { CATERING_COMMUNICATION_READ_ONLY_BANNER, EMPTY_CATERING_COMPOSER, EMPTY_CATERING_READ_MARK, EMPTY_CATERING_VIEWED, cateringReadableBoundary, completeCateringReadMark, hydrateCateringViewed, recordCateringViewedBoundary, failCateringReadMark, hydrateCateringReadMark, mayRetryCateringReadMark, retryCateringReadMark, shouldAutoMarkCateringConversationRead, startCateringReadMark, cateringMessageIsSendable, combineCateringMessagePages, completeCateringMessageSend, discardCateringMessageSend, editCateringComposer, failCateringMessageSend, formatCateringMessageTimestamp, hydrateCateringComposer, isCateringCommunicationReadOnly, latestCateringMessageId, maySendCateringMessage, nextCateringMessageCursor, retryCateringMessageSend, shouldMarkCateringConversationRead, startCateringMessageSend , EMPTY_CATERING_THREAD_VISIBILITY, cateringMessagePageKey, cateringThreadEndIsOnScreen, cateringUnreadRangeWasTraversed, cateringUnreadStart, cateringUnreadStartId, cateringViewGeneration, mayRecordCateringViewedBoundary, recordCateringSentinelVisibility, recordCateringUnreadStartInThread, recordCateringUnreadStartInViewport, recordCateringViewportVisibility } from "./catering-booking-communication-state";

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
 * Seeing the bottom of the thread proves nothing about what is above it. After the final older page is prepended,
 * scroll restoration deliberately keeps the reader near the newest messages, so the bottom sentinel is immediately
 * visible again and the re-created observers report a perfectly fresh positive for the new page set -- while the
 * backlog that was just loaded has not been looked at. The read marker is chronological, so advancing it there
 * sweeps every one of those messages read.
 */
const mine = (id: string) => ({ id, mine: true });
const theirs = (id: string) => ({ id, mine: false });
const NONE = cateringUnreadStart([], 0);
/** A generation, and the four observations that can be made within one. */
const gen = (latestId: string | null, pageKey: string, start = NONE) => cateringViewGeneration(latestId, pageKey, start);
const seeBottom = (state = EMPTY_CATERING_THREAD_VISIBILITY, g = gen(A, "1:3:end")) =>
  recordCateringViewportVisibility(recordCateringSentinelVisibility(state, g, true), g, true);
const seeUnreadStart = (state: typeof EMPTY_CATERING_THREAD_VISIBILITY, g: ReturnType<typeof gen>) =>
  recordCateringUnreadStartInViewport(recordCateringUnreadStartInThread(state, g, true), g, true);

test("nothing is on screen until both bottom halves have been positively observed", () => {
  const g = gen(A, "1:3:end");
  assert.equal(cateringThreadEndIsOnScreen(EMPTY_CATERING_THREAD_VISIBILITY, g), false);
  // The sentinel intersecting its own container while the card is below the fold is the case the second root exists
  // for; the mirror case is the card on screen with the reader scrolled up inside a long thread.
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
  // An unchanged observation returns the same object, so a repeating callback cannot churn React state.
  assert.equal(recordCateringSentinelVisibility(both, g, true), both);
  assert.equal(recordCateringViewportVisibility(both, g, true), both);
});

test("evidence collected for one newest message can never authorize another", () => {
  const held = seeBottom();
  assert.equal(cateringThreadEndIsOnScreen(held, gen(A, "1:3:end")), true);
  assert.equal(cateringThreadEndIsOnScreen(held, gen(B, "1:3:end")), false);
  // One fresh half for B discards the stale other half rather than merging with it.
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

/**
 * The unread range is derived from the server's own count plus the `mine` flags, in the same deterministic order
 * the marker uses -- no new API field.
 */
test("6. the required boundary is the first UNREAD message, not the top of the page", () => {
  // Five loaded, the oldest two already read; the unread range begins partway down.
  const loaded = [theirs("m1"), mine("m2"), theirs("m3"), theirs("m4"), mine("m5"), theirs("m6")];
  // Two incoming messages unread: m4 and m6.
  assert.deepEqual(cateringUnreadStart(loaded, 2), { kind: "message", id: "m4" });
  assert.equal(cateringUnreadStartId(cateringUnreadStart(loaded, 2)), "m4");
  // Nothing unread needs no traversal at all.
  assert.deepEqual(cateringUnreadStart(loaded, 0), { kind: "none" });
  // Four incoming messages are loaded, so a count of four is exactly identifiable -- the range starts at the first.
  assert.deepEqual(cateringUnreadStart(loaded, 4), { kind: "message", id: "m1" });
  // A range reaching PAST what is loaded, or a capped count whose true size is unknown, cannot be identified.
  assert.deepEqual(cateringUnreadStart(loaded, 5), { kind: "unresolved" });
  assert.deepEqual(cateringUnreadStart(loaded, 1, true), { kind: "unresolved" });
  assert.equal(cateringUnreadStartId(cateringUnreadStart(loaded, 5)), null);
});

test("1, 2 & 3. a prepend that reveals an older unread range is not traversed by the bottom sentinel", () => {
  // Before the prepend the range reached past what was loaded, so nothing was markable anyway.
  const before = cateringUnreadStart([theirs("m9"), theirs("m10")], 5);
  assert.deepEqual(before, { kind: "unresolved" });
  const shortGen = gen(A, "1:2:more", before);
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(EMPTY_CATERING_THREAD_VISIBILITY, shortGen), shortGen, true, before), false);
  // The final older page lands: pagination is exhausted, the range resolves, the page key changes -- and scroll
  // restoration leaves the reader at the bottom, so fresh observers immediately report the bottom visible.
  const loaded = [theirs("m6"), theirs("m7"), theirs("m8"), theirs("m9"), theirs("m10")];
  const after = cateringUnreadStart(loaded, 5);
  assert.deepEqual(after, { kind: "message", id: "m6" });
  const longGen = gen(A, "2:5:end", after);
  const bottomOnly = seeBottom(EMPTY_CATERING_THREAD_VISIBILITY, longGen);
  assert.equal(cateringThreadEndIsOnScreen(bottomOnly, longGen), true, "the bottom really is visible");
  // The decisive assertion: it still marks nothing, because the backlog was never looked at.
  assert.equal(mayRecordCateringViewedBoundary(bottomOnly, longGen, false, after), false);
  assert.equal(cateringUnreadRangeWasTraversed(bottomOnly, longGen, after), false);
});

test("4 & 13-14. traversing the range, then returning to the bottom, is what allows advancement", () => {
  const loaded = [theirs("m6"), theirs("m7"), theirs("m8")];
  const start = cateringUnreadStart(loaded, 3);
  const g = gen(A, "2:3:end", start);
  // The reader scrolls up until the first unread message is genuinely on screen in both roots.
  let state = seeUnreadStart(EMPTY_CATERING_THREAD_VISIBILITY, g);
  assert.equal(cateringUnreadRangeWasTraversed(state, g, start), true);
  // Scrolling back down takes it off screen again -- the traversal still happened, so it latches.
  state = recordCateringUnreadStartInThread(recordCateringUnreadStartInViewport(state, g, false), g, false);
  assert.equal(cateringUnreadRangeWasTraversed(state, g, start), true, "traversal is a thing that happened");
  // But the bottom must be on screen NOW as well.
  assert.equal(mayRecordCateringViewedBoundary(state, g, false, start), false);
  state = seeBottom(state, g);
  assert.equal(mayRecordCateringViewedBoundary(state, g, false, start), true);
});

test("one root alone never proves traversal, and loading pages never does", () => {
  const loaded = [theirs("m1"), theirs("m2")];
  const start = cateringUnreadStart(loaded, 2);
  const g = gen(A, "1:2:end", start);
  const inThreadOnly = recordCateringUnreadStartInThread(EMPTY_CATERING_THREAD_VISIBILITY, g, true);
  assert.equal(cateringUnreadRangeWasTraversed(inThreadOnly, g, start), false);
  const inViewportOnly = recordCateringUnreadStartInViewport(EMPTY_CATERING_THREAD_VISIBILITY, g, true);
  assert.equal(cateringUnreadRangeWasTraversed(inViewportOnly, g, start), false);
  // And an unresolved range can never be proved traversed however much is observed.
  const unresolved = cateringUnreadStart(loaded, 9);
  const ug = gen(A, "1:2:end", unresolved);
  assert.equal(cateringUnreadRangeWasTraversed(seeUnreadStart(seeBottom(EMPTY_CATERING_THREAD_VISIBILITY, ug), ug), ug, unresolved), false);
});

test("5. an unread range entirely inside the first page still marks read normally", () => {
  const loaded = [theirs("m1"), mine("m2"), theirs("m3")];
  const start = cateringUnreadStart(loaded, 1);
  assert.deepEqual(start, { kind: "message", id: "m3" });
  const g = gen("m3", "1:3:end", start);
  const state = seeBottom(seeUnreadStart(EMPTY_CATERING_THREAD_VISIBILITY, g), g);
  assert.equal(mayRecordCateringViewedBoundary(state, g, false, start), true);
  // With nothing unread at all the bottom alone still decides, exactly as before.
  const noneGen = gen("m3", "1:3:end", NONE);
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(EMPTY_CATERING_THREAD_VISIBILITY, noneGen), noneGen, false, NONE), true);
});

test("7 & 9. a new message arriving mid-traversal cannot be swept by the old bottom evidence", () => {
  const loaded = [theirs("m1"), theirs("m2")];
  const start = cateringUnreadStart(loaded, 2);
  const before = gen("m2", "1:2:end", start);
  const traversed = seeBottom(seeUnreadStart(EMPTY_CATERING_THREAD_VISIBILITY, before), before);
  assert.equal(mayRecordCateringViewedBoundary(traversed, before, false, start), true);
  // A newer message arrives. The required boundary is unchanged, so the traversal stands -- but the newest boundary
  // is different and its evidence must be collected again.
  const after = gen("m3", "1:3:end", start);
  assert.equal(cateringUnreadRangeWasTraversed(traversed, after, start), true, "the same message was still seen");
  assert.equal(mayRecordCateringViewedBoundary(traversed, after, false, start), false, "the new message needs its own evidence");
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(traversed, after), after, false, start), true);
});

test("8. a page set change revalidates the bottom, and a changed required range resets everything", () => {
  const loaded = [theirs("m1"), theirs("m2")];
  const start = cateringUnreadStart(loaded, 2);
  const before = gen("m2", "1:2:end", start);
  const traversed = seeBottom(seeUnreadStart(EMPTY_CATERING_THREAD_VISIBILITY, before), before);
  // Same newest message and same required range, different rendering: the bottom must be re-observed.
  const prepended = gen("m2", "2:5:end", start);
  assert.equal(mayRecordCateringViewedBoundary(traversed, prepended, false, start), false);
  assert.equal(cateringUnreadRangeWasTraversed(traversed, prepended, start), true);
  // A different required range discards the traversal too.
  const older = cateringUnreadStart([theirs("m0"), theirs("m1"), theirs("m2")], 3);
  const widened = gen("m2", "2:5:end", older);
  assert.equal(cateringUnreadRangeWasTraversed(traversed, widened, older), false, "a wider range was never traversed");
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(traversed, widened), widened, false, older), false);
});

test("an unfetched older page still blocks everything, however much has been observed", () => {
  const loaded = [theirs("m1"), theirs("m2")];
  const start = cateringUnreadStart(loaded, 2);
  const g = gen("m2", "1:2:more", start);
  const fully = seeBottom(seeUnreadStart(EMPTY_CATERING_THREAD_VISIBILITY, g), g);
  assert.equal(mayRecordCateringViewedBoundary(fully, g, true, start), false);
});

test("with no observations at all -- no IntersectionObserver -- nothing is ever viewable", () => {
  const g = gen(A, "1:2:end", NONE);
  assert.equal(mayRecordCateringViewedBoundary(EMPTY_CATERING_THREAD_VISIBILITY, g, false, NONE), false);
  // And an unloaded conversation is never viewable regardless of the cursor.
  const empty = gen(null, "0:0:end", NONE);
  assert.equal(mayRecordCateringViewedBoundary(seeBottom(EMPTY_CATERING_THREAD_VISIBILITY, empty), empty, false, NONE), false);
});

test("10, 11 & 12. read-attempt bounding, manual retry and send-side behaviour are unchanged", () => {
  const identity = "actor:booking";
  let mark = hydrateCateringReadMark(EMPTY_CATERING_READ_MARK, identity);
  assert.equal(shouldAutoMarkCateringConversationRead(mark, A, 3), true);
  mark = startCateringReadMark(mark, A);
  assert.equal(shouldAutoMarkCateringConversationRead(mark, A, 3), false, "one attempt per candidate");
  mark = failCateringReadMark(mark, A);
  assert.equal(shouldAutoMarkCateringConversationRead(mark, A, 3), false, "a failure must not re-fire the effect");
  // The manual control clears the recorded attempt, which buys exactly one more.
  assert.equal(mayRetryCateringReadMark(mark, A, 3), true);
  mark = retryCateringReadMark(mark);
  assert.equal(shouldAutoMarkCateringConversationRead(mark, A, 3), true);
  // Nothing here is reachable from sending: only a recorded viewed boundary feeds the mark path.
  let viewed = hydrateCateringViewed(EMPTY_CATERING_VIEWED, identity);
  assert.equal(cateringReadableBoundary(viewed, identity), null);
  viewed = recordCateringViewedBoundary(viewed, A);
  assert.equal(recordCateringViewedBoundary(viewed, A), viewed, "recording the same boundary twice is a no-op");
});
