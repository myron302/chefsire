import { FormEvent, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { cateringBookingFilePresenceKey, cateringBookingFilesKey, cateringFileBoundary, cateringFilePresencePath, cateringFileSnapshot, type CateringBookingFilePresenceView, type CateringBookingFilePageView, type CateringBookingFileView, type CateringFileVisibility } from "@shared/catering-booking-files";
import { cateringWorkspacePollInterval, effectiveCateringEditable, observedCateringEditable } from "@shared/catering-booking-operations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { EMPTY_CATERING_REMOVED_RECORDS, cateringPreservedHistory, cateringPreservedTailIds, cateringReconciledRemovals, cateringRemovedIds, emptyCateringLoadedHistory, recordCateringRemovedRecords, type CateringLoadedHistory, type CateringRemovedRecords } from "@/pages/services/catering-booking-loaded-history";
import { EMPTY_CATERING_FILE_LEDGER, EMPTY_CATERING_IN_FLIGHT, cateringMutationIsPending, cateringMutationOrigin, cateringMutationOutcome, cateringOriginFileInvalidations, cateringOriginWorkspaceInvalidations, enterCateringMutation, exitCateringMutation, expectCateringFileAddition, expectCateringFileRemoval, observeCateringFileSnapshot, settleCateringRemovedFiles, visibleCateringMutationOutcome, type CateringFileLedger, type CateringInFlight, type CateringMutationOrigin, type CateringMutationOutcome } from "@/pages/services/catering-booking-mutation-origin";
import { CATERING_FILES_EMPTY, CATERING_FILES_READ_ONLY_BANNER, CATERING_FILE_ACCEPT, cateringFileDownloadPath, cateringFileSummary, cateringFileVisibilityBadge, cateringVisibilityChoices, chooseCateringVisibility, combineCateringFilePages, completeCateringFileUpload, emptyCateringFileDraft, markCateringFileAttempted, mayUploadCateringFile, nextCateringFileCursor, selectCateringFile, type CateringFileDraft } from "@/pages/services/catering-booking-files-state";

/**
 * An upload or a delete, immutable once started, carrying the booking it belongs to. This section stays mounted
 * across a route change, so a completion handler that read the booking from render scope would describe whichever
 * booking is on screen when the request lands rather than the one that issued it.
 */
type UploadAttempt = { origin: CateringMutationOrigin; file: File; visibility: CateringFileVisibility; requestId: string };
type RemoveAttempt = { origin: CateringMutationOrigin; fileId: string };

/**
 * The booking Files section, inside the Phase 2H workspace. A customer's rendering carries no provider-private
 * count, no placeholder and no visibility control, because the server never serves them a provider-private file and
 * the interface must not imply one could exist.
 */
export default function BookingFiles({ bookingId, userId, role, editable }: { bookingId: string; userId: string; role: "provider" | "customer"; editable: boolean }) {
  const cache = useQueryClient();
  const identity = `${userId}:${bookingId}`;
  const [draft, setDraft] = useState<CateringFileDraft>(() => emptyCateringFileDraft(role));
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Whether this section has already told the workspace that the booking went terminal.
  const terminalSeenRef = useRef(false);
  // The newest-page snapshot accounted for and the exact deltas this actor's own mutations are expected to produce,
  // BOTH keyed by booking. A poll that found a real change can then be told from a quiet one per booking, a change
  // this actor caused on one booking can never be absorbed as "mine" on another, and a counterpart change that
  // lands in the same response as a local one is still announced because it is not one of the expected deltas.
  const ledgerRef = useRef<CateringFileLedger>(EMPTY_CATERING_FILE_LEDGER);
  // Mirrors the live draft so a mutation callback, which fires long after its render, resolves against what the
  // participant currently has selected rather than the draft captured when the upload started.
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  // The booking currently on screen, readable from a callback that closed over an older render. Visible local state
  // -- the draft, the file input -- may only be touched when the completion belongs to this booking.
  const identityRef = useRef(identity);
  useEffect(() => { identityRef.current = identity; }, [identity]);
  // History this participant has already loaded. A poll refetches every loaded page and re-derives each cursor from
  // the page before it, so one new file shifts every boundary down and the oldest loaded file falls out of the last
  // page -- it was never removed, and without this it would vanish on a timer and have to be loaded again.
  const historyRef = useRef<CateringLoadedHistory<CateringBookingFileView>>(emptyCateringLoadedHistory());
  // Files proved gone, per booking: a delete this client performed, or one the presence check below established.
  // Page absence is never one of them.
  const [removed, setRemoved] = useState<CateringRemovedRecords>(EMPTY_CATERING_REMOVED_RECORDS);
  // Upload and delete requests in flight, per booking: `useMutation().isPending` is a property of the hook, so an
  // upload started on one booking would otherwise disable the controls and announce progress on another.
  // Kept apart, as the hook flags were: an upload in flight disables the upload control, a delete in flight
  // disables the delete controls, and neither has ever disabled the other.
  const [uploadInFlight, setUploadInFlight] = useState<CateringInFlight>(EMPTY_CATERING_IN_FLIGHT);
  const [removeInFlight, setRemoveInFlight] = useState<CateringInFlight>(EMPTY_CATERING_IN_FLIGHT);
  const [uploadOutcome, setUploadOutcome] = useState<CateringMutationOutcome | null>(null);
  const [removeOutcome, setRemoveOutcome] = useState<CateringMutationOutcome | null>(null);
  const filesKey = cateringBookingFilesKey(userId, bookingId);
  const origin = cateringMutationOrigin(userId, bookingId);
  const choices = cateringVisibilityChoices(role);

  // The draft and the file input belong to the booking on screen, so they reset with it. The ledger deliberately
  // does NOT: it is keyed by booking, so each booking keeps its own baseline and its own arming across navigation.
  useEffect(() => { setDraft(emptyCateringFileDraft(role)); if (inputRef.current) inputRef.current.value = ""; terminalSeenRef.current = false; }, [identity, role]);

  const query = useInfiniteQuery({
    queryKey: filesKey,
    initialPageParam: undefined as string | undefined,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    // Files have no live channel at all, and a counterpart's upload or removal invalidates only THEIR actor-scoped
    // cache -- never this one, which is the point of actor-scoped keys. So without a timer a customer with the
    // workspace open sees neither a newly shared file nor one that was withdrawn, and `refetchOnWindowFocus` fires
    // only on a focus transition a focused tab never has. Following a `#files` notification into this section
    // merely changes the hash, so it would land on the same stale list.
    //
    // Same cadence as the conversation, from the one shared constant, so the two sections cannot drift apart.
    // Polling asks the same authorized route with the same credentials: it re-reads what the server decides this
    // actor may see, and can neither widen that nor imply any mutation.
    // A cancelled or completed booking is immutable, so its file list is settled and polling it forever would be
    // pure traffic. The recurring poll alone stops: the query still loads, paginates and refetches on focus.
    // Read from this query's own freshest answer rather than the parent prop, and from the query passed in rather
    // than a closure, so polling stops on the very response that reports the booking terminal.
    refetchInterval: (polled: { state: { data?: { pages: { editable?: boolean }[] } } }) =>
      cateringWorkspacePollInterval(effectiveCateringEditable(editable, observedCateringEditable(polled.state.data?.pages))),
    // A hidden tab has no reader to serve; the focus transition covers the return.
    refetchIntervalInBackground: false,
    queryFn: async ({ pageParam }): Promise<CateringBookingFilePageView> => {
      const search = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : "";
      const response = await fetch(`/api/catering/bookings/${bookingId}/files${search}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message || "Files could not be loaded"), { code: typeof body.code === "string" ? body.code : undefined });
      return body;
    },
    getNextPageParam: (lastPage) => nextCateringFileCursor(lastPage),
  });
  // The refreshed pages are an authoritative WINDOW over the newest end of the collection, not the whole of it, so
  // history already loaded below that window is preserved rather than dropped. A file the window DOES cover and no
  // longer returns has been removed and disappears; only files older than its last one are kept, and a removal this
  // client itself performed drops its record outright. Nothing is preserved once the window reaches the beginning.
  const loadedPages = query.data?.pages;
  const refreshedFiles = loadedPages ? combineCateringFilePages(loadedPages) : null;
  const history = cateringPreservedHistory(historyRef.current, identity, refreshedFiles, !query.hasNextPage, cateringRemovedIds(removed, identity));
  useEffect(() => { historyRef.current = history; });
  const files = history.items;
  // The ids the refreshed window says nothing about. They exist only in preserved history, so nothing the list
  // endpoint returns can ever settle whether they are still there -- which is the one question below.
  const preservedIds = cateringPreservedTailIds(history, refreshedFiles);
  const preservedFingerprint = preservedIds.join(",");
  // The fingerprint of the newest page this actor may see. Only ids already serialized to them are read, so a
  // provider-private change is invisible here for a customer exactly as it is everywhere else.
  const fileBoundary = cateringFileBoundary(query.data?.pages);
  // The same reading as an ordered id list, which is what a delta can actually be computed from. The joined form
  // above stays the effect's dependency: it changes exactly when this does, and it is a primitive.
  const fileSnapshot = cateringFileSnapshot(query.data?.pages);
  // The same authoritative reading the conversation uses: the files endpoint re-derives `editable` from the
  // persisted booking status on every poll, so it is what the upload and delete controls obey.
  const observedEditable = observedCateringEditable(query.data?.pages);
  const canMutate = effectiveCateringEditable(editable, observedEditable);
  // Busy, and the outcomes to announce, as they apply to the booking on screen -- never to one left behind.
  const uploading = cateringMutationIsPending(uploadInFlight, identity);
  const removing = cateringMutationIsPending(removeInFlight, identity);
  const uploadResult = visibleCateringMutationOutcome(uploadOutcome, identity);
  const removeResult = visibleCateringMutationOutcome(removeOutcome, identity);

  /**
   * Reconciles the files only preserved history is holding.
   *
   * Newest-window polling cannot prove one of them was removed: nothing newer will ever mention it again, so a file
   * its uploader deleted would render indefinitely, offering a download that answers 404, until the participant
   * paginated back down to it by hand. This asks the server the one question the window cannot answer -- of these
   * ids I already hold, which may I still see -- and the answer is a subset of what was sent, so it discloses
   * nothing new to anyone.
   *
   * It runs only while something is actually preserved, at the same cadence as the list and from the same policy,
   * so a terminal booking stops the recurring poll exactly as the list does while still loading and refreshing on
   * focus: read-only means no new mutations, not that a removal already made should stay on screen forever.
   */
  const reconcile = useQuery({
    queryKey: cateringBookingFilePresenceKey(userId, bookingId, preservedFingerprint),
    enabled: preservedIds.length > 0,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: () => cateringWorkspacePollInterval(canMutate),
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<CateringBookingFilePresenceView> => {
      const response = await fetch(cateringFilePresencePath(bookingId, preservedIds), { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message || "Files could not be reconciled"), { code: typeof body.code === "string" ? body.code : undefined });
      return body;
    },
  });
  // The answer names the ids it was asked about, so what it proves gone is read from the answer rather than from
  // whatever is preserved right now: an answer that lands late still removes exactly the files it settled, and
  // removals accumulate rather than being recomputed, so no later refresh can bring one back.
  useEffect(() => {
    const answer = reconcile.data;
    if (!answer) return;
    const gone = cateringReconciledRemovals(answer.requested, answer.active);
    if (gone.length === 0) return;
    setRemoved((current) => recordCateringRemovedRecords(current, identity, gone));
    // A removal outside the newest page is invisible to the page delta, so it is attributed here instead, by the
    // same rule: one this actor performed is already accounted for, and a counterpart's refreshes Activity. The id
    // leaves preserved history with this answer, so it is never asked about -- or announced -- twice.
    const settled = settleCateringRemovedFiles(ledgerRef.current, identity, gone);
    ledgerRef.current = settled.next;
    if (settled.refreshActivity) for (const queryKey of cateringOriginWorkspaceInvalidations(origin)) cache.invalidateQueries({ queryKey });
  }, [reconcile.data, identity]);

  // Both mutations invalidate only this actor's own booking file and workspace caches, and always the ORIGINATING
  // booking's -- never whichever booking happens to be rendered when the request lands. Another participant's
  // actor-scoped keys are deliberately untouched: this client has no legitimate way to refresh them.
  const invalidateOrigin = (attemptOrigin: CateringMutationOrigin) => {
    for (const queryKey of cateringOriginFileInvalidations(attemptOrigin)) cache.invalidateQueries({ queryKey });
  };

  const upload = useMutation({
    mutationFn: async (attempt: UploadAttempt) => {
      const form = new FormData();
      form.append("file", attempt.file);
      form.append("visibility", attempt.visibility);
      // The same token for every attempt at this selection, so a retry resolves to the file already stored.
      form.append("clientRequestId", attempt.requestId);
      const response = await fetch(`/api/catering/bookings/${attempt.origin.bookingId}/files`, { method: "POST", credentials: "include", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message || "Your file could not be uploaded"), { code: typeof body.code === "string" ? body.code : undefined });
      return body;
    },
    onMutate: (attempt) => { setUploadInFlight((current) => enterCateringMutation(current, attempt.origin)); },
    // The draft is cleared only when it still corresponds to the attempt that just completed. The controls stay
    // usable during an upload, so a participant may already have chosen a replacement file or a different visibility
    // -- clearing unconditionally would delete that newer selection, and the DOM input would lose it too. A draft
    // that survives is given a FRESH idempotency token when it is still carrying the completed attempt's, because
    // that token is now spent: reusing it would make the next Upload resolve to the file already stored and report
    // success for a file that was never created.
    onSuccess: (_body, attempt) => {
      // The draft is VISIBLE state, so it is only touched when the completed upload belongs to the booking still on
      // screen: a completion that lands after a route change must not clear or re-token another booking's draft.
      // Resolved against the current draft outside the state updater, so neither the DOM reset nor minting a token
      // is a side effect inside a function React may invoke twice.
      if (attempt.origin.identity === identityRef.current) {
        const resolved = completeCateringFileUpload(draftRef.current, attempt, role, () => crypto.randomUUID());
        if (resolved.cleared && inputRef.current) inputRef.current.value = "";
        setDraft(resolved.next);
      }
      // Armed only for an upload that actually created a file, and armed for the ORIGINATING booking alone. A retry
      // answered from the idempotency ledger (`duplicate`) added nothing, so the next boundary change is not this
      // request's doing and must not be absorbed. Arming on anything less than a real creation is how a FAILED
      // mutation used to leave the flag set for a counterpart's change to consume; arming a single booking-agnostic
      // flag is how one booking's upload used to swallow another booking's counterpart change.
      // Armed as the EXACT addition it is, by the authoritative id the server answered with, so a counterpart's
      // upload landing in the same response is still an unexplained change and still refreshes Activity. An id the
      // newest page already carries arms nothing, which is what an idempotent retry resolves to.
      const uploaded = (_body as { file?: { id?: unknown } } | undefined)?.file;
      if (typeof uploaded?.id === "string") ledgerRef.current = expectCateringFileAddition(ledgerRef.current, attempt.origin, uploaded.id);
      setUploadOutcome(cateringMutationOutcome(attempt.origin, "succeeded"));
      invalidateOrigin(attempt.origin);
    },
    // A failed upload leaves the draft entirely alone, so a newer selection survives a failure just as it does a
    // success, and the participant can correct and upload again. It arms nothing: no boundary changed.
    onError: (error: Error, attempt) => { setUploadOutcome(cateringMutationOutcome(attempt.origin, "failed", error.message)); invalidateOrigin(attempt.origin); },
    onSettled: (_body, _error, attempt) => { setUploadInFlight((current) => exitCateringMutation(current, attempt.origin)); },
  });

  const remove = useMutation({
    mutationFn: async (attempt: RemoveAttempt) => {
      const response = await fetch(`/api/catering/bookings/${attempt.origin.bookingId}/files/${attempt.fileId}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Object.assign(new Error(body.message || "This file could not be removed"), { code: typeof body.code === "string" ? body.code : undefined });
      }
      return true;
    },
    onMutate: (attempt) => { setRemoveInFlight((current) => enterCateringMutation(current, attempt.origin)); },
    // Success alone arms the suppression, and only for the booking the delete actually happened on; `onSettled` runs
    // after a failure too, and a failed delete changes no boundary, so arming there would leave an arming waiting to
    // swallow a counterpart's next change.
    // The server accepted this removal, which is authoritative about that file even where it sits below the
    // refreshed window and the list endpoint alone could not prove it gone. Forgetting it here is what stops the
    // preserved tail from rendering it again on the next merge.
    onSuccess: (_body, attempt) => {
      ledgerRef.current = expectCateringFileRemoval(ledgerRef.current, attempt.origin, attempt.fileId);
      setRemoved((current) => recordCateringRemovedRecords(current, attempt.origin.identity, [attempt.fileId]));
      setRemoveOutcome(cateringMutationOutcome(attempt.origin, "succeeded"));
    },
    onError: (error: Error, attempt) => setRemoveOutcome(cateringMutationOutcome(attempt.origin, "failed", error.message)),
    onSettled: (_body, _error, attempt) => { setRemoveInFlight((current) => exitCateringMutation(current, attempt.origin)); invalidateOrigin(attempt.origin); },
  });

  // A poll that finds the newest page genuinely different has discovered a counterpart's shared upload or removal.
  // The server wrote a `shared_file_uploaded` / `shared_file_removed` activity row for it, and the parent workspace
  // that renders Activity does not poll -- so without this the file list and the Activity panel beside it describe
  // the same booking differently until a focus change intervenes. Nothing is fabricated locally: the workspace
  // refetches its own authoritative activity.
  //
  // It fires only on a change this actor did not make. The first successful load records a baseline, an unchanged
  // page does nothing at all, and a change explained EXACTLY by this actor's own successful mutations is absorbed
  // because `invalidateOrigin` already refreshed the workspace for it -- but only the part of the change those
  // mutations account for. Anything left over after that subtraction is somebody else's and is announced, which is
  // what keeps a counterpart's upload from vanishing into the same response as a local one. It cannot loop: the
  // workspace refetch changes the parent's data, never this page's ids.
  useEffect(() => {
    const observed = observeCateringFileSnapshot(ledgerRef.current, identity, fileSnapshot);
    ledgerRef.current = observed.next;
    if (!observed.refreshActivity) return;
    for (const queryKey of cateringOriginWorkspaceInvalidations(origin)) cache.invalidateQueries({ queryKey });
  }, [fileBoundary, identity]);

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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!mayUploadCateringFile(draft, canMutate, uploading) || !draft.file || !draft.visibility || !draft.requestId) return;
    // The token is now possibly spent: the outcome of this request is not knowable from here, and an ambiguous
    // failure is exactly a request that may already have been accepted. Recording that is what makes a later
    // change of visibility mint a new token instead of retrying a changed intent under the old one.
    setDraft(markCateringFileAttempted);
    setUploadOutcome(null);
    upload.mutate({ origin, file: draft.file, visibility: draft.visibility, requestId: draft.requestId });
  };

  return <Card id="files"><CardHeader><CardTitle>Files</CardTitle><CardDescription>{role === "provider" ? "Booking documents. Files you mark provider-only are never shown to the customer." : "Documents shared between you and your caterer."}</CardDescription></CardHeader><CardContent className="space-y-4">
    {query.isLoading && <p role="status">Loading files…</p>}
    {query.isError && !query.isLoading && <div className="space-y-2" role="alert"><p>Files could not be loaded.</p><Button variant="outline" className="min-h-11" onClick={() => query.refetch()}>Retry loading files</Button></div>}
    {!query.isLoading && !query.isError && (files.length === 0
      ? <p className="text-muted-foreground">{CATERING_FILES_EMPTY}</p>
      : <ul className="space-y-2">{files.map((file) => <FileRow key={file.id} file={file} bookingId={bookingId} role={role} editable={canMutate} pending={removing} onRemove={() => { if (window.confirm(`Remove “${file.filename}”?`)) { setRemoveOutcome(null); remove.mutate({ origin, fileId: file.id }); } }} />)}</ul>)}
    {query.hasNextPage && <Button variant="outline" className="min-h-11 w-full sm:w-auto" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading more files…" : "Load more files"}</Button>}
    {query.isFetchNextPageError && <div className="space-y-2" role="alert"><p>More files could not be loaded.</p><Button variant="outline" className="min-h-11" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Retry loading more files</Button></div>}
    {removeResult?.status === "failed" && <p role="alert" className="text-destructive">{removeResult.message}</p>}

    {canMutate
      ? <form className="space-y-3 border-t pt-4" onSubmit={submit}>
          <div><Label htmlFor="catering-file">Add a file</Label>
            <input id="catering-file" ref={inputRef} type="file" accept={CATERING_FILE_ACCEPT} className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"
              aria-describedby="catering-file-help"
              onChange={(event) => { const chosen = event.target.files?.[0] ?? null; setDraft((current) => selectCateringFile(current, chosen, chosen ? crypto.randomUUID() : null)); }} />
            <p id="catering-file-help" className="mt-1 text-sm text-muted-foreground">PDF, JPEG, PNG or WebP, up to 15 MB.</p>
          </div>
          {/* A provider chooses visibility explicitly; a customer is never shown this control, and never a hint of it. */}
          {choices.length > 0 && <fieldset className="space-y-2"><legend className="text-sm font-medium">Who can see this file?</legend>
            {choices.map((choice) => <label key={choice.value} className="flex min-h-11 items-start gap-2">
              <input type="radio" name="catering-file-visibility" className="mt-1 h-5 w-5" value={choice.value} checked={draft.visibility === choice.value}
                onChange={() => setDraft((current) => chooseCateringVisibility(current, choice.value, () => crypto.randomUUID()))} />
              <span className="min-w-0"><span className="block font-medium">{choice.label}</span><span className="block text-sm text-muted-foreground">{choice.description}</span></span>
            </label>)}
          </fieldset>}
          {draft.error && <p role="alert" className="text-destructive">{draft.error}</p>}
          <Button type="submit" className="min-h-11" disabled={!mayUploadCateringFile(draft, canMutate, uploading)}>Upload file</Button>
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{uploading ? "Uploading your file…" : uploadResult?.status === "succeeded" ? "File uploaded." : ""}</p>
          {uploadResult?.status === "failed" && <p role="alert" className="text-destructive">{uploadResult.message}</p>}
        </form>
      : <p className="font-medium">{CATERING_FILES_READ_ONLY_BANNER}</p>}
  </CardContent></Card>;
}

