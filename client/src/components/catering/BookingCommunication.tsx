import { FormEvent, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cateringBookingMessagesKey, type CateringBookingMessagePageView, type CateringBookingMessageView } from "@shared/catering-booking-communication";
import { cateringWorkspacePollInterval, effectiveCateringEditable, observedCateringEditable } from "@shared/catering-booking-operations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cateringPreservedHistory, emptyCateringLoadedHistory, type CateringLoadedHistory } from "@/pages/services/catering-booking-loaded-history";
import { EMPTY_CATERING_IN_FLIGHT, EMPTY_CATERING_UNSENT_MESSAGES, applyForCateringOrigin, cateringMutationIsPending, cateringMutationOrigin, cateringMutationOutcome, cateringOriginMessageInvalidations, cateringOriginWorkspaceInvalidations, cateringUnsentMessage, clearCateringUnsentMessage, enterCateringMutation, exitCateringMutation, recordCateringUnsentMessage, visibleCateringMutationOutcome, type CateringInFlight, type CateringMutationOrigin, type CateringMutationOutcome, type CateringUnsentMessages } from "@/pages/services/catering-booking-mutation-origin";
import { CATERING_COMMUNICATION_EMPTY, CATERING_COMMUNICATION_READ_ONLY_BANNER, EMPTY_CATERING_COMPOSER, combineCateringMessagePages, completeCateringMessageSend, discardCateringMessageSend, editCateringComposer, failCateringMessageSend, formatCateringMessageTimestamp, hydrateCateringComposer, isCateringCommunicationReadOnly, latestCateringMessageId, maySendCateringMessage, mayRetryCateringReadMark, nextCateringMessageCursor, retryCateringMessageSend, retryCateringReadMark, shouldAutoMarkCateringConversationRead, startCateringMessageSend, startCateringReadMark, completeCateringReadMark, failCateringReadMark, hydrateCateringReadMark, hydrateCateringViewed, recordCateringViewedBoundary, cateringMessagePageKey, cateringReadableBoundary, cateringThreadEndIsOnScreen, cateringUnreadStart, cateringUnreadStartId, cateringViewGeneration, mayRecordCateringViewedBoundary, recordCateringMessageCoverage, recordCateringSentinelVisibility, recordCateringViewportVisibility, EMPTY_CATERING_READ_MARK, EMPTY_CATERING_VIEWED, EMPTY_CATERING_THREAD_VISIBILITY, type CateringComposerState, type CateringReadMarkState, type CateringThreadVisibility, type CateringViewedState } from "@/pages/services/catering-booking-communication-state";

/**
 * A send attempt, immutable once started, carrying the booking it belongs to. Every completion handler reads the
 * booking from HERE and never from render scope: this component stays mounted across a route change, so the
 * closure a callback is invoked with describes whatever booking is on screen when the request lands, not the one
 * that issued it.
 */
type SendAttempt = { origin: CateringMutationOrigin; text: string; clientRequestId: string };
/** The same binding for a read receipt, which is equally capable of resolving after the booking has changed. */
type ReadAttempt = { origin: CateringMutationOrigin; lastReadMessageId: string };
/**
 * The booking Communication section. It lives inside the Phase 2H workspace rather than in a second dashboard, and
 * it addresses the booking-scoped API only: no thread id is ever part of its navigation or its cache keys.
 */
