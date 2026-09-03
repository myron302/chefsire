import { FormEvent, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cateringBookingMessagesKey, type CateringBookingMessagePageView } from "@shared/catering-booking-communication";
import { cateringBookingWorkspaceKey } from "@shared/catering-booking-operations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATERING_COMMUNICATION_EMPTY, CATERING_COMMUNICATION_READ_ONLY_BANNER, EMPTY_CATERING_COMPOSER, combineCateringMessagePages, completeCateringMessageSend, discardCateringMessageSend, editCateringComposer, failCateringMessageSend, formatCateringMessageTimestamp, hydrateCateringComposer, isCateringCommunicationReadOnly, latestCateringMessageId, maySendCateringMessage, mayRetryCateringReadMark, nextCateringMessageCursor, retryCateringMessageSend, retryCateringReadMark, shouldAutoMarkCateringConversationRead, startCateringMessageSend, startCateringReadMark, completeCateringReadMark, failCateringReadMark, hydrateCateringReadMark, hydrateCateringViewed, recordCateringViewedBoundary, cateringReadableBoundary, cateringThreadEndIsOnScreen, recordCateringSentinelVisibility, recordCateringThreadVisibility, EMPTY_CATERING_READ_MARK, EMPTY_CATERING_VIEWED, EMPTY_CATERING_THREAD_VISIBILITY, type CateringComposerState, type CateringReadMarkState, type CateringThreadVisibility, type CateringViewedState } from "@/pages/services/catering-booking-communication-state";

type SendPayload = { text: string; clientRequestId: string };
/**
 * The booking Communication section. It lives inside the Phase 2H workspace rather than in a second dashboard, and
 * it addresses the booking-scoped API only: no thread id is ever part of its navigation or its cache keys.
 */
