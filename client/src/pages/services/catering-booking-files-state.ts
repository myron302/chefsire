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
 * `requestId` is minted once per selected file and reused for every attempt at uploading THAT selection, so pressing
 * Upload again after a failure -- or after a timeout that actually succeeded -- resolves to the file the server
 * already stored instead of adding a second copy. Choosing a different file mints a new token, so two deliberate
 * uploads of the same document stay two files.
 */
export type CateringFileDraft<F extends CateringSelectedFile = File> = { file: F | null; visibility: CateringFileVisibility | null; error: string | null; requestId: string | null };
export function emptyCateringFileDraft<F extends CateringSelectedFile = File>(role: "provider" | "customer"): CateringFileDraft<F> {
  return { file: null, visibility: initialCateringVisibility(role), error: null, requestId: null };
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
  if (!file) return { ...draft, file: null, error: null, requestId: null };
  return { ...draft, file, error: validateCateringFileSelection(file), requestId };
}
export function chooseCateringVisibility<F extends CateringSelectedFile>(draft: CateringFileDraft<F>, visibility: CateringFileVisibility): CateringFileDraft<F> {
  return { ...draft, visibility };
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
