import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CATERING_AMENDMENT_STATUS_LABELS, describeCateringAmendmentChanges, formatCateringAmendmentMoney,
  type CateringAmendmentTerms, type CateringAmendmentView, type CateringAmendmentsView,
} from "@shared/catering-amendments";
import { formatCateringCalendarDate } from "@shared/catering-availability";
import { CATERING_OFFER_NOTE_MAX_LENGTH } from "@shared/catering-offers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { bindClientRequestId, offerAuthorLabel, type BoundRequestId } from "@/pages/services/catering-offer-state";
import {
  amendmentDraftFromTerms, buildAmendmentProposal, cateringAmendmentInvalidationKeys, cateringAmendmentsKey, CateringAmendmentRequestError, isCurrentAmendmentTarget,
  type AmendmentDraft, type AmendmentDraftErrors, type AmendmentIdentity, type CateringAmendmentAction,
} from "@/pages/services/catering-amendment-state";

async function readJson(response: Response) { return response.json().catch(() => ({})); }

async function fetchAmendments(bookingId: string): Promise<CateringAmendmentsView> {
  const response = await fetch(`/api/catering/bookings/${encodeURIComponent(bookingId)}/amendments`, { credentials: "include" });
  const body = await readJson(response);
  if (!response.ok) throw new Error(body.message || "Booking amendments could not be loaded");
  return body.amendments;
}

