// server/routes/users.ts
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, optionalAuth } from "../middleware";
import { resolveSelfUserId } from "../lib/self-scope";
import { serializeAuthenticatedUser } from "../serializers/authenticated-user";
import { normalizePhone } from "../../shared/phone";
import { AccountStatusError, deactivateOwnAccount, isAccountHidden } from "../lib/account-status";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { startNutritionTrialResponse } from "../lib/nutrition-entitlement";
import { geocodeLocation } from "./google";
import { parseCoordinates } from "../services/catering-geo";
import { serializePublicUser } from "../serializers/public-user";
import { decodeInlineImage, inlineAvatarVersion, isInlineImageDataUri } from "../lib/inline-avatar";
import { effectiveMarketplaceTier, effectiveSubscriptionPresentation } from "../lib/subscription-security";

const r = Router();

/**
 * NOTE: This router is mounted at:
 *   app.use("/api/users", usersRouter)
 * So all paths below are RELATIVE (e.g. "/:id", not "/users/:id").
 */

/* ------------------------------------------------------------------ */
/* Users & profile basics                                              */
/* ------------------------------------------------------------------ */

/**
 * GET /api/users/search
 * Search for users by username, displayName, bio, or specialty
 */
r.get("/search", async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const limit = typeof req.query.limit === "string"
      ? parseInt(req.query.limit, 10)
      : 20;

    if (!query || query.trim().length === 0) {
      return res.json({ users: [] });
    }

    const users = await storage.searchUsers(query.trim(), limit);

    // Remove sensitive fields
    const sanitizedUsers = users.map(serializePublicUser);

    res.json({ users: sanitizedUsers });
  } catch (error) {
    console.error("GET /users/search error", error);
    res.status(500).json({ message: "Failed to search users" });
  }
});

/**
 * GET /api/users/:id/avatar
 * Serves a legacy inline (base64) avatar as a normal image so responses can reference it by URL instead of
 * embedding megabytes of base64. Avatars are already part of the public profile. Stored data is not changed.
 */
r.get("/:id/avatar", async (req, res) => {
  try {
    const user = await storage.getUser(req.params.id);
    const avatar = user?.avatar;
    if (!user || !avatar) return res.status(404).end();
    if (!isInlineImageDataUri(avatar)) {
      // Already a real URL: send the browser there (only same-site paths or https).
      if (avatar.startsWith("/") && !avatar.startsWith("//")) return res.redirect(302, avatar);
      if (avatar.startsWith("https://")) return res.redirect(302, avatar);
      return res.status(404).end();
    }
    const decoded = decodeInlineImage(avatar);
    if (!decoded) return res.status(404).end();
    const version = inlineAvatarVersion(avatar);
    const etag = `"${version}"`;
    res.setHeader("ETag", etag);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Cache-Control",
      req.query.v === version ? "public, max-age=31536000, immutable" : "public, max-age=300",
    );
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    res.type(decoded.contentType).send(decoded.body);
  } catch (error) {
    console.error("Error serving avatar:", error);
    res.status(500).end();
  }
});

