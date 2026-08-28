// server/routes/catering.ts
import { Router } from "express";
import { storage } from "../storage";
import { sendCateringRequestNotification } from "../services/notification-service";
import { db } from "../db";
import { users } from "../../shared/schema";
import { and, asc, count, desc, eq, gt, inArray, isNull, sql, lte, gte } from "drizzle-orm";
import { geocodeLocation } from "./google";
import { parseCoordinates, resolveVisitorLocation } from "../services/catering-geo";
import { requireAuth } from "../middleware";
import { z } from "zod";
import { insertCateringInquirySchema } from "@shared/schema";
import { publicCateringLocation, serializePublicCateringProvider } from "../serializers/public-catering-provider";
import { cateringQuoteDateSchema } from "../services/catering-date";
import { canTransitionCateringInquiry, cateringInquiryRole } from "../services/catering-inquiry-policy";
import { cateringBookings, cateringPackages, cateringPortfolioItems, cateringAvailabilitySettings, cateringAvailabilityExceptions, cateringAvailabilityWeeklyRules, cateringInquiries, cateringReviews } from "@shared/schema";
import { cateringReviewAggregate } from "@shared/catering-reviews";
import { isCateringAvailabilityConfigured } from "@shared/catering-dashboard";
import { canViewProviderInquiryPage, cateringInquiryPageMetadata, cateringInquiryPageSchema } from "../services/catering-inquiry-pagination";
import { availabilityExceptionSchema, availabilitySettingsSchema, calendarDateSchema, weeklyRulesSchema } from "@shared/catering-availability";
import { addCalendarDays, calendarDateInTimezone, evaluateNewCateringInquiryAvailability } from "../services/catering-availability";
import { isCateringProviderBookable } from "../services/catering-bookability";
import { CATERING_PORTFOLIO_ITEM_LIMIT, cateringPortfolioFieldsSchema, cateringPortfolioReorderSchema } from "@shared/catering-portfolio";
import { imageUpload, storeUploadedImage } from "../services/image-upload";
import { serializeCateringPortfolioItem } from "../serializers/catering-portfolio";
import { canAddPortfolioItem, hasExactPortfolioSet, ownsPortfolioItem } from "../services/catering-portfolio-policy";
import { cateringPackageInputSchema, cateringPackagePatchSchema, cateringPackageReorderSchema, hasExactPackageSet, validateMergedPackage } from "@shared/catering-packages";
import { serializeCateringPackage } from "../serializers/catering-package";
import { authorizePackageCoverUpload } from "../services/catering-package-policy";

const r = Router();
const providerIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
class PortfolioLimitError extends Error {}
const DEFAULT_AVAILABILITY = { acceptingBookings: true, minimumLeadDays: 0, maximumAdvanceDays: 365, timezone: "UTC" } as const;
async function availabilityData(providerId: string, legacyAvailable?: boolean | null) {
  const [stored] = await db.select().from(cateringAvailabilitySettings).where(eq(cateringAvailabilitySettings.providerId, providerId)).limit(1);
  const settings = stored ? { acceptingBookings: stored.acceptingBookings, minimumLeadDays: stored.minimumLeadDays, maximumAdvanceDays: stored.maximumAdvanceDays, timezone: stored.timezone } : { ...DEFAULT_AVAILABILITY, acceptingBookings: Boolean(legacyAvailable) };
  const rules = await db.select({ dayOfWeek: cateringAvailabilityWeeklyRules.dayOfWeek, available: cateringAvailabilityWeeklyRules.available }).from(cateringAvailabilityWeeklyRules).where(eq(cateringAvailabilityWeeklyRules.providerId, providerId));
  return { settings, rules };
}

