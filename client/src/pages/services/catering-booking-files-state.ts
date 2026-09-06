import { CATERING_FILE_MAX_BYTES, CATERING_FILE_SIZE_MESSAGE, CATERING_FILE_TYPE_MESSAGE, cateringFileTypeForUpload, cateringFileVisibilitiesFor, formatCateringFileSize, type CateringBookingFilePageView, type CateringBookingFileView, type CateringFileVisibility } from "@shared/catering-booking-files";
import { CATERING_WORKSPACE_READ_ONLY_CODE } from "@shared/catering-booking-operations";

/**
 * Client state for the booking Files section. The checks here mirror the server's so a participant is told about an
 * oversized or unsupported file before it is uploaded -- they never replace the server's, which stays authoritative.
 */

/** The accept attribute for the file input, derived from the same allowlist the server enforces. */
export const CATERING_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

/**
 * The visibility choices one actor is offered. A customer is offered none: every customer upload is shared, and the
 * provider-only option is never rendered for them, so the customer interface carries no hint that provider-private
 * files exist at all.
 */
export type CateringVisibilityChoice = { value: CateringFileVisibility; label: string; description: string };
const CHOICES: Record<CateringFileVisibility, CateringVisibilityChoice> = {
  shared: { value: "shared", label: "Share with customer", description: "Both booking participants can open this file." },
  provider: { value: "provider", label: "Provider only", description: "Only you can see this file. The customer is never told it exists." },
};
export function cateringVisibilityChoices(role: "provider" | "customer"): CateringVisibilityChoice[] {
  return role === "provider" ? cateringFileVisibilitiesFor(role).map((visibility) => CHOICES[visibility]) : [];
}
/**
 * The visibility an upload form starts on. A provider must choose deliberately, so the form starts unselected rather
 * than defaulting to either option: an accidental provider-private file and an accidental disclosure are both worse
 * than one extra click. A customer has exactly one possible visibility and is never asked.
 */
export function initialCateringVisibility(role: "provider" | "customer"): CateringFileVisibility | null {
  return role === "provider" ? null : "shared";
}
/**
 * The parts of a selected file these checks actually read. The browser's `File` satisfies it, so the draft below is
 * generic over it rather than casting: the component holds a real `File` to upload, and a test can describe one.
 */
export type CateringSelectedFile = { name: string; type: string; size: number };
/**
 * `requestId` is the server's idempotency token, and it belongs to ONE UPLOAD INTENT: this file, at this
 * visibility. Every attempt at that same intent reuses it, so pressing Upload again after a failure -- or after a
 * timeout that actually succeeded -- resolves to the file the server already stored instead of adding a second
 * copy. Anything that changes the intent mints a new one, so two deliberate uploads stay two files.
 *
 * `attempted` records whether the current token has ever been SUBMITTED, and it is what makes "changed intent"
 * decidable. A token that has never left the browser is unspent: editing the draft can keep it, and no extra token
 * is minted on an ordinary edit. Once submitted, the outcome may be unknown -- an ambiguous failure is exactly a
 * request that may or may not have been accepted -- so that token has to be treated as possibly spent, and any
 * change of intent after it must carry a new one.
 */
export type CateringFileDraft<F extends CateringSelectedFile = File> = { file: F | null; visibility: CateringFileVisibility | null; error: string | null; requestId: string | null; attempted: boolean };
export function emptyCateringFileDraft<F extends CateringSelectedFile = File>(role: "provider" | "customer"): CateringFileDraft<F> {
  return { file: null, visibility: initialCateringVisibility(role), error: null, requestId: null, attempted: false };
}

