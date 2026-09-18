/**
 * Deciding what to do about public-R2 objects written BEFORE upload validation existed.
 *
 * WHY THIS IS NEEDED. `lib/uploads-static` only governs objects ChefSire serves itself. When R2 is configured,
 * `publicUrl()` hands the client a direct `R2_PUBLIC_BASE_URL` address and the request never reaches Express, so
 * none of those response headers apply to any R2 object.
 *
 * WHAT THE LEGACY OBJECTS LOOK LIKE, read from the pre-repair code at caafde3:
 *
 *   /api/upload          posts/<uuid><extname(originalname)>   ContentType = file.mimetype (declared allowlist)
 *   signup avatar        avatars/<uuid><extname(originalname)> ContentType = file.mimetype (declared allowlist)
 *   review photo         reviews/<uuid><extname(originalname)> ContentType = file.mimetype (declared allowlist)
 *   persistDataUri       posts/<uuid>.<ext from declared type> ContentType = the DECLARED type, svg included
 *   storeUploadedImage   posts/<uuid>.gif | .webp              ContentType = image/gif | image/webp
 *
 * TWO CORRECTIONS FROM REVIEW, BOTH LOAD-BEARING.
 *
 * 1. SCOPE IS CODE-OWNED, NOT CLI-OWNED. The first version let `--prefix=` name any prefix. `--prefix=` (empty)
 *    was the worst case: `key.startsWith("")` is true of every key, so the entire bucket came into scope and, with
 *    deletion enabled, unrelated objects could be destroyed. `--prefix=post` likewise matched `postsomething/`.
 *    The allowed prefixes are now a frozen constant here; a request may only SELECT from them, by exact match.
 *
 * 2. AN EXTENSION IS NOT EVIDENCE OF CONTENT. This is the same mistake the whole repair exists to correct, and
 *    the first version of the script made it in reverse: it would have DELETED an object because its key ended in
 *    `.html`. But the original vulnerability took the extension from the uploader's FILENAME, so a real JPEG
 *    uploaded as `photo.html` is sitting at `posts/<uuid>.html` right now. Deleting it destroys a user's photo.
 *    Nothing is classified from its key any more: the bytes are fetched and run through the same
 *    `validateUploadedMedia` boundary that governs new uploads, and only that decides.
 *
 * WHY NOTHING IS EVER RENAMED OR DELETED. See `REFERENCE_AUDIT` below. ChefSire has no central media table; a
 * media URL is denormalised into fifteen columns across twelve tables, three of which are JSONB arrays, and the
 * stored shape is a mix of absolute R2 URLs and `/uploads/...` paths. There is no authoritative index from an
 * object to the rows that reference it, so a key change cannot be propagated safely and a deletion cannot be
 * shown not to break something. Every remediation here therefore acts IN PLACE, on the same key, so every
 * existing reference keeps resolving.
 */
import { CANONICAL_EXTENSION_CONTENT_TYPES, REJECTED_ACTIVE_CONTENT_TYPES, REJECTED_ACTIVE_EXTENSIONS } from "@shared/media-types";
import type { MediaValidationResult } from "./media-validation";

/**
 * The ONLY prefixes this tooling may ever touch. Frozen, code-owned, and derived from the audit of every
 * pre-repair writer: `/api/upload` and `persistDataUri` wrote `posts/`, signup wrote `avatars/`, review photos
 * wrote `reviews/`. Nothing else in the bucket is ChefSire's to judge, and the private catering bucket is a
 * different bucket entirely that this tooling never opens.
 */
export const LEGACY_PUBLIC_PREFIXES: readonly string[] = Object.freeze(["posts/", "avatars/", "reviews/"]);

/** What a neutralized object is set to. Also the signature that makes a re-run a no-op. */
export const NEUTRALIZED_CONTENT_TYPE = "application/octet-stream";
export const NEUTRALIZED_CONTENT_DISPOSITION = "attachment";

/** Above this, an object is not read into memory and is reported as unverifiable rather than guessed at. */
export const LEGACY_INSPECT_MAX_BYTES = 25 * 1024 * 1024;

/**
 * The reference audit that decides the shape of this whole tool, recorded here so the reasoning travels with the
 * code. Every column below can hold a URL produced by `publicUrl()` or `uploadUrlPath()`.
 */
export const REFERENCE_AUDIT = Object.freeze({
  centralMediaTable: false,
  columns: Object.freeze([
    "posts.image_url", "posts.additional_images (jsonb array)", "recipes.image_url",
    "recipe_review_photos.photo_url", "stories.image_url", "users.avatar",
    "clubs.cover_image", "club_posts.image_url", "notifications.image_url",
    "nutrition_logs.image_url", "custom_drinks.image_url", "drink_photos.image_url",
    "products.images (jsonb array)", "products.digital_file_url",
    "catering_packages.cover_image", "catering_packages.gallery_images (jsonb array)",
  ]),
  /** Both shapes occur, and a deployment that switched storage modes has both in the same column. */
  storedShapes: Object.freeze(["absolute R2_PUBLIC_BASE_URL url", "/uploads/<name> path"]),
});