export default function BookingCommunication({ bookingId, userId, role, editable, unreadCount, unreadCountCapped = false }: { bookingId: string; userId: string; role: "provider" | "customer"; editable: boolean; unreadCount: number; unreadCountCapped?: boolean }) {
  const cache = useQueryClient();
  const identity = `${userId}:${bookingId}`;
  const [composer, setComposer] = useState<CateringComposerState>(EMPTY_CATERING_COMPOSER);
  const [readMark, setReadMark] = useState<CateringReadMarkState>(EMPTY_CATERING_READ_MARK);
  const [viewed, setViewed] = useState<CateringViewedState>(EMPTY_CATERING_VIEWED);
  // Both halves of "the end of the thread is on screen", tracked separately because they change independently:
  // scrolling the page moves the container, scrolling the thread moves the sentinel within it.
  const [visibility, setVisibility] = useState<CateringThreadVisibility>(EMPTY_CATERING_THREAD_VISIBILITY);
  // The outcome of the last send, stamped with the booking it happened on. `useMutation().isSuccess` is a property
  // of the hook rather than of a booking, so it would announce "Message sent." on whichever booking is rendered
  // when the request lands.
  const [sendOutcome, setSendOutcome] = useState<CateringMutationOutcome | null>(null);
  // Read receipts in flight, per booking, for the same reason: A's request must not disable B's retry control.
  const [readInFlight, setReadInFlight] = useState<CateringInFlight>(EMPTY_CATERING_IN_FLIGHT);
  // Text that was submitted and refused, kept per booking so a booking that closes mid-send does not take the
  // participant's words down with the composer. Local recovery state only; nothing here is persisted or retried.
  const [unsent, setUnsent] = useState<CateringUnsentMessages>(EMPTY_CATERING_UNSENT_MESSAGES);
  // Marks the end of the thread. When it is on screen the newest loaded message is genuinely displayed, which is
  // the only thing that may advance the read boundary -- fetching a page is not reading it.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Every rendered message element, by id. Seeing where the unread range starts and where it ends says nothing
  // about the middle, so each message is observed individually and coverage is collapsed into a contiguous run.
  const messageNodes = useRef(new Map<string, HTMLElement>());
  // The scroll container's height before an older page loads, so restoring position after it lands is arithmetic
  // rather than a guess: prepending older messages must not move what the participant is currently reading.
  const threadRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<number | null>(null);
  // The newest message this component has already accounted for, so a poll that delivers one can be told apart
  // from a poll that delivers nothing.
  const deliveredRef = useRef<string | null>(null);
  // Whether this section has already told the workspace that the booking went terminal.
  const terminalSeenRef = useRef(false);
  // History this participant has already loaded. A poll refetches every loaded page and re-derives each cursor from
  // the page before it, so one new message shifts every boundary down and the oldest loaded message falls out of
  // the last page -- it was never deleted, and without this it would vanish on a timer and have to be loaded again.
  const historyRef = useRef<CateringLoadedHistory<CateringBookingMessageView>>(emptyCateringLoadedHistory());
  const messagesKey = cateringBookingMessagesKey(userId, bookingId);
  // The identity every attempt started from this render is stamped with.
  const origin = cateringMutationOrigin(userId, bookingId);

  useEffect(() => { setComposer((current) => hydrateCateringComposer(current, identity)); setReadMark((current) => hydrateCateringReadMark(current, identity)); setViewed((current) => hydrateCateringViewed(current, identity)); setVisibility(EMPTY_CATERING_THREAD_VISIBILITY); deliveredRef.current = null; terminalSeenRef.current = false; }, [identity]);

  const query = useInfiniteQuery({
    queryKey: messagesKey,
    initialPageParam: undefined as string | undefined,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    // Booking threads are excluded from the generic DM socket on purpose, so this query is the ONLY delivery
    // mechanism for an incoming message. `refetchOnWindowFocus` alone fires only on a focus transition, and two
    // participants with their tabs focused never have one -- they would sit on stale messages indefinitely.
    //
    // Polling refetches every page already loaded, deriving each page's cursor from the freshly returned page
    // before it, so loaded history is refreshed in place rather than discarded and the keyset ordering is the
    // server's throughout. Nothing here marks anything read: this is delivery, and reading is proved separately.
    // A cancelled or completed booking is immutable, so its conversation is settled and polling it forever would be
    // pure traffic. The recurring poll alone stops: the query still loads, paginates and refetches on focus.
    //
    // The decision reads THIS query's own freshest answer rather than the parent prop, and reads it from the query
    // passed in rather than a closure, so the poll stops on the very response that reports the booking terminal --
    // no refocus, no failed send, no unrelated invalidation needed.
    refetchInterval: (polled: { state: { data?: { pages: { editable?: boolean }[] } } }) =>
      cateringWorkspacePollInterval(effectiveCateringEditable(editable, observedCateringEditable(polled.state.data?.pages))),
    // Stated rather than inherited. A hidden tab has no reader to serve, so it polls nothing; the query refreshes
    // on the focus transition instead, which is what `refetchOnWindowFocus` above is for.
    refetchIntervalInBackground: false,
    queryFn: async ({ pageParam }): Promise<CateringBookingMessagePageView> => {
      const search = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : "";
      const response = await fetch(`/api/catering/bookings/${bookingId}/messages${search}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message || "Messages could not be loaded"), { code: typeof body.code === "string" ? body.code : undefined });
      return body;
    },
    getNextPageParam: (lastPage) => nextCateringMessageCursor(lastPage),
  });

  // What the booking-scoped endpoint itself last said about whether this booking can still be written to, and the
  // state this section acts on. The parent prop is only a fallback until the endpoint has answered once.
  const hasOlderPages = Boolean(query.hasNextPage);
  // The refreshed pages are an authoritative WINDOW over the newest end of the conversation, not the whole of it,
  // so history already loaded below that window is preserved rather than dropped. A message the window DOES cover
  // and no longer returns is gone; only messages older than its last one are kept. Derived from the ref's committed
  // value during render and written back after, so nothing flickers out and back in between the two.
  const loadedPages = query.data?.pages;
  const history = cateringPreservedHistory(historyRef.current, identity, loadedPages ? [...combineCateringMessagePages(loadedPages)].reverse() : null, !hasOlderPages);
  useEffect(() => { historyRef.current = history; });
  // Rendered oldest-to-newest, which is the order the thread reads in.
  const messages = [...history.items].reverse();
  const latestId = latestCateringMessageId(messages);
  // What is currently RENDERED, not just which message is newest. Prepending an older page leaves `latestId`
  // untouched, so without this an observation made before the prepend would still read as evidence about the
  // thread that exists after it. The preserved tail counts too: it is on screen.
  const pageKey = `${cateringMessagePageKey(loadedPages, hasOlderPages)}:${messages.length}`;
  // The oldest loaded message that must actually be seen before the newest one may be marked read, derived from the
  // server's own unread count and the `mine` flags rather than from any new API field.
  // The endpoint's own answer, which is never capped; the count and `mine` flags remain only as the fallback for a
  // page cached before the field existed.
  const unreadStart = cateringUnreadStart(messages, unreadCount, unreadCountCapped, query.data?.pages[0]?.unreadStartId);
  const unreadStartId = cateringUnreadStartId(unreadStart);
  // What any observation is evidence ABOUT: this newest message, this rendering, this required range.
  const generation = cateringViewGeneration(latestId, pageKey, unreadStart);
  const observedEditable = observedCateringEditable(query.data?.pages);
  const canSend = effectiveCateringEditable(editable, observedEditable);
  // The boundary a read mark may use: the newest message actually shown, never the newest one fetched.
  const viewedId = cateringReadableBoundary(viewed, identity);
  // The local state as it applies to the booking being rendered RIGHT NOW. The reset below runs in an effect, which
  // commits a render later, so reading the raw state would show one frame of the previous booking's composer.
  const ownComposer = hydrateCateringComposer(composer, identity);
  const ownReadMark = hydrateCateringReadMark(readMark, identity);
  const readPending = cateringMutationIsPending(readInFlight, identity);

  const send = useMutation({
    mutationFn: async (attempt: SendAttempt) => {
      const response = await fetch(`/api/catering/bookings/${attempt.origin.bookingId}/messages`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: attempt.text, clientRequestId: attempt.clientRequestId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message || "Your message could not be sent"), { code: typeof body.code === "string" ? body.code : undefined });
      return body;
    },
    onSuccess: (_body, attempt) => {
      // Local state is the ORIGIN'S local state: an attempt from another booking is refused rather than applied to
      // whatever composer happens to be on screen.
      setComposer((current) => applyForCateringOrigin(current, attempt.origin, (state) => completeCateringMessageSend(state, attempt.clientRequestId)));
      setUnsent((current) => clearCateringUnsentMessage(current, attempt.origin));
      setSendOutcome(cateringMutationOutcome(attempt.origin, "succeeded"));
      // The caches refreshed are the ORIGINATING booking's, whether or not it is still displayed -- a completion
      // that landed after a route change must leave the booking it belongs to fresh and the one on screen alone.
      // Only this actor's own booking message and workspace caches are invalidated -- never a broad clear, and never
      // the counterpart's actor-scoped keys, which this client has no legitimate way to refresh.
      for (const queryKey of cateringOriginMessageInvalidations(attempt.origin)) cache.invalidateQueries({ queryKey });
    },
    onError: (error: Error, attempt) => {
      setComposer((current) => applyForCateringOrigin(current, attempt.origin, (state) => failCateringMessageSend(state, attempt.clientRequestId, error.message)));
      // Kept against the ORIGIN, so a booking that goes terminal mid-send can still show what was never delivered.
      setUnsent((current) => recordCateringUnsentMessage(current, attempt.origin, attempt.text));
      setSendOutcome(cateringMutationOutcome(attempt.origin, "failed", error.message));
      // A booking that closed while the composer was open means this section is stale, so the workspace is refetched.
      if (isCateringCommunicationReadOnly(error)) {
        for (const queryKey of cateringOriginMessageInvalidations(attempt.origin)) cache.invalidateQueries({ queryKey });
      }
    },
  });

  const markRead = useMutation({
    mutationFn: async (attempt: ReadAttempt) => {
      const response = await fetch(`/api/catering/bookings/${attempt.origin.bookingId}/messages/read`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lastReadMessageId: attempt.lastReadMessageId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Read state could not be saved");
      return body as { lastReadMessageId?: string | null };
    },
    onMutate: (attempt) => { setReadInFlight((current) => enterCateringMutation(current, attempt.origin)); },
    // The server's marker is monotonic and authoritative: a request that lost to a newer boundary is answered with
    // that newer one, so recording what came back keeps the client from re-attempting something already passed.
    onSuccess: (body, attempt) => {
      setReadMark((current) => applyForCateringOrigin(current, attempt.origin, (state) => completeCateringReadMark(state, body?.lastReadMessageId ?? null)));
      // The marker moved, so the originating booking's unread summary AND its message pages (which carry the
      // authoritative unread start) are both stale. Neither key can belong to any booking but the originating one.
      for (const queryKey of cateringOriginMessageInvalidations(attempt.origin)) cache.invalidateQueries({ queryKey });
    },
    onError: (_error, attempt) => setReadMark((current) => applyForCateringOrigin(current, attempt.origin, (state) => failCateringReadMark(state, attempt.lastReadMessageId))),
    onSettled: (_body, _error, attempt) => { setReadInFlight((current) => exitCateringMutation(current, attempt.origin)); },
  });

  // Any delivery of a newer message makes the workspace's unread badge stale -- and that badge is what gates
  // automatic read marking, so leaving it behind would deliver the message while suppressing the read receipt for
  // it.
  //
  // The FIRST delivery is included, and deliberately so. The parent workspace summary is fetched before this
  // component's own first message request completes, so the counterpart can send a message in between: the message
  // is then displayed while the summary that was already in hand still says zero unread. Treating the first
  // delivery as "the workspace is already current" trusted a summary that may have been observed before the
  // boundary it is supposed to describe, and later quiet polls returning that same id would never correct it --
  // the message stayed visible and unread server-side until some unrelated refocus or mutation. No unread state is
  // invented here to compensate; the authoritative summary is simply asked again.
  //
  // It is tied to `latestId` actually CHANGING, so a quiet conversation issues nothing, and it cannot loop:
  // refetching the workspace changes `unreadCount`, never `latestId`, and the watermark is recorded before the
  // request goes out.
  useEffect(() => {
    if (latestId === null || deliveredRef.current === latestId) return;
    deliveredRef.current = latestId;
    for (const queryKey of cateringOriginWorkspaceInvalidations(origin)) cache.invalidateQueries({ queryKey });
  }, [latestId]);

  // The first time this section's own endpoint reports the booking terminal, the parent workspace summary is stale
  // -- it was fetched once and does not poll. Refreshing it lets the whole workspace converge on the same answer
  // rather than only this section knowing. Latched in a ref so it fires once per newly observed transition and
  // never on the polls that follow, and it cannot loop: the workspace refetch changes the parent prop, not this
  // endpoint's answer.
  useEffect(() => {
    if (observedEditable !== false || terminalSeenRef.current) return;
    terminalSeenRef.current = true;
    for (const queryKey of cateringOriginWorkspaceInvalidations(origin)) cache.invalidateQueries({ queryKey });
  }, [observedEditable]);

  // Watches the end-of-thread sentinel, which takes TWO observations OF THAT SAME ELEMENT, and each of them has to
  // be stamped with the message boundary it was collected for.
  //
  // The two observers differ only in their root. Rooted on the scroll container, the answer is "is the end of the
  // list inside the thread's own viewport" -- necessary but nowhere near sufficient, because any thread short
  // enough not to scroll satisfies it permanently, wherever the container itself happens to be. Rooted on the
  // document, the answer is "is the end of the list inside the browser viewport".
  //
  // The second observer must watch the SENTINEL, not the container. Observing the container was not enough: a
  // reader scrolled to the bottom of a tall thread whose top edge has just scrolled into view makes the container
  // intersect the document viewport while the sentinel is still physically below the fold. Both halves read true
  // and the newest message was recorded viewed without ever being on screen. Only the sentinel's own position
  // answers the question that is actually being asked.
  //
  // Both being true is still not enough, because a boolean does not record WHAT it saw. So each callback stamps its
  // observation with the `latestId` it closed over, and an observation for a different boundary discards the
  // evidence held for the old one. That is what stops evidence collected while message A was the newest from
  // authorizing message B, which arrives asynchronously and may well have pushed the sentinel out of view.
  //
  // Re-creating both observers whenever `latestId` OR the rendered page set changes is what supplies the fresh
  // evidence: `observe()` always delivers an initial observation, so a reader genuinely sitting at the bottom gets
  // a new positive and a reader pushed below the fold gets a negative instead. Both are disconnected on cleanup, so
  // neither an old observer nor a record queued by one survives into the new rendering. Scroll restoration keeps
  // the reader's visual position after a prepend, but it produces no evidence of its own -- only what the
  // re-created observers report about the thread as it now stands counts.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const thread = threadRef.current;
    // The container is required as the first observer's ROOT. Without it that observer would silently fall back to
    // the document and both would answer the same question, so an absent container fails closed instead.
    if (!sentinel || !thread || typeof IntersectionObserver === "undefined") return;
    const threadRootObserver = new IntersectionObserver((entries) => {
      setVisibility((current) => recordCateringSentinelVisibility(current, generation, entries.some((entry) => entry.isIntersecting)));
    }, { root: thread, threshold: 0.01 });
    const viewportObserver = new IntersectionObserver((entries) => {
      setVisibility((current) => recordCateringViewportVisibility(current, generation, entries.some((entry) => entry.isIntersecting)));
    }, { root: null, threshold: 0.01 });
    threadRootObserver.observe(sentinel);
    viewportObserver.observe(sentinel);
    // One observer for the messages themselves, rooted on the DOCUMENT. Intersection against a null root is clipped
    // by every scrollable ancestor, so a message reported here was visible through the thread container as well as
    // on screen -- both conditions at once, without a second observer per message. The threshold matches the
    // sentinels' 0.01: a message taller than the viewport can never be fully visible, so requiring more would make
    // a long message impossible to traverse rather than merely hard.
    const coverageObserver = new IntersectionObserver((entries) => {
      const seen = entries.filter((entry) => entry.isIntersecting).map((entry) => (entry.target as HTMLElement).dataset.messageId).filter((id): id is string => Boolean(id));
      if (seen.length > 0) setVisibility((current) => recordCateringMessageCoverage(current, generation, seen));
    }, { root: null, threshold: 0.01 });
    // Only what is rendered is observed, so the observer count is bounded by the loaded pages rather than by the
    // conversation's whole history, and everything is disconnected together below.
    messageNodes.current.forEach((node) => coverageObserver.observe(node));
    return () => {
      threadRootObserver.disconnect();
      viewportObserver.disconnect();
      coverageObserver.disconnect();
    };
  }, [latestId, pageKey, unreadStartId, messages.length]);

  // The boundary advances only while BOTH observations hold, both were collected for this exact `latestId`, AND
  // there is no older page still unfetched. Asking the visibility question about a named boundary rather than in
  // the abstract is what makes a change of `latestId` invalidate prior evidence immediately, in the same render,
  // rather than waiting for an observer to report false. The pagination condition is the separate one: the read
  // marker is chronological, so recording the newest loaded id while older pages are unfetched would sweep unread
  // messages nobody has rendered behind the boundary. Nothing is auto-fetched to satisfy it.
  useEffect(() => {
    if (!mayRecordCateringViewedBoundary(visibility, generation, hasOlderPages, unreadStart, messages)) return;
    setViewed((current) => recordCateringViewedBoundary(current, latestId));
  }, [visibility, latestId, hasOlderPages, pageKey, unreadStartId, unreadStart.kind]);

  // Marking read happens at most ONCE per boundary, and only for a boundary the actor has actually been shown.
  // The attempted boundary is recorded before the request goes out, so a failure cannot re-fire this effect:
  // without that, a failed mark leaves unreadCount above zero and the marker unmoved, and the mutation returning to
  // idle would immediately reissue the same request forever. A newly displayed message is a new boundary and earns
  // its own single attempt, so a failure blocks nothing later.
  useEffect(() => {
    // "Pending" is asked about THIS booking. A receipt still in flight for a booking the participant has navigated
    // away from says nothing about whether this one may be marked.
    if (readPending) return;
    if (!shouldAutoMarkCateringConversationRead(ownReadMark, viewedId, unreadCount)) return;
    setReadMark((current) => startCateringReadMark(hydrateCateringReadMark(current, identity), viewedId!));
    markRead.mutate({ origin, lastReadMessageId: viewedId! });
  }, [viewedId, ownReadMark, unreadCount, readPending, identity]);

  // Restore the reading position after older messages are prepended, so "load older" does not jump the thread.
  useEffect(() => {
    const container = threadRef.current;
    const previousHeight = restoreRef.current;
    if (container && previousHeight !== null && !query.isFetchingNextPage) {
      container.scrollTop += container.scrollHeight - previousHeight;
      restoreRef.current = null;
    }
  }, [messages.length, query.isFetchingNextPage]);

  const loadOlder = () => {
    restoreRef.current = threadRef.current?.scrollHeight ?? null;
    query.fetchNextPage();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Guarded here as well as by the control, so no send can be initiated once the endpoint has reported the
    // booking terminal -- whatever a stale parent prop still says.
    if (!maySendCateringMessage(ownComposer, canSend)) return;
    const started = startCateringMessageSend(ownComposer, crypto.randomUUID());
    if (!started) return;
    setComposer(started.next);
    setSendOutcome(null);
    send.mutate({ origin, ...started.payload });
  };
  const retry = () => {
    if (!canSend) return;
    const retried = retryCateringMessageSend(ownComposer);
    if (!retried) return;
    setComposer(retried.next);
    setSendOutcome(null);
    send.mutate({ origin, ...retried.payload });
  };
  const pending = ownComposer.pending;
  // Only an outcome recorded for THIS booking may be announced here.
  const outcome = visibleCateringMutationOutcome(sendOutcome, identity);
  // What was typed or submitted and has not been delivered, as it applies to this booking. The attempt's own text
  // wins while it exists; the per-booking record is what survives a navigation away and back.
  const unsentText = pending?.text ?? cateringUnsentMessage(unsent, identity);
  const typedText = ownComposer.text.trim();

  return <Card id="communication"><CardHeader><CardTitle>Communication</CardTitle><CardDescription>Messages about this booking stay with this booking. They are separate from your ordinary direct messages.</CardDescription></CardHeader><CardContent className="space-y-4">
    {query.isLoading && <p role="status">Loading messages…</p>}
    {query.isError && !query.isLoading && <div className="space-y-2" role="alert"><p>Messages could not be loaded.</p><Button variant="outline" className="min-h-11" onClick={() => query.refetch()}>Retry loading messages</Button></div>}
    {!query.isLoading && !query.isError && <>
      {query.hasNextPage && <Button variant="outline" className="min-h-11 w-full sm:w-auto" disabled={query.isFetchingNextPage} onClick={loadOlder}>{query.isFetchingNextPage ? "Loading older messages…" : "Load older messages"}</Button>}
      {messages.length === 0
        ? <p className="text-muted-foreground">{CATERING_COMMUNICATION_EMPTY}</p>
        : <div ref={threadRef} className="max-h-96 overflow-y-auto overflow-x-hidden">
            <ol className="space-y-3">{messages.map((item) => <li key={item.id} data-message-id={item.id} ref={(node) => {
              // The element each message is observed through. Registered as it mounts and dropped as it unmounts,
              // so nothing outside the rendered pages is ever observed and no detached node is retained.
              if (node) messageNodes.current.set(item.id, node); else messageNodes.current.delete(item.id);
            }} className="min-w-0 rounded-lg border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="break-words font-medium">{item.mine ? "You" : item.senderName || (item.senderRole === "provider" ? "Your caterer" : "Your customer")}</p>
                <time className="text-sm text-muted-foreground" dateTime={item.createdAt}>{formatCateringMessageTimestamp(item.createdAt)}</time>
              </div>
              {/* `break-words` plus `min-w-0` is what keeps a long URL or an unbroken word inside the card on a phone. */}
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.text}</p>
            </li>)}</ol>
            {/* Presentational only and never focusable or announced: its sole job is to tell the observer that the
                end of the thread is on screen. */}
            <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
          </div>}
    </>}
    {query.isFetchNextPageError && <div className="space-y-2" role="alert"><p>Older messages could not be loaded.</p><Button variant="outline" className="min-h-11" disabled={query.isFetchingNextPage} onClick={loadOlder}>Retry loading older messages</Button></div>}
    {/* A failed read receipt is low stakes, so it is reported quietly rather than as an alert -- but it is reported,
        because silently leaving the unread badge on with no explanation is worse. Retry issues exactly one request. */}
    {mayRetryCateringReadMark(ownReadMark, viewedId, unreadCount) && <div className="flex flex-wrap items-center gap-2" role="status">
      <p className="text-sm text-muted-foreground">These messages could not be marked as read.</p>
      <Button type="button" variant="outline" className="min-h-11" disabled={readPending} onClick={() => setReadMark((current) => retryCateringReadMark(hydrateCateringReadMark(current, identity)))}>Mark as read</Button>
    </div>}
    {canSend
      ? <form className="space-y-2" onSubmit={submit}>
          <Label htmlFor="catering-message">Message your {role === "provider" ? "customer" : "caterer"}</Label>
          {/* Deliberately editable while a send is in flight and after one fails. The attempt holds its own text, and
              a send only clears this box when it still holds exactly what was submitted, so nothing typed here is
              ever destroyed by an attempt resolving. */}
          <Textarea id="catering-message" className="min-h-24" rows={3} value={ownComposer.text}
            onChange={(event) => setComposer((current) => editCateringComposer(hydrateCateringComposer(current, identity), event.target.value))} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={!maySendCateringMessage(ownComposer, canSend)}>Send message</Button>
            {pending?.status === "failed" && <>
              <Button type="button" variant="outline" className="min-h-11" onClick={retry}>Try again</Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => { setComposer(discardCateringMessageSend(ownComposer)); setUnsent((current) => clearCateringUnsentMessage(current, origin)); }}>Discard unsent message</Button>
            </>}
          </div>
          {/* One live region carries every send outcome, so a screen reader hears the result without moving focus. */}
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {pending?.status === "sending" ? "Sending your message…" : outcome?.status === "succeeded" && !pending ? "Message sent." : ""}
          </p>
          {pending?.status === "failed" && <div role="alert" className="space-y-1 rounded-md border border-destructive p-3">
            <p className="text-destructive">{pending.error}</p>
            {/* Naming the unsent text matters once the composer can hold something else: "Try again" sends this, and
                anything typed above is left exactly as it is. */}
            <p className="text-sm">Try again resends this unsent message, so it cannot be posted twice:</p>
            <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">“{pending.text}”</p>
            {typedText !== pending.text && <p className="text-sm">What you have typed above is kept separately and is not affected.</p>}
          </div>}
        </form>
      : <div className="space-y-3">
          <p className="font-medium">{CATERING_COMMUNICATION_READ_ONLY_BANNER}</p>
          {/* A send can lose a race with the counterpart cancelling or completing the booking. The server is right
              to refuse it, but replacing the whole composer with the banner used to take the refused text away with
              it -- visible one moment, unrecoverable the next, and gone for good on reload. It is shown here
              read-only instead: no Send, no Try again, nothing that could reissue a write the booking no longer
              accepts, and nothing persisted. It is the participant's own words, kept where they can copy them. */}
          {unsentText !== null && <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="catering-unsent-message">Unsent message</Label>
            <p className="text-sm">This booking closed before this message could be sent, so it was never delivered and cannot be sent now. Copy anything you want to keep — it is not saved anywhere.</p>
            <Textarea id="catering-unsent-message" className="min-h-24" rows={3} readOnly value={unsentText} />
          </div>}
          {typedText !== "" && typedText !== unsentText && <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="catering-unsent-draft">Unsent draft</Label>
            <p className="text-sm">This was still in the message box when the booking closed. It was never sent.</p>
            <Textarea id="catering-unsent-draft" className="min-h-24" rows={3} readOnly value={ownComposer.text} />
          </div>}
        </div>}
  </CardContent></Card>;
}
