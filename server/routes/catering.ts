// server/routes/catering.ts
import { Router } from "express";
import { storage } from "../storage";
import { sendCateringRequestNotification } from "../services/notification-service";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { geocodeLocation } from "./google";
import { parseCoordinates, resolveVisitorLocation } from "../services/catering-geo";
import { requireAuth } from "../middleware";
import { z } from "zod";
import { insertCateringInquirySchema } from "@shared/schema";
import { publicCateringLocation, serializePublicCateringProvider } from "../serializers/public-catering-provider";
import { cateringQuoteDateSchema } from "../services/catering-date";
import { canTransitionCateringInquiry, cateringInquiryRole } from "../services/catering-inquiry-policy";

const r = Router();
const providerIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

/**
 * POST /api/catering/users/:id/enable
 * Body: { location: string, radius: number, bio?: string }
 */
r.post("/users/:id/enable", requireAuth, async (req, res, next) => {
  try {
    if ((req.user as { id: string }).id !== req.params.id) return res.status(403).json({ message: "You can only update your own catering profile" });
    const { location, radius, bio } = req.body || {};
    if (!location || typeof radius !== "number") {
      return res.status(400).json({ message: "location (string) and radius (number) are required" });
    }
    const geocoded = await geocodeLocation(String(location)).catch(() => null);
    const coordinates = parseCoordinates(String(location)) ?? (geocoded && { latitude: geocoded.lat, longitude: geocoded.lng });
    if (!coordinates) return res.status(422).json({ message: "We couldn't find that service location." });
    const updated = await storage.enableCatering(req.params.id, String(location), Number(radius), bio, coordinates);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering enabled successfully", user: updated });
  } catch (error) { next(error); }
});

/**
 * POST /api/catering/users/:id/disable
 */
r.post("/users/:id/disable", requireAuth, async (req, res, next) => {
  try {
    if ((req.user as { id: string }).id !== req.params.id) return res.status(403).json({ message: "You can only update your own catering profile" });
    const updated = await storage.disableCatering(req.params.id);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering disabled successfully", user: updated });
  } catch (error) { next(error); }
});

/**
 * PUT /api/catering/users/:id/settings
 * Body: { location?, radius?, bio?, available? }
 */
r.put("/users/:id/settings", requireAuth, async (req, res, next) => {
  try {
    if ((req.user as { id: string }).id !== req.params.id) return res.status(403).json({ message: "You can only update your own catering profile" });
    const settings = req.body || {};
    if (settings.location !== undefined) {
      const geocoded = await geocodeLocation(String(settings.location)).catch(() => null);
      const coordinates = parseCoordinates(String(settings.location)) ?? (geocoded && { latitude: geocoded.lat, longitude: geocoded.lng });
      if (!coordinates) return res.status(422).json({ message: "We couldn't find that service location." });
      settings.coordinates = coordinates;
    }
    const updated = await storage.updateCateringSettings(req.params.id, settings);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering settings updated", user: updated });
  } catch (error) { next(error); }
});

r.put("/users/:id/profile", requireAuth, async (req, res, next) => {
  try {
    if ((req.user as { id: string }).id !== req.params.id) return res.status(403).json({ message: "You can only update your own catering profile" });
    const profile = z.object({ displayName: z.string().trim().min(2).max(100), avatar: z.union([z.string().url(), z.literal("")]).optional(), specialty: z.string().trim().min(2).max(100), location: z.string().trim().min(2).max(200), radius: z.number().int().min(5).max(100), bio: z.string().trim().min(20).max(1000), available: z.boolean(), enabled: z.boolean() }).parse(req.body);
    const geocoded = await geocodeLocation(profile.location).catch(() => null);
    const coordinates = parseCoordinates(profile.location) ?? (geocoded && { latitude: geocoded.lat, longitude: geocoded.lng });
    if (!coordinates) return res.status(422).json({ message: "We couldn't find that service location. Try a city, ZIP code, or latitude,longitude." });
    const updated = await storage.updateUser(req.params.id, { displayName: profile.displayName, avatar: profile.avatar || null, specialty: profile.specialty, cateringEnabled: profile.enabled, cateringLocation: profile.location, cateringLatitude: coordinates.latitude.toString(), cateringLongitude: coordinates.longitude.toString(), cateringRadius: profile.radius, cateringBio: profile.bio, cateringAvailable: profile.available });
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering profile saved", user: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || "Invalid catering profile", errors: error.issues });
    next(error);
  }
});

/**
 * GET /api/catering/chefs/search?location=...&radius=25&limit=20
 */
