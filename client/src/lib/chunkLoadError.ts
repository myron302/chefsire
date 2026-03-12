const CHUNK_LOAD_ERROR_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "Loading chunk",
  "ChunkLoadError",
];

const CHUNK_RELOAD_GUARD_KEY = "chefsire:chunk-reload-attempted";

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function reloadForChunkError(): void {
  if (typeof window === "undefined") {
    return;
  }

  // Avoid infinite reload loops if the deployment is still broken.
  const alreadyAttempted = window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) === "1";
  if (!alreadyAttempted) {
    window.sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, "1");
  }

  const url = new URL(window.location.href);
  url.searchParams.set("v", Date.now().toString());
  window.location.replace(url.toString());
}

export function clearChunkReloadGuard(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY);
}

