const UPLOADS_PATH_PREFIX = "/uploads/";

/**
 * Returns a browser-safe media URL for stored uploads.
 *
 * Older rows may contain absolute upload URLs generated from whatever host or
 * protocol the server saw at upload time. When the app is later served from a
 * different host, or through HTTPS behind a proxy, those absolute URLs can break
 * feed images through stale hosts or mixed-content blocking. Uploads are served
 * by this app, so same-app upload URLs should be rendered as root-relative
 * paths while external images are left untouched.
 */
export function normalizeMediaUrl(value?: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (raw.startsWith(UPLOADS_PATH_PREFIX)) return raw;
  if (raw.startsWith("data:")) return raw;

  try {
    const url = new URL(raw);
    if (url.pathname.startsWith(UPLOADS_PATH_PREFIX)) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // Non-URL relative values are intentionally returned as-is.
  }

  return raw;
}
