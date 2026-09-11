import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Download, Star } from "lucide-react";
import {
  CATERING_CLOSEOUT_CANCELLED_NOTICE,
  CATERING_CLOSEOUT_ITEM_STATES,
  CATERING_CLOSEOUT_ITEM_STATE_LABELS,
  CATERING_CLOSEOUT_NOTES_MAXIMUM,
  CATERING_CLOSEOUT_ITEM_NOTE_MAXIMUM,
  CATERING_CLOSEOUT_PENDING_NOTICE,
  CATERING_CLOSEOUT_PROVIDER_PENDING_NOTICE,
  CATERING_CLOSEOUT_SECTION,
  CATERING_CLOSEOUT_STATE_LABELS,
  cateringBookingCloseoutKey,
  cateringBookingCloseoutPath,
  type CateringBookingCloseoutView,
  type CateringCloseoutItemKey,
  type CateringCloseoutItemState,
  type CateringCloseoutItemView,
} from "@shared/catering-booking-closeout";
import { cateringWorkspacePollInterval } from "@shared/catering-booking-operations";
import { formatCateringFileSize } from "@shared/catering-booking-files";
// The EXISTING Phase 2I authorized download address. Reused rather than restated, so there is exactly one route to
// a booking document's bytes and it re-derives the booking, the participant and the visibility on every request.
import { cateringFileDownloadPath } from "@/pages/services/catering-booking-files-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  activeCateringCloseoutEditor,
  adoptCateringCloseoutVersions,
  cateringCloseoutCompletePayload,
  cateringCloseoutEditorFor,
  cateringCloseoutFailureNotice,
  cateringCloseoutFormIsCurrent,
  cateringCloseoutItemPayload,
  cateringCloseoutNotesPayload,
  cateringCloseoutProgress,
  cateringCloseoutRebasedChecklist,
  cateringCloseoutRebasedRecord,
  cateringCloseoutReopenPayload,
  cateringCloseoutVersionsFromResponse,
  cateringCloseoutSignalVariant,
  cateringCloseoutStateVariant,
  editCateringCloseoutEditor,
  editCateringCloseoutForm,
  emptyCateringCloseoutForm,
  formatCateringCloseoutInstant,
  hydrateCateringCloseoutForm,
  isCateringCloseoutConflict,
  markCateringCloseoutEditorConflict,
  markCateringCloseoutFormConflict,
  mayEditCateringCloseoutNotes,
  mayReloadCateringCloseoutEditor,
  maySubmitCateringCloseoutEditor,
  reconcileCateringCloseoutEditor,
  settleCateringCloseoutEditor,
  settleCateringCloseoutForm,
  shouldRefetchCloseoutAfterError,
  EMPTY_CATERING_CLOSEOUT_VERSIONS,
  type CateringCloseoutError,
  type CateringCloseoutFormState,
  type CateringCloseoutItemEditorState,
  type CateringCloseoutVersions,
  type OpenCateringCloseoutItemEditor,
} from "@/pages/services/catering-booking-closeout-state";

/**
 * The Phase 2K post-event closeout section of the booking workspace.
 *
 * WHAT IT IS. Once an event has actually been served, the workspace stops being about preparing and executing and
 * becomes about wrapping up. This section is that: for a provider, the checklist of what is still outstanding, the
 * shared documents that were delivered, their own private notes, and the action that records the operational
 * wrap-up as finished. For a customer, whether the event is closed out, what is still waiting on them, the
 * documents they can download, the existing review flow, and a truthful way to work with this caterer again.
 *
 * WHAT IT IS NOT. It is not a second booking status: `closed_out` is operational, the booking stays `completed`,
 * and nothing here can move a lifecycle. It is not a payment surface: ChefSire has no catering invoice, deposit,
 * final-payment or refund system, so no balance, receipt, charge or amount is shown, and a "final invoice" is
 * nothing more than a real file someone actually uploaded. It is not a second messaging system, a second upload
 * system, a second review system or a second rental ledger: every one of those is the existing one, linked to.
 *
 * MOBILE. Every control is at least 44px tall, every list is one column that wraps rather than scrolling sideways,
 * the checklist state is a row of plain buttons rather than a dropdown in a dialog, and nothing here is a table.
 *
 * PRIVACY. A customer's payload contains no checklist, no provider note, no incident, no record version and no
 * provider-private equipment, because the server never serialized them. This component renders what it was given;
 * it does not filter secrets out of a fuller response.
 */
