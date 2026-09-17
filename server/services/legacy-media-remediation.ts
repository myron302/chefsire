/**
 * Classification for objects written to the public R2 bucket BEFORE upload validation existed.
 *
 * WHY THIS IS NEEDED, PRECISELY. The `/uploads` hardening in `lib/uploads-static` only governs objects ChefSire
 * serves itself. When R2 is configured, `publicUrl()` hands the client a direct `R2_PUBLIC_BASE_URL` address and
 * the request never reaches Express, so those response headers do not apply to a single R2 object. Any claim that
 * legacy content is "now inert" is true of local storage and false of R2.
 *
 * WHAT THE LEGACY OBJECTS ACTUALLY LOOK LIKE. Read from the pre-repair code at caafde3, per writing path:
 *
 *   /api/upload          posts/<uuid><extname(originalname)>   ContentType = file.mimetype (declared allowlist)
 *   signup avatar        avatars/<uuid><extname(originalname)> ContentType = file.mimetype (declared allowlist)
 *   review photo         reviews/<uuid><extname(originalname)> ContentType = file.mimetype (declared allowlist)
 *   persistDataUri       posts/<uuid>.<ext from declared type> ContentType = the DECLARED type, svg included
 *   storeUploadedImage   posts/<uuid>.gif | .webp              ContentType = image/gif | image/webp
 *
 * That yields two genuinely distinct legacy hazards, and conflating them would overstate the problem:
 *
 *   ACTIVE STORED TYPE -- `persistDataUri` mapped `image/svg+xml` straight through, so `posts/*.svg` objects
 *   exist whose stored ContentType is `image/svg+xml`. R2 serves the stored type, so these are script-capable
 *   documents served inline from the media host today. This is the severe case.
 *
 *   ACTIVE EXTENSION, INERT STORED TYPE -- the three multipart paths took the extension from the uploader's
 *   filename while the ContentType came from a declared-MIME allowlist, so `posts/<uuid>.html` exists with
 *   ContentType `image/jpeg`. R2 answers with the stored type, so a browser does not execute it *today*. It is
 *   still unvalidated content under an executable key, and any serving change that derives a type from the key
 *   -- a Transform Rule, a Worker, a migration that re-infers types, a bucket copied to another host -- makes it
 *   live. It is remediated too, and the distinction is reported rather than blurred.
 *
 * This module is pure: no network, no SDK, no environment. The script drives it, and it is tested directly.
 */
import { CANONICAL_EXTENSION_CONTENT_TYPES, REJECTED_ACTIVE_CONTENT_TYPES, REJECTED_ACTIVE_EXTENSIONS } from "@shared/media-types";

/** The public-bucket prefixes ChefSire has ever written. Anything else in the bucket is not ours to judge. */
export const LEGACY_PUBLIC_PREFIXES = ["posts/", "avatars/", "reviews/"] as const;

/** What a neutralized object is set to. Also the signature that makes a re-run a no-op. */
export const NEUTRALIZED_CONTENT_TYPE = "application/octet-stream";
export const NEUTRALIZED_CONTENT_DISPOSITION = "attachment";

export type LegacyObject = {
  key: string;
  /** The object's stored `Content-Type`, as R2 will serve it. Absent means the object has none. */
  contentType?: string;
  contentDisposition?: string;
};

export type LegacyAction = "neutralize" | "keep";
export type LegacyReason =
  | "active_content_type"
  | "active_extension"
  | "missing_content_type"
  | "already_neutralized"
  | "canonical_media"
  | "type_mismatch_left_alone"
  | "unrecognized_left_alone"
  | "out_of_scope";

export type LegacyDisposition = { action: LegacyAction; reason: LegacyReason };

const ACTIVE_EXTENSIONS = new Set<string>(REJECTED_ACTIVE_EXTENSIONS);
const ACTIVE_CONTENT_TYPES = new Set<string>(REJECTED_ACTIVE_CONTENT_TYPES);

