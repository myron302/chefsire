import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Trash2 } from "lucide-react";
import {
  CATERING_EQUIPMENT_SOURCES,
  CATERING_EQUIPMENT_SOURCE_LABELS,
  CATERING_EQUIPMENT_STATUSES,
  CATERING_EQUIPMENT_STATUS_LABELS,
  CATERING_EXECUTION_MILESTONE_LABELS,
  CATERING_READINESS_STATE_LABELS,
  CATERING_STAFF_ROLES,
  CATERING_STAFF_ROLE_LABELS,
  CATERING_TIMELINE_CATEGORIES,
  CATERING_TIMELINE_CATEGORY_LABELS,
  cateringBookingExecutionKey,
  cateringBookingExecutionPath,
  type CateringBookingExecutionView,
  type CateringEquipmentSource,
  type CateringEquipmentStatus,
  type CateringExecutionEquipmentView,
  type CateringExecutionMilestoneView,
  type CateringExecutionStaffView,
  type CateringExecutionTimelineItemView,
  type CateringExecutionVisibility,
  type CateringStaffRole,
  type CateringTimelineCategory,
} from "@shared/catering-booking-execution";
import { cateringWorkspacePollInterval, effectiveCateringEditable } from "@shared/catering-booking-operations";
import { CATERING_ACCESS_FIELDS } from "@shared/catering-booking-execution";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CATERING_EXECUTION_CUSTOMER_EMPTY,
  CATERING_EXECUTION_PROVIDER_EMPTY,
  CATERING_EXECUTION_READ_ONLY_BANNER,
  EMPTY_CATERING_EQUIPMENT_DRAFT,
  EMPTY_CATERING_STAFF_DRAFT,
  EMPTY_CATERING_TIMELINE_DRAFT,
  activeCateringTimelineEditor,
  cateringAccessDraftFrom,
  cateringAccessSavePayload,
  cateringEquipmentCreatePayload,
  cateringExecutionDeletePayload,
  cateringExecutionFailureNotice,
  cateringExecutionVisibilityChoices,
  cateringReadinessVariant,
  cateringStaffCreatePayload,
  cateringStaffRoleLabel,
  cateringTimelineCompletionPayload,
  cateringTimelineCreatePayload,
  cateringTimelineDeletePayload,
  cateringTimelineEditPayload,
  cateringTimelineEditorFor,
  cateringTimelineReorderControls,
  cateringTimelineReorderPayload,
  editCateringAccessField,
  editCateringTimelineEditorField,
  formatCateringEquipmentWindow,
  formatCateringTimelineWindow,
  isCateringExecutionConflict,
  markCateringTimelineEditorConflict,
  mayReloadCateringTimelineEditor,
  maySubmitCateringEquipmentDraft,
  maySubmitCateringStaffDraft,
  maySubmitCateringTimelineDraft,
  maySubmitCateringTimelineEditor,
  cateringEquipmentQuantityIsValid,
  markCateringAccessConflict,
  maySaveCateringAccess,
  preserveCateringAccessForm,
  prepareCateringCreate,
  reconcileCateringAccessForm,
  reconcileCateringTimelineEditor,
  resolveCateringAccessReviewField,
  discardCateringAccessDraft,
  cateringAccessReviewIsOpen,
  CATERING_ACCESS_MERGE_FIELDS,
  settleCateringAccessForm,
  settleCateringCreateDraft,
  settleCateringTimelineEditor,
  shouldRefetchExecutionAfterError,
  splitCateringEquipment,
  CATERING_ACCESS_NO_INSTRUCTIONS,
  cateringAccessHasInstructions,
  cateringEquipmentIsBlocking,
  cateringTimelineItemIsBlocking,
  type CateringAccessDraft,
  type CateringAccessFormState,
  type CateringEquipmentDraft,
  type CateringExecutionError,
  type CateringStaffDraft,
  type CateringTimelineDraft,
  type CateringTimelineEditorState,
  type CateringTimelineMoveDirection,
  type OpenCateringTimelineEditor,
} from "@/pages/services/catering-booking-execution-state";
import { moveCateringTimelineItem } from "@/pages/services/catering-booking-execution-state";

/**
 * The Phase 2J execution section, rendered INSIDE the existing Phase 2H/2I booking workspace.
 *
 * There is no second routing hierarchy and no separate dashboard: this is another card in the workspace the
 * participant is already in, using the same React Query patterns, the same polling cadence constant, and the same
 * read-only semantics as the Files and Communication sections beside it.
 *
 * MOBILE. This is the surface a provider actually operates an event from, on a phone, standing in a loading bay.
 * Every control is at least 44px in its smallest dimension, every icon-only button carries an accessible label
 * naming the record it acts on, lists are single-column and wrap rather than scrolling sideways, and the event-day
 * actions -- completing a run-of-show item, ticking a milestone, moving equipment to received -- are one tap with no
 * dialog in the way. Only destructive actions ask for confirmation.
 *
 * PRIVACY. A customer's payload contains no crew, no milestones, no provider-private timeline item, no
 * provider-private equipment and no provider-private access note, because the server never serialized them. This
 * component renders what it was given; it does not filter secrets out of a fuller response.
 */
