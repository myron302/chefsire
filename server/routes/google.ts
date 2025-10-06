import { Router } from "express";
import fetch from "node-fetch";

export const googleRouter = Router();

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const UA = "ChefSire-BiteMap/1.0 (+https://chefsire.com)";

function sendJson(res: any, code: number, body: any) {
  res.status(code).json(body);
}

// Diagnostics
googleRouter.get("/diagnostics", (_req, res) => {
  return sendJson(res, 200, {
    ok: true,
    hasKey: Boolean(GOOGLE_KEY),
    keyLen: GOOGLE_KEY ? GOOGLE_KEY.length : 0,
    note:
      "If hasKey=false, set GOOGLE_MAPS_API_KEY in Plesk → Node.js → Environment Variables, then Restart App.",
  });
});

// Endpoint to provide Google Maps API key securely
googleRouter.get("/maps-script", (_req, res) => {
  if (!GOOGLE_KEY) {
    return res.status(500).send("GOOGLE_MAPS_API_KEY not configured");
  }
  
  // Return just the API key (the client will construct the script URL)
  res.set("Content-Type", "text/plain");
  res.set("Cache-Control", "private, max-age=3600"); // Cache for 1 hour
  return res.send(GOOGLE_KEY);
});

// Geocode helper
async function geocode(near: string) {
  const u = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  u.searchParams.set("address", near);
  u.searchParams.set("key", GOOGLE_KEY);

  const r = await fetch(u.toString(), { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`geocode http ${r.status}`);

  const j: any = await r.json();
  const status = j?.status || "UNKNOWN";
  if (status !== "OK") {
    throw new Error(`geocode api ${status}: ${j?.error_message || "no message"}`);
  }
  const c = j?.results?.[0]?.geometry?.location;
  if (!c) throw new Error("geocode api OK but no results");
  return { lat: c.lat, lng: c.lng };
}

// Search (Nearby if ll, else Text)
googleRouter.get("/search", async (req, res) => {
  try {
    if (!GOOGLE_KEY) {
      return sendJson(res, 500, {
        error: "missing_key",
        message: "GOOGLE_MAPS_API_KEY not visible to server process.",
      });
    }

    const q =
      (req.query.q as string) ||
      (req.query.query as string) ||
      (req.query.keyword as string) ||
      "restaurant";
    const near = (req.query.near as string) || (req.query.location as string) || "New York, NY";
    const ll = (req.query.ll as string) || "";
    const limit = Math.min(60, Number(req.query.limit) || 20);

    let lat: number | undefined;
    let lng: number | undefined;

    if (ll) {
      const [la, ln] = ll.split(",").map(Number);
      if (Number.isFinite(la) && Number.isFinite(ln)) {
        lat = la;
        lng = ln;
      }
    } else if (near) {
      try {
        const c = await geocode(near);
        lat = c.lat;
        lng = c.lng;
      } catch (e: any) {
        return sendJson(res, 502, { error: "geocode_failed", message: e?.message || "Geocoding failed" });
      }
    }

    let url: string;
    if (typeof lat === "number" && typeof lng === "number") {
      const u = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
      u.searchParams.set("key", GOOGLE_KEY);
      u.searchParams.set("location", `${lat},${lng}`);
      u.searchParams.set("radius", "4000");
      u.searchParams.set("keyword", q);
      u.searchParams.set("type", "restaurant");
      url = u.toString();
    } else {
      const u = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      u.searchParams.set("key", GOOGLE_KEY);
      u.searchParams.set("query", `${q} in ${near}`);
      u.searchParams.set("type", "restaurant");
      url = u.toString();
    }

    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return sendJson(res, 502, { error: "google_http_error", status: r.status });

    const j: any = await r.json();
    const status = j?.status || "UNKNOWN";
    if (status !== "OK" && status !== "ZERO_RESULTS") {
      return sendJson(res, 502, {
        error: "google_api_error",
        status,
        message: j?.error_message || null,
      });
    }

    // Attach photo reference to each result
    const results = Array.isArray(j.results)
      ? j.results.slice(0, limit).map((place: any) => ({
          ...place,
          __photoRef: place.photos?.[0]?.photo_reference || null,
        }))
      : [];

    return sendJson(res, 200, { status, results });
  } catch (e: any) {
    console.error("google/search error", e);
    return sendJson(res, 500, { error: "google_search_failed", message: e?.message || String(e) });
  }
});

// Place Details
googleRouter.get("/:placeId/details", async (req, res) => {
  try {
    if (!GOOGLE_KEY) {
      return sendJson(res, 500, { error: "missing_key" });
    }

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
    if (!r.ok) {
      return sendJson(res, 502, { error: "google_http_error", status: r.status });
    }

    const j: any = await r.json();
    if (j.status !== "OK") {
      return sendJson(res, 502, {
        error: "google_api_error",
        status: j.status,
        message: j.error_message || null,
      });
    }

    const result = j.result || {};
    const reviews = (result.reviews || []).slice(0, reviewsLimit).map((r: any, idx: number) => ({
      id: r.time ? String(r.time) : `review-${idx}`,
      author: r.author_name || "Anonymous",
      text: r.text || "",
      rating: r.rating || null,
      created_at: r.time ? new Date(r.time * 1000).toISOString() : null,
    }));

    return sendJson(res, 200, {
      id: placeId,
      name: result.name || "",
      website: result.website || null,
      url: result.url || null,
      tel: result.formatted_phone_number || null,
      location: {
        address: result.formatted_address || null,
        lat: result.geometry?.location?.lat || null,
        lng: result.geometry?.location?.lng || null,
      },
      geometry: result.geometry || null,
      rating: result.rating || null,
      user_ratings_total: result.user_ratings_total || null,
      price: result.price_level || null,
      categories: result.types || [],
      reviews,
    });
  } catch (e: any) {
    console.error("google details error", e);
    return sendJson(res, 500, {
      error: "google_details_failed",
      message: e?.message || String(e),
    });
  }
});

// Place Photo proxy
googleRouter.get("/photo", async (req, res) => {
  try {
    if (!GOOGLE_KEY) return res.status(500).send("Missing GOOGLE_MAPS_API_KEY");
    const ref = (req.query.ref as string) || (req.query.photo_reference as string);
    if (!ref) return res.status(400).send("Missing photo reference");
    const maxWidth = String(Math.max(200, Math.min(1600, Number(req.query.maxWidth) || 600)));

    const u = new URL("https://maps.googleapis.com/maps/api/place/photo");
    u.searchParams.set("key", GOOGLE_KEY);
    u.searchParams.set("photo_reference", ref);
    u.searchParams.set("maxwidth", maxWidth);

    const r = await fetch(u.toString(), { redirect: "follow" as any, headers: { "User-Agent": UA } });
    if (!r.ok) return res.status(404).send("no_photo");

    const ct = r.headers.get("content-type") || "image/jpeg";
    res.set("Content-Type", ct);
    res.set("Cache-Control", "public, max-age=86400");
    return r.body?.pipe(res);
  } catch (e) {
    console.error("google/photo error", e);
    return res.status(404).send("no_photo");
  }
});

// Static Map proxy
googleRouter.get("/staticmap", async (req, res) => {
  try {
    if (!GOOGLE_KEY) return res.status(500).send("Missing GOOGLE_MAPS_API_KEY");

    const center = (req.query.center as string) || "";
    const markers = (req.query.markers as string) || "";
    const zoom = String(Math.max(3, Math.min(19, Number(req.query.zoom) || 13)));
    const size = (req.query.size as string) || "640x360";
    const scale = String(Number(req.query.scale) || 2);

    const u = new URL("https://maps.googleapis.com/maps/api/staticmap");
    u.searchParams.set("key", GOOGLE_KEY);
    u.searchParams.set("size", size);
    u.searchParams.set("scale", scale);
    if (center) u.searchParams.set("center", center);
    u.searchParams.set("zoom", zoom);
    if (markers) u.searchParams.append("markers", markers);

    const r = await fetch(u.toString(), { headers: { "User-Agent": UA } });
    if (!r.ok) return res.status(404).send("no_map");

    const ct = r.headers.get("content-type") || "image/png";
    res.set("Content-Type", ct);
    res.set("Cache-Control", "public, max-age=86400");
    return r.body?.pipe(res);
  } catch (e) {
    console.error("google/staticmap error", e);
    return res.status(404).send("no_map");
  }
});
