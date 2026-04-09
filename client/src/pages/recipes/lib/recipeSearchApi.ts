import type { ContentSourceFilter } from "@shared/content-source";
import type { SearchResponse } from "./recipeList.types";

export const DEFAULT_PAGE_SIZE = 24;

function parseSearchResponse(res: Response, json: SearchResponse) {
  if (!res.ok || !("ok" in json) || json.ok === false) {
    const msg = (json as any)?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return json.items || [];
}

export function getSourceFilterFromUrlParam(sourceFromUrl: string | null): ContentSourceFilter {
  if (sourceFromUrl === "chefsire" || sourceFromUrl === "external" || sourceFromUrl === "all") {
    return sourceFromUrl;
  }
  return "all";
}

export async function fetchRandomRecipes({
  count = DEFAULT_PAGE_SIZE,
  source = "all",
}: {
  count?: number;
  source?: ContentSourceFilter;
}) {
  const params = new URLSearchParams();
  params.set("count", String(count));
  params.set("source", source);

  const res = await fetch(`/api/recipes/random?${params.toString()}`);
  const json = (await res.json()) as SearchResponse;
  return parseSearchResponse(res, json);
}

export async function fetchSearchRecipes({
  term,
  pageOffset,
  pageSize = DEFAULT_PAGE_SIZE,
  source = "all",
}: {
  term: string;
  pageOffset: number;
  pageSize?: number;
  source?: ContentSourceFilter;
}) {
  const params = new URLSearchParams();
  params.set("q", term.trim());
  params.set("pageSize", String(pageSize));
  params.set("offset", String(pageOffset));
  params.set("source", source);

  const res = await fetch(`/api/recipes/search?${params.toString()}`);
  const json = (await res.json()) as SearchResponse;
  return parseSearchResponse(res, json);
}