export default function BookingExecution({ bookingId, userId, role, editable }: { bookingId: string; userId: string; role: "provider" | "customer"; editable: boolean }) {
  const cache = useQueryClient();
  const identity = `${userId}:${bookingId}`;
  const key = cateringBookingExecutionKey(userId, bookingId);
  const provider = role === "provider";

  const [timelineDraft, setTimelineDraft] = useState<CateringTimelineDraft>(EMPTY_CATERING_TIMELINE_DRAFT);
  const [staffDraft, setStaffDraft] = useState<CateringStaffDraft>(EMPTY_CATERING_STAFF_DRAFT);
  const [equipmentDraft, setEquipmentDraft] = useState<CateringEquipmentDraft>(EMPTY_CATERING_EQUIPMENT_DRAFT);
  const [accessForm, setAccessForm] = useState<CateringAccessFormState>({ identity: "", value: null, baseline: null, dirty: false });
  const [editor, setEditor] = useState<CateringTimelineEditorState>(null);
  const [notice, setNotice] = useState<{ message: string; retryable: boolean } | null>(null);

  const query = useQuery({
    queryKey: key,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    // Same cadence constant as every other workspace section, and it stops on a terminal booking for the same
    // reason: a cancelled or completed booking's execution plan is settled, so re-asking forever would be pure
    // traffic. Reading never closes -- the query still loads and still refetches on focus.
    refetchInterval: (polled: { state: { data?: { editable?: boolean } } }) =>
      cateringWorkspacePollInterval(effectiveCateringEditable(editable, polled.state.data?.editable)),
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<CateringBookingExecutionView> => {
      const response = await fetch(cateringBookingExecutionPath(bookingId), { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message || "The event execution plan could not be loaded"), { code: typeof body.code === "string" ? body.code : undefined });
      return body;
    },
  });
  const execution = query.data;
  // The section's OWN authoritative reading of whether the booking is still writable. The parent workspace summary
  // is fetched once and does not poll, so trusting it alone would present a terminal booking as editable until a
  // failed save revealed otherwise.
  const canMutate = effectiveCateringEditable(editable, execution?.editable);
  const timeline = execution?.timeline ?? [];

  // Reconcile the access form with the authoritative payload.
  //
  // Three cases, decided in one place: a clean form hydrates wholesale; a dirty form whose last save was refused as
  // stale keeps every edited field and takes ONLY the fresh concurrency version, so the next Save can succeed; a
  // dirty form that is merely dirty is left completely alone. Before the rebase existed, a conflict was terminal --
  // the form stayed dirty, so hydration was blocked, so the stale version stayed in the draft, so every later Save
  // conflicted again until the provider hard-refreshed and lost the draft entirely.
  useEffect(() => {
    if (!execution) return;
    setAccessForm((current) => reconcileCateringAccessForm(current, identity, execution.access));
  }, [identity, execution?.access.updatedAt, Boolean(execution)]);
  // An editor open on an item another tab deleted, or on a booking that just became terminal, closes once the
  // authoritative payload says so.
  const timelineIds = timeline.map((item) => item.id);
  // The delimiter is an ESCAPED NUL, not a literal one. A raw NUL byte in the source makes text tools -- rg, and
  // anything else that sniffs for binary -- treat this whole file as binary and skip its contents. The runtime
  // fingerprint is unchanged: NUL is still the separator, because no id can contain it.
  const timelineFingerprint = timelineIds.join("\u0000");
  useEffect(() => {
    if (!execution) return;
    setEditor((current) => reconcileCateringTimelineEditor(current, identity, canMutate, timelineIds));
  }, [identity, timelineFingerprint, canMutate]);
  // Drafts belong to the booking on screen. Moving to another booking starts fresh rather than carrying one
  // booking's half-typed crew assignment -- and its spent idempotency token -- into another.
  const identityRef = useRef(identity);
  useEffect(() => {
    if (identityRef.current === identity) return;
    identityRef.current = identity;
    setTimelineDraft(EMPTY_CATERING_TIMELINE_DRAFT);
    setStaffDraft(EMPTY_CATERING_STAFF_DRAFT);
    setEquipmentDraft(EMPTY_CATERING_EQUIPMENT_DRAFT);
    setEditor(null);
    setNotice(null);
  }, [identity]);

  /**
   * The booking that STARTED a request, captured at submission time.
   *
   * This component stays mounted across a booking change -- only the route parameter moves -- so a callback that
   * read `identity`, `key` or `userId` from render scope described whichever booking was on screen when the response
   * landed, not the one that issued it. Save access details on booking A, navigate to B before it answers, and A's
   * record was installed into B's form or produced a conflict in it. Two forms that happen to look alike make that
   * invisible.
   *
   * So every mutation carries its own origin, every completion invalidates the ORIGINATING booking's queries, and
   * local form state is settled only when the origin is still what is on screen.
   */
  type ExecutionOrigin = { identity: string; bookingId: string; userId: string };
  type ExecutionMutation = {
    origin: ExecutionOrigin;
    path: string; method: string; body?: unknown;
    /** What to settle locally once the server has accepted this particular write. */
    settle?: "timeline-draft" | "staff-draft" | "equipment-draft" | "access" | "editor";
    itemId?: string;
    /**
     * The EXACT draft this request was built from.
     *
     * A create settles against this snapshot rather than clearing whatever is in the form when the response lands.
     * The form stays editable during a slow request on purpose, so by then the provider may already be typing the
     * next record -- and clearing unconditionally silently destroyed it.
     */
    submittedTimeline?: CateringTimelineDraft;
    submittedStaff?: CateringStaffDraft;
    submittedEquipment?: CateringEquipmentDraft;
    /** The same idea for the two edit forms: settle against what was sent, never against what is on screen now. */
    submittedEditor?: { itemId: string; draft: OpenCateringTimelineEditor["draft"] };
    submittedAccess?: CateringAccessDraft;
  };
  const origin = (): ExecutionOrigin => ({ identity, bookingId, userId });
  /** Whether a completion belongs to the booking currently on screen. Read from a ref, so it is true NOW. */
  const settlesHere = (started: ExecutionOrigin) => started.identity === identityRef.current;
  const mutation = useMutation({
    // The URL is built from the ORIGIN's booking id, not from render scope, so a request that outlives a navigation
    // still addresses the booking it was issued for.
    mutationFn: async ({ origin: started, path, method, body }: ExecutionMutation) => {
      let response: Response;
      try {
        response = await fetch(`/api/catering/bookings/${started.bookingId}${path}`, {
          method, credentials: "include",
          headers: body === undefined ? undefined : { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (transportError) {
        // The request never got an answer. It may not have reached the server at all, or it may have been applied
        // and the response lost -- which is exactly why the draft (and its idempotency token) is kept below.
        throw Object.assign(new Error(String((transportError as Error)?.message ?? transportError)), { offline: true });
      }
      if (response.status === 204) return {};
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(value.message || "This change could not be saved"), { code: typeof value.code === "string" ? value.code : undefined });
      return value;
    },
    onSuccess: (value: Record<string, unknown>, variables) => {
      const started = variables.origin;
      // Always refresh the ORIGINATING booking, whichever booking is rendered now: that is the data this response
      // actually changed, and its cache is keyed by that booking.
      cache.invalidateQueries({ queryKey: cateringBookingExecutionKey(started.userId, started.bookingId) });
      cache.invalidateQueries({ queryKey: ["catering", "booking-workspace", started.userId, started.bookingId] });
      // Everything below writes booking-local component state, which only exists for the booking on screen. A
      // response for one the participant has navigated away from has nothing here to settle and must touch nothing.
      if (!settlesHere(started)) return;
      setNotice(null);
      // Each create clears the form only when the live draft is still the attempt that just succeeded. If newer
      // edits are there, they are kept: the created record shows up in the list above either way, which is the real
      // confirmation, and a half-typed second record is not something a completion may throw away.
      if (variables.submittedTimeline) setTimelineDraft((live) => settleCateringCreateDraft(live, variables.submittedTimeline!, EMPTY_CATERING_TIMELINE_DRAFT));
      if (variables.submittedStaff) setStaffDraft((live) => settleCateringCreateDraft(live, variables.submittedStaff!, EMPTY_CATERING_STAFF_DRAFT));
      if (variables.submittedEquipment) setEquipmentDraft((live) => settleCateringCreateDraft(live, variables.submittedEquipment!, EMPTY_CATERING_EQUIPMENT_DRAFT));
      // The editor closes only if it still holds what was saved; if the provider kept typing, it stays open with
      // the newer text, rebased onto the version this save just produced.
      if (variables.submittedEditor) {
        const saved = (value.item as { updatedAt?: string } | undefined)?.updatedAt;
        if (saved) setEditor((live) => settleCateringTimelineEditor(live, variables.submittedEditor!, saved));
      }
      if (variables.settle === "access" && value.access) setAccessForm((current) => settleCateringAccessForm(current, started.identity, value.access as never, variables.submittedAccess));
    },
    onError: (error: CateringExecutionError, variables) => {
      const started = variables.origin;
      // A refusal is about the originating booking too, so its cache is the one that may need re-reading...
      if (shouldRefetchExecutionAfterError(error)) cache.invalidateQueries({ queryKey: cateringBookingExecutionKey(started.userId, started.bookingId) });
      // ...and its message, its conflicted editor and its preserved form all belong to that booking's screen. On a
      // different booking there is nothing to mark and nothing to say.
      if (!settlesHere(started)) return;
      const outcome = cateringExecutionFailureNotice(error);
      setNotice({ message: outcome.message, retryable: outcome.retryable });
      // A conflicted editor is MARKED, not closed: the participant's words stay on screen, and saving is disabled
      // until they reload the newer version to start from.
      if (variables.settle === "editor" && variables.itemId && isCateringExecutionConflict(error)) {
        setEditor((current) => markCateringTimelineEditorConflict(current, variables.itemId!));
      }
      // A failed access save keeps the form dirty, so the next poll cannot quietly replace unsaved instructions.
      // A save refused as STALE additionally asks to be rebased: the refetch below brings the authoritative record,
      // and the reconcile effect then hands the form its fresh version while leaving the edits alone.
      if (variables.settle === "access") setAccessForm(isCateringExecutionConflict(error) ? markCateringAccessConflict : preserveCateringAccessForm);
    },
  });
  const pending = mutation.isPending;

  // Every create prepares its attempt the same way: the idempotency token is reused only when the MATERIAL payload
  // is identical to the one it was minted for, and a materially changed payload gets a fresh token. That is what
  // stops an old idempotent response from being read as successful persistence of newer edits -- the server would
  // rightly answer the old token with the old record, and the client would have cleared a record that never
  // existed. The prepared draft is stored so the request and the form agree on which token is in flight, and it is
  // also the snapshot the completion settles against.
  const submitTimeline = (event: FormEvent) => {
    event.preventDefault();
    if (!maySubmitCateringTimelineDraft(timelineDraft, canMutate, pending)) return;
    const attempt = prepareCateringCreate(timelineDraft, cateringTimelineCreatePayload, () => crypto.randomUUID());
    setTimelineDraft(attempt.draft);
    mutation.mutate({ origin: origin(), path: "/execution/timeline", method: "POST", body: attempt.body, settle: "timeline-draft", submittedTimeline: attempt.draft });
  };
  const submitStaff = (event: FormEvent) => {
    event.preventDefault();
    if (!maySubmitCateringStaffDraft(staffDraft, canMutate, pending)) return;
    const attempt = prepareCateringCreate(staffDraft, cateringStaffCreatePayload, () => crypto.randomUUID());
    setStaffDraft(attempt.draft);
    mutation.mutate({ origin: origin(), path: "/execution/staff", method: "POST", body: attempt.body, settle: "staff-draft", submittedStaff: attempt.draft });
  };
  const submitEquipment = (event: FormEvent) => {
    event.preventDefault();
    if (!maySubmitCateringEquipmentDraft(equipmentDraft, canMutate, pending)) return;
    const attempt = prepareCateringCreate(equipmentDraft, cateringEquipmentCreatePayload, () => crypto.randomUUID());
    setEquipmentDraft(attempt.draft);
    mutation.mutate({ origin: origin(), path: "/execution/equipment", method: "POST", body: attempt.body, settle: "equipment-draft", submittedEquipment: attempt.draft });
  };
  const submitAccess = (event: FormEvent) => {
    event.preventDefault();
    // A form with an unreviewed field disagreement is not submittable at all: saving it would write one side of a
    // disagreement nobody has adjudicated over the other.
    const draft = accessForm.value;
    if (!draft || !maySaveCateringAccess(accessForm, canMutate, pending)) return;
    mutation.mutate({ origin: origin(), path: "/execution/access", method: "PUT", body: cateringAccessSavePayload(draft), settle: "access", submittedAccess: { ...draft } });
  };
  const submitEditor = (open: OpenCateringTimelineEditor) => {
    if (!maySubmitCateringTimelineEditor(open, canMutate, pending)) return;
    mutation.mutate({ origin: origin(), path: `/execution/timeline/${open.itemId}`, method: "PATCH", body: cateringTimelineEditPayload(open), settle: "editor", itemId: open.itemId, submittedEditor: { itemId: open.itemId, draft: { ...open.draft } } });
  };
  const moveItem = (itemId: string, direction: CateringTimelineMoveDirection) => {
    const next = moveCateringTimelineItem(timeline, itemId, direction);
    if (next) mutation.mutate({ origin: origin(), path: "/execution/timeline/reorder", method: "POST", body: cateringTimelineReorderPayload(next) });
  };
  const reorderControlsFor = (itemId: string) => cateringTimelineReorderControls(timeline, itemId, { role, editable: canMutate, editorOpen: editor !== null, pending });

  if (query.isLoading) return <Card id="execution"><CardHeader><CardTitle>Event execution</CardTitle></CardHeader><CardContent><p role="status">Loading the event execution plan…</p></CardContent></Card>;
  if (query.isError || !execution) {
    return <Card id="execution"><CardHeader><CardTitle>Event execution</CardTitle></CardHeader><CardContent className="space-y-2" role="alert">
      <p>The event execution plan could not be loaded.</p>
      <Button variant="outline" className="min-h-11" onClick={() => query.refetch()}>Retry loading the execution plan</Button>
    </CardContent></Card>;
  }

  const equipment = splitCateringEquipment(execution.equipment);
  const visibilityChoices = cateringExecutionVisibilityChoices(role);

  return <Card id="execution"><CardHeader>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><CardTitle>Event execution</CardTitle>
        <CardDescription>{provider ? "Your operational plan for the day of service. Items marked provider-only are never shown to the customer." : "The event plan your caterer has shared with you."}</CardDescription>
      </div>
      <Badge variant={cateringReadinessVariant(execution.readiness.state)}>{CATERING_READINESS_STATE_LABELS[execution.readiness.state]}</Badge>
    </div>
  </CardHeader><CardContent className="space-y-6">

    {/* Readiness. Every line is derived server-side from persisted records this actor may see; nothing here is
        computed from a client-supplied count, and a customer never receives a provider-only signal. */}
    <section aria-labelledby="execution-readiness">
      <h3 id="execution-readiness" className="font-medium">Event-day readiness</h3>
      <ul className="mt-2 space-y-2">{execution.readiness.signals.map((signal) => <li key={signal.signal} className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant={cateringReadinessVariant(signal.state)}>{CATERING_READINESS_STATE_LABELS[signal.state]}</Badge>
        <span className="min-w-0 break-words text-sm">{signal.detail}</span>
      </li>)}</ul>
      {execution.readiness.milestones && <p className="mt-2 text-sm text-muted-foreground">Milestones complete: {execution.readiness.milestones.completed} of {execution.readiness.milestones.total}</p>}
      {!canMutate && <p className="mt-3 font-medium">{CATERING_EXECUTION_READ_ONLY_BANNER}</p>}
    </section>

    {/* Run-of-show */}
    <section aria-labelledby="execution-timeline" className="space-y-3 border-t pt-4">
      <h3 id="execution-timeline" className="font-medium">Run of show</h3>
      {timeline.length === 0
        ? <p className="text-muted-foreground">{provider ? CATERING_EXECUTION_PROVIDER_EMPTY : CATERING_EXECUTION_CUSTOMER_EMPTY}</p>
        : <ul className="space-y-2">{timeline.map((item) => {
            const open = activeCateringTimelineEditor(editor, identity, item.id, canMutate);
            return <li key={item.id} className="rounded-lg border p-3">
              {open
                ? <TimelineEditor open={open} pending={pending} identity={identity} items={timeline} editor={editor}
                    onField={(field, value) => setEditor((current) => editCateringTimelineEditorField(current, identity, item.id, field, value))}
                    onCancel={() => setEditor(null)}
                    onReload={() => setEditor(cateringTimelineEditorFor(item, identity))}
                    onSubmit={() => submitEditor(open)} choices={visibilityChoices} />
                : <TimelineRow item={item} provider={provider} editable={canMutate} pending={pending}
                    reorder={reorderControlsFor(item.id)}
                    onMove={(direction) => moveItem(item.id, direction)}
                    onToggle={() => mutation.mutate({ origin: origin(), path: `/execution/timeline/${item.id}`, method: "PATCH", body: cateringTimelineCompletionPayload(item) })}
                    onEdit={() => setEditor(cateringTimelineEditorFor(item, identity))}
                    onDelete={() => { if (window.confirm(`Remove “${item.title}” from the run of show?`)) mutation.mutate({ origin: origin(), path: `/execution/timeline/${item.id}`, method: "DELETE", body: cateringTimelineDeletePayload(item) }); }} />}
            </li>;
          })}</ul>}

      {provider && canMutate && <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitTimeline}>
        <div className="sm:col-span-2"><Label htmlFor="execution-title">Add a run-of-show item</Label>
          <Input className="min-h-11" id="execution-title" maxLength={160} value={timelineDraft.title} onChange={(event) => setTimelineDraft((current) => ({ ...current, title: event.target.value }))} /></div>
        <div><Label htmlFor="execution-category">Stage</Label>
          <select id="execution-category" className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2" value={timelineDraft.category}
            onChange={(event) => setTimelineDraft((current) => ({ ...current, category: event.target.value as CateringTimelineCategory }))}>
            {CATERING_TIMELINE_CATEGORIES.map((category) => <option key={category} value={category}>{CATERING_TIMELINE_CATEGORY_LABELS[category]}</option>)}
          </select></div>
        <div><Label htmlFor="execution-visibility">Visibility</Label>
          <select id="execution-visibility" className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2" value={timelineDraft.visibility}
            onChange={(event) => setTimelineDraft((current) => ({ ...current, visibility: event.target.value as CateringExecutionVisibility }))}>
            {visibilityChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select></div>
        <div><Label htmlFor="execution-start">Starts (event local)</Label>
          <Input className="min-h-11" id="execution-start" type="time" value={timelineDraft.scheduledTime} onChange={(event) => setTimelineDraft((current) => ({ ...current, scheduledTime: event.target.value }))} /></div>
        <div><Label htmlFor="execution-end">Ends (event local)</Label>
          <Input className="min-h-11" id="execution-end" type="time" value={timelineDraft.endTime} onChange={(event) => setTimelineDraft((current) => ({ ...current, endTime: event.target.value }))} /></div>
        <div className="sm:col-span-2"><Label htmlFor="execution-description">Notes</Label>
          <Textarea id="execution-description" maxLength={2000} value={timelineDraft.description} onChange={(event) => setTimelineDraft((current) => ({ ...current, description: event.target.value }))} /></div>
        <label className="flex min-h-11 items-center gap-2 sm:col-span-2">
          <input type="checkbox" className="h-5 w-5" checked={timelineDraft.isBlocker} onChange={(event) => setTimelineDraft((current) => ({ ...current, isBlocker: event.target.checked }))} />
          <span className="text-sm">This item is blocking the event</span>
        </label>
        <Button className="min-h-11 sm:col-span-2 sm:justify-self-start" disabled={!maySubmitCateringTimelineDraft(timelineDraft, canMutate, pending)}>Add to run of show</Button>
      </form>}
    </section>

    {/* Crew. Provider-only: a customer's payload has no `staff` key, so this whole section is never rendered for
        them and there is nothing here to hide from them. */}
    {provider && execution.staff && <section aria-labelledby="execution-crew" className="space-y-3 border-t pt-4">
      <h3 id="execution-crew" className="font-medium">Crew</h3>
      <p className="text-sm text-muted-foreground">Crew assignments are provider-only and are never shown to the customer.</p>
      {execution.staff.length === 0
        ? <p className="text-muted-foreground">No crew has been assigned yet.</p>
        : <ul className="space-y-2">{execution.staff.map((assignment) => <StaffRow key={assignment.id} assignment={assignment} editable={canMutate} pending={pending}
            onDelete={() => { if (window.confirm(`Remove ${assignment.workerName} from this event's crew?`)) mutation.mutate({ origin: origin(), path: `/execution/staff/${assignment.id}`, method: "DELETE", body: cateringExecutionDeletePayload(assignment) }); }} />)}</ul>}
      {canMutate && <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitStaff}>
        <div><Label htmlFor="crew-name">Crew member</Label>
          <Input className="min-h-11" id="crew-name" maxLength={120} value={staffDraft.workerName} onChange={(event) => setStaffDraft((current) => ({ ...current, workerName: event.target.value }))} /></div>
        <div><Label htmlFor="crew-role">Role</Label>
          <select id="crew-role" className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2" value={staffDraft.role}
            onChange={(event) => setStaffDraft((current) => ({ ...current, role: event.target.value as CateringStaffRole }))}>
            {CATERING_STAFF_ROLES.map((staffRole) => <option key={staffRole} value={staffRole}>{CATERING_STAFF_ROLE_LABELS[staffRole]}</option>)}
          </select></div>
        {staffDraft.role === "custom" && <div className="sm:col-span-2"><Label htmlFor="crew-custom-role">Name the custom role</Label>
          <Input className="min-h-11" id="crew-custom-role" maxLength={60} value={staffDraft.customRole} onChange={(event) => setStaffDraft((current) => ({ ...current, customRole: event.target.value }))} /></div>}
        <div><Label htmlFor="crew-arrival">Arrives (event local)</Label>
          <Input className="min-h-11" id="crew-arrival" type="time" value={staffDraft.arrivalTime} onChange={(event) => setStaffDraft((current) => ({ ...current, arrivalTime: event.target.value }))} /></div>
        <div><Label htmlFor="crew-departure">Leaves (event local)</Label>
          <Input className="min-h-11" id="crew-departure" type="time" value={staffDraft.departureTime} onChange={(event) => setStaffDraft((current) => ({ ...current, departureTime: event.target.value }))} /></div>
        <div className="sm:col-span-2"><Label htmlFor="crew-contact">Contact note</Label>
          <Input className="min-h-11" id="crew-contact" maxLength={200} value={staffDraft.contactNote} onChange={(event) => setStaffDraft((current) => ({ ...current, contactNote: event.target.value }))} /></div>
        <div className="sm:col-span-2"><Label htmlFor="crew-responsibility">Responsibilities</Label>
          <Textarea id="crew-responsibility" maxLength={2000} value={staffDraft.responsibilityNote} onChange={(event) => setStaffDraft((current) => ({ ...current, responsibilityNote: event.target.value }))} /></div>
        <Button className="min-h-11 sm:col-span-2 sm:justify-self-start" disabled={!maySubmitCateringStaffDraft(staffDraft, canMutate, pending)}>Assign crew member</Button>
      </form>}
    </section>}

    {/* Equipment */}
    <section aria-labelledby="execution-equipment" className="space-y-3 border-t pt-4">
      <h3 id="execution-equipment" className="font-medium">Equipment and rentals</h3>
      {execution.equipment.length === 0
        ? <p className="text-muted-foreground">{provider ? "No equipment has been recorded yet." : "Your caterer has not shared any equipment details."}</p>
        : <ul className="space-y-2">{execution.equipment.map((item) => <EquipmentRow key={item.id} item={item} provider={provider} editable={canMutate} pending={pending}
            onStatus={(status) => mutation.mutate({ origin: origin(), path: `/execution/equipment/${item.id}`, method: "PATCH", body: { status, expectedUpdatedAt: item.updatedAt } })}
            onDelete={() => { if (window.confirm(`Remove “${item.name}” from this event's equipment?`)) mutation.mutate({ origin: origin(), path: `/execution/equipment/${item.id}`, method: "DELETE", body: cateringExecutionDeletePayload(item) }); }} />)}</ul>}
      {provider && <p className="text-sm text-muted-foreground">{equipment.providerPrivate.length} provider-only, {equipment.shared.length} shared with the customer.</p>}
      {provider && canMutate && <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitEquipment}>
        <div><Label htmlFor="equipment-name">Equipment</Label>
          <Input className="min-h-11" id="equipment-name" maxLength={160} value={equipmentDraft.name} onChange={(event) => setEquipmentDraft((current) => ({ ...current, name: event.target.value }))} /></div>
        <div><Label htmlFor="equipment-quantity">Quantity</Label>
          <Input className="min-h-11" id="equipment-quantity" type="number" min={1} max={9999} value={equipmentDraft.quantity} onChange={(event) => setEquipmentDraft((current) => ({ ...current, quantity: event.target.value }))} /></div>
        <div><Label htmlFor="equipment-source">Source</Label>
          <select id="equipment-source" className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2" value={equipmentDraft.sourceType}
            onChange={(event) => setEquipmentDraft((current) => ({ ...current, sourceType: event.target.value as CateringEquipmentSource }))}>
            {CATERING_EQUIPMENT_SOURCES.map((source) => <option key={source} value={source}>{CATERING_EQUIPMENT_SOURCE_LABELS[source]}</option>)}
          </select></div>
        <div><Label htmlFor="equipment-source-name">Vendor or supplier</Label>
          <Input className="min-h-11" id="equipment-source-name" maxLength={160} value={equipmentDraft.sourceName} onChange={(event) => setEquipmentDraft((current) => ({ ...current, sourceName: event.target.value }))} /></div>
        <div><Label htmlFor="equipment-pickup-date">Pickup or delivery date</Label>
          <Input className="min-h-11" id="equipment-pickup-date" type="date" value={equipmentDraft.pickupDate} onChange={(event) => setEquipmentDraft((current) => ({ ...current, pickupDate: event.target.value }))} /></div>
        <div><Label htmlFor="equipment-pickup-time">Pickup or delivery time</Label>
          <Input className="min-h-11" id="equipment-pickup-time" type="time" value={equipmentDraft.pickupTime} onChange={(event) => setEquipmentDraft((current) => ({ ...current, pickupTime: event.target.value }))} /></div>
        <div><Label htmlFor="equipment-return-date">Return date</Label>
          <Input className="min-h-11" id="equipment-return-date" type="date" value={equipmentDraft.returnDate} onChange={(event) => setEquipmentDraft((current) => ({ ...current, returnDate: event.target.value }))} /></div>
        <div><Label htmlFor="equipment-return-time">Return time</Label>
          <Input className="min-h-11" id="equipment-return-time" type="time" value={equipmentDraft.returnTime} onChange={(event) => setEquipmentDraft((current) => ({ ...current, returnTime: event.target.value }))} /></div>
        <div><Label htmlFor="equipment-status">Status</Label>
          <select id="equipment-status" className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2" value={equipmentDraft.status}
            onChange={(event) => setEquipmentDraft((current) => ({ ...current, status: event.target.value as CateringEquipmentStatus }))}>
            {CATERING_EQUIPMENT_STATUSES.map((status) => <option key={status} value={status}>{CATERING_EQUIPMENT_STATUS_LABELS[status]}</option>)}
          </select></div>
        <div><Label htmlFor="equipment-visibility">Visibility</Label>
          <select id="equipment-visibility" className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2" value={equipmentDraft.visibility}
            onChange={(event) => setEquipmentDraft((current) => ({ ...current, visibility: event.target.value as CateringExecutionVisibility }))}>
            {visibilityChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select></div>
        <div className="sm:col-span-2"><Label htmlFor="equipment-notes">Notes</Label>
          <Textarea id="equipment-notes" maxLength={2000} value={equipmentDraft.notes} onChange={(event) => setEquipmentDraft((current) => ({ ...current, notes: event.target.value }))} /></div>
        <label className="flex min-h-11 items-center gap-2 sm:col-span-2">
          <input type="checkbox" className="h-5 w-5" checked={equipmentDraft.isBlocker} onChange={(event) => setEquipmentDraft((current) => ({ ...current, isBlocker: event.target.checked }))} />
          <span className="text-sm">This equipment is blocking the event</span>
        </label>
        {!cateringEquipmentQuantityIsValid(equipmentDraft.quantity) && <p className="text-sm text-destructive sm:col-span-2" role="alert">Quantity must be a whole number between 1 and 9999.</p>}
        <Button className="min-h-11 sm:col-span-2 sm:justify-self-start" disabled={!maySubmitCateringEquipmentDraft(equipmentDraft, canMutate, pending)}>Add equipment</Button>
      </form>}
    </section>

    {/* Venue and access instructions */}
    <section aria-labelledby="execution-access" className="space-y-3 border-t pt-4">
      <h3 id="execution-access" className="font-medium">Venue and access instructions</h3>
      <p className="text-sm text-muted-foreground">These are instructions for reaching and working at the event location recorded on this booking. The address and date live on the booking itself.</p>
      {provider && canMutate && accessForm.value
        ? <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitAccess}>
            {/* Rendered FROM the shared field metadata: label, control kind and length limit all come from the same
                definition the request schema is built from, so a browser constraint cannot disagree with the
                validation it is meant to anticipate. Every textarea used to allow 4000 and every text input allowed
                unlimited, while the schema caps most notes at 2000, the entrance at 240, a contact at 120 and a
                phone at 40 -- so the browser accepted input the server could only ever answer with a 400. */}
            {CATERING_ACCESS_FIELDS.map((meta) => <div key={meta.field} className={meta.control === "textarea" ? "sm:col-span-2" : undefined}>
              <Label htmlFor={`access-${meta.field}`}>{meta.label}</Label>
              {meta.control === "textarea"
                ? <Textarea id={`access-${meta.field}`} maxLength={meta.maxLength} value={accessForm.value![meta.field]} onChange={(event) => setAccessForm((current) => editCateringAccessField(current, meta.field, event.target.value))} />
                /* A time control carries no maxLength at all: it holds an HH:mm wall clock validated by a regex,
                   and a character count would be a meaningless constraint on a time picker. */
                : <Input className="min-h-11" id={`access-${meta.field}`} type={meta.control === "time" ? "time" : "text"}
                    maxLength={meta.control === "time" ? undefined : meta.maxLength}
                    value={accessForm.value![meta.field]} onChange={(event) => setAccessForm((current) => editCateringAccessField(current, meta.field, event.target.value))} />}
            </div>)}
            <div><Label htmlFor="access-contact-source">Venue contact supplied by</Label>
              <select id="access-contact-source" className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2" value={accessForm.value.venueContactSource}
                onChange={(event) => setAccessForm((current) => editCateringAccessField(current, "venueContactSource", event.target.value as "" | "provider" | "customer"))}>
                <option value="">Not specified</option><option value="provider">Us</option><option value="customer">The customer</option>
              </select></div>
            <label className="flex min-h-11 items-center gap-2 sm:col-span-2">
              <input type="checkbox" className="h-5 w-5" checked={accessForm.value.accessConfirmed} onChange={(event) => setAccessForm((current) => editCateringAccessField(current, "accessConfirmed", event.target.checked))} />
              <span className="text-sm">Venue access is confirmed</span>
            </label>
            {/* Field-level disagreements, decided by a person and nobody else.
                Reaching here means the provider's save was refused as stale, the authoritative record came back, and
                the merge adopted the fresh value for every field they had NOT touched -- but for these, both sides
                changed the same field to different things. The version deliberately has not advanced, so the form
                cannot be saved until each one is resolved: that is what stops a refused save from turning into a
                silent overwrite of the other writer's work. */}
            {accessForm.review && accessForm.review.fields.length > 0 && <div className="space-y-3 rounded-md border border-destructive p-3 sm:col-span-2" role="alert">
              <p className="font-medium">Someone else changed these fields while you were editing.</p>
              <p className="text-sm">Your other edits are already merged with theirs. Choose which value to keep for each field below — saving is disabled until you do, so nothing of theirs is overwritten by accident.</p>
              {accessForm.review.fields.map((field) => <div key={field} className="space-y-2 border-t pt-2">
                <p className="font-medium">{cateringAccessFieldLabel(field)}</p>
                <p className="break-words text-sm"><span className="text-muted-foreground">Theirs: </span>{formatAccessValue(accessForm.review!.theirs[field])}</p>
                <p className="break-words text-sm"><span className="text-muted-foreground">Yours: </span>{formatAccessValue(accessForm.value![field])}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setAccessForm((current) => resolveCateringAccessReviewField(current, field, "mine"))}>Keep mine</Button>
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setAccessForm((current) => resolveCateringAccessReviewField(current, field, "theirs"))}>Use theirs</Button>
                </div>
              </div>)}
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => { if (execution && window.confirm("Discard your unsaved access edits and start from the current saved version?")) setAccessForm(discardCateringAccessDraft(accessForm, identity, execution.access)); }}>Discard my edits and reload</Button>
            </div>}
            <Button className="min-h-11 sm:col-span-2 sm:justify-self-start" disabled={!maySaveCateringAccess(accessForm, canMutate, pending)}>Save access instructions</Button>
            {accessForm.dirty && !cateringAccessReviewIsOpen(accessForm) && <p className="text-sm text-muted-foreground sm:col-span-2" role="status">You have unsaved access instructions.</p>}
          </form>
        : <AccessReadOnly access={execution.access} role={role} />}
    </section>

    {/* Milestones. Provider-only, one tap each, and completing every one still does not complete the booking. */}
    {provider && execution.milestones && <section aria-labelledby="execution-milestones" className="space-y-3 border-t pt-4">
      <h3 id="execution-milestones" className="font-medium">Event-day milestones</h3>
      <p className="text-sm text-muted-foreground">Operational progress only. Marking these does not change the booking status — completing the booking stays a separate action.</p>
      <ul className="space-y-2">{execution.milestones.map((milestone) => <MilestoneRow key={milestone.key} milestone={milestone} editable={canMutate} pending={pending}
        onToggle={() => mutation.mutate({
          origin: origin(),
          path: `/execution/milestones/${milestone.key}`, method: "PUT",
          body: { completed: !milestone.completed, ...(milestone.updatedAt ? { expectedUpdatedAt: milestone.updatedAt } : {}) },
        })} />)}</ul>
    </section>}

    {notice && <div role="alert" className="space-y-2">
      <p className="text-destructive">{notice.message}</p>
      {/* A retryable failure leaves the form exactly as it was, still holding this attempt's idempotency token, so
          submitting again is the retry -- and a request that did reach the server resolves to the record it already
          created rather than adding a second one. A conflict is deliberately NOT retryable: the participant has to
          reload the newer version first, or they would overwrite it from an older base. */}
      {notice.retryable && <p className="text-sm">Your changes are still here. Submit again to retry.</p>}
    </div>}
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{pending ? "Saving your change…" : ""}</p>
  </CardContent></Card>;
}

