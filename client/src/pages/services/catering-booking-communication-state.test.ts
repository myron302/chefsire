import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_MESSAGE_MAX_LENGTH } from "@shared/catering-booking-communication";
import { CATERING_WORKSPACE_READ_ONLY_CODE } from "@shared/catering-booking-operations";
import { CATERING_COMMUNICATION_READ_ONLY_BANNER, EMPTY_CATERING_COMPOSER, EMPTY_CATERING_READ_MARK, EMPTY_CATERING_VIEWED, cateringReadableBoundary, completeCateringReadMark, hydrateCateringViewed, recordCateringViewedBoundary, failCateringReadMark, hydrateCateringReadMark, mayRetryCateringReadMark, retryCateringReadMark, shouldAutoMarkCateringConversationRead, startCateringReadMark, cateringMessageIsSendable, combineCateringMessagePages, completeCateringMessageSend, discardCateringMessageSend, editCateringComposer, failCateringMessageSend, formatCateringMessageTimestamp, hydrateCateringComposer, isCateringCommunicationReadOnly, latestCateringMessageId, maySendCateringMessage, nextCateringMessageCursor, retryCateringMessageSend, shouldMarkCateringConversationRead, startCateringMessageSend , EMPTY_CATERING_THREAD_VISIBILITY, cateringMessagePageKey, cateringThreadEndIsOnScreen, mayRecordCateringViewedBoundary, recordCateringSentinelVisibility, recordCateringViewportVisibility } from "./catering-booking-communication-state";

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
/** One rendered page set, for the cases that vary only the boundary. */
const PAGES = "1:3:end";
const bothFor = (id: string, pageKey = PAGES) => recordCateringViewportVisibility(recordCateringSentinelVisibility(EMPTY_CATERING_THREAD_VISIBILITY, id, pageKey, true), id, pageKey, true);

test("nothing is on screen until both halves have been positively observed", () => {
  assert.equal(cateringThreadEndIsOnScreen(EMPTY_CATERING_THREAD_VISIBILITY, A, PAGES), false);
  // The regression the second observer fixed: the sentinel intersects its container while the container is below
  // the fold.
  const sentinelOnly = recordCateringSentinelVisibility(EMPTY_CATERING_THREAD_VISIBILITY, A, PAGES, true);
  assert.equal(cateringThreadEndIsOnScreen(sentinelOnly, A, PAGES), false, "intra-container intersection alone proves nothing");
  // And the mirror case: the card is on screen but the reader is scrolled up inside a long thread.
  const threadOnly = recordCateringViewportVisibility(EMPTY_CATERING_THREAD_VISIBILITY, A, PAGES, true);
  assert.equal(cateringThreadEndIsOnScreen(threadOnly, A, PAGES), false);
  // Only together.
  assert.equal(cateringThreadEndIsOnScreen(bothFor(A), A, PAGES), true);
});

test("either half going away withdraws the observation, and the halves do not interfere", () => {
  const both = bothFor(A);
  // Scrolling the page away from the card, or scrolling up within the thread, each stop it independently.
  assert.equal(cateringThreadEndIsOnScreen(recordCateringViewportVisibility(both, A, PAGES, false), A, PAGES), false);
  assert.equal(cateringThreadEndIsOnScreen(recordCateringSentinelVisibility(both, A, PAGES, false), A, PAGES), false);
  // Each recorder writes only its own half.
  assert.equal(recordCateringSentinelVisibility(both, A, PAGES, false).sentinelInViewport, true);
  assert.equal(recordCateringViewportVisibility(both, A, PAGES, false).sentinelInThread, true);
  // An unchanged observation returns the same object, so a repeating observer callback cannot churn React state.
  assert.equal(recordCateringSentinelVisibility(both, A, PAGES, true), both);
  assert.equal(recordCateringViewportVisibility(both, A, PAGES, true), both);
});

test("6. evidence collected for A can never authorize marking B viewed", () => {
  // The exact reported sequence: A is visible, both observers report true, a refetch appends B, and the effect runs
  // before either observer has had a chance to report false.
  const evidence = bothFor(A);
  assert.equal(cateringThreadEndIsOnScreen(evidence, A, PAGES), true);
  assert.equal(cateringThreadEndIsOnScreen(evidence, B, PAGES), false, "stale evidence must not carry to a new boundary");
  // Both booleans are still true; what disqualifies it is that they were not collected for B.
  assert.equal(evidence.sentinelInThread && evidence.sentinelInViewport, true);
  assert.equal(evidence.observedId, A);
});

