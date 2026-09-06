import { z } from "zod";
import type { CateringBookingStatus } from "./catering-bookings";
import { mayEditCateringWorkspace } from "./catering-booking-operations";

/**
 * Booking-scoped documents. A booking file is never a public media URL: it is an authoritative metadata row whose
 * bytes live in private storage under a server-generated key, reachable only through an authorized download route.
 */
export const CATERING_FILE_VISIBILITIES = ["provider", "shared"] as const;
export type CateringFileVisibility = typeof CATERING_FILE_VISIBILITIES[number];
export const CATERING_FILE_STORAGE_PROVIDERS = ["r2", "local"] as const;

/** Launch maximum per booking file, enforced by multer, by the content check, and by a database constraint. */
export const CATERING_FILE_MAX_BYTES = 15 * 1024 * 1024;
/** Launch maximum of live (non-tombstoned) files per booking, enforced under the booking file collection lock. */
/**
 * Launch maximum of live (non-tombstoned) files per booking, applied PER VISIBILITY BUCKET -- up to this many
 * shared files, and independently up to this many provider-private files.
 *
 * The buckets are isolated because a shared outcome must never depend on provider-only state. A single combined
 * quota leaked exactly that: a customer who could enumerate the shared files and was then refused the next shared
 * upload could infer that undisclosed provider-private files were occupying the remaining slots. The value is
 * unchanged, so the shared quota a customer experiences is exactly what it was before.
 */
export const CATERING_BOOKING_FILE_LIMIT = 100;
export const CATERING_FILE_PAGE_DEFAULT = 20;
export const CATERING_FILE_PAGE_MAXIMUM = 50;
/** A file list count shown in the workspace summary is bounded rather than an unbounded total. */
export const CATERING_FILE_COUNT_CEILING = 999;

/**
 * The launch allowlist, deliberately far narrower than the generic upload route's. Each entry pins the extension,
 * the declared MIME types accepted for it, and the canonical stored content type. Anything not listed here -- GIF,
 * SVG, HTML, XML, JavaScript, archives, Office documents, video, executables, octet-stream -- is refused.
 */
export const CATERING_FILE_TYPES = [
  { extension: "pdf", mimeTypes: ["application/pdf"], contentType: "application/pdf", kind: "pdf", format: "pdf" },
  { extension: "jpg", mimeTypes: ["image/jpeg"], contentType: "image/jpeg", kind: "image", format: "jpeg" },
  { extension: "jpeg", mimeTypes: ["image/jpeg"], contentType: "image/jpeg", kind: "image", format: "jpeg" },
  { extension: "png", mimeTypes: ["image/png"], contentType: "image/png", kind: "image", format: "png" },
  { extension: "webp", mimeTypes: ["image/webp"], contentType: "image/webp", kind: "image", format: "webp" },
] as const;
export type CateringFileKind = typeof CATERING_FILE_TYPES[number]["kind"];
/** The content signature an accepted type's bytes must actually carry, named explicitly rather than parsed out of a MIME string. */
export type CateringFileFormat = typeof CATERING_FILE_TYPES[number]["format"];
export const CATERING_FILE_EXTENSIONS = CATERING_FILE_TYPES.map((type) => type.extension);
export const CATERING_FILE_MIME_TYPES = Array.from(new Set(CATERING_FILE_TYPES.flatMap((type) => [...type.mimeTypes])));

/** The allowlist entry for a lower-cased extension, or null when the extension is not offered at launch. */
export function cateringFileTypeForExtension(extension: string) {
  const normalized = extension.trim().toLowerCase().replace(/^\./, "");
  return CATERING_FILE_TYPES.find((type) => type.extension === normalized) ?? null;
}
/**
 * Extension and declared MIME must agree before any byte is read. A browser MIME alone is never trusted, and neither
 * is an extension: they must name the same allowlisted type, and the detected content must then agree with both.
 */
