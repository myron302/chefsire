// ---- Proxy: Google Place Photo (better error pass-through)
googleRouter.get("/photo", async (req, res) => {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return res.status(500).send("Missing GOOGLE_MAPS_API_KEY");
    const ref = (req.query.ref as string) || (req.query.photo_reference as string);
    if (!ref) return res.status(400).send("Missing photo reference");
    const maxWidth = String(Number(req.query.maxWidth) || 400);

    const u = new URL("https://maps.googleapis.com/maps/api/place/photo");
    u.searchParams.set("key", key);
    u.searchParams.set("photo_reference", ref);
    u.searchParams.set("maxwidth", maxWidth);

    const r = await fetch(u.toString(), { redirect: "follow" as any });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(502).type("text/plain").send(`Photo fetch failed (${r.status}). ${text}`);
    }
    if (!ct.startsWith("image/")) {
      const text = await r.text().catch(() => "");
      return res.status(502).type("text/plain").send(`Photo not image. ${text}`);
    }

    res.set("Content-Type", ct);
    return r.body?.pipe(res);
  } catch (e: any) {
    console.error("google/photo error", e);
    return res.status(500).type("text/plain").send(`photo_failed: ${e?.message || e}`);
  }
});

// ---- Proxy: Static Maps (better error pass-through)
googleRouter.get("/staticmap", async (req, res) => {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return res.status(500).send("Missing GOOGLE_MAPS_API_KEY");

    const center = (req.query.center as string) || "";
    const markers = (req.query.markers as string) || "";
    const zoom = String(Number(req.query.zoom) || 13);
    const size = (req.query.size as string) || "640x360";
    const scale = String(Number(req.query.scale) || 2);

    const u = new URL("https://maps.googleapis.com/maps/api/staticmap");
    u.searchParams.set("key", key);
    u.searchParams.set("size", size);
    u.searchParams.set("scale", scale);
    if (center) u.searchParams.set("center", center);
    u.searchParams.set("zoom", zoom);
    if (markers) u.searchParams.append("markers", markers);

    const r = await fetch(u.toString());
    const ct = r.headers.get("content-type") || "";
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(502).type("text/plain").send(`Static map failed (${r.status}). ${text}`);
    }
    if (!ct.startsWith("image/")) {
      const text = await r.text().catch(() => "");
      return res.status(502).type("text/plain").send(`Static map not image. ${text}`);
    }

    res.set("Content-Type", ct);
    return r.body?.pipe(res);
  } catch (e: any) {
    console.error("google/staticmap error", e);
    return res.status(500).type("text/plain").send(`staticmap_failed: ${e?.message || e}`);
  }
});