/** Presentation only. Download is an ordinary link to the authorized booking route, never a stored or signed URL. */
function FileRow({ file, bookingId, role, editable, pending, onRemove }: { file: CateringBookingFileView; bookingId: string; role: "provider" | "customer"; editable: boolean; pending: boolean; onRemove: () => void }) {
  const badge = cateringFileVisibilityBadge(file, role);
  return <li className="flex min-w-0 flex-wrap items-start gap-3 rounded-lg border p-3">
    <div className="min-w-0 flex-1">
      <p className="break-words font-medium [overflow-wrap:anywhere]">{file.filename}</p>
      <p className="text-sm text-muted-foreground">{cateringFileSummary(file)}</p>
      <p className="break-words text-sm text-muted-foreground">Added by {file.mine ? "you" : file.uploaderName || (file.uploadedByRole === "provider" ? "your caterer" : "your customer")}</p>
      {badge && <Badge variant="outline" className="mt-1">{badge}</Badge>}
    </div>
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" className="min-h-11"><a href={cateringFileDownloadPath(bookingId, file.id)} download aria-label={`Download ${file.filename}`}><Download className="mr-2 h-4 w-4" aria-hidden="true" />Download</a></Button>
      {editable && file.mayDelete && <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" disabled={pending} aria-label={`Remove ${file.filename}`} onClick={onRemove}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>}
    </div>
  </li>;
}
