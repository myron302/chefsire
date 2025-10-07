// server/routes/google.ts
import { Router } from "express";
import fetch from "node-fetch";

export const googleRouter = Router();

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const UA = "ChefSire-BiteMap/1.0 (+https://chefsire.com)";

function sendJson(res: any, code: number, body: any) {
  res.status(code).json(body);
}

// -------------------------
// DIAGNOSTICS
// -------------------------
googleRouter.get("/diagnostics", (_req, res) => {
  return sendJson(res, 200, {
    ok: true,
    hasKey: Boolean(GOOGLE_KEY),
    keyLen: GOOGLE_KEY ? GOOGLE_KEY.length : 0,
    note:
      "If hasKey=false, set GOOGLE_MAPS_API_KEY in Plesk → Node.js → Environment Variables, then Restart App.",
  });
});

// -------------------------
// MAPS SCRIPT
// -------------------------
googleRouter.get("/maps-script", (_req, res) => {
  if (!GOOGLE_KEY) {
    return res.status(500).send("GOOGLE_MAPS_API_KEY not configured");
  }
  res.set("Content-Type", "text/plain");
  res.set("Cache-Control", "private, max-age=3600");
  return res.send(GOOGLE_KEY);
});

// -------------------------
// GEOCODE HELPER
// -------------------------
async function geocode(near: string) {
  const u = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  u.searchParams.set("address", near);
  u.searchParams.set("key", GOOGLE_KEY);

  const r = await fetch(u.toString(), { headers: { "User-Agent": UA } });
  const j: any = await r.json();

  if (j.status !== "OK") throw new Error(`geocode failed: ${j.status}`);
  const c = j?.results?.[0]?.geometry?.location;
  if (!c) throw new Error("No results from geocoding");
  return { lat: c.lat, lng: c.lng };
}

// -------------------------
// SEARCH (Text or Nearby)
// -------------------------
googleRouter.get("/search", async (req, res) => {
  try {
    if (!GOOGLE_KEY) {
      return sendJson(res, 500, { error: "missing_key", message: "GOOGLE_MAPS_API_KEY not visible" });
    }

    const q =
      (req.query.q as string) ||
      (req.query.query as string) ||
      (req.query.keyword as string) ||
      "restaurant";

    const ll = (req.query.ll as string) || "";
    const nearParam = (req.query.near as string) || (req.query.location as string) || "";
    const limit = Math.min(60, Number(req.query.limit) || 20);

    let lat: number | undefined;
    let lng: number | undefined;
    let near = nearParam.trim();

    // ✅ Handle location priority: ll > near > New York
    if (ll) {
      const [la, ln] = ll.split(",").map(Number);
      if (Number.isFinite(la) && Number.isFinite(ln)) {
        lat = la;
        lng = ln;
      }
    } else if (near) {
      const c = await geocode(near);
      lat = c.lat;
      lng = c.lng;
    } else {
      // Default fallback to New York
      const c = await geocode("New York, NY");
      lat = c.lat;
      lng = c.lng;
      near = "New York, NY";
    }

    const u = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    u.searchParams.set("key", GOOGLE_KEY);
    u.searchParams.set("keyword", q);
    u.searchParams.set("type", "restaurant");
    u.searchParams.set("radius", "4000");
    u.searchParams.set("location", `${lat},${lng}`);

    const r = await fetch(u.toString(), { headers: { "User-Agent": UA } });
    const j: any = await r.json();

    if (j.status !== "OK" && j.status !== "ZERO_RESULTS") {
      return sendJson(res, 502, { error: "google_api_error", status: j.status, message: j.error_message });
    }

    const results = Array.isArray(j.results)
      ? j.results.slice(0, limit).map((p: any) => ({
          ...p,
          __photoRef: p.photos?.[0]?.photo_reference || null,
        }))
      : [];

    return sendJson(res, 200, { status: j.status, near, results });
  } catch (err: any) {
    console.error("google/search error", err);
    return sendJson(res, 500, { error: "google_search_failed", message: err?.message || String(err) });
  }
});

// -------------------------
// PLACE DETAILS
// -------------------------
googleRouter.get("/:placeId/details", async (req, res) => {
  try {
    const placeId = req.params.placeId;
    const reviewsLimit = Math.min(10, Number(req.query.reviewsLimit) || 5);

    const u = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    u.searchParams.set("key", GOOGLE_KEY);
    u.searchParams.set("place_id", placeId);
    u.searchParams.set(
      "fields",
      "place_id,name,formatted_address,geometry,rating,user_ratings_total,price_level,website,url,formatted_phone_number,reviews,types"
    );

    const r = await fetch(u.toString(), { headers: { "User-Agent": UA } });
    const j: any = await r.json();
    if (j.status !== "OK") {
      return sendJson(res, 502, { error: "google_api_error", status: j.status, message: j.error_message });
    }

    const result = j.result || {};
    const reviews = (result.reviews || []).slice(0, reviewsLimit).map((r: any, i: number) => ({
      id: r.time ? String(r.time) : `review-${i}`,
      author: r.author_name || "Anonymous",
      text: r.text || "",
      rating: r.rating || null,
      created_at: r.time ? new Date(r.time * 1000).toISOString() : null,
    }));

    return sendJson(res, 200, {
      id: placeId,
      name: result.name,
      website: result.website || null,
      url: result.url || null,
      tel: result.formatted_phone_number || null,
      location: {
        address: result.formatted_address || null,
        lat: result.geometry?.location?.lat || null,
        lng: result.geometry?.location?.lng || null,
      },
      rating: result.rating || null,
      user_ratings_total: result.user_ratings_total || null,
      price: result.price_level || null,
      categories: result.types || [],
      reviews,
    });
  } catch (err: any) {
    console.error("google/details error", err);
    return sendJson(res, 500, { error: "google_details_failed", message: err?.message || String(err) });
  }
});

// -------------------------
// PHOTO & STATIC MAP
// -------------------------
googleRouter.get("/photo", async (req, res) => {
  try {
    const ref = (req.query.ref as string) || "";
    if (!ref) return res.status(400).send("Missing photo reference");

    const u = new URL("https://maps.googleapis.com/maps/api/place/photo");
    u.searchParams.set("key", GOOGLE_KEY);
    u.searchParams.set("photo_reference", ref);
    u.searchParams.set("maxwidth", "800");

    const r = await fetch(u.toString(), { redirect: "follow" as any });
    if (!r.ok) return res.status(404).send("no_photo");

    res.set("Content-Type", r.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400");
    return r.body?.pipe(res);
  } catch {
    return res.status(404).send("no_photo");
  }
});

googleRouter.get("/staticmap", async (req, res) => {
  try {
    const center = (req.query.center as string) || "";
    const markers = (req.query.markers as string) || "";
    const zoom = String(Math.max(3, Math.min(19, Number(req.query.zoom) || 13)));
    const size = (req.query.size as string) || "640x360";

    const u = new URL("https://maps.googleapis.com/maps/api/staticmap");
    u.searchParams.set("key", GOOGLE_KEY);
    u.searchParams.set("size", size);
    u.searchParams.set("zoom", zoom);
    if (center) u.searchParams.set("center", center);
    if (markers) u.searchParams.append("markers", markers);

    const r = await fetch(u.toString());
    if (!r.ok) return res.status(404).send("no_map");

    res.set("Content-Type", r.headers.get("content-type") || "image/png");
    res.set("Cache-Control", "public, max-age=86400");
    return r.body?.pipe(res);
  } catch {
    return res.status(404).send("no_map");
  }
});
