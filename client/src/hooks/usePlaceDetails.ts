// client/src/hooks/usePlaceDetails.ts
import { useQuery } from "@tanstack/react-query";

export type PlaceSource = "fsq" | "google";

export interface FsqTip {
  id: string;
  text: string;
  author: string;
  created_at?: string;
  agree_count?: number;
}

export interface GoogleReview {
  id: string;
  author: string;
  text: string;
  rating?: number;
  created_at?: string;
}

export interface PlaceDetails {
  id: string;
  name: string;
  website?: string | null;
  url?: string | null; // Google listing url (Google only)
  tel?: string | null;
  location?: { address?: string; locality?: string; region?: string };
  rating?: number | null;
  user_ratings_total?: number | null; // Google only
  price?: number | null;
  categories?: string[];
  reviews: (FsqTip | GoogleReview)[];
  _source: PlaceSource;
}

export function usePlaceDetails(source: PlaceSource, id?: string) {
  return useQuery({
    queryKey: ["bitemap:details", source, id],
    enabled: !!id,
    queryFn: async (): Promise<PlaceDetails> => {
      if (!id) throw new Error("Missing place id");

      if (source === "fsq") {
        const res = await fetch(`/api/restaurants/${id}/details?tipsLimit=8`);
        if (!res.ok) throw new Error("FSQ details failed");
        const d = await res.json();
        return {
          id: d.id,
          name: d.name,
          website: d.website ?? null,
          tel: d.tel ?? null,
          location: d.location,
          rating: d.rating ?? null,
          price: d.price ?? null,
          categories: d.categories || [],
          reviews: (d.tips || []).map((t: any) => ({
            id: t.id,
            text: t.text,
            author: t.author || "Anonymous",
            created_at: t.created_at,
            agree_count: t.agree_count,
          })),
          _source: "fsq",
        };
      }

      // google
      const res = await fetch(`/api/google/${id}/details?reviewsLimit=5`);
      if (!res.ok) throw new Error("Google details failed");
      const d = await res.json();
      return {
        id: d.id,
        name: d.name,
        website: d.website ?? null,
        url: d.url ?? null,
        tel: d.tel ?? null,
        location: d.location,
        rating: d.rating ?? null,
        user_ratings_total: d.user_ratings_total ?? null,
        price: d.price ?? null,
        categories: d.categories || [],
        reviews: (d.reviews || []).map((r: any) => ({
          id: r.id,
          author: r.author,
          text: r.text,
          rating: r.rating,
          created_at: r.created_at,
        })),
        _source: "google",
      } as PlaceDetails;
    },
  });
}
