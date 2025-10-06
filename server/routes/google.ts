// server/routes/google.ts
import { Router } from "express";
import fetch from "node-fetch";

export const googleRouter = Router();

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

function json(res: any, code: number, body: any) {
  res.status(code).json(body);
}

// ---- Diagnostics (to verify env var is visible)
googleRouter.get("/diagnostics", (_req, res) => {
  return json(res, 200, {
    ok: true,
    hasKey: Boolean(GOOGLE_KEY),
    keyLen: GOOGLE_KEY ? GOOGLE_KEY.length : 0,
    note:
      "If hasKey=false, set GOOGLE_MAPS_API_KEY in Plesk Node.js → Environment Variables and Restart App.",
  });
});

// ---- Geocode helper for "near" city strings
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

// ---- Search (Nearby when ll provided; Text Search otherwise)
googleRouter.get("/search", async (req, res) => {
  try {
    if (!GOOGLE_KEY) {
      return json(res, 500, {
        error: "missing_key",
        message:
          "GOOGLE_MAPS_API_KEY is not visible to the Node process. Add it in Plesk → Node.js → Environment Variables and Restart App.",
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
        return json(res, 502, {
          error: "geocode_failed",
          message: e?.message || "Geocoding failed",
        });
      }
    }

    let url: string;
    let which: "nearby" | "text" = "text";

    if (typeof lat === "number" && typeof lng === "number") {
      // Nearby Search
      const u = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
      u.searchParams.set("key", GOOGLE_KEY);
      u.searchParams.set("location", `${lat},${lng}`);
      u.searchParams.set("radius", "4000"); // ~4km
      u.searchParams.set("keyword", q);
      u.searchParams.set("type", "restaurant");
      url = u.toString();
      which = "nearby";
    } else {
      // Text Search
      const u = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      u.searchParams.set("key", GOOGLE_KEY);
      u.searchParams.set("query", `${q} in ${near}`);
      u.searchParams.set("type", "restaurant");
      url = u.toString();
      which = "text";
    }

    console.log(`[google ${which}]`, url);

    const r = await fetch(url);
    if (!r.ok) {
      return json(res, 502, { error: "google_http_error", status: r.status });
    }

    const j: any = await r.json();
    const status = j?.status || "UNKNOWN";
    if (status !== "OK" && status !== "ZERO_RESULTS") {
      return json(res, 502, {
        error: "google_api_error",
        status,
        message: j?.error_message || null,
      });
    }

    const results = Array.isArray(j.results) ? j.results.slice(0, limit) : [];
    return json(res, 200, { status, results });
  } catch (e: any) {
    console.error("google/search error", e);
    return json(res, 500, { error: "google_search_failed", message: e?.message || String(e) });
  }
});
