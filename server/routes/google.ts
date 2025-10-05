// server/routes/google.ts
import { Router } from "express";
import fetch from "node-fetch";

const router = Router();

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!GOOGLE_API_KEY) {
  console.warn("[google] Missing GOOGLE_MAPS_API_KEY — set it in server/.env");
}

// Helper to call Google Places Web Service
async function gmaps(endpoint: string, params: Record<string, string | number>) {
  const url = new URL(`https://maps.googleapis.com/maps/api/place/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  url.searchParams.set("key", GOOGLE_API_KEY || "");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Google ${endpoint} ${res.status}`);
  const json = await res.json();
  if (json.status && json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    // include status/error_message for easier debugging
    throw new Error(`Google ${endpoint}: ${json.status} ${json.error_message || ""}`);
  }
  return json;
}

/**
 * GET /api/google/search
 * Query params:
 *   ll=lat,lon  (optional; if omitted we use text search with 'near')
 *   near=city   (fallback if ll missing)
 *   q=keyword   (default: "restaurant")
 *   radius=meters (only when ll is provided; Google caps ~50,000)
 *   limit=number (client-side cap; Google returns up to 20 per page)
 *
 * Strategy:
 *  - If ll provided -> Nearby Search (type=restaurant)
 *  - else -> Text Search (query: "<q> in <near>")
 */
router.get("/search", async (req, res) => {
  try {
    const { ll, near, q, radius, limit } = req.query as Record<string, string>;
    const searchLimit = Math.min(Number(limit || 20), 50);
    const keyword = q?.trim() || "restaurant";

    let results: any[] = [];
    if (ll) {
      const [lat, lng] = ll.split(",").map(Number);
      const nearby = await gmaps("nearbysearch/json", {
        location: `${lat},${lng}`,
        radius: Math.max(100, Math.min(Number(radius || 3000), 50000)),
        type: "restaurant",
        keyword,
      });
      results = nearby.results || [];
    } else {
      const place = near?.trim() || "New York, NY";
      const text = await gmaps("textsearch/json", {
        query: `${keyword} in ${place}`,
        type: "restaurant",
      });
      results = text.results || [];
    }

    // Normalize for client
    const items = results.slice(0, searchLimit).map((r: any) => ({
      id: r.place_id as string,
      name: r.name as string,
      categories: (r.types || []).slice(0, 3) as string[],
      location: {
        address: r.formatted_address,
      },
      geocodes: r.geometry,
      rating: typeof r.rating === "number" ? r.rating : null,
      price: typeof r.price_level === "number" ? r.price_level : null,
      user_ratings_total: r.user_ratings_total ?? null,
      source: "google" as const,
    }));

    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Google search failed" });
  }
});

/**
 * GET /api/google/:placeId/details
 * Returns rich details + up to N review excerpts.
 * Query: reviewsLimit (default 5, max 5 from Google)
 */
router.get("/:placeId/details", async (req, res) => {
  try {
    const { placeId } = req.params;
    const reviewsLimit = Math.min(Number(req.query.reviewsLimit || 5), 5);

    const fields = [
      "place_id",
      "name",
      "formatted_address",
      "formatted_phone_number",
      "website",
      "opening_hours",
      "price_level",
      "rating",
      "user_ratings_total",
      "url",
      "reviews",
      "types",
      "geometry",
    ].join(",");

    const details = await gmaps("details/json", {
      place_id: placeId,
      fields,
      reviews_no_translations: "true",
      reviews_sort: "newest",
    });

    const r = details.result || {};
    res.json({
      id: r.place_id,
      name: r.name,
      location: { address: r.formatted_address },
      tel: r.formatted_phone_number || null,
      website: r.website || null,
      url: r.url || null,
      rating: typeof r.rating === "number" ? r.rating : null,
      user_ratings_total: r.user_ratings_total ?? null,
      price: typeof r.price_level === "number" ? r.price_level : null,
      categories: (r.types || []).slice(0, 5),
      hours: r.opening_hours || null,
      geocodes: r.geometry || null,
      reviews:
        (r.reviews || []).slice(0, reviewsLimit).map((v: any) => ({
          id: String(v.time),
          author: v.author_name,
          text: v.text,
          rating: v.rating,
          created_at: v.relative_time_description, // human string
        })) || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Google details failed" });
  }
});

export default router;