/** The lower-cased extension an object key claims, without its dot. Empty when it carries none. */
export function keyExtension(key: string): string {
  const lastSegment = key.split("/").pop() ?? "";
  const dot = lastSegment.lastIndexOf(".");
  return dot <= 0 ? "" : lastSegment.slice(dot + 1).toLowerCase();
}

/** A stored content type, lower-cased and stripped of any `; charset=` parameter. */
export function normalizeContentType(contentType: string | undefined): string {
  return (contentType ?? "").split(";")[0]!.trim().toLowerCase();
}

export function isWithinScope(key: string, prefixes: readonly string[] = LEGACY_PUBLIC_PREFIXES): boolean {
  return prefixes.some((prefix) => key.startsWith(prefix));
}

/**
 * What should happen to one legacy object.
 *
 * The order is deliberate. Scope first, so nothing outside ChefSire's own prefixes is ever a candidate.
 * Idempotence second, so a re-run costs nothing and cannot flip an object back and forth. Then the two hazards.
 * Everything that is not demonstrably one of them is KEPT: a mismatch between a safe extension and a safe stored
 * type is a labelling wart, not a risk, and sweeping it up would mean modifying working user media on a guess.
 */
export function classifyLegacyObject(object: LegacyObject, prefixes: readonly string[] = LEGACY_PUBLIC_PREFIXES): LegacyDisposition {
  if (!isWithinScope(object.key, prefixes)) return { action: "keep", reason: "out_of_scope" };

  const contentType = normalizeContentType(object.contentType);
  const disposition = (object.contentDisposition ?? "").trim().toLowerCase();
  const extension = keyExtension(object.key);

  // Already done. A second run must not rewrite it, and must not report it as a fresh candidate.
  if (contentType === NEUTRALIZED_CONTENT_TYPE && disposition.startsWith(NEUTRALIZED_CONTENT_DISPOSITION)) {
    return { action: "keep", reason: "already_neutralized" };
  }

  // The severe case: R2 is serving a script-capable document because the declared type was taken at face value.
  if (ACTIVE_CONTENT_TYPES.has(contentType)) return { action: "neutralize", reason: "active_content_type" };

  // An executable key. Inert today because the stored type is inert, live the moment anything derives a type
  // from the key instead. No such object can legitimately exist under ChefSire's upload policy.
  if (ACTIVE_EXTENSIONS.has(extension)) return { action: "neutralize", reason: "active_extension" };

  // No stored type at all means the client sniffs, and sniffing is exactly what we refuse to leave to chance.
  if (contentType === "") return { action: "neutralize", reason: "missing_content_type" };

  // Canonical media, stored as the type its extension says it is. Untouched.
  if (CANONICAL_EXTENSION_CONTENT_TYPES[extension] === contentType) return { action: "keep", reason: "canonical_media" };

  // A safe extension with a different safe stored type. Both are inert, so this is reported and left alone
  // rather than modified: there is no proof anything is wrong with it, and it may be serving users correctly.
  if (CANONICAL_EXTENSION_CONTENT_TYPES[extension]) return { action: "keep", reason: "type_mismatch_left_alone" };

  // Something this repository never wrote and cannot reason about. Reported, never touched.
  return { action: "keep", reason: "unrecognized_left_alone" };
}

/** Whether a disposition's reason describes an object that could never legitimately exist under current policy. */
export function isIllegitimateUnderCurrentPolicy(reason: LegacyReason): boolean {
  return reason === "active_content_type" || reason === "active_extension";
}

export type LegacySummary = Record<LegacyReason, number>;

export function emptyLegacySummary(): LegacySummary {
  return {
    active_content_type: 0, active_extension: 0, missing_content_type: 0, already_neutralized: 0,
    canonical_media: 0, type_mismatch_left_alone: 0, unrecognized_left_alone: 0, out_of_scope: 0,
  };
}
