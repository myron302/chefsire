// server/routes/restaurants.ts
import { Router } from "express";
import fetch from "node-fetch";

const router = Router();

// Expect FSQ API key in env
const FSQ_API_KEY = process.env.FOURSQUARE_API_KEY;
if (!FSQ_API_KEY) {
  console.warn("[restaurants] Missing FOURSQUARE_API_KEY — set it in server/.env");
}

const FSQ_BASE = "https://api.foursquare.com/v3";

// Small helper to call FSQ
async function fsq(path: string, params?: Record<string, string | number>) {
  const url = new URL(FSQ_BASE + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), {
    headers: {
      "Authorization": FSQ_API_KEY || "",
      "Accept": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FSQ ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * GET /api/restaurants/search
 * Query params:
 *   ll=lat,lon  (optional, else use near)
 *   near=city   (fallback if ll missing)
 *   q=keyword   (default "restaurant")
 *   radius=meters
 *   limit=number (<= 50)
 */
router.get("/search", async (req, res) => {
  try {
    const { ll, near, q, radius, limit } = req.query as Record<string, string>;
    const params: Record<string, string | number> = {
      q: q || "restaurant",
      sort: "RELEVANCE",
      limit: Math.min(Number(limit || 30), 50),
    };
    if (ll) params.ll = ll;
    else if (near) params.near = near;
    else params.near = "New York, NY"; // sensible default

    if (radius) params.radius = Number(radius);

    // Category filter: restaurants
    // https://docs.foursquare.com/developer/reference/place-search
    params.categories = "13065"; // Food -> Restaurant umbrella

    const data = await fsq("/places/search", params);

    // Normalize a slim payload for the client
    const items = (data.results || []).map((p: any) => ({
      id: p.fsq_id,
      name: p.name,
      categories: (p.categories || []).map((c: any) => c.name),
      location: {
        address: p.location?.formatted_address,
        locality: p.location?.locality,
        region: p.location?.region,
      },
      geocodes: p.geocodes,
      rating: p.rating ?? null,
      price: p.price ?? null,
      distance: p.distance ?? null,
      photos: [], // can be filled via /photos route if you want
    }));

    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Search failed" });
  }
});

/**
 * GET /api/restaurants/:id/details
 * Returns richer details + up to N tips (“reviews”).
 * Query: tipsLimit (default 5)
 */
router.get("/:id/details", async (req, res) => {
  try {
    const { id } = req.params;
    const tipsLimit = Math.min(Number(req.query.tipsLimit || 5), 20);

    const [details, tips] = await Promise.all([
      fsq(`/places/${id}`, {}),
      fsq(`/places/${id}/tips`, { limit: tipsLimit }),
    ]);

    res.json({
      id: details.fsq_id,
      name: details.name,
      description: details.description ?? null,
      tel: details.tel ?? null,
      website: details.website ?? null,
      location: {
        address: details.location?.formatted_address,
        locality: details.location?.locality,
        region: details.location?.region,
      },
      rating: details.rating ?? null,
      price: details.price ?? null,
      hours: details.hours ?? null,
      categories: (details.categories || []).map((c: any) => c.name),
      photos: details.photos || [],
      tips: (tips?.results || []).map((t: any) => ({
        id: t.id,
        text: t.text,
        author: t.author?.name || "Anonymous",
        created_at: t.created_at,
        agree_count: t.agree_count ?? 0,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Details failed" });
  }
});

export default router;