/** The same extension/MIME/size agreement the server requires, checked here only to fail fast and say why. */
export function validateCateringFileSelection(file: CateringSelectedFile): string | null {
  if (file.size <= 0) return "An empty file cannot be uploaded";
  if (file.size > CATERING_FILE_MAX_BYTES) return CATERING_FILE_SIZE_MESSAGE;
  // The extension is read from the last path segment, so a filename that carries a directory is still judged on
  // its own extension and never on anything the path names.
  const extension = file.name.split(/[\\/]/).pop()?.split(".").pop() ?? "";
  return cateringFileTypeForUpload(extension, file.type) ? null : CATERING_FILE_TYPE_MESSAGE;
}
export function selectCateringFile<F extends CateringSelectedFile>(draft: CateringFileDraft<F>, file: F | null, requestId: string | null = null): CateringFileDraft<F> {
  // A replacement file is a different intent and arrives with its own freshly minted token, so the new draft has
  // never been submitted whatever the old one had done.
  if (!file) return { ...draft, file: null, error: null, requestId: null, attempted: false };
  return { ...draft, file, error: validateCateringFileSelection(file), requestId, attempted: false };
}
/**
 * Chooses the visibility, minting a new token when the one being carried may already be spent.
 *
 * Visibility is part of the upload intent, not a detail of it: "share this with the customer" and "keep this
 * provider-only" are two different requests. After an AMBIGUOUS failure -- a timeout, a dropped connection -- the
 * submitted token may well have been accepted server-side. Changing the visibility and pressing Upload with that
 * same token would then hit the server's early accepted-token lookup, which answers with the ORIGINAL upload at
 * the ORIGINAL visibility; the interface would clear the draft and report success for a provider-only file that
 * does not exist and never will.
 *
 * So a change of visibility on a draft whose token has been submitted mints a new one, and the draft becomes
 * unattempted again. A token that has never been submitted is unspent and is kept -- switching between the two
 * radio buttons before ever pressing Upload costs nothing. An unchanged visibility returns the SAME object, so a
 * rerender or a re-fired change event mints nothing at all.
 */
export function chooseCateringVisibility<F extends CateringSelectedFile>(draft: CateringFileDraft<F>, visibility: CateringFileVisibility, mintRequestId: () => string): CateringFileDraft<F> {
  if (draft.visibility === visibility) return draft;
  if (!draft.attempted || draft.requestId === null) return { ...draft, visibility };
  return { ...draft, visibility, requestId: mintRequestId(), attempted: false };
}
/**
 * Records that the draft's token has been submitted. From here the outcome is not knowable from the client alone,
 * so the token counts as possibly spent until the draft is cleared or a change of intent replaces it.
 */
export function markCateringFileAttempted<F extends CateringSelectedFile>(draft: CateringFileDraft<F>): CateringFileDraft<F> {
  return draft.attempted ? draft : { ...draft, attempted: true };
}
/**
 * The immutable snapshot of one submitted upload.
 *
 * The live draft and the attempt in flight are deliberately separate values, exactly as the message composer keeps
 * them separate. The upload controls stay usable while a request is running, so a participant may well pick a
 * replacement file or change the visibility before the earlier upload resolves -- and clearing the draft
 * unconditionally on success would silently delete that newer selection.
 */
export type CateringFileAttempt = { requestId: string; visibility: CateringFileVisibility };

/** Whether the live draft is still the one that was submitted: same selection token AND same chosen visibility. */
export function cateringFileDraftMatchesAttempt<F extends CateringSelectedFile>(draft: CateringFileDraft<F>, attempt: CateringFileAttempt): boolean {
  return draft.requestId === attempt.requestId && draft.visibility === attempt.visibility;
}
/**
 * Resolves an upload that succeeded.
 *
 * The draft is cleared only when it still corresponds exactly to the attempt that completed; a draft the
 * participant has since edited belongs to their NEXT intended upload and must survive untouched. `cleared` tells
 * the component whether the file input's own DOM value may be reset, so a preserved selection is not wiped out of
 * the control either.
 *
 * A preserved draft that still carries the COMPLETED attempt's token is re-minted, and that is the whole point of
 * the mint parameter. `requestId` is the server's idempotency key: the moment an upload succeeds under it, that
 * token is spent, and any later request carrying it is answered with the already-stored file rather than being
 * performed. So a draft edited during a successful upload -- the provider who switches "Share with customer" to
 * "Provider only" while the first upload is still in flight -- would, on pressing Upload, resolve to the ALREADY
 * SHARED file while the interface reported success for a provider-only file that was never created. Re-minting is
 * what makes the preserved draft a genuinely new upload.
 *
 * It is re-minted only when necessary. A draft whose token already differs from the attempt's is a fresh selection
 * that minted its own token, and keeps it. Nothing here touches a failed or unresolved attempt: retry idempotency
 * depends on that token being reused, and this runs on success alone.
 *
 * The condition is deliberately "same token but no longer matching" rather than a check against the visibility
 * field specifically, so any editable field added to the draft later is covered without amending this function.
 */