test("7. a boundary change invalidates prior positive evidence immediately, with no observer callback needed", () => {
  const evidence = bothFor(A);
  // Nothing is recorded, nothing is reset, no callback arrives -- and B is already unauthorized, in the same render
  // that latestId changed. The invalidation cannot lag behind the boundary because it is not stored state at all.
  assert.equal(cateringThreadEndIsOnScreen(evidence, B, PAGES), false);
  // The first observation that does arrive for B discards A's evidence rather than merging with it, so a single
  // positive for B cannot combine with A's leftover other half.
  const sentinelForB = recordCateringSentinelVisibility(evidence, B, PAGES, true);
  assert.equal(sentinelForB.observedId, B);
  assert.equal(sentinelForB.sentinelInViewport, false, "the other half must not survive the rebase");
  assert.equal(cateringThreadEndIsOnScreen(sentinelForB, B, PAGES), false);
});

test("8. fresh dual-positive observations for B allow B to become viewed", () => {
  // A reader genuinely sitting at the bottom: re-created observers deliver an initial observation for the new
  // boundary, both come back positive, and B is legitimately viewed.
  const forB = bothFor(B);
  assert.equal(cateringThreadEndIsOnScreen(forB, B, PAGES), true);
  // Rebuilt from A's evidence rather than from nothing, the answer is the same -- what matters is that both halves
  // were re-observed for B.
  const rebuilt = recordCateringViewportVisibility(recordCateringSentinelVisibility(bothFor(A), B, PAGES, true), B, PAGES, true);
  assert.equal(cateringThreadEndIsOnScreen(rebuilt, B, PAGES), true);
  // And A, now behind the boundary, is no longer what the evidence speaks to.
  assert.equal(cateringThreadEndIsOnScreen(rebuilt, A, PAGES), false);
});

test("9. one observer positive for B is never enough, whichever one it is", () => {
  const sentinelOnly = recordCateringSentinelVisibility(bothFor(A), B, PAGES, true);
  assert.equal(cateringThreadEndIsOnScreen(sentinelOnly, B, PAGES), false);
  const threadOnly = recordCateringViewportVisibility(bothFor(A), B, PAGES, true);
  assert.equal(cateringThreadEndIsOnScreen(threadOnly, B, PAGES), false);
  // A negative arriving for the new boundary is likewise not evidence of anything.
  assert.equal(cateringThreadEndIsOnScreen(recordCateringSentinelVisibility(bothFor(A), B, PAGES, false), B, PAGES), false);
});

test("10 & 14. with no evidence at all, and for an unloaded boundary, nothing is viewable", () => {
  // No IntersectionObserver means no callback ever fires, so the state stays empty and fails closed.
  assert.equal(cateringThreadEndIsOnScreen(EMPTY_CATERING_THREAD_VISIBILITY, A, PAGES), false);
  assert.equal(EMPTY_CATERING_THREAD_VISIBILITY.observedId, null);
  assert.equal(EMPTY_CATERING_THREAD_VISIBILITY.sentinelInThread, false);
  assert.equal(EMPTY_CATERING_THREAD_VISIBILITY.sentinelInViewport, false);
  // A null latestId -- nothing loaded -- can never be viewed, so an unloaded message can never be marked read.
  assert.equal(cateringThreadEndIsOnScreen(bothFor(A), null, PAGES), false);
  assert.equal(cateringThreadEndIsOnScreen(EMPTY_CATERING_THREAD_VISIBILITY, null, PAGES), false);
  // And a viewed boundary is never recorded from a null latestId either.
  assert.equal(recordCateringViewedBoundary(hydrateCateringViewed(EMPTY_CATERING_VIEWED, "actor:booking"), null).viewedId, null);
});

test("11 & 12. below the document fold and below the thread viewport both stay unread", () => {
  // Short thread, sentinel intersects its own container, but the card is below the page fold.
  const belowFold = recordCateringViewportVisibility(recordCateringSentinelVisibility(EMPTY_CATERING_THREAD_VISIBILITY, A, PAGES, true), A, PAGES, false);
  assert.equal(cateringThreadEndIsOnScreen(belowFold, A, PAGES), false);
  // Card on screen, but the reader is scrolled up inside a long thread so the end of it is not.
  const scrolledUp = recordCateringViewportVisibility(recordCateringSentinelVisibility(EMPTY_CATERING_THREAD_VISIBILITY, A, PAGES, false), A, PAGES, true);
  assert.equal(cateringThreadEndIsOnScreen(scrolledUp, A, PAGES), false);
  // Scrolling the card into view afterwards is a legitimate read of A -- the evidence is still A's.
  assert.equal(cateringThreadEndIsOnScreen(recordCateringViewportVisibility(belowFold, A, PAGES, true), A, PAGES), true);
});