/** Private, focused command-center summary. Provider identity always comes from the session. */
r.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const providerId = (req.user as { id: string }).id;
    const provider = await storage.getUser(providerId);
    if (!provider) return res.status(404).json({ message: "Provider not found" });
    const [storedAvailability] = await db.select().from(cateringAvailabilitySettings).where(eq(cateringAvailabilitySettings.providerId, providerId)).limit(1);
    const availability = storedAvailability ?? { ...DEFAULT_AVAILABILITY, acceptingBookings: Boolean(provider.cateringAvailable) };
    // Dashboard lifecycle facts use the same provider-local calendar policy as completion.
    const today = calendarDateInTimezone(new Date(), availability.timezone);
    const [packages, portfolio, pending, reviewRows, awaiting, recentInquiries, weeklyRules, exceptions, bookingPending, bookingUpcoming, bookingReady] = await Promise.all([
      db.select({ active: cateringPackages.active, value: count() }).from(cateringPackages).where(eq(cateringPackages.providerId, providerId)).groupBy(cateringPackages.active),
      db.select({ value: count() }).from(cateringPortfolioItems).where(eq(cateringPortfolioItems.providerId, providerId)),
      db.select({ value: count() }).from(cateringInquiries).where(and(eq(cateringInquiries.chefId, providerId), eq(cateringInquiries.status, "pending"))),
      db.select({ rating: cateringReviews.rating, value: count() }).from(cateringReviews).where(eq(cateringReviews.providerId, providerId)).groupBy(cateringReviews.rating),
      db.select({ value: count() }).from(cateringReviews).where(and(eq(cateringReviews.providerId, providerId), isNull(cateringReviews.providerResponse))),
      db.select({ id: cateringInquiries.id, status: cateringInquiries.status, eventDate: cateringInquiries.eventDate, eventType: cateringInquiries.eventType, packageId: cateringInquiries.packageId, createdAt: cateringInquiries.createdAt }).from(cateringInquiries).where(eq(cateringInquiries.chefId, providerId)).orderBy(desc(cateringInquiries.createdAt), desc(cateringInquiries.id)).limit(5),
      db.select({ value: count() }).from(cateringAvailabilityWeeklyRules).where(eq(cateringAvailabilityWeeklyRules.providerId, providerId)),
      db.select({ value: count() }).from(cateringAvailabilityExceptions).where(eq(cateringAvailabilityExceptions.providerId, providerId)),
      db.select({ value: count() }).from(cateringBookings).where(and(eq(cateringBookings.providerId, providerId), eq(cateringBookings.status, "pending_confirmation"))),
      db.select({ value: count() }).from(cateringBookings).where(and(eq(cateringBookings.providerId, providerId), eq(cateringBookings.status, "confirmed"), gt(cateringBookings.eventDate, today))),
      db.select({ value: count() }).from(cateringBookings).where(and(eq(cateringBookings.providerId, providerId), eq(cateringBookings.status, "confirmed"), lte(cateringBookings.eventDate, today))),
    ]);
    const packageTotal = packages.reduce((sum: number, row: { value: unknown }) => sum + Number(row.value), 0);
    const aggregate = cateringReviewAggregate(reviewRows.map((row: { rating: number; value: unknown }) => ({ rating: row.rating, count: Number(row.value) })));
    res.json({
      facts: { listingEnabled: Boolean(provider.cateringEnabled), acceptingInquiries: Boolean(availability.acceptingBookings), availabilityConfigured: isCateringAvailabilityConfigured({ hasSettings: Boolean(storedAvailability), weeklyRuleCount: Number(weeklyRules[0]?.value ?? 0), exceptionCount: Number(exceptions[0]?.value ?? 0) }), profileComplete: Boolean(provider.displayName?.trim() && provider.specialty?.trim() && provider.cateringLocation?.trim() && provider.cateringBio && provider.cateringBio.trim().length >= 20), inquiriesPending: Number(pending[0]?.value ?? 0), bookingsPendingConfirmation: Number(bookingPending[0]?.value ?? 0), bookingsUpcomingConfirmed: Number(bookingUpcoming[0]?.value ?? 0), bookingsReadyToComplete: Number(bookingReady[0]?.value ?? 0), packagesTotal: packageTotal, packagesActive: Number(packages.find((row: { active: boolean }) => row.active)?.value ?? 0), portfolioCount: Number(portfolio[0]?.value ?? 0), reviewCount: aggregate.reviewCount, averageRating: aggregate.averageRating, reviewsAwaitingResponse: Number(awaiting[0]?.value ?? 0) },
      availability: { minimumLeadDays: availability.minimumLeadDays, maximumAdvanceDays: availability.maximumAdvanceDays, timezone: availability.timezone },
      recentInquiries: recentInquiries.map((item: { eventDate: Date; createdAt: Date | null; [key: string]: unknown }) => ({ ...item, eventDate: item.eventDate.toISOString(), createdAt: item.createdAt?.toISOString() ?? null })),
    });
  } catch (error) { next(error); }
});

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
    const profile = z.object({ displayName: z.string().trim().min(2).max(100), avatar: z.union([z.string().url(), z.literal("")]).optional(), specialty: z.string().trim().min(2).max(100), location: z.string().trim().min(2).max(200), radius: z.number().int().min(5).max(100), bio: z.string().trim().min(20).max(1000), enabled: z.boolean() }).parse(req.body);
    const geocoded = await geocodeLocation(profile.location).catch(() => null);
    const coordinates = parseCoordinates(profile.location) ?? (geocoded && { latitude: geocoded.lat, longitude: geocoded.lng });
    if (!coordinates) return res.status(422).json({ message: "We couldn't find that service location. Try a city, ZIP code, or latitude,longitude." });
    const updated = await storage.updateUser(req.params.id, { displayName: profile.displayName, avatar: profile.avatar || null, specialty: profile.specialty, cateringEnabled: profile.enabled, cateringLocation: profile.location, cateringLatitude: coordinates.latitude.toString(), cateringLongitude: coordinates.longitude.toString(), cateringRadius: profile.radius, cateringBio: profile.bio });
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
    const { settings } = await availabilityData(provider.id, provider.cateringAvailable);
    const today = calendarDateInTimezone(new Date(), settings.timezone);
    const acceptingBookings = isCateringProviderBookable({ ...provider, acceptingBookings: settings.acceptingBookings });
    res.json({ provider: { ...serializePublicCateringProvider({ ...provider, cateringAvailable: acceptingBookings }), availability: { acceptingBookings, earliestInquiryDate: acceptingBookings ? addCalendarDays(today, settings.minimumLeadDays) : null, latestInquiryDate: acceptingBookings ? addCalendarDays(today, settings.maximumAdvanceDays) : null } } });
  } catch (error) { next(error); }
});

