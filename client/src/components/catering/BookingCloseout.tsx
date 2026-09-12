import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Download, Star } from "lucide-react";
import {
  CATERING_CLOSEOUT_CANCELLED_NOTICE,
  CATERING_CLOSEOUT_CHECKLIST_LOCKED_NOTICE,
  CATERING_CLOSEOUT_CONVERSATION_ACTION,
  CATERING_CLOSEOUT_CONVERSATION_NOTE,
  CATERING_CLOSEOUT_ITEM_STATES,
  CATERING_CLOSEOUT_ITEM_STATE_LABELS,
  CATERING_CLOSEOUT_NOTES_MAXIMUM,
  CATERING_CLOSEOUT_ITEM_NOTE_MAXIMUM,
  CATERING_CLOSEOUT_PENDING_NOTICE,
  CATERING_CLOSEOUT_PROVIDER_PENDING_NOTICE,
  CATERING_CLOSEOUT_SECTION,
  CATERING_CLOSEOUT_PROVIDER_REVIEW_ABSENT,
  CATERING_CLOSEOUT_PROVIDER_REVIEW_PRESENT,
  CATERING_CLOSEOUT_STATE_LABELS,
  cateringBookingCloseoutKey,
  cateringCloseoutCanStillChange,
  cateringCloseoutChecklistIsEditable,
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
  activeCateringCloseoutNotice,
  adoptCateringCloseoutVersions,
  cateringCloseoutCompletePayload,
  cateringCloseoutEditorFor,
  cateringCloseoutFailureNotice,
  cateringCloseoutFormIsCurrent,
  cateringCloseoutItemPayload,
  cateringCloseoutNotesPayload,
  cateringCloseoutProgress,
  cateringCloseoutChecklistFromResponse,
  cateringCloseoutRebasedRecord,
  cateringCloseoutReopenPayload,
  cateringCloseoutVersionsFromResponse,
  discardCateringCloseoutForm,
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
  mayDiscardCateringCloseoutNotes,
  mayEditCateringCloseoutNotes,
  observeCateringCloseoutTransition,
  rebaseCateringCloseoutFormVersion,
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
  type CateringCloseoutNotice,
  type CateringCloseoutTransitionRecord,
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
  const [notice, setNotice] = useState<CateringCloseoutNotice | null>(null);
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
    // The same cadence constant and the same helper every other workspace section uses, asked a different
    // question: keep polling while this booking can still produce a Phase 2K state change.
    //
    // Gating on "served AND not yet closed out" was backwards in both directions, and left two windows a
    // participant could sit in indefinitely with the tab focused. A customer watching a confirmed booking had
    // polling switched off precisely BECAUSE service had not happened, so the provider's completion never
    // arrived; and a customer shown `closed_out` had it switched off again, so a reopen -- which deliberately
    // notifies nobody and invalidates no other user's cache -- never arrived either.
    //
    // `refetchOnWindowFocus` above is a complement, not the mechanism: a participant who never leaves the tab
    // never produces a focus transition, which is exactly the case both failures needed.
    refetchInterval: (polled: { state: { data?: CateringBookingCloseoutView } }) =>
      cateringWorkspacePollInterval(cateringCloseoutCanStillChange(polled.state.data?.bookingStatus)),
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
   * Whether the CHECKLIST may be edited, which is narrower than whether closeout is actionable at all.
   *
   * `actionable` stays true after closing out -- reopening and private notes are both still legitimate -- so
   * gating checklist controls on it offered edits the server would only ever refuse under its closed-out
   * boundary. This is the same boundary, stated on the client: read from the authoritative payload, so a booking
   * another tab closed out takes the controls away here on the very next poll.
   */
  const checklistEditable = cateringCloseoutChecklistIsEditable(actionable, Boolean(closeout?.closeout.closedOut));
  /**
   * The closeout record the record mutations state their precondition against.
   *
   * The query's record, with `updatedAt` advanced to the freshest version this client has been told about. One
   * accessor rather than several, so completion and reopening cannot drift apart -- a version either of them
   * adopts is immediately the version the other sends.
   */
  const rebasedRecord = closeout ? cateringCloseoutRebasedRecord(closeout.closeout, versions, identity) : null;
  /**
   * The version a CLEAN notes form hydrates to.
   *
   * Read from the rebased record so this client's own accepted writes are reflected, but it reaches a DIRTY form
   * nowhere: `hydrateCateringCloseoutForm` keeps a dirty form's own `baseVersion` untouched. That split is the
   * whole correction -- a clean form has nothing to lose by moving with the record, and a dirty one must not claim
   * to have been written against a record its author never saw.
   */
  const notesAuthoritativeVersion = rebasedRecord?.updatedAt ?? null;

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
   * The last closeout state observed for the booking on screen.
   *
   * A ref, because this is bookkeeping rather than anything rendered: writing it must not cause a render, and
   * reading it must not make the effect below depend on its own output. It is identity-scoped like every other
   * piece of booking-local state here, so booking A's record can never make booking B look like it moved.
   */
  const transitionRef = useRef<CateringCloseoutTransitionRecord>(null);

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
    // The version travels WITH the text. A clean form takes both; a dirty one keeps both, which is what stops a
    // draft written against V1 from claiming it was based on the V2 another tab just wrote.
    setNotesForm((current) => hydrateCateringCloseoutForm(current, identity, persistedNotes, notesAuthoritativeVersion));
  }, [identity, provider, persistedNotes, notesAuthoritativeVersion, Boolean(closeout)]);
  /**
   * Refresh the workspace once when this booking's closeout state is FIRST observed, and once more whenever it
   * actually changes afterwards.
   *
   * Closing out and reopening each write a shared activity row in the same transaction as the state change, but the
   * Activity panel lives in the parent workspace query, which does not poll -- and the provider's invalidation
   * cannot reach the customer's browser. Watching only for a CHANGE assumed the two queries were synchronized at
   * the point this one started watching, and they are not: the workspace resolves once, on its own schedule, and
   * the closeout query resolves separately and later. A customer whose workspace was fetched before the provider
   * closed out, and whose first closeout payload arrives after, has nothing to compare against, sees no change on
   * any later poll, and is left with a feed permanently missing the event it describes.
   *
   * So the first authoritative observation of a booking reconciles once, whatever it says, and genuine transitions
   * reconcile once each after that.
   *
   * It cannot loop: invalidating the WORKSPACE query changes nothing this effect reads, and the observation is
   * recorded before the invalidation, so every later poll reporting the same state is inert -- the bound is one
   * refresh per booking plus one per real transition. A local completion or reopening records the state from its
   * own response, having already invalidated the workspace itself, so it never produces a second refresh on top of
   * the one it issued.
   */
  const observedClosedOut = closeout?.closeout.closedOut;
  useEffect(() => {
    if (typeof observedClosedOut !== "boolean") return;
    const observed = observeCateringCloseoutTransition(transitionRef.current, identity, observedClosedOut);
    transitionRef.current = observed.record;
    // Addressed by the identity that was just observed, so one booking's observation never refreshes another's.
    if (observed.reconcile) cache.invalidateQueries({ queryKey: ["catering", "booking-workspace", userId, bookingId] });
  }, [identity, observedClosedOut]);

  // An editor open on a booking whose checklist is no longer editable, or that belongs to another booking, closes.
  // That now includes a booking another tab closed out: the poll brings `closedOut`, and the editor drops with it.
  useEffect(() => {
    setEditor((current) => reconcileCateringCloseoutEditor(current, identity, checklistEditable));
  }, [identity, checklistEditable]);

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
    onSuccess: async (value, variables) => {
      const started = variables.origin;
      // Always refresh the ORIGINATING booking, whichever booking is rendered now: that is the data this response
      // actually changed, and its cache is keyed by that booking.
      //
      // The CLOSEOUT refetch is held onto, because every dependent control on this card reads its payload:
      // `readiness.mayCloseOut` gates "Mark closeout complete", `closeout.closedOut` chooses between that and
      // "Reopen closeout", and the checklist rows render from `checklist`. Starting the refetch and letting the
      // mutation settle anyway left a window in which `isPending` was false while the query still held the
      // PRE-mutation payload -- so a provider who moved a required item back to pending could immediately click a
      // "Mark closeout complete" button that was still enabled by the old `mayCloseOut`, and be answered with a
      // blocked 409 describing a state the screen was no longer showing.
      //
      // The WORKSPACE refetch is deliberately NOT awaited. It refreshes the Activity panel above this card, which
      // governs no control here, so holding the provider's buttons for it would serialize an unrelated read.
      const reconciled = cache.invalidateQueries({ queryKey: cateringBookingCloseoutKey(started.userId, started.bookingId) })
        // A refetch that fails must not turn a write the server ACCEPTED into a reported failure. The payload then
        // stays stale until the poll or a focus refetch replaces it, which is exactly where it stood before.
        .catch(() => undefined);
      cache.invalidateQueries({ queryKey: ["catering", "booking-workspace", started.userId, started.bookingId] });
      // INSTALL the authoritative checklist this response carried, values and versions TOGETHER.
      //
      // The item save returns the whole checklist, captured inside its transaction while the closeout advisory
      // lock was still held. Adopting versions from it while leaving the rendered values behind was how a row's
      // value and its version came apart: another tab's newer item arrived as a version this client adopted and a
      // value it discarded, and if the refetch below then failed, the next save of that row would state the newer
      // version against the older text -- accepted by the server, and the other tab's change silently gone.
      //
      // Installing the snapshot closes that by construction, and it does not depend on the refetch succeeding.
      // Nothing is fabricated: if this client holds no payload yet there is nothing to merge into, and it waits.
      const returnedChecklist = cateringCloseoutChecklistFromResponse(value);
      if (returnedChecklist) {
        cache.setQueryData(cateringBookingCloseoutKey(started.userId, started.bookingId), (previous: CateringBookingCloseoutView | undefined) =>
          previous ? { ...previous, checklist: returnedChecklist } : previous);
      }
      // Everything below writes booking-local component state, which only exists for the booking on screen. A
      // response for one the participant has navigated away from has nothing here to settle and must touch nothing
      // -- and must not hold this booking's controls pending on that booking's refetch either.
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
      // Record the state this response reports, so the refetch it triggers is not then read as an external
      // transition and answered with a SECOND workspace invalidation. A local completion or reopening already
      // invalidated the workspace above; this stops that work being duplicated -- including on the first-observation
      // path, because a tracker initialized here makes the payload that follows an identical, inert observation.
      //
      // It runs only past the `settlesHere` guard above, so a response for a booking the participant has navigated
      // away from can neither overwrite the tracker of the booking on screen nor pre-fill one on its behalf.
      const settledClosedOut = (value.closeout as { closedOut?: boolean } | undefined)?.closedOut;
      if (typeof settledClosedOut === "boolean") {
        transitionRef.current = observeCateringCloseoutTransition(transitionRef.current, started.identity, settledClosedOut).record;
      }
      if (variables.submittedItem) {
        const checklist = (value.checklist as CateringCloseoutItemView[] | undefined) ?? [];
        setEditor((current) => settleCateringCloseoutEditor(current, variables.submittedItem!, checklist.find((item) => item.key === variables.submittedItem!.key)));
      }
      const savedRecord = value.closeout as { providerNotes?: string | null; updatedAt?: string | null } | undefined;
      const savedVersion = typeof savedRecord?.updatedAt === "string" ? savedRecord.updatedAt : null;
      if (variables.submittedNotes !== undefined) {
        // This form's own accepted save settles text and version together, keeping any newer words typed while it
        // was in flight.
        setNotesForm((current) => settleCateringCloseoutForm(current, started.identity, variables.submittedNotes!, savedRecord?.providerNotes ?? "", savedVersion));
      } else if (savedVersion) {
        // THIS TAB's own complete or reopen. Both advance `catering_booking_closeout.updatedAt` and neither
        // touches `providerNotes`, so a dirty draft keeps every word and only its base version moves -- otherwise
        // the provider conflicts with themselves: type a note, close out, save the note, refused. A conflicted
        // form is left alone, because closing out resolves nothing about somebody else's competing notes edit.
        setNotesForm((current) => rebaseCateringCloseoutFormVersion(current, started.identity, savedVersion));
      }
      // LAST, and only once every synchronous settlement above has run: hold the mutation pending until the
      // authoritative payload has actually landed.
      //
      // The ordering matters in both directions. The version adoption and the draft settlements stay FIRST, so an
      // immediate consecutive write still states the precondition this write just produced rather than waiting on
      // a refetch -- the earlier correction is untouched. And the await is LAST, so no dependent control is
      // re-enabled against a payload that predates the change the provider just made.
      //
      // `query-core` awaits this callback before it dispatches success, so this genuinely keeps `isPending` true.
      await reconciled;
    },
    onError: async (error: CateringCloseoutError, variables) => {
      const started = variables.origin;
      // A refusal is about the originating booking too, so its cache is the one that may need re-reading...
      const reconciled = shouldRefetchCloseoutAfterError(error)
        ? cache.invalidateQueries({ queryKey: cateringBookingCloseoutKey(started.userId, started.bookingId) }).catch(() => undefined)
        : undefined;
      // ...and its message, its conflicted editor and its preserved form all belong to that booking's screen. On a
      // different booking there is nothing to mark and nothing to say.
      if (!settlesHere(started)) { await reconciled; return; }
      const outcome = cateringCloseoutFailureNotice(error);
      // Tagged with the booking that produced it, so it can never be rendered -- or announced -- under another.
      setNotice({ identity: started.identity, message: outcome.message, retryable: outcome.retryable });
      // A conflicted editor is MARKED, not closed: the provider's words stay on screen, and saving is disabled
      // until they reload the newer version to start from.
      if (variables.settle === "item" && variables.itemKey && isCateringCloseoutConflict(error)) {
        setEditor((current) => markCateringCloseoutEditorConflict(current, variables.itemKey!));
      }
      // The SAME classifier the checklist path uses, and for the same reason. Marking the notes form conflicted on
      // any failure was survivable while the flag was advisory, but it stopped being so once a conflict became
      // sticky and Save-blocking: a dropped connection or a 500 then disabled Save, hid every route back except
      // "discard my edits", and made the "try again" notice beside it a lie -- with, in the offline case, no newer
      // authoritative record to discard onto in the first place.
      //
      // Only a genuine optimistic-concurrency refusal is a conflict. Every other failure leaves the form exactly as
      // it was -- same text, same dirty state, same base version, not conflicted -- so the provider retries the
      // very same draft once the transient problem clears.
      if (variables.settle === "notes" && isCateringCloseoutConflict(error)) setNotesForm(markCateringCloseoutFormConflict);
      // Same rule on the refusal path. A conflict, a lifecycle refusal or a blocked completion all mean the payload
      // on screen no longer describes the server, so re-enabling the controls before the corrected one arrives
      // invites exactly the retry that was just refused. The error itself is untouched: awaiting here only delays
      // the failure being dispatched, and a failed refetch is swallowed so it cannot mask the real refusal.
      await reconciled;
    },
  });
  const pending = mutation.isPending;

  const submitItem = (open: OpenCateringCloseoutItemEditor) => {
    // The editor has to belong to the booking this submit is addressed to. `activeCateringCloseoutEditor` already
    // refuses a foreign one on the render path, but a submit is the one place where being wrong writes another
    // booking's record, so it says so explicitly rather than relying on that.
    if (!localStateIsCurrent || open.identity !== identity) return;
    // Defence in depth, not merely a hidden button: a stale editor that survives one render after the payload says
    // closed must not be able to issue the request at all.
    if (!maySubmitCateringCloseoutEditor(open, checklistEditable, pending)) return;
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
      // The FORM's own base version, not the latest polled record's. A dirty draft must state the version its
      // text was hydrated from, so another writer's intervening save is refused as a conflict rather than silently
      // overwritten.
      body: cateringCloseoutNotesPayload(notesForm.value, notesForm.baseVersion),
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

  // Read straight from the payload. The item save installs its authoritative snapshot into this very cache entry,
  // so an editor reopened right after a save already carries that row's new value AND its new version -- as one
  // pair, never a version without the value it belongs to.
  const checklist = closeout.checklist ?? [];
  const progress = cateringCloseoutProgress(checklist);
  const notesAreCurrent = localStateIsCurrent && cateringCloseoutFormIsCurrent(notesForm, identity);
  // The notice belongs to the booking that produced it, exactly as the drafts and the editor do.
  const shownNotice = localStateIsCurrent ? activeCateringCloseoutNotice(notice, identity) : null;

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

    {/* Read on the RENDER path, so booking A's refusal is already suppressed in the first committed render of
        booking B -- it is never displayed there, and never announced there by `role="alert"`. */}
    {shownNotice && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" role="alert">
      <p className="break-words">{shownNotice.message}</p>
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

    {/* Follow-up. Every link here points at an EXISTING surface: the booking conversation Phase 2I already owns --
        read-only on a completed booking, and described as such -- and the public provider page where the existing
        inquiry and review flows live. Nothing is auto-sent, no new channel is invented, and a completed booking
        does not create marketing consent of any kind. */}
    <section aria-labelledby="closeout-follow-up" className="space-y-2">
      <h3 id="closeout-follow-up" className="font-medium">Follow up</h3>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-h-11">
          <a href={closeout.communicationPath}>{CATERING_CLOSEOUT_CONVERSATION_ACTION}</a>
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
      {/* Stated once, for both participants: this section only ever renders on a completed booking, and Phase 2I
          closes its composer with the Phase 2H edit window, so the thread is read-only for everyone here. */}
      <p className="text-sm text-muted-foreground">{CATERING_CLOSEOUT_CONVERSATION_NOTE}</p>
      {closeout.customerReview && !closeout.customerReview.mayReview && <p className="text-sm text-muted-foreground">Reviews are not available for this provider right now.</p>}
      {/* A fact, naming no channel. Telling a provider to ask in the booking conversation described an action the
          read-only thread cannot perform -- and Phase 2K does not widen Phase 2I to make its own copy true. */}
      {closeout.providerReview && <p className="text-sm text-muted-foreground">{closeout.providerReview.customerReviewExists
        ? CATERING_CLOSEOUT_PROVIDER_REVIEW_PRESENT
        : CATERING_CLOSEOUT_PROVIDER_REVIEW_ABSENT}</p>}
    </section>

    {/* The provider-private checklist. A customer's payload carries no `checklist` key at all, so this whole
        section simply does not exist for them -- it is not hidden, there is nothing to hide. */}
    {provider && <section aria-labelledby="closeout-checklist" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="closeout-checklist" className="font-medium">Closeout checklist</h3>
        <span className="text-sm text-muted-foreground">{progress.resolved} of {progress.total} answered</span>
      </div>
      <p className="text-sm text-muted-foreground">Only you can see this checklist and its notes. Items marked required must be answered -- as done or as not applicable -- before you can close this booking out.</p>
      {/* Read-only while closeout stands. The remedy is named rather than performed: the explicit Reopen action
          below is the only way back, and it stays exactly where it was. */}
      {actionable && !checklistEditable && <p className="text-sm text-muted-foreground" role="status">{CATERING_CLOSEOUT_CHECKLIST_LOCKED_NOTICE}</p>}
      <ul className="space-y-2">{checklist.map((item) => {
        // Read on the RENDER path, so the one committed render between the payload arriving and the reset effect
        // flushing is already inert -- the same standard every other piece of local state here is held to.
        const open = activeCateringCloseoutEditor(editor, identity, item.key, checklistEditable);
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
                open={open} pending={pending} editable={checklistEditable}
                mayReload={mayReloadCateringCloseoutEditor(editor, identity, checklist)}
                onState={(state) => setEditor((current) => editCateringCloseoutEditor(current, identity, item.key, { state }))}
                onNote={(note) => setEditor((current) => editCateringCloseoutEditor(current, identity, item.key, { note }))}
                onReload={() => setEditor(cateringCloseoutEditorFor(item, identity))}
                onCancel={() => setEditor(null)}
                onSubmit={() => submitItem(open)}
              />
            : checklistEditable && <Button variant="outline" className="mt-2 min-h-11" onClick={() => setEditor(cateringCloseoutEditorFor(item, identity))}>
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
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-11" disabled={!mayEditCateringCloseoutNotes(notesForm, identity, actionable, pending)}>Save my notes</Button>
              {/* A refused save is not rebased by a poll: which text survives when two people wrote the same
                  record is the provider's decision, so taking the newer one is their explicit action. */}
              {mayDiscardCateringCloseoutNotes(notesForm, identity) && <Button
                type="button" variant="ghost" className="min-h-11"
                onClick={() => { if (window.confirm("Discard your unsaved notes and start from the saved version?")) setNotesForm(discardCateringCloseoutForm(identity, persistedNotes, notesAuthoritativeVersion)); }}
              >Discard my edits and reload</Button>}
            </div>
            {notesForm.conflicted && notesAreCurrent && <p className="text-sm text-amber-700" role="status">These notes changed elsewhere since you started editing. Discard your edits to start from the saved version.</p>}
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
function ChecklistEditor({ open, pending, editable, mayReload, onState, onNote, onReload, onCancel, onSubmit }: {
  open: OpenCateringCloseoutItemEditor; pending: boolean; editable: boolean;
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
      <Button className="min-h-11" disabled={!maySubmitCateringCloseoutEditor(open, editable, pending)}>Save</Button>
      {open.conflicted && <Button type="button" variant="outline" className="min-h-11" disabled={!mayReload} onClick={onReload}>Reload the latest version</Button>}
      <Button type="button" variant="ghost" className="min-h-11" onClick={onCancel}>Cancel</Button>
    </div>
  </form>;
}