r.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Try UUID lookup first, then fall back to username lookup
    // This lets /profile/:username work without a separate route
    let user = await storage.getUser(id);
    if (!user) {
      user = await storage.getUserByUsername(id);
    }
    // A suspended account's profile is hidden, answered exactly like a missing one.
    if (!user || (await isAccountHidden(user.id))) return res.status(404).json({ message: "User not found" });
    res.json(serializePublicUser(user));
  } catch (error) {
    console.error("GET /users/:id error", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

r.get("/username/:username", async (req, res) => {
  try {
    const user = await storage.getUserByUsername(req.params.username);
    // A suspended account's profile is hidden, answered exactly like a missing one.
    if (!user || (await isAccountHidden(user.id))) return res.status(404).json({ message: "User not found" });
    res.json(serializePublicUser(user));
  } catch (error) {
    console.error("GET /users/username/:username error", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

/*
 * There is deliberately no `POST /` here. Account creation is `POST /api/auth/signup` (routes/auth.ts) and the OAuth
 * strategies only -- an unauthenticated create on this router stored the caller's password unhashed, returned the whole
 * row, and skipped verification and the signup limiter (CS-CL-04). Do not add one back.
 */

r.put("/:id", requireAuth, async (req, res) => {
  try {
    // Security: users can only update their own profile
    if ((req.user as { id: string }).id !== req.params.id) {
      return res.status(403).json({ message: "You can only update your own profile" });
    }

    const schema = z.object({
      username: z.string().optional(),
      displayName: z.string().optional(),
      bio: z.string().max(500).optional(),
      avatar: z.string().optional(),
      isPrivate: z.boolean().optional(),
      specialty: z.string().optional(),
      isChef: z.boolean().optional(),
      // Blank or null removes the phone; anything else must be a valid number.
      phone: z.string().max(32).nullable().optional(),
    });
    const { phone, ...profile } = schema.parse(req.body);
    const body: Record<string, unknown> = { ...profile };
    if (phone !== undefined) {
      if (phone === null || !phone.trim()) {
        body.phone = null;
      } else {
        const normalized = normalizePhone(phone);
        if (!normalized) return res.status(400).json({ message: "Enter a valid phone number, or leave it blank" });
        body.phone = normalized;
      }
    }

    // Explicit profile allowlist above intentionally excludes every subscription/entitlement field.
    const updated = await storage.updateUser(req.params.id, body);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Profile updated successfully", user: serializeAuthenticatedUser(updated) });
  } catch (error: any) {
    if (error?.issues) {
      return res
        .status(400)
        .json({ message: "Invalid user data", errors: error.issues });
    }
    if (error?.code === "23505" && /phone/i.test(error?.constraint ?? "")) {
      return res.status(400).json({ message: "That phone number is already on another account" });
    }
    console.error("PUT /users/:id error", error);
    res.status(500).json({
      message: "Failed to update user",
      error: error?.message || "Unknown error"
    });
  }
});

// Public: chef suggestions. The path id is NOT the viewer (anyone can type any id); the only identity that
// shapes the list is the verified session, which merely excludes the caller from their own suggestions.
r.get("/:id/suggested", optionalAuth, async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 5);
    const list = await storage.getSuggestedUsers(
      (req.user as { id?: string } | undefined)?.id ?? "",
      isNaN(limit) ? 5 : Math.max(1, Math.min(limit, 50))
    );
    res.json(list.map(serializePublicUser));
  } catch (error) {
    console.error("GET /users/:id/suggested error", error);
    res.status(500).json({ message: "Failed to fetch suggested users" });
  }
});

/* ------------------------------------------------------------------ */
/* Catering settings (per-user)                                        */
/* ------------------------------------------------------------------ */
r.post("/:id/catering/enable", requireAuth, async (req, res) => {
  try {
    if ((req.user as { id: string }).id !== req.params.id) return res.status(403).json({ message: "You can only update your own catering profile" });
    const schema = z.object({
      location: z.string().min(3, "Postal/area required"),
      radius: z.number().min(5).max(100),
      bio: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const geocoded = await geocodeLocation(body.location).catch(() => null);
    const coordinates = parseCoordinates(body.location) ?? (geocoded && { latitude: geocoded.lat, longitude: geocoded.lng });
    if (!coordinates) return res.status(422).json({ message: "We couldn't find that service location." });
    const updated = await storage.enableCatering(
      req.params.id,
      body.location,
      body.radius,
      body.bio,
      coordinates,
    );
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering enabled", user: serializeAuthenticatedUser(updated) });
  } catch (error: any) {
    if (error?.issues)
      return res.status(400).json({ message: "Invalid data", errors: error.issues });
    console.error("POST /users/:id/catering/enable error", error);
    res.status(500).json({ message: "Failed to enable catering" });
  }
});

r.post("/:id/catering/disable", requireAuth, async (req, res) => {
  try {
    if ((req.user as { id: string }).id !== req.params.id) return res.status(403).json({ message: "You can only update your own catering profile" });
    const updated = await storage.disableCatering(req.params.id);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering disabled", user: serializeAuthenticatedUser(updated) });
  } catch (error) {
    console.error("POST /users/:id/catering/disable error", error);
    res.status(500).json({ message: "Failed to disable catering" });
  }
});

r.put("/:id/catering/settings", requireAuth, async (req, res) => {
  try {
    if ((req.user as { id: string }).id !== req.params.id) return res.status(403).json({ message: "You can only update your own catering profile" });
    const schema = z.object({
      location: z.string().min(3).optional(),
      radius: z.number().min(5).max(100).optional(),
      bio: z.string().optional(),
      available: z.boolean().optional(),
    });
    const settings = schema.parse(req.body);
    if (settings.location !== undefined) {
      const geocoded = await geocodeLocation(settings.location).catch(() => null);
      const coordinates = parseCoordinates(settings.location) ?? (geocoded && { latitude: geocoded.lat, longitude: geocoded.lng });
      if (!coordinates) return res.status(422).json({ message: "We couldn't find that service location." });
      (settings as typeof settings & { coordinates?: { latitude: number; longitude: number } }).coordinates = coordinates;
    }
    const updated = await storage.updateCateringSettings(
      req.params.id,
      settings
    );
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Catering settings updated", user: serializeAuthenticatedUser(updated) });
  } catch (error: any) {
    if (error?.issues)
      return res.status(400).json({ message: "Invalid data", errors: error.issues });
    console.error("PUT /users/:id/catering/settings error", error);
    res.status(500).json({ message: "Failed to update catering settings" });
  }
});

r.get("/:id/catering/status", requireAuth, async (req, res) => {
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
  } catch (error) {
    console.error("GET /users/:id/catering/status error", error);
    res.status(500).json({ message: "Failed to fetch status" });
  }
});

/* ------------------------------------------------------------------ */
/* Subscription (simple example)                                      */
/* ------------------------------------------------------------------ */
r.put("/:id/subscription", requireAuth, async (req, res) => {
  const principal = req.user as { id: string };
  if (principal.id !== req.params.id) {
    return res.status(403).json({ message: "You can only update your own subscription" });
  }

  const schema = z.object({ tier: z.literal("free") }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(503).json({
      ok: false,
      code: "SUBSCRIPTION_BILLING_NOT_CONFIGURED",
      message: "Paid subscription changes require verified billing evidence and are not available yet.",
    });
  }

  const updated = await storage.updateUser(principal.id, {
    subscriptionTier: "free",
    subscriptionStatus: "active",
    subscriptionEndsAt: null,
  } as any);
  if (!updated) return res.status(404).json({ message: "User not found" });
  return res.json({ message: "Subscription changed to Free", user: serializeAuthenticatedUser(updated) });
});

r.get("/:id/subscription/info", requireAuth, async (req, res) => {
  try {
    const userId = resolveSelfUserId(req, res, req.params.id, { message: "You can only view your own subscription" });
    if (!userId) return;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const getCommissionRate = (tier: string, monthlyRevenue: number) => {
      const tiers = {
        free: { base: 10, thresholds: [] as { amount: number; rate: number }[] },
        starter: {
          base: 8,
          thresholds: [
            { amount: 1000, rate: 7 },
            { amount: 2500, rate: 6 },
          ],
        },
        professional: {
          base: 5,
          thresholds: [
            { amount: 2500, rate: 4 },
            { amount: 5000, rate: 3 },
          ],
        },
        enterprise: {
          base: 3,
          thresholds: [
            { amount: 5000, rate: 2.5 },
            { amount: 10000, rate: 2 },
          ],
        },
        premium_plus: { base: 1, thresholds: [{ amount: 10000, rate: 0.5 }] },
      } as const;

      const t = (tiers as any)[tier] || tiers.free;
      for (const th of [...t.thresholds].reverse()) {
        if (monthlyRevenue >= th.amount) return th.rate;
      }
      return t.base;
    };

    const mrNum =
      typeof (user as any).monthlyRevenue === "number"
        ? (user as any).monthlyRevenue
        : parseFloat(String((user as any).monthlyRevenue || "0"));
    const rate = getCommissionRate(
      effectiveMarketplaceTier(user as any),
      isNaN(mrNum) ? 0 : mrNum
    );

    const effectiveTier = effectiveMarketplaceTier(user as any);
    const effectiveState = effectiveSubscriptionPresentation(effectiveTier, (user as any).subscriptionStatus, (user as any).subscriptionEndsAt);
    res.json({
      subscriptionTier: effectiveTier,
      subscriptionStatus: effectiveState.status,
      subscriptionEndsAt: effectiveState.endsAt,
      monthlyRevenue: (user as any).monthlyRevenue,
      currentCommissionRate: rate,
      tierPricing: {
        starter: { price: 15, baseRate: 8 },
        professional: { price: 35, baseRate: 5 },
        enterprise: { price: 75, baseRate: 3 },
        premium_plus: { price: 150, baseRate: 1 },
      },
    });
  } catch (error) {
    console.error("GET /users/:id/subscription/info error", error);
    res.status(500).json({ message: "Failed to fetch subscription info" });
  }
});

/* ------------------------------------------------------------------ */
/* Nutrition (trial only)                                             */
/* ------------------------------------------------------------------ */
r.post("/:id/nutrition/trial", requireAuth, async (req, res) => {
  if ((req.user as { id: string }).id !== req.params.id) {
    return res.status(403).json({ message: "You can only change your own nutrition subscription" });
  }
  // A cardless, one-time 30-day trial recorded server-side (server/lib/nutrition-entitlement.ts).
  const { status, body } = await startNutritionTrialResponse(req.params.id);
  return res.status(status).json(body);
});

// Goals, daily summaries, and logs are served only by the authenticated
// /api/nutrition router (CS-CL-01). No duplicate aliases are kept here.

/* ------------------------------------------------------------------ */
/* Account deletion                                                    */
/* ------------------------------------------------------------------ */
/**
 * DELETE /users/:id
 * Delete user account (requires authentication)
 * GDPR compliance - allows users to delete their own accounts
 */
/**
 * POST /users/:id/deactivate
 * The member deactivates their own account: hidden from everyone and signed out everywhere. Nothing is deleted:
 * signing in again (any method) reactivates it with all their data (wedding planner, meal plans, pantry, store...).
 */
r.post("/:id/deactivate", requireAuth, async (req, res) => {
  if ((req.user as { id: string }).id !== req.params.id) {
    return res.status(403).json({ message: "You can only deactivate your own account" });
  }
  try {
    await deactivateOwnAccount(req.params.id);
    res.clearCookie("auth_token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
    res.json({ ok: true, deactivated: true });
  } catch (error) {
    if (error instanceof AccountStatusError) return res.status(error.status).json({ message: error.message });
    console.error("POST /users/:id/deactivate error", error);
    res.status(500).json({ message: "We couldn't deactivate your account right now. Please try again." });
  }
});

export const KEEP_RECORDS_MESSAGE =
  "Your account has purchase, sales or booking records that ChefSire has to keep, so it can't be deleted from here. " +
  "You can deactivate it instead (everything is hidden and you're signed out), or email support@chefsire.com to close it.";

/** Does this account have transaction records that must be kept (orders bought or sold, catering bookings, meal plan purchases)? */
async function hasTransactionRecords(userId: string): Promise<boolean> {
  const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);
  const checks = [
    sql`SELECT 1 FROM orders WHERE buyer_id = ${userId} OR seller_id = ${userId} LIMIT 1`,
    sql`SELECT 1 FROM catering_bookings WHERE customer_id = ${userId} OR provider_id = ${userId} LIMIT 1`,
    sql`SELECT 1 FROM meal_plan_purchases WHERE user_id = ${userId} LIMIT 1`,
  ];
  for (const check of checks) {
    try {
      if (rowsOf(await db.execute(check)).length) return true;
    } catch (error: any) {
      // A ledger table missing outside tests is a broken environment: refuse rather than risk deleting records.
      if (error?.code === "42P01" && process.env.NODE_ENV === "test") continue;
      throw error;
    }
  }
  return false;
}

r.delete("/:id", requireAuth, async (req, res) => {
  try {
    // Security: users can only delete their own account
    if ((req.user as { id: string }).id !== req.params.id) {
      return res.status(403).json({ message: "You can only delete your own account" });
    }

    const userId = req.params.id;

    // Verify user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Transaction records are kept whatever happens to the account; deleting the account would take them with it.
    if (await hasTransactionRecords(userId)) {
      return res.status(409).json({ code: "ACCOUNT_HAS_RECORDS", message: KEEP_RECORDS_MESSAGE });
    }

    // The old hard-delete is intentionally disabled: permanent closure must use a tombstone,
    // retention checks, audit, and deferred media cleanup. Do not add a hard-delete fallback.
    return res.status(503).json({
      code: "PERMANENT_CLOSURE_DISABLED",
      message: "Permanent account closure is not available yet. You can deactivate your account, or contact support@chefsire.com.",
    });

  } catch (error) {
    console.error("DELETE /users/:id error", error);
    res.status(500).json({ message: "We couldn't delete your account right now. Please try again, or email support@chefsire.com." });
  }
});

export default r;