/** Public result contains policy status only; exception reasons and timezone remain private. */
r.get("/providers/:providerId/availability", async (req, res, next) => { try {
  const id = providerIdSchema.safeParse(req.params.providerId); if (!id.success) return res.status(400).json({ message: "Invalid provider ID" });
  const provider = await listedProvider(id.data); if (!provider) return res.status(404).json({ message: "Provider not found" });
  const targetDate = calendarDateSchema.safeParse(req.query.date); if (!targetDate.success) return res.status(400).json({ message: "A valid date in YYYY-MM-DD format is required" });
  const { settings, rules } = await availabilityData(id.data, provider.cateringAvailable);
  const exceptions = await db.select({ id: cateringAvailabilityExceptions.id, startDate: cateringAvailabilityExceptions.startDate, endDate: cateringAvailabilityExceptions.endDate, type: sql<"available" | "blocked">`${cateringAvailabilityExceptions.type}`.as("type"), reason: cateringAvailabilityExceptions.reason }).from(cateringAvailabilityExceptions).where(and(eq(cateringAvailabilityExceptions.providerId, id.data), lte(cateringAvailabilityExceptions.startDate, targetDate.data), gte(cateringAvailabilityExceptions.endDate, targetDate.data)));
  const result = evaluateNewCateringInquiryAvailability({ settings, rules, exceptions, targetDate: targetDate.data, currentDate: calendarDateInTimezone(new Date(), settings.timezone) });
  res.json(result);
} catch (error) { next(error); } });

