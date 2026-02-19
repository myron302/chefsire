// server/routes/wedding-vendor-listings.ts
//
// Vendor listing applications submitted through /services/vendor-listing.
//
// Endpoints (mounted under /api/wedding):
//   POST  /vendor-listings         → submit a new application (public)
//   GET   /vendor-listings         → list all applications (admin only)
//   GET   /vendor-listings/:id     → single application detail (admin only)
//   PATCH /vendor-listings/:id/status → approve / reject / suspend (admin only)

import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";
import {
  sendVendorListingSubmittedEmail,
  sendVendorListingConfirmationEmail,
} from "../utils/mailer";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function isEmail(s: unknown): s is string {
  if (typeof s !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function clean(input: unknown, max = 500): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, max);
}

function cleanInt(input: unknown): number | null {
  const n = Number(input);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

const VALID_PLANS = new Set(["basic", "featured", "premium"]);
const VALID_STATUSES = new Set(["pending", "approved", "rejected", "active", "suspended"]);

// ─── POST /api/wedding/vendor-listings ──────────────────────────────────────
// Public — no login required. We capture user_id if they happen to be signed in.

router.post("/vendor-listings", async (req, res) => {
  try {
    const userId = (req as any).user?.id ?? null;
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    // Required fields
    const businessName = clean(req.body?.businessName, 200);
    const email        = isEmail(req.body?.email) ? (req.body.email as string).trim().toLowerCase() : "";
    const category     = clean(req.body?.category, 60);
    const city         = clean(req.body?.city, 100);

    if (!businessName) return res.status(400).json({ ok: false, error: "businessName is required" });
    if (!email)        return res.status(400).json({ ok: false, error: "A valid email is required" });
    if (!category)     return res.status(400).json({ ok: false, error: "category is required" });
    if (!city)         return res.status(400).json({ ok: false, error: "city is required" });

    // Optional fields
    const contactName     = clean(req.body?.contactName, 120) || null;
    const phone           = clean(req.body?.phone, 40) || null;
    const website         = clean(req.body?.website, 500) || null;
    const instagramHandle = clean(req.body?.instagramHandle, 120) || null;
    const state           = clean(req.body?.state, 60) || null;
    const description     = clean(req.body?.description, 4000) || null;
    const minPrice        = cleanInt(req.body?.minPrice);
    const maxPrice        = cleanInt(req.body?.maxPrice);
    const yearsInBusiness = clean(req.body?.yearsInBusiness, 20) || null;
    const plan            = VALID_PLANS.has(req.body?.plan) ? req.body.plan : "basic";
    const agreedToTerms   = req.body?.agreeToTerms === true || req.body?.agreeToTerms === "true";

    const result: any = await db.execute(sql`
      INSERT INTO wedding_vendor_listings (
        user_id, business_name, contact_name, email, phone, website, instagram_handle,
        category, city, state, description, min_price, max_price, years_in_business,
        plan, status, agreed_to_terms, ip_address, created_at, updated_at
      )
      VALUES (
        ${userId},
        ${businessName},
        ${contactName},
        ${email},
        ${phone},
        ${website},
        ${instagramHandle},
        ${category},
        ${city},
        ${state},
        ${description},
        ${minPrice},
        ${maxPrice},
        ${yearsInBusiness},
        ${plan},
        'pending',
        ${agreedToTerms},
        ${ip},
        NOW(),
        NOW()
      )
      RETURNING id, business_name AS "businessName", email, plan, status, created_at AS "createdAt"
    `);

    const row = (result?.rows?.[0] ?? result?.[0]) as any;
    if (!row) return res.status(500).json({ ok: false, error: "Failed to save listing" });

    // Fire emails — both are non-blocking (we don't let email failure break the response)
    const appUrl = process.env.APP_URL || process.env.PUBLIC_URL || "https://chefsire.com";

    // 1. Internal notification to admin/ops
    sendVendorListingSubmittedEmail({
      listingId:    row.id,
      businessName: row.businessName,
      contactName:  contactName ?? undefined,
      email,
      phone:        phone ?? undefined,
      website:      website ?? undefined,
      instagramHandle: instagramHandle ?? undefined,
      category,
      city,
      state:        state ?? undefined,
      description:  description ?? undefined,
      minPrice:     typeof minPrice === "number" ? minPrice : undefined,
      maxPrice:     typeof maxPrice === "number" ? maxPrice : undefined,
      yearsInBusiness: yearsInBusiness ?? undefined,
      plan,
      appUrl,
    }).catch((e: any) =>
      console.error("[VendorListings] admin notification email failed:", e?.message || e)
    );

    // 2. Confirmation to the vendor
    sendVendorListingConfirmationEmail({
      to:           email,
      businessName: row.businessName,
      contactName:  contactName ?? undefined,
      plan,
      appUrl,
    }).catch((e: any) =>
      console.error("[VendorListings] vendor confirmation email failed:", e?.message || e)
    );

    return res.status(201).json({ ok: true, listing: row });
  } catch (err: any) {
    console.error("[VendorListings] POST error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

// ─── Require admin for all routes below ─────────────────────────────────────

function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ ok: false, error: "Not authenticated" });
  // Treat any user with role === 'admin' as admin.
  // Adjust to match your actual admin check (e.g. req.user.isAdmin, req.user.role, etc.)
  if (req.user.role !== "admin" && !req.user.isAdmin) {
    return res.status(403).json({ ok: false, error: "Admin only" });
  }
  next();
}

// ─── GET /api/wedding/vendor-listings ───────────────────────────────────────
// Returns a paginated list. Query params: status, plan, category, page, limit

router.get("/vendor-listings", requireAuth, requireAdmin, async (req, res) => {
  try {
    const status   = VALID_STATUSES.has(req.query.status as string) ? (req.query.status as string) : null;
    const plan     = VALID_PLANS.has(req.query.plan as string) ? (req.query.plan as string) : null;
    const category = clean(req.query.category as string, 60) || null;
    const page     = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset   = (page - 1) * limit;

    const result: any = await db.execute(sql`
      SELECT
        id,
        user_id           AS "userId",
        business_name     AS "businessName",
        contact_name      AS "contactName",
        email,
        phone,
        website,
        instagram_handle  AS "instagramHandle",
        category,
        city,
        state,
        description,
        min_price         AS "minPrice",
        max_price         AS "maxPrice",
        years_in_business AS "yearsInBusiness",
        plan,
        status,
        agreed_to_terms   AS "agreedToTerms",
        admin_notes       AS "adminNotes",
        reviewed_at       AS "reviewedAt",
        reviewed_by       AS "reviewedBy",
        created_at        AS "createdAt",
        updated_at        AS "updatedAt"
      FROM wedding_vendor_listings
      WHERE
        (${status}  IS NULL OR status   = ${status})
        AND (${plan}     IS NULL OR plan     = ${plan})
        AND (${category} IS NULL OR category = ${category})
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult: any = await db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM wedding_vendor_listings
      WHERE
        (${status}  IS NULL OR status   = ${status})
        AND (${plan}     IS NULL OR plan     = ${plan})
        AND (${category} IS NULL OR category = ${category})
    `);

    const rows  = result?.rows ?? result ?? [];
    const total = (countResult?.rows?.[0] ?? countResult?.[0])?.total ?? 0;

    return res.json({ ok: true, listings: rows, total, page, limit });
  } catch (err: any) {
    console.error("[VendorListings] GET list error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

// ─── GET /api/wedding/vendor-listings/:id ───────────────────────────────────

router.get("/vendor-listings/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "Invalid id" });

    const result: any = await db.execute(sql`
      SELECT
        id, user_id AS "userId", business_name AS "businessName", contact_name AS "contactName",
        email, phone, website, instagram_handle AS "instagramHandle",
        category, city, state, description, min_price AS "minPrice", max_price AS "maxPrice",
        years_in_business AS "yearsInBusiness", plan, status, agreed_to_terms AS "agreedToTerms",
        admin_notes AS "adminNotes", reviewed_at AS "reviewedAt", reviewed_by AS "reviewedBy",
        ip_address AS "ipAddress", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM wedding_vendor_listings
      WHERE id = ${id}
    `);

    const row = (result?.rows?.[0] ?? result?.[0]) as any;
    if (!row) return res.status(404).json({ ok: false, error: "Listing not found" });

    return res.json({ ok: true, listing: row });
  } catch (err: any) {
    console.error("[VendorListings] GET single error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

// ─── PATCH /api/wedding/vendor-listings/:id/status ──────────────────────────
// Body: { status, adminNotes? }

router.patch("/vendor-listings/:id/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "Invalid id" });

    const newStatus = req.body?.status;
    if (!VALID_STATUSES.has(newStatus)) {
      return res.status(400).json({ ok: false, error: `status must be one of: ${[...VALID_STATUSES].join(", ")}` });
    }

    const adminNotes  = clean(req.body?.adminNotes, 2000) || null;
    const reviewedBy  = (req as any).user.id;

    const result: any = await db.execute(sql`
      UPDATE wedding_vendor_listings
      SET
        status       = ${newStatus},
        admin_notes  = COALESCE(${adminNotes}, admin_notes),
        reviewed_by  = ${reviewedBy},
        reviewed_at  = NOW(),
        updated_at   = NOW()
      WHERE id = ${id}
      RETURNING id, business_name AS "businessName", email, plan, status,
                admin_notes AS "adminNotes", reviewed_at AS "reviewedAt"
    `);

    const row = (result?.rows?.[0] ?? result?.[0]) as any;
    if (!row) return res.status(404).json({ ok: false, error: "Listing not found" });

    return res.json({ ok: true, listing: row });
  } catch (err: any) {
    console.error("[VendorListings] PATCH status error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

export default router;
