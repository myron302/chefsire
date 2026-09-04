import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Composer regressions for the booking Communication section.
 *
 * The state machine itself is covered by `catering-booking-communication-state.test.ts`; what is asserted here is
 * that the component wires that machine up the way the machine assumes -- above all that the composer stays a live,
 * editable value distinct from the immutable attempt, and that a resolving attempt is never allowed to clear it
 * unconditionally. There is no DOM harness in this suite, so these are structural assertions against the component
 * source: a regression that re-disables the box, or reintroduces an unconditional clear, fails here.
 */
const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "BookingCommunication.tsx"), "utf8");
const composerForm = source.slice(source.indexOf("<form className=\"space-y-2\" onSubmit={submit}>"));

test("the composer stays editable while a send is in flight and after one fails", () => {
  const textarea = composerForm.slice(composerForm.indexOf("<Textarea id=\"catering-message\""));
  // No disabled binding at all: with the attempt held separately, editing during a send is safe rather than lossy.
  assert.equal(textarea.slice(0, textarea.indexOf("/>")).includes("disabled"), false, "the composer must not be disabled during a send");
  assert.equal(composerForm.includes("value={composer.text}"), true);
  assert.equal(composerForm.includes("editCateringComposer(current, event.target.value)"), true);
});

test("clearing the composer goes through the state machine, never an unconditional reset", () => {
  // The only clear is `completeCateringMessageSend`, which compares the composer against the submitted draft first.
  assert.equal(source.includes("completeCateringMessageSend(current, payload.clientRequestId)"), true);
  assert.equal(/setComposer\(\s*\{[^}]*text:\s*""/.test(source), false, "the composer must never be reset directly");
  assert.equal(source.includes('text: ""'), false, "clearing belongs to completeCateringMessageSend alone");
});

test("a retry resends the failed attempt rather than whatever is currently typed", () => {
  const retry = source.slice(source.indexOf("const retry = ()"), source.indexOf("const pending ="));
  assert.equal(retry.includes("retryCateringMessageSend(composer)"), true);
  // The payload comes from the state machine's attempt record, not from `composer.text`.
  assert.equal(retry.includes("send.mutate(retried.payload)"), true);
  assert.equal(retry.includes("composer.text"), false, "a retry must not read the live composer draft");
});

test("the failure notice names the unsent message and says the live draft is unaffected", () => {
  assert.equal(composerForm.includes("Try again resends this unsent message"), true);
  assert.equal(composerForm.includes("{pending.text}"), true);
  assert.equal(composerForm.includes("composer.text.trim() !== pending.text"), true);
  assert.equal(composerForm.includes("What you have typed above is kept separately"), true);
});

test("send, retry and discard controls remain reachable and accessible", () => {
  // A labelled composer, a live region for send outcomes, and an alert region for failures.
  assert.equal(composerForm.includes(`<Label htmlFor="catering-message">`), true);
  assert.equal(composerForm.includes(`role="status" aria-live="polite"`), true);
  assert.equal(composerForm.includes(`role="alert"`), true);
  // Every control keeps the 44px touch target the workspace uses.
  for (const control of ["Send message", "Try again", "Discard unsent message"]) {
    const at = composerForm.indexOf(control);
    assert.notEqual(at, -1, control);
    assert.equal(composerForm.slice(composerForm.lastIndexOf("<Button", at), at).includes("min-h-11"), true, control);
  }
});

test("duplicate-send protection is unchanged: the send control is gated by the state machine", () => {
  assert.equal(composerForm.includes("disabled={!maySendCateringMessage(composer, canSend)}"), true);
  // A fresh token per composition, reused by the retry path through the attempt record.
  assert.equal(source.includes("startCateringMessageSend(composer, crypto.randomUUID())"), true);
});

/**
 * Automatic read marking must be bounded at the component level too: the effect has to record the attempted
 * boundary before issuing the request, or a failure re-fires it the instant the mutation returns to idle.
 */
const readEffect = source.slice(source.indexOf("// Marking read happens at most ONCE per boundary"), source.indexOf("// Restore the reading position"));

test("the mark-read effect records the attempted boundary before issuing the request", () => {
  assert.equal(readEffect.includes("shouldAutoMarkCateringConversationRead(readMark, viewedId, unreadCount)"), true);
  // The attempt is recorded first, so a second pass for the same boundary is refused before any request is made.
  assert.equal(readEffect.indexOf("startCateringReadMark(current, viewedId!)") < readEffect.indexOf("markRead.mutate(viewedId!)"), true);
  // The old unbounded predicate, which knew nothing about attempts, must not be what gates the effect.
  assert.equal(readEffect.includes("shouldMarkCateringConversationRead("), false, "the effect must gate on the attempted boundary, not only on unread state");
});

test("a failed mark-read is recorded rather than retried from the effect", () => {
  const mutation = source.slice(source.indexOf("const markRead = useMutation"), source.indexOf("// Watches the end-of-thread sentinel"));
  assert.equal(mutation.includes("failCateringReadMark(current, attemptedId)"), true);
  // Success takes the server's authoritative marker, which is monotonic, rather than the requested id.
  assert.equal(mutation.includes("completeCateringReadMark(current, body?.lastReadMessageId ?? null)"), true);
  assert.equal(mutation.includes("setMarkedId("), false, "the old success-only marker state must be gone");
});

test("the read-marker retry is offered quietly and accessibly, and issues no request itself", () => {
  const retry = source.slice(source.indexOf("mayRetryCateringReadMark(readMark, viewedId, unreadCount)"));
  // A failed read receipt is not an error the user caused, so it is a status region rather than an alert.
  assert.equal(retry.slice(0, retry.indexOf("</div>")).includes(`role="status"`), true);
  const button = retry.slice(retry.indexOf("<Button"), retry.indexOf("</Button>"));
  assert.equal(button.includes("min-h-11"), true);
  assert.equal(button.includes("disabled={markRead.isPending}"), true);
  // The control only clears the recorded attempt; the effect then issues exactly one request.
  assert.equal(button.includes("setReadMark(retryCateringReadMark)"), true);
  assert.equal(button.includes("markRead.mutate"), false, "the retry control must not issue a request directly");
});

/**
 * Read state must reflect what was displayed, not what was fetched. A first page that overflows the viewport used
 * to be marked read the moment the component mounted.
 */
const viewEffect = source.slice(source.indexOf("// Watches the end-of-thread sentinel"), source.indexOf("// Marking read happens at most ONCE per boundary"));

test("the read boundary comes from what was displayed, never from the newest fetched message", () => {
  assert.equal(source.includes("const viewedId = cateringReadableBoundary(viewed, identity);"), true);
  // Nothing in the mark path may reach for latestId any more.
  assert.equal(readEffect.includes("latestId"), false, "the mark effect must not use the fetched boundary");
  assert.equal(source.includes("mayRetryCateringReadMark(readMark, viewedId, unreadCount)"), true);
});

test("a sentinel at the end of the thread is what advances the viewed boundary", () => {
  assert.equal(viewEffect.includes("new IntersectionObserver"), true);
  assert.equal(viewEffect.includes("recordCateringViewedBoundary(current, latestId)"), true);
  // Re-created as the thread changes so it never observes a detached node, and both are disconnected on cleanup.
  assert.equal(viewEffect.includes("}, [latestId, pageKey]);"), true);
  assert.equal(viewEffect.includes("threadRootObserver.disconnect(); viewportObserver.disconnect();"), true);
  // Environments without IntersectionObserver simply record nothing, which leaves messages unread rather than
  // falsely marking them read.
  assert.equal(viewEffect.includes(`typeof IntersectionObserver === "undefined"`), true);
});

/**
 * Intra-container intersection is not evidence of being on screen, and neither is the CONTAINER being on screen.
 *
 * An observer rooted on the thread answers only "is the sentinel inside the thread's own viewport". Any thread
 * short enough not to scroll satisfies that permanently, wherever the container itself is -- and Communication sits
 * below several other workspace sections, so on a phone the whole card is routinely below the fold.
 *
 * Observing the CONTAINER against the document viewport was the wrong second half: a reader scrolled to the bottom
 * of a tall thread whose top edge has just come into view makes the container intersect while the sentinel is still
 * physically below the fold. Both halves read true and nothing had been seen. So both observers watch the sentinel
 * itself, and only their roots differ.
 */
test("both observers watch the SENTINEL, differing only in their root", () => {
  assert.equal((viewEffect.match(/new IntersectionObserver/g) ?? []).length, 2);
  // Same element, twice. The container is never a stand-in for browser-viewport visibility of the boundary.
  assert.equal((viewEffect.match(/\.observe\(sentinel\)/g) ?? []).length, 2);
  assert.equal(viewEffect.includes("threadRootObserver.observe(sentinel)"), true);
  assert.equal(viewEffect.includes("viewportObserver.observe(sentinel)"), true);
  assert.equal(viewEffect.includes(".observe(thread)"), false, "the container must not be what the viewport observer watches");
  // Two coordinate systems: the thread's scroll root, and the document viewport.
  assert.equal(viewEffect.includes("{ root: thread, threshold: 0.01 }"), true);
  assert.equal(viewEffect.includes("{ root: null, threshold: 0.01 }"), true);
});

test("neither observation alone advances the read boundary", () => {
  // The boundary moves through the conjunction and nothing else: no observer callback records it directly.
  assert.equal(viewEffect.includes("mayRecordCateringViewedBoundary(visibility, latestId, hasOlderPages, pageKey)"), true);
  const threadCallback = viewEffect.slice(viewEffect.indexOf("const threadRootObserver"), viewEffect.indexOf("const viewportObserver"));
  assert.equal(threadCallback.includes("recordCateringViewedBoundary"), false, "thread-root visibility alone must not advance the boundary");
  const viewportCallback = viewEffect.slice(viewEffect.indexOf("const viewportObserver"), viewEffect.indexOf("threadRootObserver.observe"));
  assert.equal(viewportCallback.includes("recordCateringViewedBoundary"), false, "viewport visibility alone must not advance the boundary");
  // Each callback records only its own half.
  assert.equal(threadCallback.includes("recordCateringSentinelVisibility"), true);
  assert.equal(viewportCallback.includes("recordCateringViewportVisibility"), true);
});

test("the boundary advances from the conjunction, and refuses when it does not hold", () => {
  const conjunction = source.slice(source.indexOf("// The boundary advances only while BOTH observations hold"), source.indexOf("// Marking read happens at most ONCE per boundary"));
  assert.equal(conjunction.includes("if (!mayRecordCateringViewedBoundary(visibility, latestId, hasOlderPages, pageKey)) return;"), true);
  assert.equal(conjunction.includes("recordCateringViewedBoundary(current, latestId)"), true);
  // Re-evaluated when either half changes, when newer messages arrive, or when pagination is exhausted, so a
  // reader sitting at the bottom of a fully loaded visible thread still tracks them.
  assert.equal(conjunction.includes("}, [visibility, latestId, hasOlderPages, pageKey]);"), true);
});

test("an environment that cannot observe leaves messages unread rather than falsely read", () => {
  // Both halves start false, so nothing is marked read until each is positively observed.
  assert.equal(source.includes("useState<CateringThreadVisibility>(EMPTY_CATERING_THREAD_VISIBILITY)"), true);
  // A missing container is as disqualifying as a missing sentinel: it is the first observer's ROOT, and without it
  // that observer would fall back to the document and both would answer the same question.
  assert.equal(viewEffect.includes(`if (!sentinel || !thread || typeof IntersectionObserver === "undefined") return;`), true);
});

test("the visibility state resets with the conversation, so it never carries across bookings", () => {
  const hydrate = source.slice(source.indexOf("useEffect(() => { setComposer("), source.indexOf("const query = useInfiniteQuery"));
  assert.equal(hydrate.includes("setVisibility(EMPTY_CATERING_THREAD_VISIBILITY)"), true);
  assert.equal(hydrate.includes("}, [identity]);"), true);
});

test("the sentinel observed is the one rendered inside the scroll container", () => {
  // One sentinel, inside the container the messages are rendered into, so "visible in the thread root" and "visible
  // in the browser viewport" are two questions about the same physical position.
  assert.equal(viewEffect.includes("const sentinel = sentinelRef.current;"), true);
  assert.equal(source.includes(`<div ref={threadRef} className="max-h-96 overflow-y-auto`), true);
  assert.equal(source.indexOf("<div ref={threadRef}") < source.indexOf("<div ref={sentinelRef}"), true);
});

test("the viewed boundary is actor and booking scoped and resets with the conversation", () => {
  assert.equal(source.includes("setViewed((current) => hydrateCateringViewed(current, identity))"), true);
  assert.equal(source.includes("cateringReadableBoundary(viewed, identity)"), true);
});


/**
 * IntersectionObserver reports asynchronously, so a boolean alone carries no record of WHAT it saw. Evidence
 * collected while message A was newest must never authorize marking a message B that arrived afterwards -- and may
 * well have pushed the sentinel out of view in the process.
 */
test("each observation is stamped with the boundary it was collected for", () => {
  // Both callbacks pass the `latestId` they closed over, so the evidence records its own boundary.
  assert.equal(viewEffect.includes("recordCateringSentinelVisibility(current, latestId, pageKey, entries.some((entry) => entry.isIntersecting))"), true);
  assert.equal(viewEffect.includes("recordCateringViewportVisibility(current, latestId, pageKey, entries.some((entry) => entry.isIntersecting))"), true);
  // And the conjunction is asked about a named boundary rather than in the abstract, which is what makes a change
  // of latestId invalidate prior evidence in the same render instead of waiting for a callback to report false.
  assert.equal(viewEffect.includes("mayRecordCateringViewedBoundary(visibility, latestId, hasOlderPages, pageKey)"), true);
  assert.equal(/cateringThreadEndIsOnScreen\(visibility\)/.test(source), false, "the boundary-free form must be gone");
  // And the rendered page set is part of the stamp, so a prepend cannot reuse evidence about the shorter thread.
  assert.equal(source.includes("const pageKey = cateringMessagePageKey(query.data?.pages, hasOlderPages);"), true);
});

test("a boundary change re-creates both observers, which is what supplies fresh evidence", () => {
  // `latestId` is a dependency, so new observers are constructed for the new boundary; `observe()` always delivers
  // an initial observation, so a reader still at the bottom gets a fresh positive and one pushed below the fold
  // gets a negative. Neither inherits the old boundary's answer.
  assert.equal(viewEffect.includes("}, [latestId, pageKey]);"), true);
  assert.equal(viewEffect.includes("threadRootObserver.observe(sentinel)"), true);
  assert.equal(viewEffect.includes("viewportObserver.observe(sentinel)"), true);
  // Old observers are torn down, so neither they nor a record they queued survive into the new boundary.
  assert.equal(viewEffect.includes("threadRootObserver.disconnect(); viewportObserver.disconnect();"), true);
});

test("the component never marks a boundary read from anything but this evidence", () => {
  // The only writer of the viewed boundary is the conjunction effect. No other path records one.
  assert.equal((source.match(/recordCateringViewedBoundary\(/g) ?? []).length, 1);
  // The mark-read effect still reads the viewed boundary rather than the fetched one, and remains bounded to one
  // attempt per boundary, so re-observing the same boundary cannot re-issue the mutation.
  assert.equal(readEffect.includes("latestId"), false);
  assert.equal(readEffect.includes("shouldAutoMarkCateringConversationRead(readMark, viewedId, unreadCount)"), true);
  assert.equal(readEffect.indexOf("startCateringReadMark(current, viewedId!)") < readEffect.indexOf("markRead.mutate(viewedId!)"), true);
});


/**
 * Dual-sentinel visibility proves the newest LOADED boundary is on screen. It says nothing about what is behind it,
 * and the server's read marker is chronological -- it sweeps everything at or before the boundary message. So a
 * conversation whose unread backlog is larger than the first page would have its unloaded older messages marked
 * read the moment the reader saw the newest one.
 */
test("the viewed boundary is gated on pagination being exhausted", () => {
  // The pagination cursor's own answer, not a heuristic, and it is the query's `hasNextPage`.
  assert.equal(source.includes("const hasOlderPages = Boolean(query.hasNextPage);"), true);
  const conjunction = source.slice(source.indexOf("// The boundary advances only while BOTH observations hold"), source.indexOf("// Marking read happens at most ONCE per boundary"));
  assert.equal(conjunction.includes("mayRecordCateringViewedBoundary(visibility, latestId, hasOlderPages, pageKey)"), true);
  // Re-evaluated when the cursor is exhausted -- but the page set is part of the stamp, so exhausting it invalidates
  // the evidence gathered before the prepend rather than unlocking the boundary with it.
  assert.equal(conjunction.includes("hasOlderPages, pageKey]);"), true);
});

test("nothing is auto-fetched to satisfy the pagination gate: paging stays manual", () => {
  // `fetchNextPage` is reachable only from the two explicit controls, never from an effect.
  assert.equal((source.match(/query\.fetchNextPage\(\)/g) ?? []).length, 1);
  assert.equal(source.includes("const loadOlder = () => {"), true);
  const conjunction = source.slice(source.indexOf("// The boundary advances only while BOTH observations hold"), source.indexOf("// Marking read happens at most ONCE per boundary"));
  assert.equal(conjunction.includes("fetchNextPage"), false, "the read path must never fetch a page itself");
  assert.equal(readEffect.includes("fetchNextPage"), false);
  // The observer effect does not either.
  assert.equal(viewEffect.includes("fetchNextPage"), false);
});