r.get("/users/:id/availability", requireAuth, async (req, res, next) => { try {
  const viewerId = (req.user as { id: string }).id; if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own availability" });
  const provider = await storage.getUser(viewerId);
  const { settings, rules } = await availabilityData(viewerId, provider?.cateringAvailable);
  const exceptions = await db.select().from(cateringAvailabilityExceptions).where(eq(cateringAvailabilityExceptions.providerId, viewerId)).orderBy(asc(cateringAvailabilityExceptions.startDate));
  res.json({ settings, rules, exceptions });
} catch (error) { next(error); } });
r.put("/users/:id/availability/settings", requireAuth, async (req, res, next) => { try {
  const viewerId = (req.user as { id: string }).id; if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own availability" });
  const input = availabilitySettingsSchema.parse(req.body);
  const [settings] = await db.insert(cateringAvailabilitySettings).values({ providerId: viewerId, ...input }).onConflictDoUpdate({ target: cateringAvailabilitySettings.providerId, set: { ...input, updatedAt: new Date() } }).returning(); res.json({ settings });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message, errors: error.issues }); next(error); } });
r.put("/users/:id/availability/weekly", requireAuth, async (req, res, next) => { try {
  const viewerId = (req.user as { id: string }).id; if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own availability" });
  const { rules } = weeklyRulesSchema.parse(req.body); await db.transaction(async (tx: typeof db) => { await tx.delete(cateringAvailabilityWeeklyRules).where(eq(cateringAvailabilityWeeklyRules.providerId, viewerId)); if (rules.length) await tx.insert(cateringAvailabilityWeeklyRules).values(rules.map((rule) => ({ providerId: viewerId, ...rule }))); }); res.json({ rules });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });
r.post("/users/:id/availability/exceptions", requireAuth, async (req, res, next) => { try {
  const viewerId = (req.user as { id: string }).id; if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own availability" });
  const input = availabilityExceptionSchema.parse(req.body); const [exception] = await db.insert(cateringAvailabilityExceptions).values({ providerId: viewerId, ...input }).onConflictDoNothing().returning();
  if (!exception) return res.status(409).json({ message: "That availability exception already exists" }); res.status(201).json({ exception });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message, errors: error.issues }); next(error); } });
r.delete("/users/:id/availability/exceptions/:exceptionId", requireAuth, async (req, res, next) => { try {
  const viewerId = (req.user as { id: string }).id; if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own availability" });
  if (!z.string().uuid().safeParse(req.params.exceptionId).success) return res.status(400).json({ message: "Invalid exception ID" });
  const [deleted] = await db.delete(cateringAvailabilityExceptions).where(and(eq(cateringAvailabilityExceptions.id, req.params.exceptionId), eq(cateringAvailabilityExceptions.providerId, viewerId))).returning({ id: cateringAvailabilityExceptions.id }); if (!deleted) return res.status(404).json({ message: "Availability exception not found" }); res.status(204).end();
} catch (error) { next(error); } });

async function listedProvider(providerId: string) {
  const provider = await storage.getUser(providerId);
  return provider?.cateringEnabled ? provider : null;
}

r.get("/providers/:providerId/portfolio", async (req, res, next) => {
  try {
    const parsedId = providerIdSchema.safeParse(req.params.providerId);
    if (!parsedId.success) return res.status(400).json({ message: "Invalid provider ID" });
    if (!await listedProvider(parsedId.data)) return res.status(404).json({ message: "Provider not found" });
    const items = await db.select().from(cateringPortfolioItems).where(eq(cateringPortfolioItems.providerId, parsedId.data)).orderBy(asc(cateringPortfolioItems.sortOrder), asc(cateringPortfolioItems.createdAt));
    res.json({ items: items.map(serializeCateringPortfolioItem) });
  } catch (error) { next(error); }
});

