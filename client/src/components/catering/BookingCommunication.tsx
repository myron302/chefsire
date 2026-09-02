import { FormEvent, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cateringBookingMessagesKey, type CateringBookingMessagePageView } from "@shared/catering-booking-communication";
import { cateringBookingWorkspaceKey } from "@shared/catering-booking-operations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATERING_COMMUNICATION_EMPTY, CATERING_COMMUNICATION_READ_ONLY_BANNER, EMPTY_CATERING_COMPOSER, combineCateringMessagePages, completeCateringMessageSend, discardCateringMessageSend, editCateringComposer, failCateringMessageSend, formatCateringMessageTimestamp, hydrateCateringComposer, isCateringCommunicationReadOnly, latestCateringMessageId, maySendCateringMessage, nextCateringMessageCursor, retryCateringMessageSend, shouldMarkCateringConversationRead, startCateringMessageSend, type CateringComposerState } from "@/pages/services/catering-booking-communication-state";

type SendPayload = { text: string; clientRequestId: string };
/**
 * The booking Communication section. It lives inside the Phase 2H workspace rather than in a second dashboard, and
 * it addresses the booking-scoped API only: no thread id is ever part of its navigation or its cache keys.
 */
export default function BookingCommunication({ bookingId, userId, role, editable, unreadCount }: { bookingId: string; userId: string; role: "provider" | "customer"; editable: boolean; unreadCount: number }) {
  const cache = useQueryClient();
  const identity = `${userId}:${bookingId}`;
  const [composer, setComposer] = useState<CateringComposerState>(EMPTY_CATERING_COMPOSER);
  const [markedId, setMarkedId] = useState<string | null>(null);
  // The scroll container's height before an older page loads, so restoring position after it lands is arithmetic
  // rather than a guess: prepending older messages must not move what the participant is currently reading.
  const threadRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<number | null>(null);
  const messagesKey = cateringBookingMessagesKey(userId, bookingId);

  useEffect(() => { setComposer((current) => hydrateCateringComposer(current, identity)); setMarkedId(null); }, [identity]);

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
      if (!response.ok) throw new Error("Read state could not be saved");
      return response.json().catch(() => ({}));
    },
    onSuccess: (_body, lastReadMessageId) => { setMarkedId(lastReadMessageId); cache.invalidateQueries({ queryKey: cateringBookingWorkspaceKey(userId, bookingId) }); },
  });

  // Simply having the conversation open marks it read once, and only while something is actually unread.
  useEffect(() => {
    if (!markRead.isPending && shouldMarkCateringConversationRead(latestId, markedId, unreadCount)) markRead.mutate(latestId!);
  }, [latestId, markedId, unreadCount, markRead.isPending]);

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
          </div>}
    </>}
    {query.isFetchNextPageError && <div className="space-y-2" role="alert"><p>Older messages could not be loaded.</p><Button variant="outline" className="min-h-11" disabled={query.isFetchingNextPage} onClick={loadOlder}>Retry loading older messages</Button></div>}
    {editable
      ? <form className="space-y-2" onSubmit={submit}>
          <Label htmlFor="catering-message">Message your {role === "provider" ? "customer" : "caterer"}</Label>
          <Textarea id="catering-message" className="min-h-24" rows={3} value={composer.text} disabled={pending?.status === "sending"}
            onChange={(event) => setComposer((current) => editCateringComposer(current, event.target.value))} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={!maySendCateringMessage(composer, editable)}>Send message</Button>
            {pending?.status === "failed" && <>
              <Button type="button" variant="outline" className="min-h-11" onClick={retry}>Try again</Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setComposer(discardCateringMessageSend(composer))}>Discard</Button>
            </>}
          </div>
          {/* One live region carries every send outcome, so a screen reader hears the result without moving focus. */}
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {pending?.status === "sending" ? "Sending your message…" : send.isSuccess && !pending ? "Message sent." : ""}
          </p>
          {pending?.status === "failed" && <p role="alert" className="text-destructive">{pending.error} Your message was kept — try again sends the same message, so you will not post it twice.</p>}
        </form>
      : <p className="font-medium">{CATERING_COMMUNICATION_READ_ONLY_BANNER}</p>}
  </CardContent></Card>;
}
