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

// SVG is deliberately excluded: it can carry script and is not served from our origin.
const SAFE_CONTENT_TYPES: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
};

export function isInlineImageDataUri(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("data:") && INLINE_IMAGE_RE.test(value.slice(0, 40));
}

const versionCache = new Map<string, string>();
const VERSION_CACHE_LIMIT = 2000;

/** Short content version so the URL changes whenever the stored avatar changes (allows immutable caching). */
export function inlineAvatarVersion(userId: string, dataUri: string): string {
  const key = `${userId}:${dataUri.length}:${dataUri.slice(-32)}`;
  const cached = versionCache.get(key);
  if (cached) return cached;
  const version = createHash("sha1").update(dataUri).digest("hex").slice(0, 12);
  if (versionCache.size >= VERSION_CACHE_LIMIT) {
    const oldest = versionCache.keys().next().value;
    if (oldest !== undefined) versionCache.delete(oldest);
  }
  versionCache.set(key, version);
  return version;
}

/** The avatar value to expose publicly: a URL for inline data URIs, otherwise the stored value unchanged. */
export function publicAvatarValue(userId: string, avatar: string | null | undefined): string | null | undefined {
  if (!isInlineImageDataUri(avatar)) return avatar;
  return `/api/users/${encodeURIComponent(userId)}/avatar?v=${inlineAvatarVersion(userId, avatar as string)}`;
}

/** Decodes a stored inline avatar into bytes for serving; null if it is not a safe raster image. */
export function decodeInlineImage(dataUri: string): { contentType: string; body: Buffer } | null {
  const match = INLINE_IMAGE_RE.exec(dataUri.slice(0, 40));
  if (!match) return null;
  const contentType = SAFE_CONTENT_TYPES[match[1].toLowerCase()];
  if (!contentType) return null;
  const body = Buffer.from(dataUri.slice(match[0].length), "base64");
  if (body.length === 0) return null;
  return { contentType, body };
}