r.get("/chefs/search", async (req, res, next) => {
  try {
    const location = String(req.query.location || "").trim();
    const radius   = Number(req.query.radius ?? 25);
    const limit    = Number(req.query.limit ?? 20);
    if (!location) return res.status(400).json({ message: "location is required" });
    if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(limit) || limit <= 0) return res.status(400).json({ message: "radius and limit must be positive numbers" });
    const coordinates = await resolveVisitorLocation(location, async (value) => {
      const geocoded = await geocodeLocation(value);
      return { latitude: geocoded.lat, longitude: geocoded.lng };
    });
    if (!coordinates) return res.status(422).json({ message: "We couldn't find that city or ZIP code. Try another location." });

    const chefs = await storage.findChefsInRadius(coordinates, radius, limit);
    const publicChefs = chefs.map(serializePublicCateringProvider);
    res.json({ chefs: publicChefs, searchParams: { location: publicCateringLocation(location), radius }, total: publicChefs.length });
  } catch (error) { next(error); }
});

/** Public, read-only provider profile. Disabled listings intentionally expose no profile data. */
r.get("/providers/:providerId", async (req, res, next) => {
  try {
    const parsedId = providerIdSchema.safeParse(req.params.providerId);
    if (!parsedId.success) return res.status(400).json({ message: "Invalid provider ID" });
    const provider = await storage.getUser(parsedId.data);
    if (!provider) return res.status(404).json({ message: "Provider not found" });
    if (!provider.cateringEnabled) {
      return res.status(410).json({ message: "This provider is not currently listed in the marketplace", code: "PROVIDER_UNAVAILABLE" });
    }
    res.json({ provider: serializePublicCateringProvider(provider) });
  } catch (error) { next(error); }
});

/**
 * POST /api/catering/inquiries
 * Body: { chefId, eventDate, guestCount?, eventType?, cuisinePreferences?, budget?, message }
 * The authenticated user is always used as customerId.
 */
r.post("/inquiries", requireAuth, async (req, res, next) => {
  try {
    const customerId = (req.user as { id: string }).id;
    const body = insertCateringInquirySchema.pick({
      chefId: true, guestCount: true, eventType: true,
      cuisinePreferences: true, budget: true, message: true,
    }).and(z.object({ eventDate: z.string(), timezoneOffsetMinutes: z.number() })).parse(req.body);
    const { eventDate } = cateringQuoteDateSchema.parse(body);
    const { timezoneOffsetMinutes: _timezoneOffsetMinutes, ...inquiryFields } = body;
    const input = { ...inquiryFields, eventDate };
    if (input.chefId === customerId) return res.status(400).json({ message: "You cannot request a quote from yourself" });
    const provider = await storage.getUser(input.chefId);
    if (!provider?.cateringEnabled || !provider.cateringAvailable) {
      return res.status(409).json({ message: "This provider is not currently accepting inquiries" });
    }
    const inquiry = await storage.createCateringInquiry({ ...input, customerId });

    // Send notification to chef about new catering request
    const [customer] = await db
      .select({ username: users.username, displayName: users.displayName, avatar: users.avatar })
      .from(users)
      .where(eq(users.id, inquiry.customerId))
      .limit(1);

    if (customer) {
      sendCateringRequestNotification(
        inquiry.chefId,
        customer.username || customer.displayName || 'A customer',
        customer.avatar,
        new Date(inquiry.eventDate),
        inquiry.guestCount || 0
      );
    }

    res.status(201).json({ message: "Catering inquiry sent successfully", inquiry });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || "Invalid quote request", errors: error.issues });
    next(error);
  }
});

/**
 * GET /api/catering/users/:id/inquiries
 */
r.get("/users/:id/inquiries", requireAuth, async (req, res, next) => {
  try {
    if ((req.user as { id: string }).id !== req.params.id) return res.status(403).json({ message: "You can only view your own received inquiries" });
    const inquiries = await storage.getCateringInquiries(req.params.id);
    res.json({ inquiries, total: inquiries.length });
  } catch (error) { next(error); }
});

/**
 * PUT /api/catering/inquiries/:id
 * Body: { status }
 */
r.put("/inquiries/:id", requireAuth, async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(["accepted", "declined", "cancelled"]) }).parse(req.body);
    const inquiry = await storage.getCateringInquiry(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    const role = cateringInquiryRole(inquiry, (req.user as { id: string }).id);
    if (!role) return res.status(403).json({ message: "You are not a participant in this inquiry" });
    if (!canTransitionCateringInquiry(role, inquiry.status, status)) return res.status(409).json({ message: "That status transition is not allowed" });
    const updated = await storage.updateCateringInquiry(req.params.id, { status });
    if (!updated) return res.status(409).json({ message: "The inquiry status changed before this request completed" });
    res.json({ message: "Inquiry updated successfully", inquiry: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || "Invalid inquiry update", errors: error.issues });
    next(error);
  }
});

/**
 * GET /api/catering/users/:id/status
 */
r.get("/users/:id/status", requireAuth, async (req, res, next) => {
  try {
    if ((req.user as { id: string }).id !== req.params.id) return res.status(403).json({ message: "You can only view your own catering status" });
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      cateringEnabled: user.cateringEnabled ?? false,
      cateringAvailable: user.cateringAvailable ?? false,
      cateringLocation: user.cateringLocation,
      cateringRadius: user.cateringRadius,
      cateringBio: user.cateringBio,
      isChef: user.isChef,
    });
  } catch (error) { next(error); }
});

export default r;
