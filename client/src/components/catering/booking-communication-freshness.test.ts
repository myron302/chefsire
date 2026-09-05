import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_WORKSPACE_POLL_MS, cateringWorkspacePollInterval } from "@shared/catering-booking-operations";

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
/** Source with comments removed. Every "must not contain" assertion runs on this, so the prose explaining a rule
 *  can never satisfy -- or fail -- the check for that rule. */
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
const viewEffect = source.slice(source.indexOf("// Watches the end-of-thread sentinel"), source.indexOf("// The boundary advances only while BOTH observations hold"));
const readEffect = source.slice(source.indexOf("// Marking read happens at most ONCE per boundary"), source.indexOf("// Restore the reading position"));

test("1. the booking message query actively refreshes on a timer, not only on staleness", () => {
  assert.equal(queryOptions.includes("refetchInterval: (polled:"), true);
  assert.equal(queryOptions.includes("cateringWorkspacePollInterval(effectiveCateringEditable(editable, observedCateringEditable(polled.state.data?.pages)))"), true);
  assert.equal(cateringWorkspacePollInterval(true), CATERING_WORKSPACE_POLL_MS);
  // A bounded, unhurried cadence -- and one shared constant rather than a number buried in the component.
  assert.equal(CATERING_WORKSPACE_POLL_MS, 15_000);
  assert.equal(CATERING_WORKSPACE_POLL_MS >= 10_000, true, "polling must not be high frequency");
  assert.equal(CATERING_WORKSPACE_POLL_MS <= 60_000, true, "polling must actually be timely");
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
  // And this component opens no live channel of its own: it addresses the booking-scoped HTTP API only.
  const code = stripComments(source);
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
    assert.equal(stripComments(queryOptions).includes(forbidden), false, forbidden);
  }
  // The boundary still comes only from the dual-sentinel conjunction, and only from there.
  assert.equal((source.match(/recordCateringViewedBoundary\(/g) ?? []).length, 1);
  assert.equal(source.includes("mayRecordCateringViewedBoundary(visibility, generation, hasOlderPages, unreadStart)"), true);
});

test("3. a polled-in message below the fold stays unread, because its boundary has no evidence yet", () => {
  // A poll that delivers a newer message changes `latestId`, which invalidates the evidence held for the previous
  // boundary in the same render -- the observation is stamped with the id it was collected for.
  assert.equal(source.includes("cateringThreadEndIsOnScreen(state, generation)") === false, true, "the check lives in the state module");
  assert.equal(viewEffect.includes("recordCateringSentinelVisibility(current, generation, entries.some((entry) => entry.isIntersecting))"), true);
  assert.equal(viewEffect.includes("recordCateringViewportVisibility(current, generation, entries.some((entry) => entry.isIntersecting))"), true);
  // Both observers are re-created when `latestId` changes, so the new boundary is judged by a fresh observation --
  // positive for a reader still at the sentinel, negative for one the new message pushed below the fold.
  assert.equal(viewEffect.includes("}, [latestId, pageKey, unreadStartId]);"), true);
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
  assert.equal(stripComments(queryOptions).includes("maxPages"), false, "loaded history must not be dropped by the refresh");
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
  assert.equal(stripComments(queryOptions).includes("setComposer"), false);
  assert.equal(source.includes("completeCateringMessageSend(current, payload.clientRequestId)"), true);
  assert.equal(source.includes('text: ""'), false, "clearing belongs to completeCateringMessageSend alone");
  // Idempotent sends are unchanged: one token per composition, reused by the retry path.
  assert.equal(source.includes("startCateringMessageSend(composer, crypto.randomUUID())"), true);
  assert.equal(source.includes("retryCateringMessageSend(composer)"), true);
});

/**
 * The parent workspace summary is fetched before this component's own first message request completes, so the
 * counterpart can send a message in between. Treating the FIRST delivery as "the workspace is already current"
 * trusted a summary observed before the boundary it describes -- and because later quiet polls return that same
 * id and never invalidate, the message stayed visible and unread server-side until an unrelated refocus.
 */
const delivery = source.slice(source.indexOf("// Any delivery of a newer message"), source.indexOf("// Watches the end-of-thread sentinel"));

test("1. the FIRST delivery refreshes the workspace summary too, not only later ones", () => {
  // The decisive assertion: no first-load exemption anywhere on this path.
  assert.equal(stripComments(delivery).includes("firstLoad"), false, "the first delivery must not be exempted");
  assert.equal(delivery.includes("cache.invalidateQueries({ queryKey: cateringBookingWorkspaceKey(userId, bookingId) });"), true);
  // Unconditional once the id has changed -- the guard above it is only the has-it-changed check.
  assert.equal(delivery.indexOf("if (latestId === null || deliveredRef.current === latestId) return;") < delivery.indexOf("cache.invalidateQueries("), true);
  // No unread state is invented client-side to compensate; the authoritative summary is simply asked again.
  const deliveryCode = stripComments(delivery);
  for (const forbidden of ["unreadCount", "setViewed", "markRead", "setReadMark"]) {
    assert.equal(deliveryCode.includes(forbidden), false, forbidden);
  }
});

test("2 & 3. it cannot loop, and a later new latestId still refreshes", () => {
  // The watermark is recorded BEFORE the request goes out, and the workspace refetch changes `unreadCount`, never
  // `latestId`, so the effect cannot re-enter for the same boundary.
  assert.equal(delivery.indexOf("deliveredRef.current = latestId;") < delivery.indexOf("cache.invalidateQueries("), true);
  assert.equal(delivery.includes("}, [latestId]);"), true);
  // Keyed on latestId alone, so every subsequent change -- not just the first -- runs it again.
  assert.equal(delivery.includes("if (latestId === null"), true);
});