export default function BookingCommunication({ bookingId, userId, role, editable, unreadCount }: { bookingId: string; userId: string; role: "provider" | "customer"; editable: boolean; unreadCount: number }) {
  const cache = useQueryClient();
  const identity = `${userId}:${bookingId}`;
  const [composer, setComposer] = useState<CateringComposerState>(EMPTY_CATERING_COMPOSER);
  const [readMark, setReadMark] = useState<CateringReadMarkState>(EMPTY_CATERING_READ_MARK);
  const [viewed, setViewed] = useState<CateringViewedState>(EMPTY_CATERING_VIEWED);
  // Both halves of "the end of the thread is on screen", tracked separately because they change independently:
  // scrolling the page moves the container, scrolling the thread moves the sentinel within it.
  const [visibility, setVisibility] = useState<CateringThreadVisibility>(EMPTY_CATERING_THREAD_VISIBILITY);
  // Marks the end of the thread. When it is on screen the newest loaded message is genuinely displayed, which is
  // the only thing that may advance the read boundary -- fetching a page is not reading it.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // The scroll container's height before an older page loads, so restoring position after it lands is arithmetic
  // rather than a guess: prepending older messages must not move what the participant is currently reading.
  const threadRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<number | null>(null);
  const messagesKey = cateringBookingMessagesKey(userId, bookingId);

  useEffect(() => { setComposer((current) => hydrateCateringComposer(current, identity)); setReadMark((current) => hydrateCateringReadMark(current, identity)); setViewed((current) => hydrateCateringViewed(current, identity)); setVisibility(EMPTY_CATERING_THREAD_VISIBILITY); }, [identity]);

  const query = useInfiniteQuery({
    queryKey: messagesKey,
    initialPageParam: undefined as string | undefined,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async ({ pageParam }): Promise<CateringBookingMessagePageView> => {
      const search = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : "";
      const response = await fetch(`/api/catering/bookings/${bookingId}/messages${search}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message || "Messages could not be loaded"), { code: typeof body.code === "string" ? body.code : undefined });
      return body;
    },
    getNextPageParam: (lastPage) => nextCateringMessageCursor(lastPage),
  });

  const messages = combineCateringMessagePages(query.data?.pages ?? []);
  const latestId = latestCateringMessageId(messages);
  // The boundary a read mark may use: the newest message actually shown, never the newest one fetched.
  const viewedId = cateringReadableBoundary(viewed, identity);

  const send = useMutation({
    mutationFn: async (payload: SendPayload) => {
      const response = await fetch(`/api/catering/bookings/${bookingId}/messages`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message || "Your message could not be sent"), { code: typeof body.code === "string" ? body.code : undefined });
      return body;
    },
    onSuccess: (_body, payload) => {
      setComposer((current) => completeCateringMessageSend(current, payload.clientRequestId));
      // Only this actor's own booking message and workspace caches are invalidated -- never a broad clear, and never
      // the counterpart's actor-scoped keys, which this client has no legitimate way to refresh.
      cache.invalidateQueries({ queryKey: messagesKey });
      cache.invalidateQueries({ queryKey: cateringBookingWorkspaceKey(userId, bookingId) });
    },
    onError: (error: Error, payload) => {
      setComposer((current) => failCateringMessageSend(current, payload.clientRequestId, error.message));
      // A booking that closed while the composer was open means this section is stale, so the workspace is refetched.
      if (isCateringCommunicationReadOnly(error)) {
        cache.invalidateQueries({ queryKey: messagesKey });
        cache.invalidateQueries({ queryKey: cateringBookingWorkspaceKey(userId, bookingId) });
      }
    },
  });

  const markRead = useMutation({
    mutationFn: async (lastReadMessageId: string) => {
      const response = await fetch(`/api/catering/bookings/${bookingId}/messages/read`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lastReadMessageId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Read state could not be saved");
      return body as { lastReadMessageId?: string | null };
    },
    // The server's marker is monotonic and authoritative: a request that lost to a newer boundary is answered with
    // that newer one, so recording what came back keeps the client from re-attempting something already passed.
    onSuccess: (body) => { setReadMark((current) => completeCateringReadMark(current, body?.lastReadMessageId ?? null)); cache.invalidateQueries({ queryKey: cateringBookingWorkspaceKey(userId, bookingId) }); },
    onError: (_error, attemptedId) => setReadMark((current) => failCateringReadMark(current, attemptedId)),
  });

  // Watches the end of the thread, which takes TWO observations rather than one.
  //
  // The sentinel observer roots on the scroll container, so it answers "is the end of the list inside the thread's
  // own viewport". That is necessary but nowhere near sufficient: any thread short enough not to scroll satisfies
  // it permanently, wherever the container itself happens to be. Communication sits below several other workspace
  // sections, so on a phone that is routinely far below the fold -- and marking read on the container test alone
  // reported messages as read that had never been on screen.
  //
  // The thread observer supplies the missing half by watching the container against the document viewport, with a
  // null root. Only the conjunction advances the boundary. Both are re-created when the thread mounts or its
  // contents change so neither ever watches a stale node, and both are disconnected on cleanup.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const thread = threadRef.current;
    if (!sentinel || !thread || typeof IntersectionObserver === "undefined") return;
    const sentinelObserver = new IntersectionObserver((entries) => {
      setVisibility((current) => recordCateringSentinelVisibility(current, entries.some((entry) => entry.isIntersecting)));
    }, { root: threadRef.current ?? null, threshold: 0.01 });
    const threadObserver = new IntersectionObserver((entries) => {
      setVisibility((current) => recordCateringThreadVisibility(current, entries.some((entry) => entry.isIntersecting)));
    }, { root: null, threshold: 0.01 });
    sentinelObserver.observe(sentinel);
    threadObserver.observe(thread);
    return () => { sentinelObserver.disconnect(); threadObserver.disconnect(); };
  }, [latestId, messages.length]);

  // The boundary advances only while BOTH observations hold. Neither one alone is evidence the participant saw
  // anything, and an environment that reports neither leaves the messages unread rather than falsely read.
  useEffect(() => {
    if (!cateringThreadEndIsOnScreen(visibility)) return;
    setViewed((current) => recordCateringViewedBoundary(current, latestId));
  }, [visibility, latestId]);

  // Marking read happens at most ONCE per boundary, and only for a boundary the actor has actually been shown.
  // The attempted boundary is recorded before the request goes out, so a failure cannot re-fire this effect:
  // without that, a failed mark leaves unreadCount above zero and the marker unmoved, and the mutation returning to
  // idle would immediately reissue the same request forever. A newly displayed message is a new boundary and earns
  // its own single attempt, so a failure blocks nothing later.
  useEffect(() => {
    if (markRead.isPending) return;
    if (!shouldAutoMarkCateringConversationRead(readMark, viewedId, unreadCount)) return;
    setReadMark((current) => startCateringReadMark(current, viewedId!));
    markRead.mutate(viewedId!);
  }, [viewedId, readMark, unreadCount, markRead.isPending]);

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
    const started = startCateringMessageSend(composer, crypto.randomUUID());
    if (!started) return;
    setComposer(started.next);
    send.mutate(started.payload);
  };
  const retry = () => {
    const retried = retryCateringMessageSend(composer);
    if (!retried) return;
    setComposer(retried.next);
    send.mutate(retried.payload);
  };
  const pending = composer.pending;

  return <Card id="communication"><CardHeader><CardTitle>Communication</CardTitle><CardDescription>Messages about this booking stay with this booking. They are separate from your ordinary direct messages.</CardDescription></CardHeader><CardContent className="space-y-4">
    {query.isLoading && <p role="status">Loading messages…</p>}
    {query.isError && !query.isLoading && <div className="space-y-2" role="alert"><p>Messages could not be loaded.</p><Button variant="outline" className="min-h-11" onClick={() => query.refetch()}>Retry loading messages</Button></div>}
    {!query.isLoading && !query.isError && <>
      {query.hasNextPage && <Button variant="outline" className="min-h-11 w-full sm:w-auto" disabled={query.isFetchingNextPage} onClick={loadOlder}>{query.isFetchingNextPage ? "Loading older messages…" : "Load older messages"}</Button>}
      {messages.length === 0
        ? <p className="text-muted-foreground">{CATERING_COMMUNICATION_EMPTY}</p>
        : <div ref={threadRef} className="max-h-96 overflow-y-auto overflow-x-hidden">
            <ol className="space-y-3">{messages.map((item) => <li key={item.id} className="min-w-0 rounded-lg border p-3">
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
    {mayRetryCateringReadMark(readMark, viewedId, unreadCount) && <div className="flex flex-wrap items-center gap-2" role="status">
      <p className="text-sm text-muted-foreground">These messages could not be marked as read.</p>
      <Button type="button" variant="outline" className="min-h-11" disabled={markRead.isPending} onClick={() => setReadMark(retryCateringReadMark)}>Mark as read</Button>
    </div>}
    {editable
      ? <form className="space-y-2" onSubmit={submit}>
          <Label htmlFor="catering-message">Message your {role === "provider" ? "customer" : "caterer"}</Label>
          {/* Deliberately editable while a send is in flight and after one fails. The attempt holds its own text, and
              a send only clears this box when it still holds exactly what was submitted, so nothing typed here is
              ever destroyed by an attempt resolving. */}
          <Textarea id="catering-message" className="min-h-24" rows={3} value={composer.text}
            onChange={(event) => setComposer((current) => editCateringComposer(current, event.target.value))} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={!maySendCateringMessage(composer, editable)}>Send message</Button>
            {pending?.status === "failed" && <>
              <Button type="button" variant="outline" className="min-h-11" onClick={retry}>Try again</Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setComposer(discardCateringMessageSend(composer))}>Discard unsent message</Button>
            </>}
          </div>
          {/* One live region carries every send outcome, so a screen reader hears the result without moving focus. */}
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {pending?.status === "sending" ? "Sending your message…" : send.isSuccess && !pending ? "Message sent." : ""}
          </p>
          {pending?.status === "failed" && <div role="alert" className="space-y-1 rounded-md border border-destructive p-3">
            <p className="text-destructive">{pending.error}</p>
            {/* Naming the unsent text matters once the composer can hold something else: "Try again" sends this, and
                anything typed above is left exactly as it is. */}
            <p className="text-sm">Try again resends this unsent message, so it cannot be posted twice:</p>
            <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">“{pending.text}”</p>
            {composer.text.trim() !== pending.text && <p className="text-sm">What you have typed above is kept separately and is not affected.</p>}
          </div>}
        </form>
      : <p className="font-medium">{CATERING_COMMUNICATION_READ_ONLY_BANNER}</p>}
  </CardContent></Card>;
}