/** Public package collection: inactive records are filtered at the database boundary. */
r.get("/providers/:providerId/packages", async (req, res, next) => { try {
  const id = providerIdSchema.safeParse(req.params.providerId); if (!id.success) return res.status(400).json({ message: "Invalid provider ID" });
  if (!await listedProvider(id.data)) return res.status(404).json({ message: "Provider not found" });
  const packages = await db.select().from(cateringPackages).where(and(eq(cateringPackages.providerId, id.data), eq(cateringPackages.active, true))).orderBy(sql`${cateringPackages.featured} DESC`, asc(cateringPackages.displayOrder), asc(cateringPackages.createdAt));
  res.json({ packages: packages.map(serializeCateringPackage) });
} catch (error) { next(error); } });

r.get("/users/:id/packages", requireAuth, async (req, res, next) => { try {
  if ((req.user as { id: string }).id !== req.params.id) return res.status(403).json({ message: "You can only manage your own packages" });
  const packages = await db.select().from(cateringPackages).where(eq(cateringPackages.providerId, req.params.id)).orderBy(asc(cateringPackages.displayOrder), asc(cateringPackages.createdAt));
  res.json({ packages: packages.map(serializeCateringPackage) });
} catch (error) { next(error); } });

r.post("/users/:id/packages", requireAuth, async (req, res, next) => { try {
  const viewerId = (req.user as { id: string }).id; if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own packages" });
  if (!await listedProvider(viewerId)) return res.status(409).json({ message: "Enable your catering profile before creating packages" });
  const input = cateringPackageInputSchema.parse(req.body); const [{ value }] = await db.select({ value: count() }).from(cateringPackages).where(eq(cateringPackages.providerId, viewerId));
  const [created] = await db.insert(cateringPackages).values({ ...input, startingPrice: String(input.startingPrice), providerId: viewerId, displayOrder: value }).returning();
  res.status(201).json({ package: serializeCateringPackage(created) });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message, errors: error.issues }); next(error); } });

r.patch("/users/:id/packages/:packageId", requireAuth, async (req, res, next) => { try {
  const viewerId = (req.user as { id: string }).id; if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own packages" });
  if (!z.string().uuid().safeParse(req.params.packageId).success) return res.status(400).json({ message: "Invalid package ID" });
  const [existing] = await db.select().from(cateringPackages).where(eq(cateringPackages.id, req.params.packageId)).limit(1);
  if (!existing) return res.status(404).json({ message: "Package not found" });
  if (existing.providerId !== viewerId) return res.status(403).json({ message: "You do not own this package" });
  const input = cateringPackagePatchSchema.parse(req.body);
  validateMergedPackage(serializeCateringPackage(existing), input);
  const values = { ...input, ...(input.startingPrice === undefined ? {} : { startingPrice: String(input.startingPrice) }), updatedAt: new Date() };
  const [updated] = await db.update(cateringPackages).set(values).where(and(eq(cateringPackages.id, req.params.packageId), eq(cateringPackages.providerId, viewerId))).returning();
  if (!updated) return res.status(404).json({ message: "Package not found" }); res.json({ package: serializeCateringPackage(updated) });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message, errors: error.issues }); next(error); } });

r.delete("/users/:id/packages/:packageId", requireAuth, async (req, res, next) => { try {
  const viewerId = (req.user as { id: string }).id; if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own packages" });
  if (!z.string().uuid().safeParse(req.params.packageId).success) return res.status(400).json({ message: "Invalid package ID" });
  const [deleted] = await db.delete(cateringPackages).where(and(eq(cateringPackages.id, req.params.packageId), eq(cateringPackages.providerId, viewerId))).returning({ id: cateringPackages.id }); if (!deleted) return res.status(404).json({ message: "Package not found" }); res.status(204).end();
} catch (error) { next(error); } });

r.post("/users/:id/packages/:packageId/duplicate", requireAuth, async (req, res, next) => { try {
  const viewerId = (req.user as { id: string }).id; if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own packages" });
  const [source] = await db.select().from(cateringPackages).where(and(eq(cateringPackages.id, req.params.packageId), eq(cateringPackages.providerId, viewerId))).limit(1); if (!source) return res.status(404).json({ message: "Package not found" });
  const { id: _id, createdAt: _created, updatedAt: _updated, ...copy } = source; const [created] = await db.insert(cateringPackages).values({ ...copy, title: `${source.title} (Copy)`.slice(0, 120), active: false, featured: false, displayOrder: source.displayOrder + 1 }).returning(); res.status(201).json({ package: serializeCateringPackage(created) });
} catch (error) { next(error); } });

