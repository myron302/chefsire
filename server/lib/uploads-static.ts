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

/** What `/uploads` answers with for one stored object. Exported so the rule can be asserted without a socket. */
export function uploadResponseHeaders(filePath: string): Record<string, string> {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = uploadContentTypes[extension];
  const headers: Record<string, string> = {
    "Content-Type": contentType ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  if (!contentType || !inlineUploadExtensions.has(extension)) headers["Content-Disposition"] = "attachment";
  return headers;
}

export function uploadsStaticHandler(uploadsDir: string): RequestHandler {
  return express.static(uploadsDir, {
    maxAge: "365d",
    immutable: true,
    setHeaders: (res, filePath) => {
      // `send` only fills in a Content-Type when one is not already set, so stating it here is authoritative.
      for (const [header, value] of Object.entries(uploadResponseHeaders(filePath))) res.setHeader(header, value);
    },
  });
}