export function completeCateringFileUpload<F extends CateringSelectedFile>(draft: CateringFileDraft<F>, attempt: CateringFileAttempt, role: "provider" | "customer", mintRequestId: () => string): { next: CateringFileDraft<F>; cleared: boolean } {
  if (cateringFileDraftMatchesAttempt(draft, attempt)) return { next: emptyCateringFileDraft<F>(role), cleared: true };
  if (draft.requestId !== attempt.requestId) return { next: draft, cleared: false };
  return { next: { ...draft, requestId: mintRequestId(), attempted: false }, cleared: false };
}

/** Upload is offered only once a valid file and an explicit visibility are both present on an editable booking. */
export function mayUploadCateringFile<F extends CateringSelectedFile>(draft: CateringFileDraft<F>, editable: boolean, pending: boolean): boolean {
  return editable && !pending && draft.file !== null && draft.visibility !== null && draft.error === null;
}

/** Pages arrive newest-first and append older ones, de-duplicated by id so an overlapping refetch never repeats a file. */
export function combineCateringFilePages(pages: readonly CateringBookingFilePageView[]): CateringBookingFileView[] {
  const seen = new Set<string>();
  const combined: CateringBookingFileView[] = [];
  for (const page of pages) for (const file of page.files) {
    if (seen.has(file.id)) continue;
    seen.add(file.id);
    combined.push(file);
  }
  return combined;
}
export function nextCateringFileCursor(page: { nextCursor: string | null } | undefined): string | undefined {
  return page?.nextCursor ?? undefined;
}

/** The visibility badge a provider sees on one file. A customer is never shown one, because every file they see is shared. */
export function cateringFileVisibilityBadge(file: { visibility: CateringFileVisibility }, role: "provider" | "customer"): string | null {
  if (role !== "provider") return null;
  return file.visibility === "provider" ? "Provider only" : "Shared with customer";
}
/** One line of secondary metadata: type, size and when it was added. */
export function cateringFileSummary(file: { contentType: string; byteSize: number; createdAt: string }): string {
  const kind = file.contentType === "application/pdf" ? "PDF" : file.contentType.replace("image/", "").toUpperCase();
  const added = new Date(file.createdAt);
  const when = Number.isNaN(added.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(added);
  return [kind, formatCateringFileSize(file.byteSize), when].filter((part) => part !== "").join(" · ");
}
/** The download address for one file. It is a booking-scoped route, re-authorized per request, never a stored URL. */
export function cateringFileDownloadPath(bookingId: string, fileId: string): string {
  return `/api/catering/bookings/${bookingId}/files/${fileId}/download`;
}

export function cateringFileErrorCode(error: unknown): string | null {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : null;
}
export function isCateringFileReadOnly(error: unknown): boolean {
  return cateringFileErrorCode(error) === CATERING_WORKSPACE_READ_ONLY_CODE;
}

export const CATERING_FILES_READ_ONLY_BANNER = "This booking is closed. Existing files stay available to download, but nothing can be added or removed.";
export const CATERING_FILES_EMPTY = "No files have been added to this booking yet.";
