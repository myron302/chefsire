/**
 * The canonical description of every media type ChefSire accepts from a user, and the only place a stored
 * extension or a served content type is allowed to come from.
 *
 * THE RULE THIS MODULE EXISTS TO ENFORCE. Nothing a request says about a file is evidence of what the file is.
 * `file.mimetype` is copied from the multipart part header, `file.originalname` is copied from the same place, and
 * a `data:` URI's media type is simply the first token of a string the client composed. All three are attacker
 * chosen. Before this module, each of them reached storage: an upload declaring `image/jpeg` and named
 * `attack.html` was written into the publicly served uploads directory as `<uuid>.html`, and `express.static`
 * served it back as `text/html` on ChefSire's own origin.
 *
 * So the pipeline is: detect the format from the bytes (server/services/media-validation.ts), look the detected
 * format up HERE, and take the extension and the content type from the row that comes back. The declared MIME and
 * the original filename never select a row; the bytes do. The original filename survives only as inert display
 * metadata.
 *
 * This module is deliberately dependency-free and shared: the client's file pickers advertise exactly the formats
 * the server will accept, so a person is never offered a format that is going to be rejected after the upload.
 */

/** A format ChefSire can identify from a file's own bytes. */
export type MediaFormat =
  | "jpeg" | "png" | "webp" | "gif"
  | "mp4" | "quicktime" | "webm" | "ogg" | "avi"
  | "pdf" | "zip" | "epub" | "docx" | "xlsx" | "doc" | "xls";

/**
 * How a format is allowed to be used.
 *
 * `image` and `video` are rendered inline, in `<img>` and `<video>`, on ChefSire's own origin -- that is where
 * active content would actually execute, so those two lists are closed and every member is verified format by
 * format. `document` is only ever downloaded, never rendered: every member is inert in a browser and is served as
 * an attachment with sniffing disabled.
 */
export type MediaClass = "image" | "video" | "document";

export type MediaTypeDescriptor = {
  readonly format: MediaFormat;
  readonly mediaClass: MediaClass;
  /** The content type the SERVER states. It is never copied from the request. */
  readonly contentType: string;
  /** The extension the SERVER appends to a generated name. Lower case, no dot. */
  readonly extension: string;
};

