import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_MESSAGE_POLL_MS } from "@shared/catering-booking-communication";

/**
 * Delivery of incoming booking messages while the tab stays open.
 *
 * Booking-linked threads are deliberately excluded from the generic DM socket -- that exclusion is what stops the
 * socket transport from bypassing booking participation, lifecycle and idempotency rules -- so this query is the
 * only delivery channel there is. `refetchOnWindowFocus` fires on a focus TRANSITION, and two participants sitting
 * in the same workspace with their tabs focused never have one: each could stay on stale messages indefinitely.
 *
 * There is no DOM or React Query harness in this suite, so the query options and the effects are asserted
 * structurally against the component source, as everywhere else in Phase 2I. What is being pinned is that delivery
 * happens on a timer, and that delivery is kept strictly separate from reading.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "BookingCommunication.tsx"), "utf8");
const socketSource = fs.readFileSync(path.join(here, "..", "..", "..", "..", "server", "realtime", "dmSocket.ts"), "utf8");
const queryOptions = source.slice(source.indexOf("const query = useInfiniteQuery({"), source.indexOf("queryFn: async ({ pageParam })"));
const viewEffect = source.slice(source.indexOf("// Watches the end-of-thread sentinel"), source.indexOf("// The boundary advances only while BOTH observations hold"));
const readEffect = source.slice(source.indexOf("// Marking read happens at most ONCE per boundary"), source.indexOf("// Restore the reading position"));

test("1. the booking message query actively refreshes on a timer, not only on staleness", () => {
  assert.equal(queryOptions.includes("refetchInterval: CATERING_MESSAGE_POLL_MS"), true);
  // A bounded, unhurried cadence -- and one shared constant rather than a number buried in the component.
  assert.equal(CATERING_MESSAGE_POLL_MS, 15_000);
  assert.equal(CATERING_MESSAGE_POLL_MS >= 10_000, true, "polling must not be high frequency");
  assert.equal(CATERING_MESSAGE_POLL_MS <= 60_000, true, "polling must actually be timely");
  // It agrees with the query's own staleness boundary rather than fighting it.
  assert.equal(queryOptions.includes("staleTime: 15_000"), true);
});

test("2. no focus change is required: the timer is what delivers, and focus refetch is kept as well", () => {
  assert.equal(queryOptions.includes("refetchOnWindowFocus: true"), true);
  assert.equal(queryOptions.includes("refetchInterval:"), true);
  // A hidden tab has no reader to serve, so background polling stays off and the focus transition covers the
  // return. This is stated rather than inherited from a default that could change.
  assert.equal(queryOptions.includes("refetchIntervalInBackground: false"), true);
});

test("5. polling exists BECAUSE the socket refuses booking threads, and that refusal is intact", () => {
  // The premise of this whole mechanism. If the socket ever started serving booking threads, every booking rule it
  // bypasses would need re-proving -- so the guard is asserted here too, not only in the bypass suite.
  assert.equal((socketSource.match(/refuseBookingLinkedThread\(socket, threadId\)/g) ?? []).length, 4);
  assert.equal(socketSource.includes("if (!linked) return false;"), true);
  // And this component opens no live channel of its own: it addresses the booking-scoped HTTP API only. Comments
  // are stripped first, so the prose explaining WHY there is no socket cannot satisfy -- or fail -- this check.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
  for (const forbidden of ["socket", "io(", "WebSocket", "EventSource"]) {
    assert.equal(code.includes(forbidden), false, forbidden);
  }
  // The only transport it uses is fetch against the booking-scoped routes.
  assert.equal(code.includes("`/api/catering/bookings/${bookingId}/messages"), true);
});

test("3. polling does not advance the read marker: fetching is not evidence of reading", () => {
  // The read request is issued from one place, gated on a boundary the participant was SHOWN.
  assert.equal((source.match(/markRead\.mutate\(/g) ?? []).length, 1);
  assert.equal(readEffect.includes("shouldAutoMarkCateringConversationRead(readMark, viewedId, unreadCount)"), true);
  // Nothing in the query options, and nothing on the fetch path, records a viewed boundary or marks read.
  for (const forbidden of ["recordCateringViewedBoundary", "markRead", "setViewed"]) {
    assert.equal(queryOptions.includes(forbidden), false, forbidden);
  }
  // The boundary still comes only from the dual-sentinel conjunction, and only from there.
  assert.equal((source.match(/recordCateringViewedBoundary\(/g) ?? []).length, 1);
  assert.equal(source.includes("mayRecordCateringViewedBoundary(visibility, latestId, hasOlderPages)"), true);
});

test("3. a polled-in message below the fold stays unread, because its boundary has no evidence yet", () => {
  // A poll that delivers a newer message changes `latestId`, which invalidates the evidence held for the previous
  // boundary in the same render -- the observation is stamped with the id it was collected for.
  assert.equal(source.includes("cateringThreadEndIsOnScreen(state, latestId)") === false, true, "the check lives in the state module");
  assert.equal(viewEffect.includes("recordCateringSentinelVisibility(current, latestId, entries.some((entry) => entry.isIntersecting))"), true);
  assert.equal(viewEffect.includes("recordCateringViewportVisibility(current, latestId, entries.some((entry) => entry.isIntersecting))"), true);
  // Both observers are re-created when `latestId` changes, so the new boundary is judged by a fresh observation --
  // positive for a reader still at the sentinel, negative for one the new message pushed below the fold.
  assert.equal(viewEffect.includes("}, [latestId, messages.length]);"), true);
  assert.equal(viewEffect.includes("threadRootObserver.observe(sentinel)"), true);
  assert.equal(viewEffect.includes("viewportObserver.observe(sentinel)"), true);
});

test("7. repeated polls cause no duplicate automatic read requests", () => {
  // A poll returning the same newest message records the same boundary, and recording an unchanged boundary is a
  // no-op, so the mark effect never re-fires for it. Beyond that the attempt itself is recorded before the request.
  assert.equal(readEffect.indexOf("startCateringReadMark(current, viewedId!)") < readEffect.indexOf("markRead.mutate(viewedId!)"), true);
  assert.equal(readEffect.includes("if (markRead.isPending) return;"), true);
  // The effect gates on the recorded attempt, not merely on unread state, so an unchanged boundary is refused.
  assert.equal(readEffect.includes("shouldMarkCateringConversationRead("), false);
});

test("8. polling preserves loaded pagination and history", () => {
  // Cursor-based pages, deduplicated by id when combined, so a refreshed page cannot duplicate or reorder a message.
  assert.equal(source.includes("getNextPageParam: (lastPage) => nextCateringMessageCursor(lastPage)"), true);
  assert.equal(source.includes("combineCateringMessagePages(query.data?.pages ?? [])"), true);
  // No page cap: nothing discards older loaded pages to keep polling cheap.
  assert.equal(queryOptions.includes("maxPages"), false, "loaded history must not be dropped by the refresh");
  // The scroll position is restored only after an explicit older-page fetch, which sets the marker. A poll never
  // sets it, so a delivered message cannot yank the reader to the bottom.
  assert.equal(source.includes("restoreRef.current = threadRef.current?.scrollHeight ?? null;"), true);
  const restore = source.slice(source.indexOf("// Restore the reading position"), source.indexOf("const loadOlder ="));
  assert.equal(restore.includes("previousHeight !== null"), true);
  assert.equal(restore.includes("!query.isFetchingNextPage"), true);
});

test("6. polling does not clear drafts or disturb send state", () => {
  // The composer is component state; only the send state machine ever writes it, and only for the attempt that
  // resolved. Nothing on the fetch path touches it.
  assert.equal(queryOptions.includes("setComposer"), false);
  assert.equal(source.includes("completeCateringMessageSend(current, payload.clientRequestId)"), true);
  assert.equal(source.includes('text: ""'), false, "clearing belongs to completeCateringMessageSend alone");
  // Idempotent sends are unchanged: one token per composition, reused by the retry path.
  assert.equal(source.includes("startCateringMessageSend(composer, crypto.randomUUID())"), true);
  assert.equal(source.includes("retryCateringMessageSend(composer)"), true);
});

test("delivering a genuinely new message refreshes the unread badge, and only then", () => {
  const delivery = source.slice(source.indexOf("// A poll that brings a genuinely new message"), source.indexOf("// Watches the end-of-thread sentinel"));
  // Tied to the id CHANGING, so a quiet conversation issues nothing extra.
  assert.equal(delivery.includes("if (latestId === null || deliveredRef.current === latestId) return;"), true);
  // The first id seen is recorded but not acted on: the workspace that rendered this component is already current.
  assert.equal(delivery.includes("const firstLoad = deliveredRef.current === null;"), true);
  assert.equal(delivery.includes("if (!firstLoad) cache.invalidateQueries({ queryKey: cateringBookingWorkspaceKey(userId, bookingId) });"), true);
  // Actor-scoped, exactly as every other cache touch in this component -- never a broad clear, never the
  // counterpart's keys.
  assert.equal(source.includes("cache.clear()"), false);
  assert.equal(source.includes("cache.invalidateQueries()"), false);
  // It cannot loop: the workspace refetch changes `unreadCount`, never `latestId`.
  assert.equal(delivery.includes("}, [latestId]);"), true);
  // And the watermark resets with the conversation, so switching bookings cannot suppress the first refresh.
  const hydrate = source.slice(source.indexOf("useEffect(() => { setComposer("), source.indexOf("const query = useInfiniteQuery"));
  assert.equal(hydrate.includes("deliveredRef.current = null;"), true);
});

test("9. a terminal booking still reads and polls, but remains non-writable", () => {
  // Reading never closes, only sending does: the query, the poll and the read path are unconditional, and the
  // composer is what `editable` gates.
  assert.equal(queryOptions.includes("enabled:"), false, "a historical conversation must still load and refresh");
  assert.equal(source.includes("{editable\n      ? <form className=\"space-y-2\" onSubmit={submit}>"), true);
  assert.equal(source.includes(": <p className=\"font-medium\">{CATERING_COMMUNICATION_READ_ONLY_BANNER}</p>}"), true);
  // The send control is additionally gated by the state machine, which takes `editable` too.
  assert.equal(source.includes("disabled={!maySendCateringMessage(composer, editable)}"), true);
  // A booking that closed while the composer was open refetches the workspace, so the banner replaces the form.
  assert.equal(source.includes("if (isCateringCommunicationReadOnly(error)) {"), true);
});
