// server/routes/google.ts
import { Router } from "express";
import fetch from "node-fetch";

export const googleRouter = Router();

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

function json(res: any, code: number, body: any) {
  res.status(code).json(body);
}

// ---- Diagnostics
googleRouter.get("/diagnostics", (_req, res) => {
  return json(res, 200, {
    ok: true,
    hasKey: Boolean(GOOGLE_KEY),
    keyLen: GOOGLE_KEY ? GOOGLE_KEY.length : 0,
    note:
      "If hasKey=false, set GOOGLE_MAPS_API_KEY in Plesk Node.js → Environment Variables and Restart App.",
  });
});

// ---- Geocode helper
async function geocode(near: string) {
  const u = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  u.searchParams.set("address", near);
  u.searchParams.set("key", GOOGLE_KEY);
  const r = await fetch(u.toString());
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

// ---- Search (Nearby when we have ll, else Text search)
googleRouter.get("/search", async (req, res) => {
  try {
    if (!GOOGLE_KEY) {
      return json(res, 500, { error: "missing_key", message: "Set GOOGLE_MAPS_API_KEY" });
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
        lat = la; lng = ln;
      }
    } else if (near) {
      const c = await geocode(near);
      lat = c.lat; lng = c.lng;
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

    const r = await fetch(url);
    if (!r.ok) return json(res, 502, { error: "google_http_error", status: r.status });
    const j: any = await r.json();
    const status = j?.status || "UNKNOWN";
    if (status !== "OK" && status !== "ZERO_RESULTS") {
      return json(res, 502, { error: "google_api_error", status, message: j?.error_message || null });
    }

    // Trim list on server
    j.results = Array.isArray(j.results) ? j.results.slice(0, limit) : [];
    return json(res, 200, { status, results: j.results });
  } catch (e: any) {
    console.error("google/search error", e);
    return json(res, 500, { error: "google_search_failed", message: e?.message || String(e) });
  }
});

// ---- Proxy: Google Place Photo (keeps your key server-side)
googleRouter.get("/photo", async (req, res) => {
  try {
    if (!GOOGLE_KEY) return res.status(500).send("Missing GOOGLE_MAPS_API_KEY");
    const ref = (req.query.ref as string) || (req.query.photo_reference as string);
    if (!ref) return res.status(400).send("Missing photo reference");
    const maxWidth = String(Number(req.query.maxWidth) || 400);

    const u = new URL("https://maps.googleapis.com/maps/api/place/photo");
    u.searchParams.set("key", GOOGLE_KEY);
    u.searchParams.set("photo_reference", ref);
    u.searchParams.set("maxwidth", maxWidth);

    // Google returns a 302 to the actual image CDN — follow it
    const r = await fetch(u.toString(), { redirect: "follow" as any });
    if (!r.ok) return res.status(502).send("Photo fetch failed");

    // Pass through the image
    res.set("Content-Type", r.headers.get("content-type") || "image/jpeg");
    return r.body?.pipe(res);
  } catch (e) {
    console.error("google/photo error", e);
    return res.status(500).send("photo_failed");
  }
});

// ---- Proxy: Static Maps with optional center/markers
googleRouter.get("/staticmap", async (req, res) => {
  try {
    if (!GOOGLE_KEY) return res.status(500).send("Missing GOOGLE_MAPS_API_KEY");

    const center = (req.query.center as string) || "";
    const markers = (req.query.markers as string) || ""; // can be "lat,lng|lat,lng"
    const zoom = String(Number(req.query.zoom) || 13);
    const size = (req.query.size as string) || "640x360";
    const scale = String(Number(req.query.scale) || 2);

    const u = new URL("https://maps.googleapis.com/maps/api/staticmap");
    u.searchParams.set("key", GOOGLE_KEY);
    u.searchParams.set("size", size);
    u.searchParams.set("scale", scale);

    if (center) u.searchParams.set("center", center);
    u.searchParams.set("zoom", zoom);

    if (markers) {
      // default red markers; you can style if wanted
      u.searchParams.append("markers", markers);
    }

    const r = await fetch(u.toString());
    if (!r.ok) return res.status(502).send("Static map fetch failed");

    res.set("Content-Type", r.headers.get("content-type") || "image/png");
    return r.body?.pipe(res);
  } catch (e) {
    console.error("google/staticmap error", e);
    return res.status(500).send("staticmap_failed");
  }
});
