const DEFAULT_RECENT_MAX = 10;

function parseStoredSlugs(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

export function readRecentlyViewedSlugs(storageKey: string): string[] {
  if (typeof window === "undefined") return [];

  return parseStoredSlugs(window.localStorage.getItem(storageKey));
}

export function addRecentlyViewedSlug(storageKey: string, slug: string, maxItems = DEFAULT_RECENT_MAX) {
  if (typeof window === "undefined") return;

  const normalizedSlug = String(slug || "").trim();
  if (!normalizedSlug) return;

  const existing = readRecentlyViewedSlugs(storageKey);
  const deduped = [normalizedSlug, ...existing.filter((item) => item !== normalizedSlug)];
  const limited = deduped.slice(0, Math.max(1, maxItems));

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(limited));
  } catch {
    // Ignore storage write failures.
  }
}
