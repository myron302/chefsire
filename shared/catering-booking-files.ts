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
export const CATERING_FILE_LIMIT_MESSAGE = `A booking may hold at most ${CATERING_BOOKING_FILE_LIMIT} files`;
export const CATERING_FILE_TYPE_MESSAGE = "Only PDF, JPEG, PNG and WebP files are accepted";
export const CATERING_FILE_SIZE_MESSAGE = `A booking file may be at most ${CATERING_FILE_MAX_BYTES / (1024 * 1024)} MB`;
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