r.put("/users/:id/packages/reorder", requireAuth, async (req, res, next) => { try {
  const viewerId = (req.user as { id: string }).id; if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own packages" }); const { packageIds } = cateringPackageReorderSchema.parse(req.body);
  const existing = await db.select({ id: cateringPackages.id }).from(cateringPackages).where(eq(cateringPackages.providerId, viewerId)); if (!hasExactPackageSet(existing.map(({ id }: { id: string }) => id), packageIds)) return res.status(400).json({ message: "Reorder must include every package exactly once" });
  await db.transaction(async (tx: typeof db) => Promise.all(packageIds.map((id, displayOrder) => tx.update(cateringPackages).set({ displayOrder, updatedAt: new Date() }).where(and(eq(cateringPackages.id, id), eq(cateringPackages.providerId, viewerId)))))); res.json({ packageIds });
} catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); } });

r.post("/users/:id/packages/:packageId/cover", requireAuth, async (req, res, next) => {
  try {
    const viewerId = (req.user as { id: string }).id;
    const preliminary = authorizePackageCoverUpload(viewerId, req.params.id, req.params.packageId, undefined);
    if (!preliminary.allowed && preliminary.status !== 404) return res.status(preliminary.status).json({ message: preliminary.message });
    const [existing] = await db.select({ providerId: cateringPackages.providerId }).from(cateringPackages).where(eq(cateringPackages.id, req.params.packageId)).limit(1);
    const decision = authorizePackageCoverUpload(viewerId, req.params.id, req.params.packageId, existing);
    if (!decision.allowed) return res.status(decision.status).json({ message: decision.message });
    imageUpload.single("image")(req, res, async (uploadError) => {
      try {
        if (uploadError || !req.file) return res.status(400).json({ message: uploadError instanceof Error ? uploadError.message : "An image is required" });
        const uploaded = await storeUploadedImage(req.file);
        const [updated] = await db.update(cateringPackages).set({ coverImage: uploaded.url, updatedAt: new Date() }).where(and(eq(cateringPackages.id, req.params.packageId), eq(cateringPackages.providerId, viewerId))).returning();
        // A concurrent delete after storage can leave an orphan; media cleanup is intentionally handled by the existing lifecycle process.
        if (!updated) return res.status(409).json({ message: "Package changed during upload; the stored media is pending cleanup" });
        res.json({ package: serializeCateringPackage(updated) });
      } catch (error) { next(error); }
    });
  } catch (error) { next(error); }
});