export function cateringFileTypeForUpload(extension: string, declaredMimeType: string) {
  const byExtension = cateringFileTypeForExtension(extension);
  if (!byExtension) return null;
  const declared = declaredMimeType.trim().toLowerCase().split(";")[0];
  return (byExtension.mimeTypes as readonly string[]).includes(declared) ? byExtension : null;
}

/**
 * The non-file part of an upload. `clientRequestId` is a retry token, scoped by the server to this booking and this
 * uploader: a retry after a timeout that actually succeeded resolves to the file the first attempt persisted rather
 * than adding a second copy of it. `.strict()` rejects a storage key, an uploader id, or any other forged field.
 */
export const cateringFileUploadFieldsSchema = z.object({
  visibility: z.enum(CATERING_FILE_VISIBILITIES),
  clientRequestId: z.string().uuid().optional(),
}).strict();

/**
 * The complete multipart shape of a booking file upload, used to bound the parser itself.
 *
 * Multer accumulates every part into memory BEFORE the route can check who is asking, so these limits -- not the
 * schema above -- are what stops an authenticated caller from spending process memory on a booking they do not own.
 * They are derived from the real contract rather than picked generously: exactly one file part, exactly the two
 * text fields above, and nothing else.
 */
export const CATERING_UPLOAD_MULTIPART = {
  /** The one `file` part. */
  files: 1,
  /** `visibility` and `clientRequestId`. */
  fields: 2,
  /** The two fields plus the file. */
  parts: 3,
  /** Longest accepted value is a 36-character UUID; this leaves room without allowing a payload. */
  fieldSize: 256,
  /** Longest accepted name is `clientRequestId`, at 15 characters. */
  fieldNameSize: 64,
} as const;
export const cateringBookingFilePageSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(CATERING_FILE_PAGE_MAXIMUM).default(CATERING_FILE_PAGE_DEFAULT),
}).strict();

/**
 * Which visibilities an actor may create. A customer has exactly one: everything a customer uploads is shared with
 * the provider. Phase 2I has no customer-private visibility, and a customer asking for "provider" is refused rather
 * than silently downgraded, so an ambiguous request never becomes a wrong persisted visibility.
 */
export function cateringFileVisibilitiesFor(role: "provider" | "customer"): readonly CateringFileVisibility[] {
  return role === "provider" ? CATERING_FILE_VISIBILITIES : ["shared"];
}
export function mayUploadCateringFileVisibility(role: "provider" | "customer", visibility: CateringFileVisibility): boolean {
  return cateringFileVisibilitiesFor(role).includes(visibility);
}
/** Which visibilities an actor may ever observe. A customer receives no evidence that provider-private files exist. */
export function cateringFileVisibilitiesVisibleTo(role: "provider" | "customer"): readonly CateringFileVisibility[] {
  return role === "provider" ? CATERING_FILE_VISIBILITIES : ["shared"];
}
export function mayReadCateringFile(role: "provider" | "customer", visibility: CateringFileVisibility): boolean {
  return cateringFileVisibilitiesVisibleTo(role).includes(visibility);
}

/** Uploads and deletions close exactly when the Phase 2H workspace closes. Reading and downloading never close. */
export function mayMutateCateringFiles(status: CateringBookingStatus): boolean { return mayEditCateringWorkspace(status); }
/**
 * Phase 2I deletion rule: the uploader deletes their own file and nobody else's. A provider may not remove a
 * document the customer supplied, and a customer may not remove one the provider shared. There is no visibility
 * mutation at all -- a provider-private file is shared by uploading it again as a shared file, deliberately, rather
 * than by a toggle that could disclose it with one mis-click.
 */
export function mayDeleteCateringFile(actorId: string, file: { uploadedBy: string; deletedAt: string | null }, status: CateringBookingStatus): boolean {
  if (!mayMutateCateringFiles(status)) return false;
  return file.deletedAt === null && file.uploadedBy === actorId;
}

