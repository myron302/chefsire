/**
 * The `/uploads` static mount, as one handler the application mounts and the tests exercise.
 *
 * DEFENCE IN DEPTH, NOT THE FIX. What makes this mount safe is that every write site verifies a file's bytes and
 * names the object from the DETECTED format (see `server/services/media-validation.ts`), so no new object can end
 * in an executable extension. These headers are the second line, and they matter for a specific reason: objects
 * written by earlier builds are already on disk in real deployments, and some of them are `.html` and `.svg`
 * files that this mount used to hand back as `text/html` and `image/svg+xml` on ChefSire's own origin.
 *
 * So the content type is not derived from the extension by `send`'s MIME table. It is looked up in the canonical
 * table, which contains only the formats validation can produce. An extension that is not in it -- every legacy
 * active-content object included -- is served as an inert `application/octet-stream` attachment. `nosniff` stops
 * a browser second-guessing the type we state, and the sandbox CSP applies when one of these URLs is navigated to
 * directly, which is the case that turns a stored file into a same-origin document. Neither header affects an
 * `<img>` or `<video>` subresource, so nothing the application renders inline changes.
 */
import express, { type RequestHandler } from "express";
import path from "node:path";
import { CANONICAL_EXTENSION_CONTENT_TYPES, INLINE_EXTENSIONS } from "@shared/media-types";

const uploadContentTypes: Record<string, string> = Object.fromEntries(
  Object.entries(CANONICAL_EXTENSION_CONTENT_TYPES).map(([extension, contentType]) => [`.${extension}`, contentType]),
);
const inlineUploadExtensions = new Set(INLINE_EXTENSIONS.map((extension) => `.${extension}`));

/**
 * Caching for local `/uploads`, and why none of it is immutable.
 *
 * An earlier version of this file gated a one-year immutable lease on a filename shape, on the theory that only
 * this repair's generators produce `<prefix><uuid>.<canonical extension>`. That theory is false, and the
 * inventory of every pre-repair writer says so plainly -- these are the names they wrote, from caafde3:
 *
 *   routes/upload.ts             `${randomUUID()}${path.extname(file.originalname)}`   e.g. <uuid>.jpg
 *   services/image-upload.ts     `${randomUUID()}.gif`, `${id}.webp`, `${id}_thumb.webp`
 *   routes/auth.ts               `avatar-${randomUUID()}${path.extname(file.originalname)}`
 *   lib/data-uri.ts              `${randomUUID()}.${ext}`
 *   scripts/migrate-base64-images.ts  `${randomUUID()}.${ext}`
 *   routes/reviews.ts            `review-${Date.now()}-${random}${ext}`   (the only one that differs)
 *
 * The new generators produce THE SAME SHAPES. Reproduced: seven of the eight historical name forms satisfied the
 * rule and were handed `public, max-age=31536000, immutable`, despite never having been byte-verified. No
 * filename-only discriminator can separate them, because there is nothing to separate -- the strings are drawn
 * from the same grammar.
 *
 * So the filename is out of the cache decision entirely. Until verified uploads live in a namespace historical
 * writers never used -- a storage-layout migration this repair is not the place for -- nothing served from local
 * `/uploads` gets an immutable lease. Canonical media keeps a short revalidated window, which a conditional
 * request satisfies with a 304, and anything whose extension is not a format this pipeline produces is not stored
 * by a cache at all. R2 has its own policy and is unaffected.
 *
 * WHAT NONE OF THIS DOES is revoke a lease already issued. `maxAge: "365d", immutable: true` is on main at
 * caafde3, so clients that fetched a legacy URL before this deploys hold a cached response -- for a legacy
 * `.html`, a `text/html` one -- and will not revalidate until it expires. No header can cancel that, because the
 * client never asks again. The pull request states that residual exposure and its remedy.
 */

/** Canonical media: cacheable, but only for a window short enough that a policy change takes effect quickly. */
export const LOCAL_MEDIA_CACHE_CONTROL = "public, max-age=300, must-revalidate";
/** Anything whose extension this pipeline never produces: inert, and never stored by a cache. */
export const LEGACY_CACHE_CONTROL = "no-store, must-revalidate";

/**
 * What `/uploads` answers with for one stored object. Exported so the rule can be asserted without a socket.
 *
 * The content type is not derived from the extension by `send`'s MIME table. It is looked up in the canonical
 * table, which contains only the formats validation can produce. An extension that is not in it -- every legacy
 * active-content object included -- is served as an inert `application/octet-stream` attachment.
 */
export function uploadResponseHeaders(filePath: string): Record<string, string> {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = uploadContentTypes[extension];
  const headers: Record<string, string> = {
    "Content-Type": contentType ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    // Never `immutable`: see above. The filename plays no part in this decision.
    "Cache-Control": contentType ? LOCAL_MEDIA_CACHE_CONTROL : LEGACY_CACHE_CONTROL,
  };
  if (!contentType || !inlineUploadExtensions.has(extension)) headers["Content-Disposition"] = "attachment";
  return headers;
}

export function uploadsStaticHandler(uploadsDir: string): RequestHandler {
  return express.static(uploadsDir, {
    // `maxAge`/`immutable` are deliberately NOT set here. `send` only applies them when nothing has already set
    // Cache-Control, and `uploadResponseHeaders` always does -- so leaving them out keeps one source of truth.
    // `<UPLOADS_DIR>/.promote` holds validated files for the instant between "copied" and "published" when the
    // staging and uploads directories are on different filesystems. Denying dotfiles means nothing under it is
    // reachable even by exact URL, so a half-copied file is never addressable while it exists.
    dotfiles: "deny",
    setHeaders: (res, filePath) => {
      // `send` only fills in a Content-Type when one is not already set, so stating it here is authoritative.
      for (const [header, value] of Object.entries(uploadResponseHeaders(filePath))) res.setHeader(header, value);
    },
  });
}