r.post("/users/:id/portfolio", requireAuth, (req, res, next) => {
  if ((req.user as { id: string }).id !== req.params.id) return res.status(403).json({ message: "You can only manage your own portfolio" });
  imageUpload.single("image")(req, res, async (uploadError) => {
    try {
      if (uploadError) return res.status(400).json({ message: uploadError instanceof Error ? uploadError.message : "Invalid image" });
      if (!req.file) return res.status(400).json({ message: "An image is required" });
      const file = req.file;
      const provider = await storage.getUser(req.params.id);
      if (!provider?.cateringEnabled) return res.status(409).json({ message: "Enable your catering profile before adding portfolio items" });
      const fields = cateringPortfolioFieldsSchema.parse(req.body);
      const item = await db.transaction(async (tx: typeof db) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${req.params.id}))`);
        const [{ value: itemCount }] = await tx.select({ value: count() }).from(cateringPortfolioItems).where(eq(cateringPortfolioItems.providerId, req.params.id));
        if (!canAddPortfolioItem(itemCount, CATERING_PORTFOLIO_ITEM_LIMIT)) throw new PortfolioLimitError();
        const uploaded = await storeUploadedImage(file);
        const [created] = await tx.insert(cateringPortfolioItems).values({ providerId: req.params.id, image: uploaded.url, ...fields, description: fields.description ?? null }).returning();
        return created;
      });
      res.status(201).json({ item: serializeCateringPortfolioItem(item) });
    } catch (error) {
      if (error instanceof PortfolioLimitError) return res.status(409).json({ message: `Portfolio limit reached. You can upload up to ${CATERING_PORTFOLIO_ITEM_LIMIT} photos.` });
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });
      next(error);
    }
  });
});

r.patch("/users/:id/portfolio/:itemId", requireAuth, async (req, res, next) => {
  try {
    if (!z.string().uuid().safeParse(req.params.itemId).success) return res.status(400).json({ message: "Invalid portfolio item ID" });
    const viewerId = (req.user as { id: string }).id;
    if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own portfolio" });
    const fields = cateringPortfolioFieldsSchema.partial().parse(req.body);
    const [existing] = await db.select().from(cateringPortfolioItems).where(eq(cateringPortfolioItems.id, req.params.itemId)).limit(1);
    if (!existing) return res.status(404).json({ message: "Portfolio item not found" });
    if (!ownsPortfolioItem(viewerId, existing)) return res.status(403).json({ message: "You do not own this portfolio item" });
    const [item] = await db.update(cateringPortfolioItems).set({ ...fields, description: fields.description }).where(and(eq(cateringPortfolioItems.id, existing.id), eq(cateringPortfolioItems.providerId, viewerId))).returning();
    res.json({ item: serializeCateringPortfolioItem(item) });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); }
});

r.delete("/users/:id/portfolio/:itemId", requireAuth, async (req, res, next) => {
  try {
    if (!z.string().uuid().safeParse(req.params.itemId).success) return res.status(400).json({ message: "Invalid portfolio item ID" });
    const viewerId = (req.user as { id: string }).id;
    if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own portfolio" });
    const [deleted] = await db.delete(cateringPortfolioItems).where(and(eq(cateringPortfolioItems.id, req.params.itemId), eq(cateringPortfolioItems.providerId, viewerId))).returning({ id: cateringPortfolioItems.id });
    if (!deleted) return res.status(404).json({ message: "Portfolio item not found" });
    res.status(204).end();
  } catch (error) { next(error); }
});

r.put("/users/:id/portfolio/reorder", requireAuth, async (req, res, next) => {
  try {
    const viewerId = (req.user as { id: string }).id;
    if (viewerId !== req.params.id) return res.status(403).json({ message: "You can only manage your own portfolio" });
    const { itemIds } = cateringPortfolioReorderSchema.parse(req.body);
    const existing = await db.select({ id: cateringPortfolioItems.id }).from(cateringPortfolioItems).where(eq(cateringPortfolioItems.providerId, viewerId));
    if (!hasExactPortfolioSet(existing.map(({ id }: { id: string }) => id), itemIds)) return res.status(400).json({ message: "Reorder must include every portfolio item exactly once" });
    await db.transaction(async (tx: typeof db) => Promise.all(itemIds.map((id, sortOrder) => tx.update(cateringPortfolioItems).set({ sortOrder }).where(and(eq(cateringPortfolioItems.id, id), eq(cateringPortfolioItems.providerId, viewerId))))));
    const items = itemIds.length ? await db.select().from(cateringPortfolioItems).where(inArray(cateringPortfolioItems.id, itemIds)).orderBy(asc(cateringPortfolioItems.sortOrder)) : [];
    res.json({ items: items.map(serializeCateringPortfolioItem) });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message }); next(error); }
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
      chefId: true, packageId: true, guestCount: true, eventType: true,
      cuisinePreferences: true, budget: true, message: true,
    }).and(z.object({ eventDate: z.string(), timezoneOffsetMinutes: z.number() })).parse(req.body);
    const { eventDate } = cateringQuoteDateSchema.parse(body);
    const { timezoneOffsetMinutes: _timezoneOffsetMinutes, ...inquiryFields } = body;
    const input = { ...inquiryFields, eventDate };
    if (input.chefId === customerId) return res.status(400).json({ message: "You cannot request a quote from yourself" });
    const provider = await storage.getUser(input.chefId);
    if (!provider?.cateringEnabled) {
      return res.status(409).json({ message: "This provider is not currently accepting inquiries" });
    }
    const targetCalendarDate = body.eventDate;
    const availability = await availabilityData(input.chefId, provider.cateringAvailable);
    if (!isCateringProviderBookable({ ...provider, acceptingBookings: availability.settings.acceptingBookings })) return res.status(409).json({ message: "This provider is not currently accepting inquiries", code: "AVAILABILITY_NOT_ACCEPTING" });
    const matchingExceptions = await db.select({ id: cateringAvailabilityExceptions.id, startDate: cateringAvailabilityExceptions.startDate, endDate: cateringAvailabilityExceptions.endDate, type: sql<"available" | "blocked">`${cateringAvailabilityExceptions.type}`.as("type"), reason: cateringAvailabilityExceptions.reason }).from(cateringAvailabilityExceptions).where(and(eq(cateringAvailabilityExceptions.providerId, input.chefId), lte(cateringAvailabilityExceptions.startDate, targetCalendarDate), gte(cateringAvailabilityExceptions.endDate, targetCalendarDate)));
    const decision = evaluateNewCateringInquiryAvailability({ settings: availability.settings, rules: availability.rules, exceptions: matchingExceptions, targetDate: targetCalendarDate, currentDate: calendarDateInTimezone(new Date(), availability.settings.timezone), packageId: input.packageId ?? undefined });
    if (!decision.available) return res.status(422).json({ message: ({ not_accepting: "This provider is not accepting inquiries", lead_time: "This date does not meet the provider's minimum lead time", advance_window: "This date is beyond the provider's booking window", blocked: "This provider is unavailable on the selected date", weekly_unavailable: "This provider does not accept inquiries for that day of the week" } as Record<string, string>)[decision.reason], code: `AVAILABILITY_${decision.reason.toUpperCase()}` });
    if (input.packageId) { const [selected] = await db.select({ id: cateringPackages.id }).from(cateringPackages).where(and(eq(cateringPackages.id, input.packageId), eq(cateringPackages.providerId, input.chefId), eq(cateringPackages.active, true))).limit(1); if (!selected) return res.status(400).json({ message: "Selected package is unavailable" }); }
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
    const viewerId = (req.user as { id: string }).id;
    if (!canViewProviderInquiryPage(viewerId, req.params.id)) return res.status(403).json({ message: "You can only view your own received inquiries" });
    const { page, limit } = cateringInquiryPageSchema.parse(req.query);
    const [{ value }] = await db.select({ value: count() }).from(cateringInquiries).where(eq(cateringInquiries.chefId, viewerId));
    const rows = await db.select({ inquiry: cateringInquiries, bookingId: cateringBookings.id, bookingStatus: cateringBookings.status, providerConfirmedAt: cateringBookings.providerConfirmedAt, customerConfirmedAt: cateringBookings.customerConfirmedAt }).from(cateringInquiries).leftJoin(cateringBookings, eq(cateringBookings.inquiryId, cateringInquiries.id)).where(eq(cateringInquiries.chefId, viewerId)).orderBy(desc(cateringInquiries.createdAt), desc(cateringInquiries.id)).limit(limit).offset((page - 1) * limit);
    const total = Number(value);
    const inquiries = rows.map(({ inquiry, bookingId, bookingStatus, providerConfirmedAt, customerConfirmedAt }) => ({ ...inquiry, booking: bookingId ? { id: bookingId, status: bookingStatus, providerConfirmedAt: providerConfirmedAt?.toISOString() ?? null, customerConfirmedAt: customerConfirmedAt?.toISOString() ?? null } : null }));
    res.json({ inquiries, pagination: cateringInquiryPageMetadata(page, limit, total), total });
  } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || "Invalid pagination" }); next(error); }
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