export default function BookingCloseout({ bookingId, userId, role }: { bookingId: string; userId: string; role: "provider" | "customer" }) {
  const cache = useQueryClient();
  const identity = `${userId}:${bookingId}`;
  const key = cateringBookingCloseoutKey(userId, bookingId);
  const provider = role === "provider";

  const [notesForm, setNotesForm] = useState<CateringCloseoutFormState<string>>(emptyCateringCloseoutForm(""));
  const [editor, setEditor] = useState<CateringCloseoutItemEditorState>(null);
  const [notice, setNotice] = useState<{ message: string; retryable: boolean } | null>(null);
  /**
   * The freshest authoritative versions an accepted mutation has returned.
   *
   * Booking-local like every other piece of state here, and reset on navigation with the rest. It exists so that a
   * version the server minted for one of OUR OWN accepted writes is used by the next write immediately, rather than
   * only once the invalidated query has refetched -- see `CateringCloseoutVersions` for the race that opens.
   */
  const [versions, setVersions] = useState<CateringCloseoutVersions>(EMPTY_CATERING_CLOSEOUT_VERSIONS);

  const query = useQuery({
    queryKey: key,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    // The same cadence constant every other workspace section uses. It stops once closeout is recorded complete,
    // because a closed-out booking's closeout is settled and re-asking forever would be pure traffic. Reading never
    // closes -- the query still loads and still refetches on focus.
    refetchInterval: (polled: { state: { data?: CateringBookingCloseoutView } }) =>
      cateringWorkspacePollInterval(Boolean(polled.state.data?.eventServiceOccurred) && !polled.state.data?.closeout.closedOut),
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<CateringBookingCloseoutView> => {
      const response = await fetch(cateringBookingCloseoutPath(bookingId), { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message || "The closeout view could not be loaded"), { code: typeof body.code === "string" ? body.code : undefined });
      return body;
    },
  });
  const closeout = query.data;
  // The section's OWN authoritative reading of whether closeout may be acted on, re-derived by the endpoint from
  // the persisted booking on every request. The parent workspace summary is fetched once and does not poll, so
  // trusting it alone would present a booking as actionable until a failed save revealed otherwise.
  const actionable = Boolean(closeout?.actionable);

  /**
   * The booking on screen, synchronized during RENDER.
   *
   * This ref is the guard every async completion is measured against, so it has to be current the instant the new
   * booking is committed. A passive effect flushes AFTER the commit, which leaves a window in which booking B is
   * displayed while the ref still says A -- and a response for A landing in that window would be accepted as
   * belonging to the workspace on screen and could settle A's success or A's conflict into B's notes form, item
   * editor or notice. That is the exact defect Phase 2J ended on, and this section is built with the fix from its
   * first line rather than after one.
   *
   * The assignment is idempotent (it writes the identity this render is FOR), so repeating it is harmless. A render
   * discarded before commit can only leave the ref on a booking that is not displayed, which makes `settlesHere`
   * refuse -- the safe direction, because refusing costs nothing: the originating booking's queries are invalidated
   * by ORIGIN regardless, and only local form state is left alone.
   */
  const identityRef = useRef(identity);
  identityRef.current = identity;

  /**
   * The booking the notes form, the open editor and the notice currently belong to.
   *
   * STATE rather than a ref, because render has to be able to ask the question. The reset below is a passive effect
   * -- it sets state, so it cannot move into render -- and passive effects flush after the commit, which leaves one
   * committed render of booking B in which this state still holds booking A's half-written note. Read from a ref, a
   * render could not react to that changing; read from state, the guard below is an ordinary reactive value and the
   * stale window is simply inert.
   *
   * It cannot loop: the effect returns immediately once the two agree, and the only thing that makes them disagree
   * is a genuine navigation.
   */
  const [localIdentity, setLocalIdentity] = useState(identity);
  useEffect(() => {
    if (localIdentity === identity) return;
    setLocalIdentity(identity);
    setNotesForm(emptyCateringCloseoutForm(""));
    setEditor(null);
    setNotice(null);
    setVersions(EMPTY_CATERING_CLOSEOUT_VERSIONS);
  }, [identity, localIdentity]);
  const localStateIsCurrent = localIdentity === identity;

  // Hydrate the notes form from the authoritative payload. A dirty form is left alone so a poll cannot replace
  // unsaved writing; a form refused as stale keeps its text and takes the fresh version to submit against.
  const persistedNotes = closeout?.closeout.providerNotes ?? "";
  useEffect(() => {
    if (!closeout || !provider) return;
    setNotesForm((current) => hydrateCateringCloseoutForm(current, identity, persistedNotes));
  }, [identity, provider, persistedNotes, Boolean(closeout)]);
  // An editor open on a booking that is no longer actionable, or that belongs to another booking, closes.
  useEffect(() => {
    setEditor((current) => reconcileCateringCloseoutEditor(current, identity, actionable));
  }, [identity, actionable]);

  /**
   * The booking that STARTED a request, captured at submission time.
   *
   * This component stays mounted across a booking change -- only the route parameter moves -- so a callback reading
   * `identity`, `key` or `userId` from render scope would describe whichever booking was on screen when the
   * response landed, not the one that issued it. Every mutation therefore carries its own origin, every completion
   * invalidates the ORIGINATING booking's queries, and local form state is settled only when the origin is still
   * what is on screen.
   */
  type CloseoutOrigin = { identity: string; bookingId: string; userId: string };
  type CloseoutMutation = {
    origin: CloseoutOrigin;
    path: string; method: string; body?: unknown;
    settle?: "item" | "notes";
    itemKey?: CateringCloseoutItemKey;
    /** The EXACT values this request was built from, so a completion settles what it accounts for and nothing else. */
    submittedItem?: { identity: string; key: CateringCloseoutItemKey; state: CateringCloseoutItemState; note: string };
    submittedNotes?: string;
  };
  const origin = (): CloseoutOrigin => ({ identity, bookingId, userId });
  /** Whether a completion belongs to the booking currently on screen, read from the render-synchronized ref. */
  const settlesHere = (started: CloseoutOrigin) => started.identity === identityRef.current;

  const mutation = useMutation({
    // The URL is built from the ORIGIN's booking id, not from render scope, so a request that outlives a navigation
    // still addresses the booking it was issued for.
    mutationFn: async ({ origin: started, path, method, body }: CloseoutMutation) => {
      let response: Response;
      try {
        response = await fetch(`/api/catering/bookings/${started.bookingId}${path}`, {
          method, credentials: "include",
          headers: body === undefined ? undefined : { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (transportError) {
        // The request never got an answer. It may not have reached the server at all, or it may have been applied
        // and the response lost -- which is exactly why every draft is kept below, and why every Phase 2K write is
        // defined to be safe to retry.
        throw Object.assign(new Error(String((transportError as Error)?.message ?? transportError)), { offline: true });
      }
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(value.message || "This closeout change could not be saved"), { code: typeof value.code === "string" ? value.code : undefined });
      return value as Record<string, unknown>;
    },
    onSuccess: (value, variables) => {
      const started = variables.origin;
      // Always refresh the ORIGINATING booking, whichever booking is rendered now: that is the data this response
      // actually changed, and its cache is keyed by that booking. The workspace is refreshed too, because a
      // completion writes a shared activity row the Activity panel renders.
      cache.invalidateQueries({ queryKey: cateringBookingCloseoutKey(started.userId, started.bookingId) });
      cache.invalidateQueries({ queryKey: ["catering", "booking-workspace", started.userId, started.bookingId] });
      // Everything below writes booking-local component state, which only exists for the booking on screen. A
      // response for one the participant has navigated away from has nothing here to settle and must touch nothing.
      if (!settlesHere(started)) return;
      // ADOPT THE RETURNED VERSIONS FIRST, before anything below settles and before `isPending` goes false.
      //
      // This is the whole fix: the next mutation the provider fires -- another notes save, a checklist edit,
      // completing closeout, reopening it -- states its precondition against the version the server just minted
      // for this accepted write, instead of against the one the query still holds until its refetch lands. The
      // invalidation above still runs, and still reconciles everything else; it is simply no longer the only thing
      // that moves the concurrency token.
      //
      // It is installed under the ORIGINATING booking's identity, so a response that arrives for a booking the
      // participant has navigated away from cannot advance another booking's versions.
      setVersions((current) => adoptCateringCloseoutVersions(current, started.identity, cateringCloseoutVersionsFromResponse(value)));
      setNotice(null);
      if (variables.submittedItem) {
        const checklist = (value.checklist as CateringCloseoutItemView[] | undefined) ?? [];
        setEditor((current) => settleCateringCloseoutEditor(current, variables.submittedItem!, checklist.find((item) => item.key === variables.submittedItem!.key)));
      }
      if (variables.submittedNotes !== undefined) {
        const saved = (value.closeout as { providerNotes?: string | null } | undefined)?.providerNotes ?? "";
        setNotesForm((current) => settleCateringCloseoutForm(current, started.identity, variables.submittedNotes!, saved));
      }
    },
    onError: (error: CateringCloseoutError, variables) => {
      const started = variables.origin;
      // A refusal is about the originating booking too, so its cache is the one that may need re-reading...
      if (shouldRefetchCloseoutAfterError(error)) cache.invalidateQueries({ queryKey: cateringBookingCloseoutKey(started.userId, started.bookingId) });
      // ...and its message, its conflicted editor and its preserved form all belong to that booking's screen. On a
      // different booking there is nothing to mark and nothing to say.
      if (!settlesHere(started)) return;
      const outcome = cateringCloseoutFailureNotice(error);
      setNotice({ message: outcome.message, retryable: outcome.retryable });
      // A conflicted editor is MARKED, not closed: the provider's words stay on screen, and saving is disabled
      // until they reload the newer version to start from.
      if (variables.settle === "item" && variables.itemKey && isCateringCloseoutConflict(error)) {
        setEditor((current) => markCateringCloseoutEditorConflict(current, variables.itemKey!));
      }
      if (variables.settle === "notes") setNotesForm(markCateringCloseoutFormConflict);
    },
  });
  const pending = mutation.isPending;

  /**
   * The closeout record every record mutation states its precondition against.
   *
   * The query's record, with `updatedAt` advanced to the freshest version this client has been told about. One
   * accessor rather than three, so notes, complete and reopen cannot drift apart -- a version any one of them
   * adopts is immediately the version the other two send.
   */
  const rebasedRecord = closeout ? cateringCloseoutRebasedRecord(closeout.closeout, versions, identity) : null;

  const submitItem = (open: OpenCateringCloseoutItemEditor) => {
    // The editor has to belong to the booking this submit is addressed to. `activeCateringCloseoutEditor` already
    // refuses a foreign one on the render path, but a submit is the one place where being wrong writes another
    // booking's record, so it says so explicitly rather than relying on that.
    if (!localStateIsCurrent || open.identity !== identity) return;
    if (!maySubmitCateringCloseoutEditor(open, actionable, pending)) return;
    mutation.mutate({
      origin: origin(), path: `/closeout/items/${open.key}`, method: "PUT", body: cateringCloseoutItemPayload(open),
      settle: "item", itemKey: open.key, submittedItem: { identity, key: open.key, state: open.state, note: open.note },
    });
  };
  const submitNotes = (event: FormEvent) => {
    event.preventDefault();
    if (!localStateIsCurrent || !mayEditCateringCloseoutNotes(notesForm, identity, actionable, pending)) return;
    mutation.mutate({
      origin: origin(), path: "/closeout/notes", method: "PUT",
      // The REBASED version, so an immediate second save after a successful one is not refused against a version
      // its own predecessor already advanced past.
      body: cateringCloseoutNotesPayload(notesForm.value, rebasedRecord?.updatedAt ?? null),
      settle: "notes", submittedNotes: notesForm.value,
    });
  };
  const completeCloseout = () => {
    if (!closeout || !rebasedRecord || !actionable || pending || !closeout.readiness.mayCloseOut) return;
    // Rebased for the same reason: a notes save that landed a moment ago has already advanced this record's
    // version, and completing against the pre-save one would be refused with a conflict nobody caused.
    mutation.mutate({ origin: origin(), path: "/closeout/complete", method: "POST", body: cateringCloseoutCompletePayload(rebasedRecord) });
  };
  const reopenCloseout = () => {
    if (!closeout || !rebasedRecord || !actionable || pending || !closeout.closeout.closedOut) return;
    // Deliberate rather than an accidental toggle: reopening is confirmed, is its own route, and is audited on the
    // server with a persisted count, instant and actor.
    if (!window.confirm("Reopen this booking's closeout? Your customer will see that it was reopened.")) return;
    // And rebased here too: reopening immediately after completing is the most likely sequence of all -- the
    // provider closes out, notices something, and undoes it -- and it is exactly the sequence the completion's own
    // returned version would otherwise have made conflict.
    mutation.mutate({ origin: origin(), path: "/closeout/reopen", method: "POST", body: cateringCloseoutReopenPayload(rebasedRecord) });
  };

  if (query.isLoading) return <Card id={CATERING_CLOSEOUT_SECTION}><CardHeader><CardTitle>Post-event closeout</CardTitle></CardHeader><CardContent><p role="status">Loading closeout…</p></CardContent></Card>;
  if (query.isError || !closeout) {
    return <Card id={CATERING_CLOSEOUT_SECTION}><CardHeader><CardTitle>Post-event closeout</CardTitle></CardHeader><CardContent className="space-y-2" role="alert">
      <p>The closeout view could not be loaded.</p>
      <Button variant="outline" className="min-h-11" onClick={() => query.refetch()}>Retry loading closeout</Button>
    </CardContent></Card>;
  }

  // A booking whose event was never served gets a truthful statement and nothing else: no checklist, no signals, no
  // documents list and no actions. A cancelled booking in particular is never dressed up as a completed one, and a
  // future confirmed booking is never offered closeout early. The distinction comes from the authoritative booking
  // status the server read, never from comparing the event date to the device clock.
  if (!closeout.eventServiceOccurred) {
    return <Card id={CATERING_CLOSEOUT_SECTION}><CardHeader>
      <CardTitle>Post-event closeout</CardTitle>
      <CardDescription>{closeout.bookingStatus === "cancelled" ? CATERING_CLOSEOUT_CANCELLED_NOTICE : provider ? CATERING_CLOSEOUT_PROVIDER_PENDING_NOTICE : CATERING_CLOSEOUT_PENDING_NOTICE}</CardDescription>
    </CardHeader></Card>;
  }

  // Rebased, so an item's editor reopened straight after a successful save on that item carries the version that
  // save produced rather than the one the query still holds.
  const checklist = cateringCloseoutRebasedChecklist(closeout.checklist ?? [], versions, identity);
  const progress = cateringCloseoutProgress(checklist);
  const notesAreCurrent = localStateIsCurrent && cateringCloseoutFormIsCurrent(notesForm, identity);

  return <Card id={CATERING_CLOSEOUT_SECTION}><CardHeader>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <CardTitle>Post-event closeout</CardTitle>
        <CardDescription>{provider
          ? "Wrapping up after service. Nothing here changes the booking's status -- it stays complete either way."
          : "Your event is complete. Here is what is settled, what is still outstanding, and what you can do next."}</CardDescription>
      </div>
      <Badge variant={cateringCloseoutStateVariant(closeout.readiness.state)}>{CATERING_CLOSEOUT_STATE_LABELS[closeout.readiness.state]}</Badge>
    </div>
  </CardHeader><CardContent className="space-y-6">

    {notice && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" role="alert">
      <p className="break-words">{notice.message}</p>
    </div>}

    {closeout.closeout.closedOut && <p className="rounded-md bg-muted p-3 text-sm">
      {provider ? "You marked this booking operationally closed out" : "Your caterer finished wrapping up this event"}
      {closeout.closeout.closedOutAt ? ` on ${formatCateringCloseoutInstant(closeout.closeout.closedOutAt)}` : ""}.
      {" "}The booking itself is unchanged and stays complete.
    </p>}
    {closeout.closeout.reopenCount > 0 && <p className="text-sm text-muted-foreground">
      Closeout has been reopened {closeout.closeout.reopenCount === 1 ? "once" : `${closeout.closeout.reopenCount} times`}
      {closeout.closeout.lastReopenedAt ? `, most recently on ${formatCateringCloseoutInstant(closeout.closeout.lastReopenedAt)}` : ""}.
    </p>}

    {/* Closeout signals. Every line is derived server-side from persisted records THIS actor may see; nothing here
        is computed from a client-supplied count, and a customer never receives a provider-only signal. */}
    <section aria-labelledby="closeout-signals">
      <h3 id="closeout-signals" className="font-medium">Where things stand</h3>
      <ul className="mt-2 space-y-2">{closeout.readiness.signals.map((signal) => <li key={signal.signal} className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant={cateringCloseoutSignalVariant(signal.state)}>{signal.label}</Badge>
        <span className="min-w-0 break-words text-sm text-muted-foreground">{signal.detail}</span>
      </li>)}</ul>
    </section>

    {/* Final documents. The EXISTING Phase 2I shared files for this booking, downloaded through the EXISTING
        authorized endpoint. Nothing is categorised and nothing is inferred: these are real files with real names. */}
    <section aria-labelledby="closeout-documents">
      <h3 id="closeout-documents" className="font-medium">Shared documents</h3>
      {closeout.documents.length
        ? <ul className="mt-2 space-y-2">{closeout.documents.map((document) => <li key={document.id} className="rounded-lg border p-3">
            <p className="break-words font-medium">{document.filename}</p>
            <p className="text-sm text-muted-foreground">
              {formatCateringFileSize(document.byteSize)} · shared by {document.uploadedByRole === "provider" ? "your caterer" : "the customer"}
              {document.uploaderName ? ` (${document.uploaderName})` : ""}
            </p>
            <Button asChild variant="outline" className="mt-2 min-h-11">
              <a href={cateringFileDownloadPath(bookingId, document.id)} download aria-label={`Download ${document.filename}`}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />Download
              </a>
            </Button>
          </li>)}</ul>
        : <p className="mt-2 text-sm text-muted-foreground">No documents have been shared on this booking.</p>}
    </section>

    {/* Follow-up. Both CTAs open EXISTING surfaces: the booking conversation Phase 2I already owns, and the public
        provider page where the existing inquiry and review flows already live. Nothing is auto-sent, and a
        completed booking does not create marketing consent of any kind. */}
    <section aria-labelledby="closeout-follow-up" className="space-y-2">
      <h3 id="closeout-follow-up" className="font-medium">Follow up</h3>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-h-11">
          <a href={closeout.communicationPath}>Open the booking conversation</a>
        </Button>
        {closeout.customerReview && closeout.customerReview.mayReview && <Button asChild className="min-h-11">
          <Link href={closeout.customerReview.reviewPath}>
            <Star className="mr-2 h-4 w-4" aria-hidden="true" />
            {closeout.customerReview.alreadyReviewed ? "Update your review" : "Review this caterer"}
          </Link>
        </Button>}
        {closeout.rebookPath && <Button asChild variant="outline" className="min-h-11">
          <Link href={closeout.rebookPath}>Work with this caterer again</Link>
        </Button>}
      </div>
      {closeout.customerReview && !closeout.customerReview.mayReview && <p className="text-sm text-muted-foreground">Reviews are not available for this provider right now.</p>}
      {closeout.providerReview && <p className="text-sm text-muted-foreground">{closeout.providerReview.customerReviewExists
        ? "This customer has left a review on your profile."
        : "This customer has not left a review yet. You can ask them in the booking conversation."}</p>}
    </section>

    {/* The provider-private checklist. A customer's payload carries no `checklist` key at all, so this whole
        section simply does not exist for them -- it is not hidden, there is nothing to hide. */}
    {provider && <section aria-labelledby="closeout-checklist" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="closeout-checklist" className="font-medium">Closeout checklist</h3>
        <span className="text-sm text-muted-foreground">{progress.resolved} of {progress.total} answered</span>
      </div>
      <p className="text-sm text-muted-foreground">Only you can see this checklist and its notes. Items marked required must be answered -- as done or as not applicable -- before you can close this booking out.</p>
      <ul className="space-y-2">{checklist.map((item) => {
        const open = activeCateringCloseoutEditor(editor, identity, item.key, actionable);
        return <li key={item.key} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-words font-medium">{item.label}</p>
              <p className="break-words text-sm text-muted-foreground">{item.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {item.required && <Badge variant="outline">Required</Badge>}
              <Badge variant={item.state === "pending" ? "secondary" : "default"}>{CATERING_CLOSEOUT_ITEM_STATE_LABELS[item.state]}</Badge>
            </div>
          </div>
          {item.providerNote && !open && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.providerNote}</p>}
          {item.resolvedAt && !open && <p className="mt-1 text-xs text-muted-foreground">Answered {formatCateringCloseoutInstant(item.resolvedAt)}</p>}
          {open
            ? <ChecklistEditor
                open={open} pending={pending} actionable={actionable}
                mayReload={mayReloadCateringCloseoutEditor(editor, identity, checklist)}
                onState={(state) => setEditor((current) => editCateringCloseoutEditor(current, identity, item.key, { state }))}
                onNote={(note) => setEditor((current) => editCateringCloseoutEditor(current, identity, item.key, { note }))}
                onReload={() => setEditor(cateringCloseoutEditorFor(item, identity))}
                onCancel={() => setEditor(null)}
                onSubmit={() => submitItem(open)}
              />
            : actionable && <Button variant="outline" className="mt-2 min-h-11" onClick={() => setEditor(cateringCloseoutEditorFor(item, identity))}>
                {item.state === "pending" ? "Answer this item" : "Update this item"}
              </Button>}
        </li>;
      })}</ul>
    </section>}

    {/* The provider's private post-event notes. A separate concern from the Phase 2J access record's private note,
        and stored separately, so the two have their own versions and their own audit trails. */}
    {provider && <section aria-labelledby="closeout-notes" className="space-y-2">
      <h3 id="closeout-notes" className="font-medium">Your private event notes</h3>
      <p className="text-sm text-muted-foreground">Only you can see this. It is never shown to the customer, and it never appears in activity, notifications or reviews.</p>
      {actionable
        ? <form className="space-y-2" onSubmit={submitNotes}>
            <Label htmlFor="closeout-notes-field" className="sr-only">Private event notes</Label>
            <Textarea
              id="closeout-notes-field" rows={5} maxLength={CATERING_CLOSEOUT_NOTES_MAXIMUM}
              placeholder="How the event actually went, what you would change, anything worth remembering next time."
              value={notesAreCurrent ? notesForm.value : ""}
              disabled={!notesAreCurrent}
              onChange={(event) => setNotesForm((current) => editCateringCloseoutForm(current, event.target.value))}
            />
            <Button className="min-h-11" disabled={!mayEditCateringCloseoutNotes(notesForm, identity, actionable, pending)}>Save my notes</Button>
          </form>
        : persistedNotes
          ? <p className="whitespace-pre-wrap break-words text-sm">{persistedNotes}</p>
          : <p className="text-sm text-muted-foreground">No private notes yet.</p>}
    </section>}

    {/* The closeout action itself. It records that the operational wrap-up is finished; it does not touch the
        booking's Phase 2G status, which stays exactly as it is. */}
    {provider && actionable && <section aria-labelledby="closeout-action" className="space-y-2 border-t pt-4">
      <h3 id="closeout-action" className="font-medium">Operational closeout</h3>
      {closeout.closeout.closedOut
        ? <>
            <p className="text-sm text-muted-foreground">This booking is closed out. Reopening is recorded and your customer can see that it happened.</p>
            <Button variant="outline" className="min-h-11" disabled={pending} onClick={reopenCloseout}>Reopen closeout</Button>
          </>
        : <>
            <p className="text-sm text-muted-foreground">{closeout.readiness.mayCloseOut
              ? "Everything required is answered. Marking this closed out tells your customer you have finished wrapping up."
              : "Answer every required checklist item -- as done or as not applicable -- before closing this booking out."}</p>
            <Button className="min-h-11" disabled={pending || !closeout.readiness.mayCloseOut} onClick={completeCloseout}>Mark closeout complete</Button>
          </>}
    </section>}
  </CardContent></Card>;
}

/**
 * The editor for one checklist item. Presentation only: every decision it renders was taken above or in the pure
 * state module, so this component holds no state of its own and cannot disagree with the list around it.
 *
 * State is a row of full-height buttons rather than a select, because three fixed choices on a phone should be one
 * tap and not a picker.
 */
function ChecklistEditor({ open, pending, actionable, mayReload, onState, onNote, onReload, onCancel, onSubmit }: {
  open: OpenCateringCloseoutItemEditor; pending: boolean; actionable: boolean;
  mayReload: boolean;
  onState: (state: CateringCloseoutItemState) => void;
  onNote: (note: string) => void;
  onReload: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <fieldset>
      <legend className="text-sm font-medium">Where has this got to?</legend>
      <div className="mt-2 flex flex-wrap gap-2">{CATERING_CLOSEOUT_ITEM_STATES.map((state) => <Button
        key={state} type="button" className="min-h-11"
        variant={open.state === state ? "default" : "outline"}
        aria-pressed={open.state === state}
        onClick={() => onState(state)}
      >{CATERING_CLOSEOUT_ITEM_STATE_LABELS[state]}</Button>)}</div>
    </fieldset>
    <div>
      <Label htmlFor={`closeout-note-${open.key}`}>Note (optional, private to you)</Label>
      <Textarea
        id={`closeout-note-${open.key}`} rows={3} maxLength={CATERING_CLOSEOUT_ITEM_NOTE_MAXIMUM}
        value={open.note} onChange={(event) => onNote(event.target.value)}
      />
    </div>
    {open.conflicted && <p className="text-sm text-amber-700" role="alert">
      This item changed elsewhere since you opened it. {mayReload ? "Reload the latest version to carry on." : "Waiting for the latest version…"}
    </p>}
    <div className="flex flex-wrap gap-2">
      <Button className="min-h-11" disabled={!maySubmitCateringCloseoutEditor(open, actionable, pending)}>Save</Button>
      {open.conflicted && <Button type="button" variant="outline" className="min-h-11" disabled={!mayReload} onClick={onReload}>Reload the latest version</Button>}
      <Button type="button" variant="ghost" className="min-h-11" onClick={onCancel}>Cancel</Button>
    </div>
  </form>;
}
