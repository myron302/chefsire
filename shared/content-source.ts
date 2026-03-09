export const CONTENT_SOURCES = ["chefsire", "external"] as const;

export type ContentSource = (typeof CONTENT_SOURCES)[number];
export type ContentSourceFilter = ContentSource | "all";

export const CONTENT_SOURCE_LABELS: Record<ContentSourceFilter, string> = {
  all: "All",
  chefsire: "ChefSire",
  external: "External",
};

export function isContentSource(value: unknown): value is ContentSource {
  return typeof value === "string" && CONTENT_SOURCES.includes(value as ContentSource);
}

export function parseContentSourceFilter(value: unknown): ContentSourceFilter {
  if (typeof value !== "string") return "all";
  const normalized = value.trim().toLowerCase();
  if (normalized === "all") return "all";
  return isContentSource(normalized) ? normalized : "all";
}
