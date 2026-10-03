import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CATERING_OFFER_GUEST_MAX, CATERING_OFFER_NOTE_MAX_LENGTH, CATERING_OFFER_STATE_LABELS, cateringOfferRevisionKey, describeCateringOfferChanges, formatCateringOfferMoney,
  type CateringOfferNegotiationView, type CateringOfferRevisionView, type CateringOfferTermsInput,
} from "@shared/catering-offers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  CateringOfferRequestError, cateringOfferInvalidationKeys, isCurrentOfferTarget, newCateringClientRequestId, offerAuthorLabel,
  offerDraftFromNegotiation, validateChangeRequestMessage, validateOfferDraft, type CateringOfferAction, type OfferDraft, type OfferDraftErrors, type OfferMutationIdentity,
} from "@/pages/services/catering-offer-state";

async function readJson(response: Response) { return response.json().catch(() => ({})); }

async function fetchNegotiation(bookingId: string): Promise<CateringOfferNegotiationView> {
  const response = await fetch(`/api/catering/bookings/${encodeURIComponent(bookingId)}/offer`, { credentials: "include" });
  const body = await readJson(response);
  if (!response.ok) throw new Error(body.message || "The offer could not be loaded");
  return body.negotiation;
}

async function post(path: string, body: unknown, fallback: string): Promise<Record<string, unknown>> {
  const response = await fetch(path, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const parsed = await readJson(response);
  if (!response.ok) throw new CateringOfferRequestError(parsed.message || fallback, response.status, typeof parsed.code === "string" ? parsed.code : null);
  return parsed;
}

const when = (iso: string) => new Date(iso).toLocaleString();

/**
 * The terms form, shared by the provider's first offer (on an accepted inquiry) and every later revision. It holds its own
 * draft, validates before it submits, and reports a refusal beside the button that caused it. Money is typed as text and
 * converted to cents once, by `validateOfferDraft`.
 */
export function OfferTermsForm({ idPrefix, initial, submitLabel, pendingLabel, pending, error, currency = "USD", onSubmit, onCancel }: {
  idPrefix: string; initial: OfferDraft; submitLabel: string; pendingLabel: string; pending: boolean; error?: string | null; currency?: string;
  onSubmit: (terms: Pick<CateringOfferTermsInput, "priceCents" | "guestCount" | "note" | "currency">) => void; onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<OfferDraft>(initial);
  const [errors, setErrors] = useState<OfferDraftErrors>({});
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const checked = validateOfferDraft(draft, currency);
    if (!checked.ok) { setErrors(checked.errors); return; }
    setErrors({});
    onSubmit(checked.terms);
  };
  return (
    <form className="space-y-3" onSubmit={submit} noValidate aria-label="Offer terms">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-price`}>Total price ({currency}), optional</Label>
          <Input id={`${idPrefix}-price`} inputMode="decimal" autoComplete="off" value={draft.price} disabled={pending} aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? `${idPrefix}-price-error` : undefined} onChange={(event) => setDraft({ ...draft, price: event.target.value })} />
          {errors.price && <p id={`${idPrefix}-price-error`} role="alert" className="text-sm text-destructive">{errors.price}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-guests`}>Guest count, optional</Label>
          <Input id={`${idPrefix}-guests`} inputMode="numeric" autoComplete="off" value={draft.guestCount} disabled={pending} aria-invalid={Boolean(errors.guestCount)} aria-describedby={errors.guestCount ? `${idPrefix}-guests-error` : undefined} onChange={(event) => setDraft({ ...draft, guestCount: event.target.value })} placeholder={`1 to ${CATERING_OFFER_GUEST_MAX.toLocaleString()}`} />
          {errors.guestCount && <p id={`${idPrefix}-guests-error`} role="alert" className="text-sm text-destructive">{errors.guestCount}</p>}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-note`}>What the offer includes, optional</Label>
        <Textarea id={`${idPrefix}-note`} rows={4} maxLength={CATERING_OFFER_NOTE_MAX_LENGTH + 200} value={draft.note} disabled={pending} aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? `${idPrefix}-note-error` : undefined} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        {errors.note && <p id={`${idPrefix}-note-error`} role="alert" className="text-sm text-destructive">{errors.note}</p>}
        <p className="text-xs text-muted-foreground">Shown to the customer with this offer. ChefSire does not collect payment for catering.</p>
      </div>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={pending}>{pending ? pendingLabel : submitLabel}</Button>
        {onCancel && <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

function revisionStatusText(revision: CateringOfferRevisionView): string {
  if (revision.kind === "change_request") return "Change request";
  if (revision.acceptedAt) return "Accepted";
  return revision.isCurrent ? "Current offer" : "Replaced by a newer revision";
}

function Terms({ priceCents, currency, guestCount, note }: { priceCents: number | null; currency: string; guestCount: number | null; note: string | null }) {
  return (
    <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
      <dt className="text-muted-foreground">Price</dt><dd className="break-words font-medium">{formatCateringOfferMoney(priceCents, currency)}</dd>
      <dt className="text-muted-foreground">Guests</dt><dd className="break-words">{guestCount ?? "Not specified"}</dd>
      {note && <><dt className="text-muted-foreground">Terms</dt><dd className="whitespace-pre-wrap break-words">{note}</dd></>}
    </dl>
  );
}

function History({ negotiation }: { negotiation: CateringOfferNegotiationView }) {
  const ordered = negotiation.revisions;
  if (ordered.length === 0) return <p className="text-sm text-muted-foreground">This offer was made before revision history existed, so there are no earlier versions to show. Its terms are above.</p>;
  const previousOffer = (revision: CateringOfferRevisionView) => ordered.find((candidate) => candidate.kind === "offer" && candidate.revisionNumber < revision.revisionNumber) ?? null;
  return (
    <ol className="space-y-3" aria-label="Offer history, newest first">
      {ordered.map((revision) => {
        const changes = revision.kind === "offer" ? describeCateringOfferChanges(previousOffer(revision), revision) : [];
        return (
          <li key={revision.id} className="min-w-0 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="break-words text-sm font-medium">{revision.kind === "offer" ? `Offer revision ${revision.revisionNumber}` : `Change request (revision ${revision.revisionNumber})`} · {offerAuthorLabel(revision.proposedBy, negotiation.role)}</p>
              <Badge variant="outline" className="whitespace-normal text-left">{revisionStatusText(revision)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{when(revision.createdAt)}{revision.respondsToRevisionNumber ? ` · about revision ${revision.respondsToRevisionNumber}` : ""}{revision.acceptedAt ? ` · accepted ${when(revision.acceptedAt)}` : ""}</p>
            {revision.kind === "offer" ? <div className="mt-2"><Terms priceCents={revision.priceCents} currency={revision.currency} guestCount={revision.guestCount} note={revision.note} />{changes.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{changes.map((change) => <li key={change} className="break-words">{change}</li>)}</ul>}</div>
              : <p className="mt-2 whitespace-pre-wrap break-words text-sm">{revision.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export function BookingOffer({ bookingId, userId, role, providerId = null }: { bookingId: string; userId: string; role: "provider" | "customer"; providerId?: string | null }) {
  const client = useQueryClient();
  const shown = useRef<OfferMutationIdentity>({ userId, bookingId });
  shown.current = { userId, bookingId };
  const [reviseOpen, setReviseOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changeMessage, setChangeMessage] = useState("");
  const [changeMessageError, setChangeMessageError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"accept" | "decline" | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  // One id per submission, so resending the same form (a dropped connection, a double tap) is one revision, never two.
  const requestId = useRef(newCateringClientRequestId());
  const key = cateringOfferRevisionKey(userId, bookingId);
  useEffect(() => { setReviseOpen(false); setChangesOpen(false); setChangeMessage(""); setChangeMessageError(null); setConfirm(null); setConflict(null); requestId.current = newCateringClientRequestId(); }, [userId, bookingId]);

  const query = useQuery({ queryKey: key, queryFn: () => fetchNegotiation(bookingId), staleTime: 15_000, refetchOnWindowFocus: true });
  const negotiation = query.data;

  const settle = async (identity: OfferMutationIdentity, action: CateringOfferAction) => {
    await Promise.all(cateringOfferInvalidationKeys({ surfaceUserId: identity.userId, providerId: role === "provider" ? identity.userId : providerId, bookingId: identity.bookingId, action }).map((queryKey) => client.invalidateQueries({ queryKey: [...queryKey] })));
  };
  const onFailure = async (error: Error, identity: OfferMutationIdentity) => {
    if (!isCurrentOfferTarget(shown.current, identity)) return;
    if (error instanceof CateringOfferRequestError && error.isConflict) {
      setConflict(error.message); setConfirm(null); setReviseOpen(false); requestId.current = newCateringClientRequestId();
      await client.invalidateQueries({ queryKey: cateringOfferRevisionKey(identity.userId, identity.bookingId) });
    }
  };

  const revise = useMutation({
    mutationFn: async (variables: { identity: OfferMutationIdentity; terms: Pick<CateringOfferTermsInput, "priceCents" | "guestCount" | "note" | "currency">; expectedRevisionId: string | null; clientRequestId: string }) =>
      post(`/api/catering/bookings/${encodeURIComponent(variables.identity.bookingId)}/offer/revisions`, { ...variables.terms, expectedRevisionId: variables.expectedRevisionId, clientRequestId: variables.clientRequestId }, "The offer could not be revised") as Promise<{ negotiation: CateringOfferNegotiationView }>,
    onSuccess: async (data, variables) => {
      client.setQueryData(cateringOfferRevisionKey(variables.identity.userId, variables.identity.bookingId), data.negotiation);
      if (isCurrentOfferTarget(shown.current, variables.identity)) { setReviseOpen(false); setConflict(null); requestId.current = newCateringClientRequestId(); }
      await settle(variables.identity, "revise");
    },
    onError: (error, variables) => onFailure(error, variables.identity),
  });
  const requestChanges = useMutation({
    mutationFn: async (variables: { identity: OfferMutationIdentity; revisionId: string | null; message: string; clientRequestId: string }) =>
      post(`/api/catering/bookings/${encodeURIComponent(variables.identity.bookingId)}/offer/change-requests`, { revisionId: variables.revisionId, message: variables.message, clientRequestId: variables.clientRequestId }, "Your request could not be sent") as Promise<{ negotiation: CateringOfferNegotiationView }>,
    onSuccess: async (data, variables) => {
      client.setQueryData(cateringOfferRevisionKey(variables.identity.userId, variables.identity.bookingId), data.negotiation);
      if (isCurrentOfferTarget(shown.current, variables.identity)) { setChangesOpen(false); setChangeMessage(""); setConflict(null); requestId.current = newCateringClientRequestId(); }
      await settle(variables.identity, "request-changes");
    },
    onError: (error, variables) => onFailure(error, variables.identity),
  });
  const accept = useMutation({
    mutationFn: async (variables: { identity: OfferMutationIdentity; revisionId: string | null }) => post(`/api/catering/bookings/${encodeURIComponent(variables.identity.bookingId)}/customer-confirm`, { revisionId: variables.revisionId }, "The offer could not be accepted"),
    onSuccess: async (_data, variables) => { if (isCurrentOfferTarget(shown.current, variables.identity)) { setConfirm(null); setConflict(null); } await settle(variables.identity, "accept"); },
    onError: (error, variables) => onFailure(error, variables.identity),
  });
  const decline = useMutation({
    mutationFn: async (variables: { identity: OfferMutationIdentity }) => post(`/api/catering/bookings/${encodeURIComponent(variables.identity.bookingId)}/cancel`, {}, "The offer could not be declined"),
    onSuccess: async (_data, variables) => { if (isCurrentOfferTarget(shown.current, variables.identity)) { setConfirm(null); setConflict(null); } await settle(variables.identity, "decline"); },
    onError: (error, variables) => onFailure(error, variables.identity),
  });
  useEffect(() => { revise.reset(); requestChanges.reset(); accept.reset(); decline.reset(); }, [userId, bookingId]);

  if (query.isLoading) return <p role="status" className="text-sm">Loading offer…</p>;
  if (query.isError || !negotiation) {
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>The offer could not be loaded. Nothing has been assumed about its terms.</p>
        <Button className="min-h-11" variant="outline" onClick={() => query.refetch()}>Retry</Button>
      </div>
    );
  }

  const identity = { userId, bookingId };
  const current = negotiation.revisions.find((revision) => revision.id === negotiation.currentRevisionId) ?? null;
  const terms = current ?? (negotiation.legacyTerms ? { priceCents: negotiation.legacyTerms.priceCents, currency: negotiation.legacyTerms.currency, guestCount: negotiation.legacyTerms.guestCount, note: null } : null);
  const accepted = negotiation.revisions.find((revision) => revision.acceptedAt !== null) ?? null;
  const busy = revise.isPending || requestChanges.isPending || accept.isPending || decline.isPending;
  const acceptLabel = current ? `Accept offer revision ${current.revisionNumber}` : "Accept offer";
  const stateText = negotiation.state === "accepted" ? (accepted ? `Terms accepted (revision ${accepted.revisionNumber})` : CATERING_OFFER_STATE_LABELS.accepted) : negotiation.state === "closed" ? `${CATERING_OFFER_STATE_LABELS.closed}: the booking was cancelled` : CATERING_OFFER_STATE_LABELS.open;

  return (
    <section className="min-w-0 space-y-3 rounded-lg border bg-muted/30 p-3 sm:p-4" aria-label="Offer and negotiation" aria-busy={query.isFetching}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">{negotiation.state === "open" ? "Current offer" : "Final offer"}{current ? ` · revision ${current.revisionNumber}` : negotiation.legacy ? " · original offer" : ""}</h4>
        <Badge variant="outline" className="whitespace-normal text-left" role="status">{stateText}</Badge>
      </div>
      {conflict && <p role="alert" className="break-words rounded-md border border-destructive p-2 text-sm">{conflict} The latest terms are shown below.</p>}
      {terms ? <Terms {...terms} /> : <p className="text-sm text-muted-foreground">No terms have been recorded for this offer.</p>}
      {current && <p className="text-xs text-muted-foreground">Offered {when(current.createdAt)}</p>}
      {!current && negotiation.legacyTerms?.offeredAt && <p className="text-xs text-muted-foreground">Offered {when(negotiation.legacyTerms.offeredAt)}</p>}
      {negotiation.changeRequestPending && <p role="status" className="break-words text-sm font-medium">{role === "provider" ? "The customer asked for changes. Send a revised offer to respond." : "You asked for changes. Waiting for the caterer to send a revised offer."}</p>}
      {negotiation.state !== "open" && <p className="text-sm text-muted-foreground">This negotiation is closed and read-only. {negotiation.state === "accepted" ? "Later changes need a separate booking amendment." : ""}</p>}

      {negotiation.actions.canAccept && !changesOpen && (
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" disabled={busy} onClick={() => { accept.reset(); setConfirm("accept"); }}>{acceptLabel}</Button>
          {negotiation.actions.canRequestChanges && <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => { setChangesOpen(true); setConflict(null); }}>Request changes</Button>}
          {negotiation.actions.canDecline && <Button className="min-h-11" variant="destructive" disabled={busy} onClick={() => { decline.reset(); setConfirm("decline"); }}>Decline offer</Button>}
        </div>
      )}
      {changesOpen && negotiation.actions.canRequestChanges && (
        <form className="space-y-2" noValidate aria-label="Request changes" onSubmit={(event) => {
          event.preventDefault();
          const problem = validateChangeRequestMessage(changeMessage);
          setChangeMessageError(problem);
          if (problem) return;
          requestChanges.mutate({ identity, revisionId: negotiation.currentRevisionId, message: changeMessage.trim(), clientRequestId: requestId.current });
        }}>
          <Label htmlFor={`offer-changes-${bookingId}`}>What would you like changed?</Label>
          <Textarea id={`offer-changes-${bookingId}`} rows={4} value={changeMessage} disabled={requestChanges.isPending} aria-invalid={Boolean(changeMessageError)} aria-describedby={`offer-changes-help-${bookingId}`} onChange={(event) => setChangeMessage(event.target.value)} />
          <p id={`offer-changes-help-${bookingId}`} className="text-xs text-muted-foreground">Sending this does not change the booking or its terms. The caterer decides whether to send you a revised offer, and nothing is confirmed until you accept one.</p>
          {changeMessageError && <p role="alert" className="text-sm text-destructive">{changeMessageError}</p>}
          {requestChanges.isError && !(requestChanges.error instanceof CateringOfferRequestError && requestChanges.error.isConflict) && <p role="alert" className="break-words text-sm text-destructive">{requestChanges.error.message}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={requestChanges.isPending}>{requestChanges.isPending ? "Sending…" : "Send change request"}</Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={requestChanges.isPending} onClick={() => { setChangesOpen(false); setChangeMessageError(null); }}>Cancel</Button>
          </div>
        </form>
      )}

      {negotiation.actions.canRevise && !reviseOpen && <div><Button className="min-h-11" disabled={busy} onClick={() => { setReviseOpen(true); setConflict(null); revise.reset(); }}>{negotiation.legacy ? "Send a revised offer" : "Revise offer"}</Button></div>}
      {reviseOpen && negotiation.actions.canRevise && (
        <OfferTermsForm idPrefix={`offer-${bookingId}`} initial={offerDraftFromNegotiation(negotiation)} currency={terms?.currency ?? "USD"} submitLabel="Send revised offer" pendingLabel="Sending revised offer…" pending={revise.isPending}
          error={revise.isError && !(revise.error instanceof CateringOfferRequestError && revise.error.isConflict) ? revise.error.message : null}
          onCancel={() => setReviseOpen(false)}
          onSubmit={(submitted) => revise.mutate({ identity, terms: submitted, expectedRevisionId: negotiation.currentRevisionId, clientRequestId: requestId.current })} />
      )}

      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Offer history{negotiation.revisions.length ? ` (${negotiation.revisions.length})` : ""}</summary>
        <div className="mt-2"><History negotiation={negotiation} /></div>
      </details>

      <AlertDialog open={confirm === "accept"} onOpenChange={(open) => { if (!open && !accept.isPending) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this offer?</AlertDialogTitle>
            <AlertDialogDescription>{terms ? `You are accepting ${current ? `revision ${current.revisionNumber}` : "the original offer"}: ${formatCateringOfferMoney(terms.priceCents, terms.currency)}${terms.guestCount ? ` for ${terms.guestCount} guests` : ""}. This confirms the booking with these terms.` : "This confirms the booking with the terms shown."}</AlertDialogDescription>
          </AlertDialogHeader>
          {accept.isError && !(accept.error instanceof CateringOfferRequestError && accept.error.isConflict) && <p role="alert" className="break-words text-sm text-destructive">{accept.error.message}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={accept.isPending}>Keep reviewing</AlertDialogCancel>
            <Button className="min-h-11" disabled={accept.isPending} onClick={() => accept.mutate({ identity, revisionId: negotiation.currentRevisionId })}>{accept.isPending ? "Accepting…" : "Accept and confirm"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirm === "decline"} onOpenChange={(open) => { if (!open && !decline.isPending) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this offer?</AlertDialogTitle>
            <AlertDialogDescription>This cancels the booking and the negotiation. The history stays on record, and you can send a new request later.</AlertDialogDescription>
          </AlertDialogHeader>
          {decline.isError && <p role="alert" className="break-words text-sm text-destructive">{decline.error.message}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={decline.isPending}>Keep offer</AlertDialogCancel>
            <Button className="min-h-11" variant="destructive" disabled={decline.isPending} onClick={() => decline.mutate({ identity })}>{decline.isPending ? "Declining…" : "Decline offer"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
