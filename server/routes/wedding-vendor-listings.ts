// server/routes/wedding-vendor-listings.ts
//
// Vendor listing submissions for wedding vendors (directory / marketplace).
// Public: vendors can submit a listing request.
// Admin: list/approve/reject/publish.
//
// Mounted under /api/wedding

import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";
import { hasCurrentAdminAuthority } from "../lib/admin-authority";
import { scheduleOpenVendorImport } from "../lib/wedding-vendor-import";

const router = Router();

// ────────────────────────────────────────────────────────────────
// Ensure table exists (runs automatically on first access)
let listingsTableReady = false;
export async function ensureWeddingVendorListingsTable() {
  if (listingsTableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wedding_vendor_listings (
      id BIGSERIAL PRIMARY KEY,
      user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,

      business_name VARCHAR(255) NOT NULL,
      contact_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(64),
      website VARCHAR(512),
      instagram_handle VARCHAR(255),

      category VARCHAR(128),
      city VARCHAR(128),
      state VARCHAR(64),
      description TEXT,

      min_price INTEGER,
      max_price INTEGER,
      years_in_business INTEGER,

      plan VARCHAR(64) NOT NULL DEFAULT 'basic',
      status VARCHAR(64) NOT NULL DEFAULT 'pending',
      agree BOOLEAN NOT NULL DEFAULT FALSE,

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS wedding_vendor_listings_user_idx
      ON wedding_vendor_listings(user_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS wedding_vendor_listings_status_idx
      ON wedding_vendor_listings(status)
  `);

  // Unclaimed listings imported from open business data (source = 'overture'). A listing is "claimed" once
  // user_id is set through the claim flow; until then it shows public business info only and takes no quotes.
  await db.execute(sql`
    ALTER TABLE wedding_vendor_listings
      ADD COLUMN IF NOT EXISTS source VARCHAR(32),
      ADD COLUMN IF NOT EXISTS source_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS source_release VARCHAR(32),
      ADD COLUMN IF NOT EXISTS street VARCHAR(255),
      ADD COLUMN IF NOT EXISTS postcode VARCHAR(16),
      ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP
  `);
  // Production's table predates this file's CREATE TABLE (it has agreed_to_terms instead of agree, and email
  // NOT NULL), so CREATE TABLE IF NOT EXISTS never reconciled it. Bring any older table up to what this code writes:
  // add the missing agree column and allow listings without an email (email was always optional here).
  await db.execute(sql`ALTER TABLE wedding_vendor_listings ADD COLUMN IF NOT EXISTS agree BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.execute(sql`ALTER TABLE wedding_vendor_listings ALTER COLUMN email DROP NOT NULL`);
  // The older table also carries CHECK constraints for a different status/plan vocabulary (active/suspended,
  // premium) that reject what this code writes (published/hidden/retired, pro). The routes validate both values
  // themselves (status PATCH allow-list, zod plan enum), so drop the stale checks.
  await db.execute(sql`ALTER TABLE wedding_vendor_listings DROP CONSTRAINT IF EXISTS wedding_vendor_listings_status_check`);
  await db.execute(sql`ALTER TABLE wedding_vendor_listings DROP CONSTRAINT IF EXISTS wedding_vendor_listings_plan_check`);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS wedding_vendor_listings_source_id_uidx
      ON wedding_vendor_listings(source_id) WHERE source_id IS NOT NULL
  `);
  listingsTableReady = true;
  scheduleOpenVendorImport();
}
// ────────────────────────────────────────────────────────────────

const VendorListingSchema = z.object({
  businessName: z.string().min(2).max(120),
  contactName: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(25).optional(),
  website: z.string().url().optional(),
  instagramHandle: z.string().min(2).max(60).optional(),

  category: z.string().min(2).max(60),
  city: z.string().min(2).max(60),
  state: z.string().min(2).max(60),

  description: z.string().min(10).max(2000).optional(),
  minPrice: z.number().int().min(0).max(10_000_000).optional(),
  maxPrice: z.number().int().min(0).max(10_000_000).optional(),
  yearsInBusiness: z.number().int().min(0).max(100).optional(),

  plan: z.enum(["basic", "featured", "pro"]).default("basic"),
  agree: z.boolean(),
});

/**
 * Admin gate for vendor-listing moderation.
 *
 * This used to read `req.user.isAdmin` — a field ChefSire never populates from an authoritative
 * source, so the check was both unreachable and, had the claim ever been attached to the token,
 * forgeable. It now uses the same current-account check as every other admin route.
 */
async function requireAdmin(req: any, res: any, next: any) {
  if (!(await hasCurrentAdminAuthority(req.user?.id))) {
    return res.status(403).json({ ok: false, error: "Admin only" });
  }
  next();
}

/**
 * POST /api/wedding/vendor-listings
 * Public submission.
 */
router.post("/vendor-listings", async (req, res) => {
  try {
    await ensureWeddingVendorListingsTable();

    const parsed = VendorListingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.message });
    }
    const v = parsed.data;

    if (!v.agree) {
      return res.status(400).json({ ok: false, error: "You must agree to the terms." });
    }

    // user_id is optional here — allow non-logged-in vendors to submit.
    const userId = req.user?.id ?? null;

    const result: any = await db.execute(sql`
      INSERT INTO wedding_vendor_listings (
        user_id, business_name, contact_name, email, phone, website, instagram_handle,
        category, city, state, description, min_price, max_price, years_in_business,
        plan, status, agree
      )
      VALUES (
        ${userId},
        ${v.businessName},
        ${v.contactName ?? null},
        ${v.email ?? null},
        ${v.phone ?? null},
        ${v.website ?? null},
        ${v.instagramHandle ?? null},
        ${v.category},
        ${v.city},
        ${v.state},
        ${v.description ?? null},
        ${typeof v.minPrice === "number" ? v.minPrice : null},
        ${typeof v.maxPrice === "number" ? v.maxPrice : null},
        ${typeof v.yearsInBusiness === "number" ? v.yearsInBusiness : null},
        ${v.plan},
        'pending',
        ${v.agree}
      )
      RETURNING id, status, created_at AS "createdAt"
    `);

    const row = result?.rows?.[0] ?? result?.[0];
    return res.json({
      ok: true,
      listing: { id: row?.id ?? null, status: row?.status ?? "pending", createdAt: row?.createdAt ?? null },
    });
  } catch (err: any) {
    console.error("[Wedding Vendor Listings] submit error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

/**
 * GET /api/wedding/vendor-listings/public
 * Public vendor directory: ONLY listings with status "published". Member listings return business-facing fields
 * (no contact name, email or phone; quote requests go through ChefSire). Unclaimed listings imported from open
 * business data also return their public business phone, since couples contact them directly.
 * Never returns email. Declared before `/:id`.
 */
router.get("/vendor-listings/public", async (_req, res) => {
  try {
    await ensureWeddingVendorListingsTable();
    const result: any = await db.execute(sql`
      SELECT
        id,
        business_name AS "businessName",
        website,
        instagram_handle AS "instagramHandle",
        category,
        city,
        state,
        description,
        min_price AS "minPrice",
        max_price AS "maxPrice",
        years_in_business AS "yearsInBusiness",
        (source IS NOT NULL AND user_id IS NULL) AS "unclaimed",
        CASE WHEN source IS NOT NULL AND user_id IS NULL THEN phone ELSE NULL END AS phone
      FROM wedding_vendor_listings
      WHERE status = 'published'
      -- Members first; then listings a couple can actually act on (website and phone); names that start with a
      -- letter before ones starting with digits or symbols ("10selden"); then A-Z.
      ORDER BY (source IS NOT NULL AND user_id IS NULL) ASC,
               (website IS NOT NULL AND phone IS NOT NULL) DESC,
               (business_name ~ '^[A-Za-z]') DESC,
               lower(business_name) ASC
      LIMIT 5000
    `);
    // Phone is only present for unclaimed listings; drop the key entirely for member listings.
    const rows = (result?.rows ?? result ?? []).map((row: any) => {
      if (row.phone == null) {
        const { phone: _omit, ...rest } = row;
        return rest;
      }
      return row;
    });
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json({ ok: true, listings: rows });
  } catch (err: any) {
    console.error("[Wedding Vendor Listings] public list error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * GET /api/wedding/vendor-listings
 * Admin list.
 */
router.get("/vendor-listings", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureWeddingVendorListingsTable();

    const status = typeof req.query?.status === "string" ? req.query.status : undefined;

    const result: any = await db.execute(sql`
      SELECT
        id,
        user_id AS "userId",
        business_name AS "businessName",
        contact_name AS "contactName",
        email,
        phone,
        website,
        instagram_handle AS "instagramHandle",
        category,
        city,
        state,
        description,
        min_price AS "minPrice",
        max_price AS "maxPrice",
        years_in_business AS "yearsInBusiness",
        plan,
        status,
        agree,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM wedding_vendor_listings
      ${status ? sql`WHERE status = ${status}` : sql``}
      ORDER BY created_at DESC
      LIMIT 500
    `);

    const rows = result?.rows ?? result ?? [];
    return res.json({ ok: true, listings: rows });
  } catch (err: any) {
    console.error("[Wedding Vendor Listings] list error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

/**
 * GET /api/wedding/vendor-listings/:id
 * Admin view.
 */
router.get("/vendor-listings/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureWeddingVendorListingsTable();

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: "Invalid id" });

    const result: any = await db.execute(sql`
      SELECT
        id,
        user_id AS "userId",
        business_name AS "businessName",
        contact_name AS "contactName",
        email,
        phone,
        website,
        instagram_handle AS "instagramHandle",
        category,
        city,
        state,
        description,
        min_price AS "minPrice",
        max_price AS "maxPrice",
        years_in_business AS "yearsInBusiness",
        plan,
        status,
        agree,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM wedding_vendor_listings
      WHERE id = ${id}
      LIMIT 1
    `);

    const row = result?.rows?.[0] ?? result?.[0];
    if (!row) return res.status(404).json({ ok: false, error: "Not found" });

    return res.json({ ok: true, listing: row });
  } catch (err: any) {
    console.error("[Wedding Vendor Listings] get error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

/**
 * PATCH /api/wedding/vendor-listings/:id/status
 * Admin update status.
 * Body: { status: "pending" | "approved" | "rejected" | "published" | "hidden" | "retired" }
 */
router.patch("/vendor-listings/:id/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureWeddingVendorListingsTable();

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: "Invalid id" });

    const status = typeof req.body?.status === "string" ? req.body.status : "";
    const allowed = new Set(["pending", "approved", "rejected", "published", "hidden", "retired"]);
    if (!allowed.has(status)) return res.status(400).json({ ok: false, error: "Invalid status" });

    const result: any = await db.execute(sql`
      UPDATE wedding_vendor_listings
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, status, updated_at AS "updatedAt"
    `);

    const row = result?.rows?.[0] ?? result?.[0];
    if (!row) return res.status(404).json({ ok: false, error: "Not found" });

    return res.json({ ok: true, listing: row });
  } catch (err: any) {
    console.error("[Wedding Vendor Listings] status update error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

export default router;
