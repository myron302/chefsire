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

/** A year, which is what a genuinely immutable object deserves and what this mount has always sent. */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
/** What a legacy object gets instead: no stored copy, and revalidate every time. */
export const LEGACY_CACHE_CONTROL = "no-store, must-revalidate";

/**
 * Whether a filename is one THIS repair's generators produced.
 *
 * `generatedMediaName` builds `<prefix><uuid>.<canonical extension>` with a prefix that is either empty,
 * `avatar-` or `review-`, and `storeUploadedImage` writes a `<uuid>_thumb.webp` beside each processed image.
 * Nothing else matches, which is exactly the point: the historical names the vulnerable paths wrote --
 * `<uuid>.html`, `avatar-<uuid>.html`, `review-<timestamp>-<random>.<anything>` -- do not.
 */
export function isCanonicalUploadName(filename: string): boolean {
  return /^(avatar-|review-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(_thumb)?\.[a-z0-9]{1,5}$/.test(filename);
}

/**
 * What `/uploads` answers with for one stored object. Exported so the rule can be asserted without a socket.
 *
 * CACHING IS SPLIT, AND THE REASON IS HISTORICAL. This mount has sent `public, max-age=31536000, immutable`
 * since before this PR -- it is on `main` at caafde3, not something introduced here. So every legacy object was
 * served under a stable URL with a one-year immutable lease, and a `.html` or `.svg` written by the vulnerable
 * upload paths went out as `text/html` or `image/svg+xml` with that lease attached. Reproduced against main's
 * handler verbatim.
 *
 * An immutable lease is a promise that the content at a URL will never change, and for a canonical object --
 * a generated UUID name that is written once and never rewritten -- that promise is true and worth keeping. For
 * a legacy object it is false twice over: this repair changes how it is served, and the R2 remediation changes
 * its stored metadata. So legacy names no longer receive that promise; they are `no-store, must-revalidate`, and
 * every request reaches the repaired server.
 *
 * WHAT THIS DOES NOT DO. It cannot revoke a lease already issued. A client that fetched `/uploads/<uuid>.html`
 * before this deploys holds a cached `text/html` response and will not revalidate until it expires -- up to a
 * year. No response header can reach back and cancel that, because the client never asks again. Changing the URL
 * would, but the reference audit in `services/legacy-media-remediation.ts` explains why keys cannot be rewritten.
 * The residual exposure and the operational remedy are stated in the pull request rather than papered over here.
 */
export function uploadResponseHeaders(filePath: string): Record<string, string> {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = uploadContentTypes[extension];
  const canonical = isCanonicalUploadName(path.basename(filePath)) && Boolean(contentType);
  const headers: Record<string, string> = {
    "Content-Type": contentType ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": canonical ? IMMUTABLE_CACHE_CONTROL : LEGACY_CACHE_CONTROL,
  };
  if (!contentType || !inlineUploadExtensions.has(extension)) headers["Content-Disposition"] = "attachment";
  return headers;
}

export function uploadsStaticHandler(uploadsDir: string): RequestHandler {
  return express.static(uploadsDir, {
    // `maxAge`/`immutable` are deliberately NOT set here. `send` only applies them when nothing has already set
    // Cache-Control, and `uploadResponseHeaders` always does -- so leaving them out keeps one source of truth
    // for a policy that now differs between canonical and legacy objects.
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