/* ------------------------------------------------------------------ scope, fail-closed */

export type PrefixResolution =
  | { ok: true; prefixes: readonly string[] }
  | { ok: false; rejected: readonly string[] };

/**
 * Resolves a requested scope against the code-owned list.
 *
 * A request may only SELECT from `LEGACY_PUBLIC_PREFIXES`, by exact string match. It can never widen the scope,
 * introduce a new prefix, or pass the empty string. Requesting nothing means all three. One bad value fails the
 * whole call: a run that was partly misunderstood is not a run worth doing.
 */
export function resolveRequestedPrefixes(requested: readonly string[]): PrefixResolution {
  if (requested.length === 0) return { ok: true, prefixes: LEGACY_PUBLIC_PREFIXES };
  const rejected = requested.filter((prefix) => !LEGACY_PUBLIC_PREFIXES.includes(prefix));
  if (rejected.length > 0) return { ok: false, rejected };
  // De-duplicated, and ordered by the code-owned list rather than by argv.
  return { ok: true, prefixes: LEGACY_PUBLIC_PREFIXES.filter((prefix) => requested.includes(prefix)) };
}

/**
 * Whether one key is inside the code-owned boundary.
 *
 * Checked again on every key a listing returns, immediately before any mutation. Listing by prefix is a request,
 * not a guarantee -- a proxy, a stub, a future refactor or a malformed response could yield something else -- and
 * the cost of re-checking is nothing. Keys with traversal segments, a leading slash or an empty segment are
 * refused outright: an R2 key is an opaque string where `..` is literal, but anything that syncs the bucket to a
 * filesystem would resolve it, and a key we cannot reason about is not one to mutate.
 */
export function isKeyWithinOwnedScope(key: string, prefixes: readonly string[] = LEGACY_PUBLIC_PREFIXES): boolean {
  if (key === "" || key.startsWith("/") || key.endsWith("/")) return false;
  const segments = key.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return false;
  // Exact directory prefixes only: "posts/" matches "posts/x", never "postsomething/x".
  return prefixes.some((prefix) => LEGACY_PUBLIC_PREFIXES.includes(prefix) && key.startsWith(prefix));
}

/* ------------------------------------------------------------------ triage, from metadata alone */

/**
 * Everything HEAD tells us about one object. Held in full because remediation rewrites metadata by copy, and a
 * copy that only supplies some fields discards the rest -- see `planObjectMetadata`.
 */
export type LegacyObjectMetadata = {
  key: string;
  contentType?: string;
  contentDisposition?: string;
  cacheControl?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  expires?: string;
  /** Custom `x-amz-meta-*` entries. The uploader's, not ours, and never ours to discard. */
  metadata?: Record<string, string>;
  websiteRedirectLocation?: string;
  size?: number;
};

export type TriageReason =
  | "active_content_type" | "active_extension" | "missing_content_type"
  | "already_neutralized" | "canonical_media" | "type_mismatch_left_alone" | "unrecognized_left_alone" | "out_of_scope";

export type LegacyTriage = { action: "inspect" | "keep"; reason: TriageReason };

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

/**
 * Whether an object is worth reading the bytes of. This decides only whether to LOOK, never what to do.
 *
 * Canonical media -- the right extension carrying the right stored type -- is not read at all: there is nothing
 * to learn and no action available, and skipping it keeps a run over a large bucket cheap.
 */
export function triageLegacyObject(object: LegacyObjectMetadata, prefixes: readonly string[] = LEGACY_PUBLIC_PREFIXES): LegacyTriage {
  if (!isKeyWithinOwnedScope(object.key, prefixes)) return { action: "keep", reason: "out_of_scope" };

  const contentType = normalizeContentType(object.contentType);
  const disposition = (object.contentDisposition ?? "").trim().toLowerCase();
  const extension = keyExtension(object.key);

  if (contentType === NEUTRALIZED_CONTENT_TYPE && disposition.startsWith(NEUTRALIZED_CONTENT_DISPOSITION)) {
    return { action: "keep", reason: "already_neutralized" };
  }
  if (ACTIVE_CONTENT_TYPES.has(contentType)) return { action: "inspect", reason: "active_content_type" };
  if (ACTIVE_EXTENSIONS.has(extension)) return { action: "inspect", reason: "active_extension" };
  if (contentType === "") return { action: "inspect", reason: "missing_content_type" };
  if (CANONICAL_EXTENSION_CONTENT_TYPES[extension] === contentType) return { action: "keep", reason: "canonical_media" };
  if (CANONICAL_EXTENSION_CONTENT_TYPES[extension]) return { action: "keep", reason: "type_mismatch_left_alone" };
  return { action: "keep", reason: "unrecognized_left_alone" };
}

