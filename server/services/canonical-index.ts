import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type CanonicalIndexFile<TEntry> = {
  bySlug?: Record<string, TEntry>;
  [key: string]: unknown;
};

type IndexResolver<TEntry> = {
  generatedFileName: string;
  fallbackCollections?: string[];
};

export function createCanonicalIndexResolver<TEntry extends { slug: string }>(
  options: IndexResolver<TEntry>
) {
  let cache: CanonicalIndexFile<TEntry> | null | undefined;

  function loadIndex(): CanonicalIndexFile<TEntry> | null {
    if (cache !== undefined) {
      return cache;
    }

    try {
      const servicesDir = path.dirname(fileURLToPath(import.meta.url));
      const filePath = path.join(servicesDir, "..", "generated", options.generatedFileName);
      const json = fs.readFileSync(filePath, "utf8");
      cache = JSON.parse(json) as CanonicalIndexFile<TEntry>;
    } catch {
      cache = null;
    }

    return cache;
  }

  function getBySlug(slug: string): TEntry | null {
    const normalizedSlug = String(slug ?? "").trim();
    if (!normalizedSlug) return null;

    const index = loadIndex();
    if (!index) return null;

    if (index.bySlug?.[normalizedSlug]) {
      return index.bySlug[normalizedSlug] ?? null;
    }

    const fallbackCollections = options.fallbackCollections ?? [];
    for (const collectionKey of fallbackCollections) {
      const collection = index[collectionKey];
      if (!collection || typeof collection !== "object") continue;

      const entries = Object.values(collection as Record<string, TEntry>);
      const match = entries.find((entry) => entry?.slug === normalizedSlug);
      if (match) return match;
    }

    return null;
  }

  return {
    getBySlug,
  };
}
