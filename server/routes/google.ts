// server/routes/google.ts
import { Router } from "express";
import fetch from "node-fetch";

export const googleRouter = Router();

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

// helper: geocode a city string -> {lat,lng}
async function geocode(near: string) {
  const u = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  u.searchParams.set("address", near);
  u.searchParams.set("key", GOOGLE_KEY || "");
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`geocode ${r.status}`);
  const j: any = await r.json();
  const c = j?.results?.[0]?.geometry?.location;
  if (!c) return null;
  return { lat: c.lat, lng: c.lng };
}

// GET /google/search?q=&near=&ll=&limit=
googleRouter.get("/search", async (req, res) => {
  try {
    if (!GOOGLE_KEY) return res.status(500).json({ error: "Missing GOOGLE_MAPS_API_KEY" });

    const q = (req.query.q as string) || (req.query.query as string) || "restaurant";
    const near = (req.query.near as string) || (req.query.location as string);
    const ll = (req.query.ll as string) || "";
    const limit = Math.min(60, Number(req.query.limit) || 20);

    let lat: number | undefined, lng: number | undefined;

    if (ll) {
      const [la, ln] = ll.split(",").map(Number);
      if (Number.isFinite(la) && Number.isFinite(ln)) { lat = la; lng = ln; }
    } else if (near) {
      const c = await geocode(near);
      if (c) { lat = c.lat; lng = c.lng; }
    }

    // Prefer Places Text Search (city search) OR Nearby Search (when we have coords)
    let url: string;
    if (typeof lat === "number" && typeof lng === "number") {
      const u = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
      u.searchParams.set("key", GOOGLE_KEY);
      u.searchParams.set("location", `${lat},${lng}`);
      u.searchParams.set("radius", "4000"); // 4km
      u.searchParams.set("keyword", q);
      u.searchParams.set("type", "restaurant");
      url = u.toString();
    } else {
      const u = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      u.searchParams.set("key", GOOGLE_KEY);
      u.searchParams.set("query", `${q} in ${near || "New York, NY"}`);
      u.searchParams.set("type", "restaurant");
      url = u.toString();
    }

    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: `Google ${r.status}` });
    const j: any = await r.json();

    // trim to limit, keep fields we care about
    j.results = Array.isArray(j.results) ? j.results.slice(0, limit) : [];
    return res.json(j);
  } catch (e: any) {
    console.error("google/search error", e);
    return res.status(500).json({ error: "google_search_failed" });
  }
});