/* ------------------------------------------------------------------ the decision, from the bytes */

export type RemediationReason =
  | "valid_media_unsafe_key"      // real media under a key whose extension is active: pin the true type
  | "valid_media_wrong_type"      // real media whose stored type disagrees with its bytes: pin the true type
  | "active_content"              // the bytes really are HTML/SVG/script: make it an inert download
  | "unverifiable_active_surface" // bytes unreadable AND the object presents an active surface: inert download
  | "unverifiable_inert"          // bytes unreadable but nothing about it is active: report, touch nothing
  | "too_large_to_inspect"        // beyond the read bound: report, touch nothing
  | "already_correct";            // the bytes agree with the stored type and the key: nothing to do

export type LegacyRemediation =
  | { action: "pin_content_type"; contentType: string; reason: RemediationReason; unsafeKeyRetained: boolean }
  | { action: "neutralize"; reason: RemediationReason }
  | { action: "report_only"; reason: RemediationReason }
  | { action: "keep"; reason: RemediationReason };

/**
 * What to do about one object, decided from what its bytes actually are.
 *
 * The four outcomes the review asked for, and nothing is ever renamed or deleted in any of them:
 *
 *   A. VALID MEDIA UNDER AN UNSAFE KEY -- a real JPEG at `posts/<uuid>.html`. Preserved. Its verified canonical
 *      content type is pinned onto the object, so R2 serves the truth instead of whatever was declared. The key
 *      keeps its unsafe extension because changing it would orphan every database row pointing at the old URL;
 *      that is reported (`unsafeKeyRetained`) rather than silently accepted.
 *   B. ACTUAL ACTIVE CONTENT -- HTML bytes, an SVG with script. Neutralized in place: `application/octet-stream`,
 *      `attachment`, `no-store`. Not deleted, because the key may be referenced and neutralizing stops execution
 *      just as completely while leaving the reference resolvable.
 *   C. UNVERIFIABLE -- fail closed, and split by whether it presents an active surface at all. Something
 *      unreadable that R2 is serving as `text/html`, or that sits under a `.svg` key, is neutralized (reversible,
 *      non-destructive). Something unreadable that is inert either way is reported for a human and not touched.
 *      In practice the runner only ever reaches this function for objects that DO present an active surface --
 *      triage inspects an object only when its stored type is active, its key extension is active, or it has no
 *      stored type at all, and all three are active surfaces -- so the inert branch exists for direct callers
 *      and as a guard against a future triage that widens what it inspects.
 *   D. ALREADY CORRECT -- untouched.
 */
export function decideLegacyRemediation(
  object: LegacyObjectMetadata,
  triage: LegacyTriage,
  validation: MediaValidationResult | { kind: "not_inspected"; why: "too_large" | "unreadable" },
): LegacyRemediation {
  if (triage.action === "keep") return { action: "keep", reason: "already_correct" };

  const storedType = normalizeContentType(object.contentType);
  const extension = keyExtension(object.key);
  const presentsActiveSurface = ACTIVE_CONTENT_TYPES.has(storedType) || ACTIVE_EXTENSIONS.has(extension) || storedType === "";

  if (validation.kind === "not_inspected") {
    if (validation.why === "too_large") return { action: "report_only", reason: "too_large_to_inspect" };
    return presentsActiveSurface
      ? { action: "neutralize", reason: "unverifiable_active_surface" }
      : { action: "report_only", reason: "unverifiable_inert" };
  }

  if (validation.kind === "rejected") {
    // The bytes are not media ChefSire accepts. Combined with an active surface that is the real hazard; without
    // one it is still not something to destroy, so it is reported instead.
    return presentsActiveSurface
      ? { action: "neutralize", reason: "active_content" }
      : { action: "report_only", reason: "unverifiable_inert" };
  }

  // CONTENT-ENCODING, AND WHY IT BLOCKS A PIN.
  //
  // A content coding tells the client to transform the stored bytes before interpreting them. S3 and R2 return
  // the STORED bytes for a GET -- the coding is object metadata, not a transfer encoding -- so what this tool
  // validated and what a browser ends up interpreting are only the same thing when there is no coding in play.
  // With one present we cannot honestly say "these bytes are a JPEG, so serve them as image/jpeg": the browser
  // would gunzip them first and get something we never looked at.
  //
  // So a non-identity coding is treated as unverifiable rather than reasoned around. It never becomes a pin; it
  // is neutralized if the object presents an active surface, and reported otherwise. Neutralization drops the
  // coding (see `planObjectMetadata`) precisely so the object then serves its literal bytes and nothing else.
  const coding = (object.contentEncoding ?? "").trim().toLowerCase();
  if (coding !== "" && coding !== "identity") {
    return presentsActiveSurface
      ? { action: "neutralize", reason: "unverifiable_active_surface" }
      : { action: "report_only", reason: "unverifiable_inert" };
  }

  // The bytes ARE valid media. It is never destroyed, whatever its key says.
  const unsafeKeyRetained = ACTIVE_EXTENSIONS.has(extension);
  if (storedType === validation.contentType && !unsafeKeyRetained) {
    return { action: "keep", reason: "already_correct" };
  }
  return {
    action: "pin_content_type",
    contentType: validation.contentType,
    reason: unsafeKeyRetained ? "valid_media_unsafe_key" : "valid_media_wrong_type",
    unsafeKeyRetained,
  };
}


