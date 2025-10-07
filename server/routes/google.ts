import { Router } from "express";
import fetch from "node-fetch";

export const googleRouter = Router();

// ❗️Keep the server key for server-side calls
const GOOGLE_SERVER_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

// ✅ NEW: separate browser key for loading the JS API in the client
const GOOGLE_BROWSER_KEY = process.env.GOOGLE_MAPS_BROWSER_KEY ?? "";

const UA = "ChefSire-BiteMap/1.0 (+https://chefsire.com)";

function sendJson(res: any, code: number, body: any) {
  res.status(code).json(body);
}

// Diagnostics
googleRouter.get("/diagnostics", (_req, res) => {
  return sendJson(res, 200, {
    ok: true,
    serverKey: { present: Boolean(GOOGLE_SERVER_KEY), len: GOOGLE_SERVER_KEY?.length || 0 },
    browserKey: { present: Boolean(GOOGLE_BROWSER_KEY), len: GOOGLE_BROWSER_KEY?.length || 0 },
    note: "Server key must be IP-restricted; browser key must be HTTP-referrer restricted.",
  });
});

// ✅ This endpoint must return the BROWSER key (not the server key)
googleRouter.get("/maps-script", (_req, res) => {
  if (!GOOGLE_BROWSER_KEY) {
    return res.status(500).send("GOOGLE_MAPS_BROWSER_KEY not configured");
  }
  res.set("Content-Type", "text/plain");
  res.set("Cache-Control", "private, max-age=3600");
  return res.send(GOOGLE_BROWSER_KEY);
});

// Geocode helper uses the SERVER key
async function geocode(near: string) {
  const u = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  u.searchParams.set("address", near);
  u.searchParams.set("key", GOOGLE_SERVER_KEY);

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

// Search (Nearby/Text) — uses SERVER key
googleRouter.get("/search", async (req, res) => {
  try {
    if (!GOOGLE_SERVER_KEY) {
      return sendJson(res, 500, {
        error: "missing_key",
        message: "GOOGLE_MAPS_API_KEY (server key) not visible to server process.",
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
      u.searchParams.set("key", GOOGLE_SERVER_KEY);
      u.searchParams.set("location", `${lat},${lng}`);
      u.searchParams.set("radius", "4000");
      u.searchParams.set("keyword", q);
      u.searchParams.set("type", "restaurant");
      url = u.toString();
    } else {
      const u = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      u.searchParams.set("key", GOOGLE_SERVER_KEY);
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

// Details / Photo / Staticmap endpoints should also use GOOGLE_SERVER_KEY (unchanged), just replace references if needed.