export const CATERING_FILE_NOT_FOUND_MESSAGE = "File not found";
export const CATERING_FILE_READ_ONLY_MESSAGE = "Cancelled and completed bookings are read-only";
/**
 * The refusal for a full bucket, worded for the bucket that is actually full.
 *
 * A customer only ever uploads shared files, so they only ever see the shared message -- and it reflects the shared
 * count alone. Nothing a customer can provoke mentions, or depends on, provider-only storage.
 */
export const CATERING_FILE_LIMIT_MESSAGES: Record<CateringFileVisibility, string> = {
  shared: `A booking may hold at most ${CATERING_BOOKING_FILE_LIMIT} shared files`,
  provider: `A booking may hold at most ${CATERING_BOOKING_FILE_LIMIT} provider-only files`,
};
export function cateringFileLimitMessage(visibility: CateringFileVisibility): string {
  return CATERING_FILE_LIMIT_MESSAGES[visibility];
}

export const CATERING_FILE_TYPE_MESSAGE = "Only PDF, JPEG, PNG and WebP files are accepted";
export const CATERING_FILE_SIZE_MESSAGE = `A booking file may be at most ${CATERING_FILE_MAX_BYTES / (1024 * 1024)} MB`;
/** Bounded refusals for a multipart request that exceeded the parser limits above. None discloses any internals. */
export const CATERING_UPLOAD_MULTIPART_MESSAGES = {
  file: "Upload exactly one file",
  size: CATERING_FILE_SIZE_MESSAGE,
  fields: "Too many form fields were sent with this upload",
  parts: "Too many parts were sent with this upload",
  fieldValue: "A form field value was too long",
  fieldName: "A form field name was too long",
  rejected: "This upload request was rejected",
} as const;
/** A storage cleanup that failed after the metadata tombstone never restores the file; it stays gone to every actor. */
export const CATERING_FILE_CLEANUP_PENDING_CODE = "catering_file_cleanup_pending";
export const CATERING_FILE_LIMIT_CODE = "catering_file_limit";

/** Neutral notification copy: a filename, a size and a storage key all stay out of the notification. */
export const CATERING_FILE_NOTIFICATION = { type: "catering_booking_file", title: "New catering booking file", message: "A new file was added to your catering booking." } as const;

/**
 * What a file list serializes. There is deliberately no url and no storageKey: the only way to bytes is the
 * authorized download route, which re-derives the booking, the participant and the visibility on every request.
 */
export type CateringBookingFileView = {
  id: string; visibility: CateringFileVisibility; filename: string; contentType: string; byteSize: number;
  uploadedBy: string; uploadedByRole: "provider" | "customer"; uploaderName: string | null;
  createdAt: string; mine: boolean; mayDelete: boolean;
};
export type CateringBookingFilePageView = { files: CateringBookingFileView[]; nextCursor: string | null; editable: boolean };

/**
 * A stable fingerprint of the newest page of files THIS actor may see, or null before any page has arrived.
 *
 * The file list polls but the parent workspace summary does not, so a counterpart's shared upload or removal
 * refreshed the file list while the Activity panel beside it kept showing the state before that change -- two
 * panels describing the same booking differently until a focus change or an unrelated mutation happened to
 * intervene. Comparing this value across polls is what tells a quiet poll from one that actually found something.
 *
 * The newest page's ids, in order, are enough because a file row is only ever inserted or tombstoned -- nothing
 * about an existing one is editable in Phase 2I -- so any change this actor can see rewrites that list: an upload
 * adds an id at the head, a removal drops one out. The page is the endpoint's own newest-first keyset page, so no
 * loaded history is walked and older pages are not disturbed.
 *
 * PRIVACY. It is computed from the actor's OWN response, which the server has already filtered to the visibilities
 * that actor is allowed (a customer's pages contain shared files only). So a provider-private upload or removal
 * changes nothing a customer can compute, triggers no refresh on their side, and cannot be inferred from this
 * value, from its length, or from when it changes. Only ids already serialized to this actor are read; no storage
 * key, count of hidden rows, or other metadata is involved.
 *
 * A removal of a file older than the newest page leaves that page identical and so is not detected here; that case
 * still resolves on the next focus refetch, exactly as before. Detecting it would mean diffing the whole loaded
 * history on every poll, which is a worse trade for a bounded collection whose newest page is what Activity is
 * describing.
 */