test("repeated identical observations produce no new state, so no mutation loop is possible", () => {
  const both = bothFor(A);
  // The same object back each time: React bails out of the re-render, the conjunction effect does not re-run, and
  // no further mark-read mutation is issued.
  let state = both;
  for (let i = 0; i < 5; i += 1) {
    state = recordCateringSentinelVisibility(state, A, PAGES, true);
    state = recordCateringViewportVisibility(state, A, PAGES, true);
  }
  assert.equal(state, both);
  // Recording the same viewed boundary twice is likewise a no-op.
  const viewed = recordCateringViewedBoundary(hydrateCateringViewed(EMPTY_CATERING_VIEWED, "actor:booking"), A);
  assert.equal(recordCateringViewedBoundary(viewed, A), viewed);
});


/**
 * The document-viewport half must be about the SENTINEL, not the thread container.
 *
 * Observing the container was the original second half, and it let this through: a tall thread the reader is
 * scrolled to the bottom of, whose top edge has just come into view. The container intersects the browser viewport,
 * the sentinel intersects the container's own viewport, and the sentinel is still physically below the fold. Both
 * booleans true, nothing seen. Both observations are now of the sentinel, differing only in their root.
 */
test("1. container partially visible but sentinel below the browser viewport stays unread", () => {
  // The exact failure case: in-thread yes, in-browser-viewport no.
  const state = recordCateringViewportVisibility(recordCateringSentinelVisibility(EMPTY_CATERING_THREAD_VISIBILITY, A, PAGES, true), A, PAGES, false);
  assert.equal(state.sentinelInThread, true);
  assert.equal(state.sentinelInViewport, false);
  assert.equal(cateringThreadEndIsOnScreen(state, A, PAGES), false);
});

test("2 & 3. one root positive is never enough, whichever root it is", () => {
  const threadOnly = recordCateringSentinelVisibility(EMPTY_CATERING_THREAD_VISIBILITY, A, PAGES, true);
  assert.equal(cateringThreadEndIsOnScreen(threadOnly, A, PAGES), false, "thread scroll viewport alone");
  const viewportOnly = recordCateringViewportVisibility(EMPTY_CATERING_THREAD_VISIBILITY, A, PAGES, true);
  assert.equal(cateringThreadEndIsOnScreen(viewportOnly, A, PAGES), false, "browser viewport alone");
});

test("4. the sentinel visible in BOTH roots is what allows viewed", () => {
  assert.equal(cateringThreadEndIsOnScreen(bothFor(A), A, PAGES), true);
  // And either root going false withdraws it again -- scrolling the page away, or scrolling up inside the thread.
  assert.equal(cateringThreadEndIsOnScreen(recordCateringViewportVisibility(bothFor(A), A, PAGES, false), A, PAGES), false);
  assert.equal(cateringThreadEndIsOnScreen(recordCateringSentinelVisibility(bothFor(A), A, PAGES, false), A, PAGES), false);
});

test("5 & 6. stale dual-root evidence for A cannot mark B, which needs fresh dual-root evidence", () => {
  const staleForA = bothFor(A);
  assert.equal(cateringThreadEndIsOnScreen(staleForA, B, PAGES), false);
  // One fresh root for B does not combine with A's leftover other root.
  const oneFreshRoot = recordCateringSentinelVisibility(staleForA, B, PAGES, true);
  assert.equal(oneFreshRoot.sentinelInViewport, false, "the other root must not survive the rebase");
  assert.equal(cateringThreadEndIsOnScreen(oneFreshRoot, B, PAGES), false);
  // Both roots re-observed for B is what allows it.
  assert.equal(cateringThreadEndIsOnScreen(recordCateringViewportVisibility(oneFreshRoot, B, PAGES, true), B, PAGES), true);
});


/**
 * Visibility of the newest LOADED message is not visibility of everything behind it.
 *
 * Messages arrive newest-first and older pages are fetched on demand, so a conversation whose unread backlog is
 * larger than the first page loads the newest messages and leaves older unread ones unfetched. The server's read
 * marker is chronological -- it sweeps everything at or before the boundary's `(created_at, id)` pair -- so
 * recording the newest loaded id in that state marks those unloaded messages read without ever rendering them.
 */
