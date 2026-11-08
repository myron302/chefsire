import { createHash } from "node:crypto";

/**
 * Legacy avatars stored inline as base64 data URIs.
 *
 * Some users' `avatar` column holds the whole image as a `data:image/...;base64,` string (often ~1 MB). The public
 * user projection is embedded in every post, comment and like, so a 10-post feed shipped the same avatar bytes
 * over and over (11 MB measured on production, ~14 s to download). Instead of sending the bytes, the projection
 * now sends a short, versioned URL served by GET /api/users/:id/avatar, which the browser fetches once and
 * caches. Stored data is never modified.
 */

const INLINE_IMAGE_RE = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,/i;

/** Defense in depth for an unauthenticated endpoint: refuse to decode absurdly large stored values. */
export const INLINE_AVATAR_MAX_BASE64_CHARS = 16 * 1024 * 1024;

// SVG and every other non-raster type are deliberately excluded: SVG can carry script.
const SAFE_CONTENT_TYPES: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
};

/** True only for allowlisted raster data URIs. */
export function isInlineImageDataUri(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("data:") && INLINE_IMAGE_RE.test(value.slice(0, 40));
}

/**
 * Content version for the avatar URL: a digest of the ENTIRE stored value, so any change to the image yields a
 * new URL. (Matching-version URLs are cached immutably, so a partial key could pin a stale picture.)
 */
export function inlineAvatarVersion(dataUri: string): string {
  return createHash("sha1").update(dataUri).digest("hex").slice(0, 16);
}

/**
 * The avatar value to expose publicly:
 * - allowlisted raster data URI -> short versioned URL
 * - any other `data:` value (SVG, unknown types) -> null, so it is neither leaked nor shipped inline
 * - normal URLs / paths -> unchanged
 */
export function publicAvatarValue(userId: string, avatar: string | null | undefined): string | null | undefined {
  if (typeof avatar !== "string") return avatar;
  if (isInlineImageDataUri(avatar)) {
    return `/api/users/${encodeURIComponent(userId)}/avatar?v=${inlineAvatarVersion(avatar)}`;
  }
  if (avatar.trim().toLowerCase().startsWith("data:")) return null;
  return avatar;
}

function matchesSignature(contentType: string, body: Buffer): boolean {
  switch (contentType) {
    case "image/png":
      return body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/jpeg":
      return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
    case "image/gif":
      return body.length >= 6 && (body.subarray(0, 6).toString("ascii") === "GIF87a" || body.subarray(0, 6).toString("ascii") === "GIF89a");
    case "image/webp":
      return body.length >= 12 && body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP";
    default:
      return false;
  }
}

/**
 * Decodes a stored inline avatar into bytes for serving; null unless it is an allowlisted raster type, within the
 * size cap, and its bytes carry that type's file signature.
 */
export function decodeInlineImage(dataUri: string): { contentType: string; body: Buffer } | null {
  const match = INLINE_IMAGE_RE.exec(dataUri.slice(0, 40));
  if (!match) return null;
  const contentType = SAFE_CONTENT_TYPES[match[1].toLowerCase()];
  if (!contentType) return null;
  if (dataUri.length - match[0].length > INLINE_AVATAR_MAX_BASE64_CHARS) return null;
  const body = Buffer.from(dataUri.slice(match[0].length), "base64");
  if (body.length === 0 || !matchesSignature(contentType, body)) return null;
  return { contentType, body };
}
