// client/src/hooks/useNearbyBites.ts
import { useQuery } from "@tanstack/react-query";

export type Source = "fsq" | "google" | "both";

export interface NearbyParams {
  q?: string;
  near?: string;
  ll?: string; // "lat,lng"
  source?: Source;
  limit?: number; // optional client cap
}

export interface BaseItem {
  id: string;
  name: string;
  categories?: string[];
  location?: { address?: string; locality?: string; region?: string };
  rating?: number | null;
  price?: number | null;
  user_ratings_total?: number | null;
  geocodes?: any;
  source: "fsq" | "google";
}

async function fetchEndpoint(
  baseUrl: string,
  params: Record<string, string | number | undefined>
) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
    ) as Record<string, string>
  ).toString();

  const res = await fetch(`${baseUrl}?${qs}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${baseUrl} failed: ${text}`);
  }
  return res.json();
}

export function useNearbyBites({
  q = "restaurant",
  near,
  ll,
  source = "both",
  limit,
}: NearbyParams) {
  return useQuery({
    queryKey: ["bitemap:list", source, q, near, ll, limit],
    queryFn: async (): Promise<BaseItem[]> => {
      const endpoints =
        source === "both"
          ? ["/api/restaurants/search", "/api/google/search"]
          : source === "fsq"
          ? ["/api/restaurants/search"]
          : ["/api/google/search"];

      const payloads = await Promise.all(
        endpoints.map((url) =>
          fetchEndpoint(url, { q, ...(ll ? { ll } : { near }) })
        )
      );

      // normalize & tag source
      const normalized = payloads.flatMap((p, i) => {
        const s = source === "both" ? (i === 0 ? "fsq" : "google") : source;
        return (p.items || []).map((it: any) => ({ ...it, source: s }));
      });

      // optional client-side cap
      return typeof limit === "number" ? normalized.slice(0, limit) : normalized;
    },
  });
}