/** Every accepted format, keyed by the format its bytes were detected as. */
export const MEDIA_TYPES: { readonly [F in MediaFormat]: MediaTypeDescriptor } = {
  jpeg: { format: "jpeg", mediaClass: "image", contentType: "image/jpeg", extension: "jpg" },
  png: { format: "png", mediaClass: "image", contentType: "image/png", extension: "png" },
  webp: { format: "webp", mediaClass: "image", contentType: "image/webp", extension: "webp" },
  gif: { format: "gif", mediaClass: "image", contentType: "image/gif", extension: "gif" },
  mp4: { format: "mp4", mediaClass: "video", contentType: "video/mp4", extension: "mp4" },
  quicktime: { format: "quicktime", mediaClass: "video", contentType: "video/quicktime", extension: "mov" },
  webm: { format: "webm", mediaClass: "video", contentType: "video/webm", extension: "webm" },
  // ChefSire has always stored Ogg video under `.ogg`; keeping that spelling keeps existing objects addressable.
  ogg: { format: "ogg", mediaClass: "video", contentType: "video/ogg", extension: "ogg" },
  avi: { format: "avi", mediaClass: "video", contentType: "video/x-msvideo", extension: "avi" },
  pdf: { format: "pdf", mediaClass: "document", contentType: "application/pdf", extension: "pdf" },
  zip: { format: "zip", mediaClass: "document", contentType: "application/zip", extension: "zip" },
  epub: { format: "epub", mediaClass: "document", contentType: "application/epub+zip", extension: "epub" },
  docx: { format: "docx", mediaClass: "document", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" },
  xlsx: { format: "xlsx", mediaClass: "document", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" },
  doc: { format: "doc", mediaClass: "document", contentType: "application/msword", extension: "doc" },
  xls: { format: "xls", mediaClass: "document", contentType: "application/vnd.ms-excel", extension: "xls" },
} as const;

export const MEDIA_FORMATS = Object.keys(MEDIA_TYPES) as readonly MediaFormat[];

export function mediaFormatsFor(mediaClass: MediaClass): readonly MediaFormat[] {
  return MEDIA_FORMATS.filter((format) => MEDIA_TYPES[format].mediaClass === mediaClass);
}

export const IMAGE_FORMATS = mediaFormatsFor("image");
export const VIDEO_FORMATS = mediaFormatsFor("video");
export const DOCUMENT_FORMATS = mediaFormatsFor("document");

/**
 * Active content: formats a browser can execute, script from, or navigate into same-origin. None of these is an
 * accepted format above, and this list exists so a test can state that directly rather than inferring it from an
 * absence. SVG is on it deliberately -- an SVG is a document with script and event handlers that merely happens to
 * be called an image, and nothing in ChefSire has ever needed a user-supplied one.
 */
export const REJECTED_ACTIVE_CONTENT_TYPES = [
  "text/html", "application/xhtml+xml", "image/svg+xml", "application/xml", "text/xml",
  "text/javascript", "application/javascript", "application/x-msdownload", "application/x-httpd-php",
] as const;

/** Extensions a stored object may never end in, whatever any part of the request claimed. */
export const REJECTED_ACTIVE_EXTENSIONS = [
  "html", "htm", "xhtml", "shtml", "svg", "svgz", "xml", "xsl", "xslt",
  "js", "mjs", "php", "phtml", "asp", "aspx", "jsp", "hta", "swf",
] as const;

/** The canonical extension for a detected format. The only supported way to name a stored object. */
export function canonicalExtension(format: MediaFormat): string {
  return MEDIA_TYPES[format].extension;
}

/** The canonical content type for a detected format. The only supported value for an R2 `ContentType`. */
export function canonicalContentType(format: MediaFormat): string {
  return MEDIA_TYPES[format].contentType;
}

/** Whether a stored object of this format is rendered inline by the application, or only ever downloaded. */
export function isInlineMediaClass(mediaClass: MediaClass): boolean {
  return mediaClass === "image" || mediaClass === "video";
}

/** Every canonical extension, mapped to the content type the server states for it when serving `/uploads`. */
export const CANONICAL_EXTENSION_CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze(
  MEDIA_FORMATS.reduce<Record<string, string>>((acc, format) => {
    acc[MEDIA_TYPES[format].extension] = MEDIA_TYPES[format].contentType;
    return acc;
  }, {
    // `storeUploadedImage` writes a `_thumb.webp` beside every processed image; `jpeg` is accepted here because
    // objects written by older builds use it. Neither is a format a NEW upload can be stored as.
    jpeg: "image/jpeg",
  }),
);

/** The canonical extensions the application renders inline. Everything else served from `/uploads` downloads. */
export const INLINE_EXTENSIONS: readonly string[] = Object.freeze([
  ...IMAGE_FORMATS.map(canonicalExtension), "jpeg",
  ...VIDEO_FORMATS.map(canonicalExtension),
]);

/**
 * `accept` values for the client's file pickers.
 *
 * `accept="image/*"` is a UX hint and never a security control, but an over-broad hint is still a real defect: it
 * offers a person a HEIC or an SVG the server is going to refuse. These strings name exactly what is accepted.
 */
export const IMAGE_UPLOAD_ACCEPT = IMAGE_FORMATS.map((format) => MEDIA_TYPES[format].contentType).join(",");
export const VIDEO_UPLOAD_ACCEPT = VIDEO_FORMATS.map((format) => MEDIA_TYPES[format].contentType).join(",");
export const MEDIA_UPLOAD_ACCEPT = `${IMAGE_UPLOAD_ACCEPT},${VIDEO_UPLOAD_ACCEPT}`;
export const DOCUMENT_UPLOAD_ACCEPT = DOCUMENT_FORMATS.map((format) => `.${MEDIA_TYPES[format].extension}`).join(",");
export const GENERAL_UPLOAD_ACCEPT = `${MEDIA_UPLOAD_ACCEPT},${DOCUMENT_UPLOAD_ACCEPT}`;

/** Why an upload was refused. Each maps to one client-facing message and one status; none names an internal. */
export type MediaRejectionReason = "empty" | "unsupported_media_type" | "content_mismatch" | "too_large" | "unreadable_image";

export const MEDIA_REJECTION_MESSAGES: { readonly [R in MediaRejectionReason]: string } = {
  empty: "The uploaded file is empty.",
  unsupported_media_type: "Unsupported media type.",
  content_mismatch: "The file's contents do not match an allowed media type.",
  unreadable_image: "The image could not be read. It may be truncated or corrupt.",
  too_large: "The file is too large.",
};

/** 415 for "we do not accept what this actually is", 400 for a malformed request body. */
export const MEDIA_REJECTION_STATUS: { readonly [R in MediaRejectionReason]: 400 | 415 } = {
  empty: 400,
  unsupported_media_type: 415,
  content_mismatch: 415,
  unreadable_image: 415,
  too_large: 400,
};