test("4. repeated quiet polls with the same latestId do not re-invalidate", () => {
  assert.equal(delivery.includes("deliveredRef.current === latestId) return;"), true);
  // Actor-scoped, exactly as every other cache touch in this component -- never a broad clear, never the
  // counterpart's keys.
  assert.equal(source.includes("cache.clear()"), false);
  assert.equal(source.includes("cache.invalidateQueries()"), false);
  // And the watermark resets with the conversation, so switching bookings cannot suppress its first refresh.
  const hydrate = source.slice(source.indexOf("useEffect(() => { setComposer("), source.indexOf("const query = useInfiniteQuery"));
  assert.equal(hydrate.includes("deliveredRef.current = null;"), true);
});

test("6. once the refreshed summary reports unread, the ordinary explicit read path proceeds unchanged", () => {
  // The refresh only makes `unreadCount` truthful. Eligibility still needs a boundary the actor was shown, and the
  // request still goes to the explicit read endpoint.
  assert.equal(readEffect.includes("shouldAutoMarkCateringConversationRead(readMark, viewedId, unreadCount)"), true);
  assert.equal(source.includes("const viewedId = cateringReadableBoundary(viewed, identity);"), true);
  assert.equal(source.includes("`/api/catering/bookings/${bookingId}/messages/read`"), true);
  // One attempt per boundary is preserved: the attempt is recorded before the request.
  assert.equal(readEffect.indexOf("startCateringReadMark(current, viewedId!)") < readEffect.indexOf("markRead.mutate(viewedId!)"), true);
});

test("9. a terminal booking still reads, but remains non-writable", () => {
  // Reading never closes, only sending does: the query and the read path are unconditional, and the composer is
  // what the effective editable state gates.
  assert.equal(stripComments(queryOptions).includes("enabled:"), false, "a historical conversation must still load");
  assert.equal(source.includes("{canSend\n      ? <form className=\"space-y-2\" onSubmit={submit}>"), true);
  assert.equal(source.includes(": <p className=\"font-medium\">{CATERING_COMMUNICATION_READ_ONLY_BANNER}</p>}"), true);
  // The send control is additionally gated by the state machine, which takes the same effective value.
  assert.equal(source.includes("disabled={!maySendCateringMessage(composer, canSend)}"), true);
  // A booking that closed while the composer was open refetches the workspace, so the banner replaces the form.
  assert.equal(source.includes("if (isCateringCommunicationReadOnly(error)) {"), true);
});


/**
 * A cancelled or completed booking is immutable: no message can be sent into it, no file uploaded or removed. Its
 * lists are settled, so re-asking every fifteen seconds forever is pure traffic for an answer that cannot change.
 */
test("an active booking polls at the configured cadence; a terminal one does not poll at all", () => {
  assert.equal(cateringWorkspacePollInterval(true), 15_000);
  // Both terminal states reach this through the same flag, which is why one predicate covers cancelled and
  // completed alike rather than matching on status strings.
  assert.equal(cateringWorkspacePollInterval(false), false);
});

test("closure is taken from the parent workspace's authoritative flag, never re-inferred", () => {
  // `editable` is the same prop that renders the read-only banner and gates every mutation control.
  assert.equal(source.includes("editable, unreadCount, unreadCountCapped = false }: { bookingId: string; userId: string; role: \"provider\" | \"customer\"; editable: boolean; unreadCount: number; unreadCountCapped?: boolean }"), true);
  // And it is only ever the FALLBACK: the endpoint's own answer wins when it has one.
  assert.equal(source.includes("const canSend = effectiveCateringEditable(editable, observedEditable);"), true);
  // No second opinion about BOOKING closure anywhere in the component. (`pending?.status` is the send attempt's
  // own state, not the booking's, so closure-specific tokens are what this checks.)
  const code = stripComments(source);
  for (const inferred of ["cancelled", "completed", "booking.status", "mayMutateCateringFiles", "CATERING_BOOKING_STATUSES"]) {
    assert.equal(code.includes(inferred), false, inferred);
  }
  // The polling policy is handed the endpoint's own answer, with the parent prop only as the fallback inside
  // `effectiveCateringEditable` -- nothing else derives closure.
  assert.equal(code.includes("effectiveCateringEditable(editable, observedCateringEditable("), true);
});

test("only the recurring poll stops: a terminal conversation still loads, paginates and refetches on focus", () => {
  const code = stripComments(queryOptions);
  // The query is never disabled -- reading never closes, only writing does.
  assert.equal(code.includes("enabled:"), false);
  assert.equal(queryOptions.includes("refetchOnWindowFocus: true"), true);
  assert.equal(queryOptions.includes("staleTime: 15_000"), true);
  // Pagination, the actor-scoped key and the read-boundary logic are all untouched by the polling condition.
  assert.equal(source.includes("getNextPageParam: (lastPage) => nextCateringMessageCursor(lastPage)"), true);
  assert.equal(source.includes("queryKey: messagesKey"), true);
  assert.equal(source.includes("mayRecordCateringViewedBoundary(visibility, generation, hasOlderPages, unreadStart)"), true);
});

test("no mutation capability is reintroduced for a terminal booking", () => {
  // The composer is replaced by the banner, and the send control is additionally gated by the state machine.
  assert.equal(source.includes("CATERING_COMMUNICATION_READ_ONLY_BANNER"), true);
  assert.equal(source.includes("disabled={!maySendCateringMessage(composer, canSend)}"), true);
  // Marking a historical conversation read is still allowed -- reading is not a mutation of the booking.
  assert.equal(source.includes("`/api/catering/bookings/${bookingId}/messages/read`"), true);
});