export function cateringFileSnapshot(pages: readonly { files: readonly { id: string }[] }[] | undefined): readonly string[] | null {
  if (!pages || pages.length === 0) return null;
  return pages[0].files.map((file) => file.id);
}
export function cateringFileBoundary(pages: readonly { files: readonly { id: string }[] }[] | undefined): string | null {
  const snapshot = cateringFileSnapshot(pages);
  return snapshot === null ? null : snapshot.join(",");
}

export function formatCateringFileSize(byteSize: number): string {
  if (!Number.isFinite(byteSize) || byteSize < 0) return "";
  if (byteSize < 1024) return `${byteSize} B`;
  if (byteSize < 1024 * 1024) return `${Math.round(byteSize / 1024)} KB`;
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}
/** A bounded count renders truthfully at its ceiling rather than claiming an exact total it never counted. */
export function formatCateringBoundedCount(count: number, ceiling: number): string {
  return count > ceiling ? `${ceiling}+` : String(count);
}

export const cateringBookingFilesKey = (userId: string, bookingId: string) => ["catering", "booking-files", userId, bookingId] as const;

/**
 * Reconciling files the client still holds but the newest page no longer covers.
 *
 * Background polling refreshes a WINDOW over the newest end of the collection, and history loaded below that window
 * is preserved rather than dropped, because absence from a shifted page proves nothing. That is right for a file
 * merely displaced by newer uploads and wrong for one the uploader has since removed: nothing in the newest pages
 * can ever mention it again, so it would sit in the rendering forever, offering a download that answers 404, until
 * the participant happened to paginate back down to it by hand.
 *
 * So the client asks the only question it actually needs answered: of these files I am already holding, which may I
 * still see? The answer is a subset of what the caller supplied, so it can disclose nothing the caller did not
 * already have -- an id that is provider-private to a customer is simply absent, exactly as a deleted one is and
 * exactly as an id that never existed is, which is what keeps the three indistinguishable. No storage key, no
 * count, no timestamp and no id the actor was not already served is involved.
 *
 * It is bounded by what a client can be holding below the window, and it is idempotent: asking twice answers the
 * same, and a file's absence is permanent, so acting on it can never need to be undone.
 */
export const CATERING_FILE_PRESENCE_MAXIMUM = 200;
export const cateringBookingFilePresenceSchema = z.object({
  ids: z.string()
    .transform((raw) => raw.split(",").filter((id) => id !== ""))
    .pipe(z.array(z.string().uuid()).min(1).max(CATERING_FILE_PRESENCE_MAXIMUM)),
}).strict();
/** The request is echoed so the client can subtract without depending on which request an answer belongs to. */
export type CateringBookingFilePresenceView = { requested: string[]; active: string[] };
/**
 * Every presence query for one actor's view of one booking, whatever set of ids it is currently asking about. The
 * full key appends that set, so this prefix is what a one-off refresh invalidates when the recurring poll has
 * stopped -- a booking going terminal stops mutations, not the truth about a removal already made.
 */
export const cateringBookingFilePresencePrefix = (userId: string, bookingId: string) =>
  ["catering", "booking-file-presence", userId, bookingId] as const;
export const cateringBookingFilePresenceKey = (userId: string, bookingId: string, fingerprint: string) =>
  [...cateringBookingFilePresencePrefix(userId, bookingId), fingerprint] as const;
export function cateringFilePresencePath(bookingId: string, ids: readonly string[]): string {
  return `/api/catering/bookings/${bookingId}/files/active?ids=${encodeURIComponent(ids.join(","))}`;
}