/** One compared value, rendered readably: a boolean reads as yes/no and an empty field says so rather than showing nothing. */
function formatAccessValue(value: string | boolean): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value.trim() === "" ? "(empty)" : value;
}
/** The one label lookup, reading the shared metadata so the form, the review and the read-only list agree. */
function cateringAccessFieldLabel(field: string): string {
  return CATERING_ACCESS_FIELDS.find((meta) => meta.field === field)?.label ?? field;
}

/**
 * Read-only access instructions.
 *
 * Confirmation and instruction text are SEPARATE FACTS, and this renders both. Returning the empty-state message
 * before reaching the confirmation meant a booking whose access the caterer had explicitly confirmed, but for which
 * no notes had been typed, appeared to the customer as though nothing existed at all -- the exact opposite of what
 * the record said. The confirmation is now always shown; the absence of instructions is stated alongside it rather
 * than in place of it.
 *
 * `providerPrivateNotes` is filtered out for a customer here as well as being absent from their payload, so the two
 * independent barriers stay independent.
 */
function AccessReadOnly({ access, role }: { access: CateringBookingExecutionView["access"]; role: "provider" | "customer" }) {
  const entries = CATERING_ACCESS_FIELDS
    .filter((meta) => meta.field !== "providerPrivateNotes" || role === "provider")
    .map((meta) => [meta.label as string, (meta.field === "providerPrivateNotes" ? access.providerPrivateNotes : (access as Record<string, unknown>)[meta.field]) as unknown] as const)
    .filter((entry): entry is readonly [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "");
  return <div className="space-y-3">
    <dl className="grid gap-3 sm:grid-cols-2">
      {entries.map(([label, value]) => <div className="min-w-0" key={label}>
        <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
        <dd className="whitespace-pre-wrap break-words">{value}</dd>
      </div>)}
      {/* Always rendered, in every one of the four combinations of confirmed/unconfirmed and notes/no notes. */}
      <div className="min-w-0"><dt className="text-sm font-medium text-muted-foreground">Venue access</dt>
        <dd>{access.accessConfirmed ? "Confirmed" : "Not yet confirmed"}</dd></div>
      {access.venueContactSource && <div className="min-w-0"><dt className="text-sm font-medium text-muted-foreground">Venue contact supplied by</dt>
        <dd>{access.venueContactSource === "customer" ? "The customer" : "The caterer"}</dd></div>}
    </dl>
    {!cateringAccessHasInstructions(entries) && <p className="text-muted-foreground">{CATERING_ACCESS_NO_INSTRUCTIONS}</p>}
  </div>;
}

/** Presentation only. Every icon-only control names the item it acts on, so it is usable without sight of the row. */
function TimelineRow({ item, provider, editable, pending, reorder, onMove, onToggle, onEdit, onDelete }: {
  item: CateringExecutionTimelineItemView; provider: boolean; editable: boolean; pending: boolean;
  reorder: { up: boolean; down: boolean } | null;
  onMove: (direction: CateringTimelineMoveDirection) => void; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return <div className="flex min-w-0 items-start gap-3">
    {provider && <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded border" disabled={!editable || pending}
      aria-label={`${item.completed ? "Mark not done" : "Mark done"}: ${item.title}`} onClick={onToggle}>{item.completed && <Check className="h-5 w-5" aria-hidden="true" />}</button>}
    <div className="min-w-0 flex-1">
      <p className={`break-words font-medium ${item.completed ? "line-through" : ""}`}>{item.title}</p>
      <p className="text-sm text-muted-foreground">{CATERING_TIMELINE_CATEGORY_LABELS[item.category]} · {formatCateringTimelineWindow(item.scheduledTime, item.endTime)}</p>
      {item.description && <p className="break-words text-sm">{item.description}</p>}
      <div className="mt-1 flex flex-wrap gap-2">
        {cateringTimelineItemIsBlocking(item) && <Badge variant="destructive">Blocking</Badge>}
        {/* Only a provider is shown the visibility of an item -- a customer holds shared items alone, so the badge
            would say the same thing on every row and imply the existence of the ones they cannot see. */}
        {provider && <Badge variant="outline">{item.visibility === "shared" ? "Shared with customer" : "Provider only"}</Badge>}
      </div>
    </div>
    {provider && <div className="flex flex-wrap justify-end gap-2">
      {reorder && <>
        <Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11" aria-label={`Move ${item.title} earlier`} disabled={!reorder.up} onClick={() => onMove("up")}><ArrowUp className="h-4 w-4" aria-hidden="true" /></Button>
        <Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11" aria-label={`Move ${item.title} later`} disabled={!reorder.down} onClick={() => onMove("down")}><ArrowDown className="h-4 w-4" aria-hidden="true" /></Button>
      </>}
      {editable && <>
        <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={onEdit}>Edit</Button>
        <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Remove ${item.title}`} disabled={pending} onClick={onDelete}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
      </>}
    </div>}
  </div>;
}

function TimelineEditor({ open, pending, identity, items, editor, onField, onCancel, onReload, onSubmit, choices }: {
  open: OpenCateringTimelineEditor; pending: boolean; identity: string;
  items: readonly CateringExecutionTimelineItemView[]; editor: CateringTimelineEditorState;
  onField: <K extends keyof OpenCateringTimelineEditor["draft"]>(field: K, value: OpenCateringTimelineEditor["draft"][K]) => void;
  onCancel: () => void; onReload: () => void; onSubmit: () => void;
  choices: { value: CateringExecutionVisibility; label: string }[];
}) {
  const mayReload = mayReloadCateringTimelineEditor(editor, identity, items);
  return <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <div className="sm:col-span-2"><Label htmlFor={`edit-title-${open.itemId}`}>Title</Label>
      <Input className="min-h-11" id={`edit-title-${open.itemId}`} maxLength={160} value={open.draft.title} onChange={(event) => onField("title", event.target.value)} /></div>
    <div><Label htmlFor={`edit-category-${open.itemId}`}>Stage</Label>
      <select id={`edit-category-${open.itemId}`} className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2" value={open.draft.category}
        onChange={(event) => onField("category", event.target.value as CateringTimelineCategory)}>
        {CATERING_TIMELINE_CATEGORIES.map((category) => <option key={category} value={category}>{CATERING_TIMELINE_CATEGORY_LABELS[category]}</option>)}
      </select></div>
    <div><Label htmlFor={`edit-visibility-${open.itemId}`}>Visibility</Label>
      <select id={`edit-visibility-${open.itemId}`} className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2" value={open.draft.visibility}
        onChange={(event) => onField("visibility", event.target.value as CateringExecutionVisibility)}>
        {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </select></div>
    <div><Label htmlFor={`edit-start-${open.itemId}`}>Starts</Label>
      <Input className="min-h-11" id={`edit-start-${open.itemId}`} type="time" value={open.draft.scheduledTime} onChange={(event) => onField("scheduledTime", event.target.value)} /></div>
    <div><Label htmlFor={`edit-end-${open.itemId}`}>Ends</Label>
      <Input className="min-h-11" id={`edit-end-${open.itemId}`} type="time" value={open.draft.endTime} onChange={(event) => onField("endTime", event.target.value)} /></div>
    <div className="sm:col-span-2"><Label htmlFor={`edit-description-${open.itemId}`}>Notes</Label>
      <Textarea id={`edit-description-${open.itemId}`} maxLength={2000} value={open.draft.description} onChange={(event) => onField("description", event.target.value)} /></div>
    <label className="flex min-h-11 items-center gap-2 sm:col-span-2">
      <input type="checkbox" className="h-5 w-5" checked={open.draft.isBlocker} onChange={(event) => onField("isBlocker", event.target.checked)} />
      <span className="text-sm">This item is blocking the event</span>
    </label>
    {open.conflict && <div className="space-y-2 rounded-md border border-destructive p-3 sm:col-span-2" role="alert">
      <p className="font-medium">This run-of-show item changed somewhere else while you were editing it.</p>
      <p className="text-sm">Your unsaved changes above are kept, but they are based on the older version, so saving them would overwrite the newer one. Reload the latest item to start from it — that replaces the draft above.</p>
      <Button type="button" variant="outline" className="min-h-11" disabled={pending || !mayReload} onClick={onReload}>Reload latest item</Button>
      {!mayReload && <p className="text-sm" role="status">Fetching the latest version of this item…</p>}
    </div>}
    <div className="flex gap-2 sm:col-span-2">
      <Button className="min-h-11" disabled={pending || open.conflict || open.draft.title.trim().length === 0}>Save item</Button>
      <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>Cancel</Button>
    </div>
  </form>;
}

function StaffRow({ assignment, editable, pending, onDelete }: { assignment: CateringExecutionStaffView; editable: boolean; pending: boolean; onDelete: () => void }) {
  return <li className="flex min-w-0 flex-wrap items-start gap-3 rounded-lg border p-3">
    <div className="min-w-0 flex-1">
      <p className="break-words font-medium">{assignment.workerName}</p>
      <p className="text-sm text-muted-foreground">{cateringStaffRoleLabel(assignment, CATERING_STAFF_ROLE_LABELS)}{assignment.arrivalTime || assignment.departureTime ? ` · ${formatCateringTimelineWindow(assignment.arrivalTime, assignment.departureTime)}` : ""}</p>
      {assignment.contactNote && <p className="break-words text-sm">{assignment.contactNote}</p>}
      {assignment.responsibilityNote && <p className="break-words text-sm">{assignment.responsibilityNote}</p>}
    </div>
    {editable && <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Remove ${assignment.workerName} from the crew`} disabled={pending} onClick={onDelete}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>}
  </li>;
}

function EquipmentRow({ item, provider, editable, pending, onStatus, onDelete }: {
  item: CateringExecutionEquipmentView; provider: boolean; editable: boolean; pending: boolean;
  onStatus: (status: CateringEquipmentStatus) => void; onDelete: () => void;
}) {
  return <li className="flex min-w-0 flex-wrap items-start gap-3 rounded-lg border p-3">
    <div className="min-w-0 flex-1">
      <p className="break-words font-medium">{item.name} × {item.quantity}</p>
      <p className="text-sm text-muted-foreground">{CATERING_EQUIPMENT_SOURCE_LABELS[item.sourceType]}{item.sourceName ? ` · ${item.sourceName}` : ""}</p>
      {formatCateringEquipmentWindow(item.pickupDate, item.pickupTime) && <p className="text-sm">Pickup: {formatCateringEquipmentWindow(item.pickupDate, item.pickupTime)}</p>}
      {formatCateringEquipmentWindow(item.returnDate, item.returnTime) && <p className="text-sm">Return: {formatCateringEquipmentWindow(item.returnDate, item.returnTime)}</p>}
      {item.notes && <p className="break-words text-sm">{item.notes}</p>}
      <div className="mt-1 flex flex-wrap gap-2">
        <Badge variant="outline">{CATERING_EQUIPMENT_STATUS_LABELS[item.status]}</Badge>
        {/* The SAME predicate the server's readiness derivation uses, so a received, in-use, returned or cancelled
            item is not badged as blocking while the summary above reports ready. The stored flag is untouched. */}
        {cateringEquipmentIsBlocking(item) && <Badge variant="destructive">Blocking</Badge>}
        {provider && <Badge variant="outline">{item.visibility === "shared" ? "Shared with customer" : "Provider only"}</Badge>}
      </div>
    </div>
    {provider && editable && <div className="flex flex-wrap justify-end gap-2">
      <div><Label className="sr-only" htmlFor={`equipment-status-${item.id}`}>{`Status for ${item.name}`}</Label>
        <select id={`equipment-status-${item.id}`} className="flex min-h-11 rounded-md border border-input bg-background px-3 py-2" value={item.status} disabled={pending}
          onChange={(event) => onStatus(event.target.value as CateringEquipmentStatus)}>
          {CATERING_EQUIPMENT_STATUSES.map((status) => <option key={status} value={status}>{CATERING_EQUIPMENT_STATUS_LABELS[status]}</option>)}
        </select></div>
      <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Remove ${item.name}`} disabled={pending} onClick={onDelete}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
    </div>}
  </li>;
}

function MilestoneRow({ milestone, editable, pending, onToggle }: { milestone: CateringExecutionMilestoneView; editable: boolean; pending: boolean; onToggle: () => void }) {
  const label = CATERING_EXECUTION_MILESTONE_LABELS[milestone.key];
  return <li className="flex min-w-0 items-center gap-3 rounded-lg border p-3">
    <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded border" disabled={!editable || pending}
      aria-label={`${milestone.completed ? "Mark not done" : "Mark done"}: ${label}`} aria-pressed={milestone.completed} onClick={onToggle}>
      {milestone.completed && <Check className="h-5 w-5" aria-hidden="true" />}
    </button>
    <div className="min-w-0 flex-1">
      <p className={`break-words ${milestone.completed ? "line-through" : ""}`}>{label}</p>
      {milestone.completedAt && <time className="text-sm text-muted-foreground" dateTime={milestone.completedAt}>{new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(milestone.completedAt))}</time>}
    </div>
  </li>;
}
