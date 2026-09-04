import { FormEvent, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { cateringBookingFilesKey, cateringFileBoundary, type CateringBookingFilePageView, type CateringBookingFileView, type CateringFileVisibility } from "@shared/catering-booking-files";
import { cateringBookingWorkspaceKey, cateringWorkspacePollInterval, effectiveCateringEditable, observedCateringEditable } from "@shared/catering-booking-operations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CATERING_FILES_EMPTY, CATERING_FILES_READ_ONLY_BANNER, CATERING_FILE_ACCEPT, cateringFileDownloadPath, cateringFileSummary, cateringFileVisibilityBadge, cateringVisibilityChoices, chooseCateringVisibility, combineCateringFilePages, completeCateringFileUpload, emptyCateringFileDraft, markCateringFileAttempted, mayUploadCateringFile, nextCateringFileCursor, selectCateringFile, type CateringFileAttempt, type CateringFileDraft } from "@/pages/services/catering-booking-files-state";

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
  // The newest-page fingerprint this component has already accounted for, so a poll that found a real change can be
  // told from a quiet one, and a change this actor caused itself can be absorbed rather than announced twice.
  const boundaryRef = useRef<string | null>(null);
  const ownMutationRef = useRef(false);
  // Mirrors the live draft so a mutation callback, which fires long after its render, resolves against what the
  // participant currently has selected rather than the draft captured when the upload started.
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  const filesKey = cateringBookingFilesKey(userId, bookingId);
  const choices = cateringVisibilityChoices(role);

  useEffect(() => { setDraft(emptyCateringFileDraft(role)); if (inputRef.current) inputRef.current.value = ""; terminalSeenRef.current = false; boundaryRef.current = null; ownMutationRef.current = false; }, [identity, role]);

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
  const files = combineCateringFilePages(query.data?.pages ?? []);
  // The fingerprint of the newest page this actor may see. Only ids already serialized to them are read, so a
  // provider-private change is invisible here for a customer exactly as it is everywhere else.
  const fileBoundary = cateringFileBoundary(query.data?.pages);
  // The same authoritative reading the conversation uses: the files endpoint re-derives `editable` from the
  // persisted booking status on every poll, so it is what the upload and delete controls obey.
  const observedEditable = observedCateringEditable(query.data?.pages);
  const canMutate = effectiveCateringEditable(editable, observedEditable);

  // Both mutations invalidate only this actor's own booking file and workspace caches. Another participant's
  // actor-scoped keys are deliberately untouched: this client has no legitimate way to refresh them.
  const invalidate = () => {
    // This actor's own upload or removal already refreshes the workspace here, so the boundary change its refetch
    // produces is absorbed below rather than announced a second time.
    ownMutationRef.current = true;
    cache.invalidateQueries({ queryKey: filesKey });
    cache.invalidateQueries({ queryKey: cateringBookingWorkspaceKey(userId, bookingId) });
  };

  const upload = useMutation({
    mutationFn: async ({ file, visibility, requestId }: { file: File; visibility: CateringFileVisibility; requestId: string } & CateringFileAttempt) => {
      const form = new FormData();
      form.append("file", file);
      form.append("visibility", visibility);
      // The same token for every attempt at this selection, so a retry resolves to the file already stored.
      form.append("clientRequestId", requestId);
      const response = await fetch(`/api/catering/bookings/${bookingId}/files`, { method: "POST", credentials: "include", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message || "Your file could not be uploaded"), { code: typeof body.code === "string" ? body.code : undefined });
      return body;
    },
    // The draft is cleared only when it still corresponds to the attempt that just completed. The controls stay
    // usable during an upload, so a participant may already have chosen a replacement file or a different visibility
    // -- clearing unconditionally would delete that newer selection, and the DOM input would lose it too. A draft
    // that survives is given a FRESH idempotency token when it is still carrying the completed attempt's, because
    // that token is now spent: reusing it would make the next Upload resolve to the file already stored and report
    // success for a file that was never created.
    onSuccess: (_body, attempt) => {
      // Resolved against the current draft outside the state updater, so neither the DOM reset nor minting a token
      // is a side effect inside a function React may invoke twice.
      const resolved = completeCateringFileUpload(draftRef.current, attempt, role, () => crypto.randomUUID());
      if (resolved.cleared && inputRef.current) inputRef.current.value = "";
      setDraft(resolved.next);
      invalidate();
    },
    // A failed upload leaves the draft entirely alone, so a newer selection survives a failure just as it does a
    // success, and the participant can correct and upload again.
    onError: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch(`/api/catering/bookings/${bookingId}/files/${fileId}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Object.assign(new Error(body.message || "This file could not be removed"), { code: typeof body.code === "string" ? body.code : undefined });
      }
      return true;
    },
    onSettled: () => invalidate(),
  });

  // A poll that finds the newest page genuinely different has discovered a counterpart's shared upload or removal.
  // The server wrote a `shared_file_uploaded` / `shared_file_removed` activity row for it, and the parent workspace
  // that renders Activity does not poll -- so without this the file list and the Activity panel beside it describe
  // the same booking differently until a focus change intervenes. Nothing is fabricated locally: the workspace
  // refetches its own authoritative activity.
  //
  // It fires only on a CHANGE. The first successful load just records a baseline, an unchanged fingerprint does
  // nothing at all, and a change this actor caused itself is absorbed because `invalidate()` already refreshed the
  // workspace for it. It cannot loop: the workspace refetch changes the parent's data, never this page's ids.
  useEffect(() => {
    if (fileBoundary === null || boundaryRef.current === fileBoundary) return;
    const baseline = boundaryRef.current === null;
    const own = ownMutationRef.current;
    boundaryRef.current = fileBoundary;
    ownMutationRef.current = false;
    if (baseline || own) return;
    cache.invalidateQueries({ queryKey: cateringBookingWorkspaceKey(userId, bookingId) });
  }, [fileBoundary]);

  // The first time this section's own endpoint reports the booking terminal, the parent workspace summary is stale
  // -- it was fetched once and does not poll. Refreshing it lets the whole workspace converge on the same answer
  // rather than only this section knowing. Latched in a ref so it fires once per newly observed transition and
  // never on the polls that follow, and it cannot loop: the workspace refetch changes the parent prop, not this
  // endpoint's answer.
  useEffect(() => {
    if (observedEditable !== false || terminalSeenRef.current) return;
    terminalSeenRef.current = true;
    cache.invalidateQueries({ queryKey: cateringBookingWorkspaceKey(userId, bookingId) });
  }, [observedEditable]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!mayUploadCateringFile(draft, canMutate, upload.isPending) || !draft.file || !draft.visibility || !draft.requestId) return;
    // The token is now possibly spent: the outcome of this request is not knowable from here, and an ambiguous
    // failure is exactly a request that may already have been accepted. Recording that is what makes a later
    // change of visibility mint a new token instead of retrying a changed intent under the old one.
    setDraft(markCateringFileAttempted);
    upload.mutate({ file: draft.file, visibility: draft.visibility, requestId: draft.requestId });
  };

  return <Card id="files"><CardHeader><CardTitle>Files</CardTitle><CardDescription>{role === "provider" ? "Booking documents. Files you mark provider-only are never shown to the customer." : "Documents shared between you and your caterer."}</CardDescription></CardHeader><CardContent className="space-y-4">
    {query.isLoading && <p role="status">Loading files…</p>}
    {query.isError && !query.isLoading && <div className="space-y-2" role="alert"><p>Files could not be loaded.</p><Button variant="outline" className="min-h-11" onClick={() => query.refetch()}>Retry loading files</Button></div>}
    {!query.isLoading && !query.isError && (files.length === 0
      ? <p className="text-muted-foreground">{CATERING_FILES_EMPTY}</p>
      : <ul className="space-y-2">{files.map((file) => <FileRow key={file.id} file={file} bookingId={bookingId} role={role} editable={canMutate} pending={remove.isPending} onRemove={() => { if (window.confirm(`Remove “${file.filename}”?`)) remove.mutate(file.id); }} />)}</ul>)}
    {query.hasNextPage && <Button variant="outline" className="min-h-11 w-full sm:w-auto" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading more files…" : "Load more files"}</Button>}
    {query.isFetchNextPageError && <div className="space-y-2" role="alert"><p>More files could not be loaded.</p><Button variant="outline" className="min-h-11" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Retry loading more files</Button></div>}
    {remove.isError && <p role="alert" className="text-destructive">{remove.error.message}</p>}

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
          <Button type="submit" className="min-h-11" disabled={!mayUploadCateringFile(draft, canMutate, upload.isPending)}>Upload file</Button>
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{upload.isPending ? "Uploading your file…" : upload.isSuccess ? "File uploaded." : ""}</p>
          {upload.isError && <p role="alert" className="text-destructive">{upload.error.message}</p>}
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