test("1. the newest sentinel visible while older pages remain unfetched is NOT viewable", () => {
  const seen = bothFor(A);
  // Visibility itself is genuine and fresh; what disqualifies it is the unfetched history behind it.
  assert.equal(cateringThreadEndIsOnScreen(seen, A, PAGES), true);
  assert.equal(mayRecordCateringViewedBoundary(seen, A, true, PAGES), false, "an unfetched older page blocks the boundary");
});

test("2. the newest sentinel visible with pagination exhausted is allowed", () => {
  assert.equal(mayRecordCateringViewedBoundary(bothFor(A), A, false, PAGES), true);
});

test("3. exhausting pagination does not rescue stale evidence from an earlier boundary", () => {
  // Evidence collected while A was newest, then B arrives and the cursor happens to exhaust. The boundary binding
  // still applies: B needs its own observations.
  const staleForA = bothFor(A);
  assert.equal(mayRecordCateringViewedBoundary(staleForA, B, false, PAGES), false);
  assert.equal(mayRecordCateringViewedBoundary(staleForA, B, true, PAGES), false);
  // One fresh root for B is still not enough, exhausted cursor or not.
  const oneRoot = recordCateringSentinelVisibility(staleForA, B, PAGES, true);
  assert.equal(mayRecordCateringViewedBoundary(oneRoot, B, false, PAGES), false);
});

test("4 & 5. loading older pages marks nothing by itself; exhaustion plus fresh evidence does", () => {
  // Mid-pagination, with the reader looking at the newest message: still nothing.
  let state = bothFor(A);
  assert.equal(mayRecordCateringViewedBoundary(state, A, true, PAGES), false);
  // Prepending an older page moves the reader away from the end, and the re-created observers say so. Exhausting
  // the cursor in that state still records nothing, because the sentinel is no longer on screen.
  state = recordCateringSentinelVisibility(state, A, PAGES, false);
  assert.equal(mayRecordCateringViewedBoundary(state, A, false, PAGES), false, "loading a page must not itself mark read");
  // Only once the participant is back at the end, with both roots positive for this exact boundary, is it eligible.
  state = recordCateringSentinelVisibility(state, A, PAGES, true);
  assert.equal(mayRecordCateringViewedBoundary(state, A, false, PAGES), true);
});

test("6. an ineligible boundary yields no readable id, so older unread messages stay counted", () => {
  const identity = "actor:booking";
  let viewed = hydrateCateringViewed(EMPTY_CATERING_VIEWED, identity);
  // The component only records when the gate allows it, so a blocked boundary leaves the readable id null and the
  // mark-read effect has nothing to send -- the server's unread count keeps the backlog.
  if (mayRecordCateringViewedBoundary(bothFor(A), A, true, PAGES)) viewed = recordCateringViewedBoundary(viewed, A);
  assert.equal(cateringReadableBoundary(viewed, identity), null);
  assert.equal(shouldAutoMarkCateringConversationRead(hydrateCateringReadMark(EMPTY_CATERING_READ_MARK, identity), null, 7), false);
  // And once it is eligible, the ordinary path resumes.
  if (mayRecordCateringViewedBoundary(bothFor(A), A, false, PAGES)) viewed = recordCateringViewedBoundary(viewed, A);
  assert.equal(cateringReadableBoundary(viewed, identity), A);
});

test("an unloaded conversation is never viewable regardless of the cursor", () => {
  assert.equal(mayRecordCateringViewedBoundary(bothFor(A), null, false, PAGES), false);
  assert.equal(mayRecordCateringViewedBoundary(EMPTY_CATERING_THREAD_VISIBILITY, null, false, PAGES), false);
});


/**
 * `latestId` alone does not identify what is on screen. Loading older messages prepends them without changing the
 * newest one, so evidence gathered before the prepend stayed stamped with the same boundary and stayed valid for a
 * thread that now renders entirely different content -- and because exhausting pagination is itself the gate, the
 * flip from "more" to "end" unlocked the boundary using booleans collected for the SHORTER thread, while scroll
 * restoration deliberately kept the reader where they were.
 */
const SHORT = cateringMessagePageKey([{ messages: [{}, {}, {}] }], true);
const LONG = cateringMessagePageKey([{ messages: [{}, {}, {}] }, { messages: [{}, {}] }], false);

test("page 1. both sentinels positive while an older page remains unfetched marks nothing", () => {
  const evidence = bothFor(A, SHORT);
  assert.equal(cateringThreadEndIsOnScreen(evidence, A, SHORT), true);
  assert.equal(mayRecordCateringViewedBoundary(evidence, A, true, SHORT), false);
});