async function post(path: string, body: unknown, fallback: string): Promise<{ amendments: CateringAmendmentsView }> {
  const response = await fetch(path, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const parsed = await readJson(response);
  if (!response.ok) throw new CateringAmendmentRequestError(parsed.message || fallback, response.status, typeof parsed.code === "string" ? parsed.code : null);
  return parsed;
}

const when = (iso: string) => new Date(iso).toLocaleString();

function TermsList({ terms }: { terms: CateringAmendmentTerms }) {
  return (
    <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
      <dt className="text-muted-foreground">Event date</dt><dd className="break-words font-medium">{formatCateringCalendarDate(terms.eventDate)}</dd>
      <dt className="text-muted-foreground">Guests</dt><dd className="break-words">{terms.guestCount ?? "Not specified"}</dd>
      <dt className="text-muted-foreground">Agreed price</dt><dd className="break-words">{formatCateringAmendmentMoney(terms.priceCents, terms.currency)}</dd>
      {terms.termsNote && <><dt className="text-muted-foreground">Terms</dt><dd className="whitespace-pre-wrap break-words">{terms.termsNote}</dd></>}
    </dl>
  );
}

/** Changed terms only, as OLD -> NEW text. The change is in the words, so it never depends on colour. */
function Changes({ amendment }: { amendment: CateringAmendmentView }) {
  const changes = describeCateringAmendmentChanges(amendment);
  return (
    <ul className="space-y-1 text-sm" aria-label="Proposed changes">
      {changes.map((change) => (
        <li key={change.field} className="break-words"><span className="font-medium">{change.label}:</span> <span className="whitespace-pre-wrap">{change.before}</span> <span aria-label="changes to">→</span> <span className="whitespace-pre-wrap font-medium">{change.after}</span></li>
      ))}
    </ul>
  );
}

export function BookingAmendments({ bookingId, userId, role }: { bookingId: string; userId: string; role: "provider" | "customer" }) {
  const client = useQueryClient();
  const shown = useRef<AmendmentIdentity>({ userId, bookingId });
  shown.current = { userId, bookingId };
  const key = cateringAmendmentsKey(userId, bookingId);
  // The terms and base a proposal is written against are captured when the editor opens and never re-read from a later refetch.
  const [editor, setEditor] = useState<{ base: CateringAmendmentTerms; baseAmendmentId: string | null; draft: AmendmentDraft } | null>(null);
  const [errors, setErrors] = useState<AmendmentDraftErrors>({});
  const [confirming, setConfirming] = useState<"accept" | "decline" | "withdraw" | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const proposeRequest = useRef<BoundRequestId | null>(null);
  useEffect(() => { setEditor(null); setErrors({}); setConfirming(null); setConflict(null); proposeRequest.current = null; }, [userId, bookingId]);

  const query = useQuery({ queryKey: key, queryFn: () => fetchAmendments(bookingId), staleTime: 15_000, refetchOnWindowFocus: true });
  const view = query.data;

  const settle = async (identity: AmendmentIdentity, action: CateringAmendmentAction) => {
    await Promise.all(cateringAmendmentInvalidationKeys({ surfaceUserId: identity.userId, bookingId: identity.bookingId, action }).map((queryKey) => client.invalidateQueries({ queryKey: [...queryKey] })));
  };
  const onFailure = async (error: Error, identity: AmendmentIdentity) => {
    if (!isCurrentAmendmentTarget(shown.current, identity)) return;
    if (error instanceof CateringAmendmentRequestError && error.isConflict) {
      setConflict(error.message); setConfirming(null); setEditor(null); proposeRequest.current = null;
      await client.invalidateQueries({ queryKey: cateringAmendmentsKey(identity.userId, identity.bookingId) });
    }
  };

  const propose = useMutation({
    mutationFn: async (variables: { identity: AmendmentIdentity; body: Record<string, unknown>; baseAmendmentId: string | null; clientRequestId: string }) =>
      post(`/api/catering/bookings/${encodeURIComponent(variables.identity.bookingId)}/amendments`, { ...variables.body, expectedBaseAmendmentId: variables.baseAmendmentId, clientRequestId: variables.clientRequestId }, "The amendment could not be proposed"),
    onSuccess: async (data, variables) => {
      client.setQueryData(cateringAmendmentsKey(variables.identity.userId, variables.identity.bookingId), data.amendments);
      proposeRequest.current = null;
      if (isCurrentAmendmentTarget(shown.current, variables.identity)) { setEditor(null); setConflict(null); }
      await settle(variables.identity, "propose");
    },
    onError: (error, variables) => onFailure(error, variables.identity),
  });
  const respond = useMutation({
    mutationFn: async (variables: { identity: AmendmentIdentity; amendmentId: string; action: "accept" | "decline" | "withdraw" }) =>
      post(`/api/catering/bookings/${encodeURIComponent(variables.identity.bookingId)}/amendments/${encodeURIComponent(variables.amendmentId)}/${variables.action}`, {}, "The amendment could not be updated"),
    onSuccess: async (data, variables) => {
      client.setQueryData(cateringAmendmentsKey(variables.identity.userId, variables.identity.bookingId), data.amendments);
      if (isCurrentAmendmentTarget(shown.current, variables.identity)) { setConfirming(null); setConflict(null); }
      await settle(variables.identity, variables.action);
    },
    onError: (error, variables) => onFailure(error, variables.identity),
  });
  useEffect(() => { propose.reset(); respond.reset(); }, [userId, bookingId]);

  if (query.isLoading) return <p role="status" className="text-sm">Loading booking terms…</p>;
  if (query.isError || !view) {
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>Booking amendments could not be loaded. Nothing has been assumed about the booking's terms.</p>
        <Button className="min-h-11" variant="outline" onClick={() => query.refetch()}>Retry</Button>
      </div>
    );
  }

  const identity = { userId, bookingId };
  const busy = propose.isPending || respond.isPending;
  const pending = view.pending;
  const history = view.amendments;
  const failure = (mutation: { isError: boolean; error: Error | null }) => (mutation.isError && mutation.error && !(mutation.error instanceof CateringAmendmentRequestError && mutation.error.isConflict) ? mutation.error.message : null);
  const dialogCopy = {
    accept: { title: "Accept this amendment?", body: "The booking's terms change to the proposed ones straight away. The earlier terms stay in the history.", cta: "Accept amendment", pendingCta: "Accepting…" },
    decline: { title: "Decline this amendment?", body: "The booking keeps its current terms. The proposal stays in the history as declined.", cta: "Decline amendment", pendingCta: "Declining…" },
    withdraw: { title: "Withdraw your proposal?", body: "The booking keeps its current terms. The proposal stays in the history as withdrawn.", cta: "Withdraw proposal", pendingCta: "Withdrawing…" },
  } as const;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    const built = buildAmendmentProposal(editor.draft, editor.base, { billingTermsLocked: view.billingTermsLocked });
    if (!built.ok) { setErrors(built.errors); return; }
    setErrors({});
    proposeRequest.current = bindClientRequestId(proposeRequest.current, { bookingId, base: editor.baseAmendmentId, ...built.body });
    propose.mutate({ identity, body: built.body, baseAmendmentId: editor.baseAmendmentId, clientRequestId: proposeRequest.current.id });
  };
  const setField = (field: keyof AmendmentDraft, value: string) => setEditor((open) => (open ? { ...open, draft: { ...open.draft, [field]: value } } : open));
  const proposeError = failure(propose);

  return (
    <section className="min-w-0 space-y-3 rounded-lg border bg-muted/30 p-3 sm:p-4" aria-label="Booking terms and amendments" aria-busy={query.isFetching}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">Current booking terms</h4>
        {view.bookingStatus !== "confirmed" && <Badge variant="outline" className="whitespace-normal text-left" role="status">{view.bookingStatus === "pending_confirmation" ? "Terms are still being negotiated" : "Read-only: this booking has ended"}</Badge>}
      </div>
      {conflict && <p role="alert" className="break-words rounded-md border border-destructive p-2 text-sm">{conflict} The latest terms are shown below.</p>}
      <TermsList terms={view.currentTerms} />
      <p className="text-xs text-muted-foreground">These stay the agreement until an amendment is accepted. Tasks, schedule items, files and messages are not changed automatically when the terms change.</p>

      {pending && (
        <div className="min-w-0 space-y-2 rounded-md border p-3" aria-label="Pending amendment">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="break-words text-sm font-medium">{offerAuthorLabel(pending.proposedBy, role)} proposed a change · {when(pending.createdAt)}</p>
            <Badge variant="outline" className="whitespace-normal text-left">{CATERING_AMENDMENT_STATUS_LABELS.pending}</Badge>
          </div>
          <Changes amendment={pending} />
          {pending.message && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">“{pending.message}”</p>}
          <p className="text-xs text-muted-foreground">{view.actions.canAccept ? "Nothing changes until you accept." : "Nothing changes until the other party accepts."}</p>
          <div className="flex flex-wrap gap-2">
            {view.actions.canAccept && <Button className="min-h-11" disabled={busy} onClick={() => { respond.reset(); setConfirming("accept"); }}>Accept amendment</Button>}
            {view.actions.canDecline && <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => { respond.reset(); setConfirming("decline"); }}>Decline</Button>}
            {view.actions.canWithdraw && <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => { respond.reset(); setConfirming("withdraw"); }}>Withdraw proposal</Button>}
          </div>
        </div>
      )}

      {view.actions.canPropose && !editor && (
        <div><Button className="min-h-11" disabled={busy} onClick={() => { propose.reset(); setErrors({}); setConflict(null); proposeRequest.current = null; setEditor({ base: view.currentTerms, baseAmendmentId: view.latestAcceptedAmendmentId, draft: amendmentDraftFromTerms(view.currentTerms) }); }}>Propose a change</Button></div>
      )}
      {editor && view.actions.canPropose && (
        <form className="space-y-3" noValidate aria-label="Propose an amendment" onSubmit={submit}>
          <p className="text-sm text-muted-foreground">Change only what needs to change. The other party has to accept before the booking's terms are updated.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`amend-date-${bookingId}`}>Event date</Label>
              <Input id={`amend-date-${bookingId}`} type="date" value={editor.draft.eventDate} disabled={propose.isPending} aria-invalid={Boolean(errors.eventDate)} aria-describedby={errors.eventDate ? `amend-date-error-${bookingId}` : undefined} onChange={(event) => setField("eventDate", event.target.value)} />
              {errors.eventDate && <p id={`amend-date-error-${bookingId}`} role="alert" className="text-sm text-destructive">{errors.eventDate}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`amend-guests-${bookingId}`}>Guest count</Label>
              <Input id={`amend-guests-${bookingId}`} inputMode="numeric" autoComplete="off" value={editor.draft.guestCount} disabled={propose.isPending} aria-invalid={Boolean(errors.guestCount)} aria-describedby={errors.guestCount ? `amend-guests-error-${bookingId}` : undefined} onChange={(event) => setField("guestCount", event.target.value)} />
              {errors.guestCount && <p id={`amend-guests-error-${bookingId}`} role="alert" className="text-sm text-destructive">{errors.guestCount}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`amend-price-${bookingId}`}>Agreed price ({view.currentTerms.currency})</Label>
              <Input id={`amend-price-${bookingId}`} inputMode="decimal" autoComplete="off" value={editor.draft.price} disabled={propose.isPending || view.billingTermsLocked} aria-invalid={Boolean(errors.price)} aria-describedby={`amend-price-help-${bookingId}`} onChange={(event) => setField("price", event.target.value)} />
              <p id={`amend-price-help-${bookingId}`} className={errors.price ? "text-sm text-destructive" : "text-xs text-muted-foreground"} role={errors.price ? "alert" : undefined}>{errors.price ?? (view.billingTermsLocked ? "Billing has started, so the price can no longer change." : "Changing the price is only possible before any invoice or payment exists.")}</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`amend-terms-${bookingId}`}>Terms description</Label>
            <Textarea id={`amend-terms-${bookingId}`} rows={3} maxLength={CATERING_OFFER_NOTE_MAX_LENGTH + 200} value={editor.draft.termsNote} disabled={propose.isPending} aria-invalid={Boolean(errors.termsNote)} onChange={(event) => setField("termsNote", event.target.value)} />
            {errors.termsNote && <p role="alert" className="text-sm text-destructive">{errors.termsNote}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`amend-message-${bookingId}`}>Reason, optional</Label>
            <Textarea id={`amend-message-${bookingId}`} rows={2} value={editor.draft.message} disabled={propose.isPending} aria-invalid={Boolean(errors.message)} onChange={(event) => setField("message", event.target.value)} />
            <p className="text-xs text-muted-foreground">Visible to both of you.</p>
            {errors.message && <p role="alert" className="text-sm text-destructive">{errors.message}</p>}
          </div>
          {errors.form && <p role="alert" className="text-sm text-destructive">{errors.form}</p>}
          {proposeError && <p role="alert" className="break-words text-sm text-destructive">{proposeError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={propose.isPending}>{propose.isPending ? "Sending…" : "Send proposal"}</Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={propose.isPending} onClick={() => { setEditor(null); setErrors({}); proposeRequest.current = null; }}>Cancel</Button>
          </div>
        </form>
      )}

      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Amendment history{history.length ? ` (${history.length})` : ""}</summary>
        <div className="mt-2 space-y-3">
          {history.length === 0 ? <p className="text-sm text-muted-foreground">This booking has not been amended. Its terms are the ones that were confirmed.</p> : (
            <ol className="space-y-3" aria-label="Amendment history, newest first">
              {history.map((amendment) => (
                <li key={amendment.id} className="min-w-0 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="break-words text-sm font-medium">Amendment {amendment.amendmentNumber} · proposed by {offerAuthorLabel(amendment.proposedBy, role).toLowerCase()}</p>
                    <Badge variant="outline" className="whitespace-normal text-left">{CATERING_AMENDMENT_STATUS_LABELS[amendment.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{when(amendment.createdAt)}{amendment.respondedAt ? ` · closed ${when(amendment.respondedAt)}` : ""}</p>
                  <div className="mt-2"><Changes amendment={amendment} /></div>
                  {amendment.message && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">“{amendment.message}”</p>}
                </li>
              ))}
            </ol>
          )}
          {view.originalTerms && <div><p className="text-sm font-medium">Terms as first confirmed</p><TermsList terms={view.originalTerms} /></div>}
        </div>
      </details>

      <AlertDialog open={confirming !== null && pending !== null} onOpenChange={(open) => { if (!open && !respond.isPending) setConfirming(null); }}>
        <AlertDialogContent>
          {confirming && pending && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{dialogCopy[confirming].title}</AlertDialogTitle>
                <AlertDialogDescription>{dialogCopy[confirming].body}</AlertDialogDescription>
              </AlertDialogHeader>
              <Changes amendment={pending} />
              {failure(respond) && <p role="alert" className="break-words text-sm text-destructive">{failure(respond)}</p>}
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11" disabled={respond.isPending}>Keep reviewing</AlertDialogCancel>
                <Button className="min-h-11" variant={confirming === "accept" ? "default" : "destructive"} disabled={respond.isPending} onClick={() => respond.mutate({ identity, amendmentId: pending.id, action: confirming })}>{respond.isPending ? dialogCopy[confirming].pendingCta : dialogCopy[confirming].cta}</Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