/* ------------------------------------------------------------------ metadata, preserved deliberately */

/**
 * The COMPLETE metadata an object should carry after remediation.
 *
 * It is a complete state rather than a patch because that is what the underlying operation is: rewriting an
 * object's metadata means copying it onto itself with `MetadataDirective: "REPLACE"`, and REPLACE keeps only
 * what the request supplies. The first version supplied three fields, so remediating an object silently erased
 * its custom `x-amz-meta-*` entries, its `Content-Language`, its `Expires` and -- on a pin, which supplied only
 * a content type -- its `Cache-Control` and `Content-Disposition` as well. That is a generic metadata reset, not
 * a security fix, and it is what this function exists to prevent.
 *
 * A field left `undefined` here is genuinely removed. Every removal below is deliberate and explained.
 */
export type ObjectMetadataPlan = {
  contentType: string;
  contentDisposition?: string;
  cacheControl?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  expires?: string;
  metadata?: Record<string, string>;
  websiteRedirectLocation?: string;
};

/**
 * PRESERVED, always -- none of it affects how the bytes are interpreted:
 *   `Metadata` (custom `x-amz-meta-*`), `Content-Language`, `Expires`.
 *
 * PRESERVED on a pin, OVERRIDDEN on a neutralization:
 *   `Content-Disposition` -- a pin is valid media that should keep serving the way it serves today; a
 *      neutralized object must download rather than render, so it becomes `attachment`.
 *   `Cache-Control` -- a pin keeps whatever caching policy it had; a neutralized object becomes `no-store`, so a
 *      cache cannot keep handing out the pre-remediation response.
 *
 * OVERRIDDEN, always: `Content-Type`. That is the remediation.
 *
 * REMOVED on a neutralization: `Content-Encoding` and `Website-Redirect-Location`. A neutralized object is one
 * whose content we have concluded we do not trust, and both of these tell a client to do something other than
 * take the bytes literally -- decode them, or go somewhere else entirely. Removing them is what makes
 * "serves as an inert download" true rather than approximately true. On a pin neither is removed: a pin can only
 * happen when the coding is absent or `identity` (see `decideLegacyRemediation`), so there is nothing to strip.
 */
export function planObjectMetadata(existing: LegacyObjectMetadata, remediation: LegacyRemediation): ObjectMetadataPlan | null {
  if (remediation.action !== "neutralize" && remediation.action !== "pin_content_type") return null;

  const always = {
    contentLanguage: existing.contentLanguage,
    expires: existing.expires,
    metadata: existing.metadata,
  };

  if (remediation.action === "neutralize") {
    return {
      ...always,
      contentType: NEUTRALIZED_CONTENT_TYPE,
      contentDisposition: NEUTRALIZED_CONTENT_DISPOSITION,
      cacheControl: "no-store",
      contentEncoding: undefined,
      websiteRedirectLocation: undefined,
    };
  }

  return {
    ...always,
    contentType: remediation.contentType,
    contentDisposition: existing.contentDisposition,
    cacheControl: existing.cacheControl,
    contentEncoding: existing.contentEncoding,
    websiteRedirectLocation: existing.websiteRedirectLocation,
  };
}

export type LegacySummary = Record<TriageReason | RemediationReason, number>;

export function emptyLegacySummary(): LegacySummary {
  return {
    active_content_type: 0, active_extension: 0, missing_content_type: 0, already_neutralized: 0,
    canonical_media: 0, type_mismatch_left_alone: 0, unrecognized_left_alone: 0, out_of_scope: 0,
    valid_media_unsafe_key: 0, valid_media_wrong_type: 0, active_content: 0,
    unverifiable_active_surface: 0, unverifiable_inert: 0, too_large_to_inspect: 0, already_correct: 0,
  };
}
