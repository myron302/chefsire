import path from "path";
import { CATERING_BOOKING_FILE_LIMIT, CATERING_FILE_MAX_BYTES, cateringFileTypeForExtension, cateringFileTypeForUpload, mayDeleteCateringFile, mayMutateCateringFiles, mayReadCateringFile, mayUploadCateringFileVisibility, type CateringFileVisibility } from "@shared/catering-booking-files";

export { mayDeleteCateringFile, mayMutateCateringFiles, mayReadCateringFile, mayUploadCateringFileVisibility };

/** How long a sanitized display filename may be, extension included. Long enough to stay recognisable, bounded. */
export const CATERING_FILE_DISPLAY_NAME_MAX = 120;

/**
 * Reduces a client-supplied filename to safe display metadata. It never becomes part of a storage key, so this only
 * has to be safe to store and render: path separators and traversal segments are dropped rather than resolved,
 * control characters and NUL are removed, whitespace is collapsed, and the result is bounded while keeping the
 * extension the content was actually validated as. "../../etc/passwd" therefore becomes an ordinary display name and
 * can address nothing.
 */
export function sanitizeCateringFilename(originalName: string, extension: string): string {
  // Take the last path segment under both separators, so a Windows or POSIX path can never contribute a directory.
  const lastSegment = originalName.split(/[\\/]/).pop() ?? "";
  // Control characters -- NUL, newlines, tabs, DEL -- become a space rather than vanishing, so removing them
  // cannot silently run two words together into a name that reads as something the uploader never chose.
  const withoutControl = lastSegment.replace(/[\u0000-\u001f\u007f]/g, " ");
  const collapsed = withoutControl.replace(/\s+/g, " ").trim();
  // A name made only of dots ("..", ".") carries no information and must not survive as one.
  const base = collapsed.replace(/\.[^.]*$/, "").replace(/^\.+$/, "").replace(/^\.+/, "").trim();
  const safeBase = base.replace(/[^\w \-.()\[\]&+,'#]/g, "_").trim();
  const suffix = `.${extension}`;
  const room = CATERING_FILE_DISPLAY_NAME_MAX - suffix.length;
  const bounded = safeBase.slice(0, Math.max(room, 1)).trim();
  return `${bounded === "" ? "file" : bounded}${suffix}`;
}

/** The extension a filename claims, lower-cased and without its dot. Empty when the name carries none. */
export function cateringFileExtension(originalName: string): string {
  const lastSegment = originalName.split(/[\\/]/).pop() ?? "";
  return path.extname(lastSegment).replace(/^\./, "").toLowerCase();
}

/**
 * The private storage key for one file. Every segment is server-generated: the booking id, the file id, and the
 * extension of the allowlisted type the content was validated as. The client-supplied filename contributes nothing,
 * so no upload can steer where its bytes land, and the opaque file UUID is what actually identifies the object.
 */
export function cateringFileStorageKey(bookingId: string, fileId: string, extension: string): string {
  const type = cateringFileTypeForExtension(extension);
  if (!type) throw new Error("Refusing to build a storage key for a file type that is not allowed");
  if (!/^[0-9a-f-]{36}$/i.test(bookingId) || !/^[0-9a-f-]{36}$/i.test(fileId)) throw new Error("Refusing to build a storage key from a non-identifier");
  return `catering-bookings/${bookingId}/${fileId}/${fileId}.${type.extension}`;
}

/**
 * Resolves what an upload request is allowed to be, before any byte is stored. Every refusal is distinct so the
 * client is told the truth: a wrong visibility for the actor is not a rejected file type, and neither is a full
 * booking. Extension and declared MIME must name the same allowlisted type; content is checked separately.
 */
export type CateringUploadRequest = { role: "provider" | "customer"; visibility: CateringFileVisibility; originalName: string; declaredMimeType: string; byteSize: number };
export function resolveCateringUpload(request: CateringUploadRequest) {
  if (!mayUploadCateringFileVisibility(request.role, request.visibility)) return { kind: "forbidden_visibility" } as const;
  if (request.byteSize <= 0) return { kind: "empty" } as const;
  if (request.byteSize > CATERING_FILE_MAX_BYTES) return { kind: "too_large" } as const;
  const extension = cateringFileExtension(request.originalName);
  const type = cateringFileTypeForUpload(extension, request.declaredMimeType);
  if (!type) return { kind: "unsupported_type" } as const;
  return { kind: "accepted", type, filename: sanitizeCateringFilename(request.originalName, type.extension) } as const;
}

/**
 * Resolved under the booking file collection lock: a booking that closed and a full bucket are different refusals.
 *
 * `activeCount` is the count for the visibility bucket being uploaded into, never the booking's total. The caller
 * scopes it, which is what keeps a customer's shared-upload outcome independent of provider-private files.
 */
export function resolveCateringFileSlot(locked: { activeCount: number } | null) {
  if (!locked) return { kind: "read_only" } as const;
  if (locked.activeCount >= CATERING_BOOKING_FILE_LIMIT) return { kind: "limit" } as const;
  return { kind: "accepted" } as const;
}

/**
 * Whether one actor may see one persisted file at all. A customer asking for a provider-private file gets exactly
 * the same answer as one asking for a file that never existed, so a probe learns nothing either way.
 */
export function cateringFileVisibleTo(file: { visibility: string; deletedAt: Date | null } | undefined, role: "provider" | "customer"): boolean {
  if (!file || file.deletedAt !== null) return false;
  return mayReadCateringFile(role, file.visibility as CateringFileVisibility);
}

/** The activity event a persisted file upload or removal earns, and the visibility that activity is recorded at. */
export function cateringFileActivity(visibility: CateringFileVisibility, action: "uploaded" | "removed") {
  const eventType = visibility === "shared"
    ? (action === "uploaded" ? "shared_file_uploaded" as const : "shared_file_removed" as const)
    : (action === "uploaded" ? "provider_file_uploaded" as const : "provider_file_removed" as const);
  // Provider-private file history is recorded at provider visibility, so the customer never receives the row.
  return { eventType, visibility };
}
/** Only a new shared file notifies the counterpart. Provider-private uploads and every deletion stay silent. */
export function shouldNotifyCateringFileUpload(visibility: CateringFileVisibility): boolean { return visibility === "shared"; }

/**
 * The Content-Disposition for an authorized download. Documents and images alike are served as attachments at
 * launch: nothing user-supplied is ever rendered inline in the application's origin. The filename is emitted twice --
 * an ASCII-only fallback with quotes and backslashes stripped, and a percent-encoded UTF-8 form -- so a name with
 * non-ASCII characters survives without letting a quote or a newline break out of the header.
 */
export function cateringFileContentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Download responses are private, uncached, and never sniffed into a different type than the one we validated. */
export const CATERING_FILE_DOWNLOAD_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } as const;
