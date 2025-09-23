// server/routes/catering.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

/**
 * POST /api/catering/users/:id/enable
 * Body: { location: string, radius: number, bio?: string }
 */
r.post("/users/:id/enable", async (req, res, next) => {
  try {
    const { location, radius, bio } = req.body || {};
    if (!location || typeof radius !== "number") {
      return res.status(400).json({ message: "location (string) and radius (number) are required" });
    }
    const updated = await storage.enableCatering(req.params.id, String(location), Number(radius), bio);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering enabled successfully", user: updated });
  } catch (e) { next(e); }
});

/**
 * POST /api/catering/users/:id/disable
 */
r.post("/users/:id/disable", async (req, res, next) => {
  try {
    const updated = await storage.disableCatering(req.params.id);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering disabled successfully", user: updated });
  } catch (e) { next(e); }
});

/**
 * PUT /api/catering/users/:id/settings
 * Body: { location?, radius?, bio?, available? }
 */
r.put("/users/:id/settings", async (req, res, next) => {
  try {
    const updated = await storage.updateCateringSettings(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering settings updated", user: updated });
  } catch (e) { next(e); }
});

/**
 * GET /api/catering/chefs/search?location=...&radius=25&limit=20
 */
r.get("/chefs/search", async (req, res, next) => {
  try {
    const location = String(req.query.location || "");
    const radius   = Number(req.query.radius ?? 25);
    const limit    = Number(req.query.limit ?? 20);
    if (!location) return res.status(400).json({ message: "location is required" });

    const chefs = await storage.findChefsInRadius(location, radius, limit);
    res.json({ chefs, searchParams: { location, radius }, total: chefs.length });
  } catch (e) { next(e); }
});

/**
 * POST /api/catering/inquiries
 * Body: { customerId, chefId, eventDate, guestCount?, eventType?, cuisinePreferences?, budget?, message }
 */
r.post("/inquiries", async (req, res, next) => {
  try {
    const inquiry = await storage.createCateringInquiry(req.body);
    res.status(201).json({ message: "Catering inquiry sent successfully", inquiry });
  } catch (e) { next(e); }
});

/**
 * GET /api/catering/users/:id/inquiries
 */
r.get("/users/:id/inquiries", async (req, res, next) => {
  try {
    const inquiries = await storage.getCateringInquiries(req.params.id);
    res.json({ inquiries, total: inquiries.length });
  } catch (e) { next(e); }
});

/**
 * PUT /api/catering/inquiries/:id
 * Body: { status?, message? }
 */
r.put("/inquiries/:id", async (req, res, next) => {
  try {
    const updated = await storage.updateCateringInquiry(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ message: "Inquiry not found" });
    res.json({ message: "Inquiry updated successfully", inquiry: updated });
  } catch (e) { next(e); }
});

/**
 * GET /api/catering/users/:id/status
 */
r.get("/users/:id/status", async (req, res, next) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      cateringEnabled:  (user as any).cateringEnabled || false,
      cateringAvailable:(user as any).cateringAvailable || false,
      cateringLocation: (user as any).cateringLocation,
      cateringRadius:   (user as any).cateringRadius,
      cateringBio:      (user as any).cateringBio,
      isChef:           (user as any).isChef,
    });
  } catch (e) { next(e); }
});

export default r;