test("page 2 & 5. loading an older page invalidates the evidence even though latestId is unchanged", () => {
  const evidence = bothFor(A, SHORT);
  // The prepend lands: same newest message, different rendering, and the cursor is now exhausted.
  assert.notEqual(SHORT, LONG);
  assert.equal(cateringThreadEndIsOnScreen(evidence, A, LONG), false, "evidence about a different rendering is not evidence about this one");
  assert.equal(mayRecordCateringViewedBoundary(evidence, A, false, LONG), false, "exhausting pagination must not unlock stale evidence");
});

test("page 3 & 7. before the new observers report, nothing is markable -- restoration is not evidence", () => {
  // Scroll restoration keeps the reader's visual position after the prepend, but it produces no observation.
  const afterPrepend = bothFor(A, SHORT);
  assert.equal(mayRecordCateringViewedBoundary(afterPrepend, A, false, LONG), false);
  // A single fresh half is still not enough, and it discards the stale other half rather than merging with it.
  const oneFresh = recordCateringSentinelVisibility(afterPrepend, A, LONG, true);
  assert.equal(oneFresh.sentinelInViewport, false, "the stale other half must not survive the rebase");
  assert.equal(mayRecordCateringViewedBoundary(oneFresh, A, false, LONG), false);
});

test("page 4. fresh dual-positive evidence for the new page set is what allows the boundary", () => {
  const fresh = bothFor(A, LONG);
  assert.equal(mayRecordCateringViewedBoundary(fresh, A, false, LONG), true);
  // And it is specific to that rendering: it does not retroactively authorize the earlier one.
  assert.equal(mayRecordCateringViewedBoundary(fresh, A, false, SHORT), false);
});

test("page 6. a changed latestId still invalidates evidence, page set unchanged", () => {
  const evidence = bothFor(A, LONG);
  assert.equal(mayRecordCateringViewedBoundary(evidence, B, false, LONG), false);
});

test("the page key changes on a prepend, on a new message, and on the pagination flip", () => {
  const base = [{ messages: [{}, {}] }];
  // Exhaustion flips.
  assert.notEqual(cateringMessagePageKey(base, true), cateringMessagePageKey(base, false));
  // A prepended page changes both the page count and the message count.
  assert.notEqual(cateringMessagePageKey(base, false), cateringMessagePageKey([...base, { messages: [{}] }], false));
  // A newly delivered message changes the count.
  assert.notEqual(cateringMessagePageKey(base, false), cateringMessagePageKey([{ messages: [{}, {}, {}] }], false));
  // An identical rendering produces an identical key, so a quiet poll re-keys nothing.
  assert.equal(cateringMessagePageKey(base, false), cateringMessagePageKey([{ messages: [{}, {}] }], false));
  // Nothing loaded is still a stable key rather than a crash.
  assert.equal(cateringMessagePageKey(undefined, true), "0:0:more");
  assert.equal(cateringMessagePageKey([], false), "0:0:end");
});

test("page 8. one attempt per exact (boundary, page set) candidate, and a failure does not loop", () => {
  const identity = "actor:booking";
  let viewed = hydrateCateringViewed(EMPTY_CATERING_VIEWED, identity);
  // Only an eligible candidate records anything, so an ineligible one leaves no readable boundary to attempt.
  if (mayRecordCateringViewedBoundary(bothFor(A, SHORT), A, true, SHORT)) viewed = recordCateringViewedBoundary(viewed, A);
  assert.equal(cateringReadableBoundary(viewed, identity), null);
  if (mayRecordCateringViewedBoundary(bothFor(A, LONG), A, false, LONG)) viewed = recordCateringViewedBoundary(viewed, A);
  assert.equal(cateringReadableBoundary(viewed, identity), A);
  // Recording the same boundary again is a no-op, and a failed attempt is recorded rather than retried.
  assert.equal(recordCateringViewedBoundary(viewed, A), viewed);
  let mark = hydrateCateringReadMark(EMPTY_CATERING_READ_MARK, identity);
  assert.equal(shouldAutoMarkCateringConversationRead(mark, A, 3), true);
  mark = startCateringReadMark(mark, A);
  assert.equal(shouldAutoMarkCateringConversationRead(mark, A, 3), false, "one attempt per candidate");
  mark = failCateringReadMark(mark, A);
  assert.equal(shouldAutoMarkCateringConversationRead(mark, A, 3), false, "a failure must not re-fire the effect");
});
