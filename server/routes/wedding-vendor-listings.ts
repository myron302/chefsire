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

const router = Router();

// ────────────────────────────────────────────────────────────────
// Ensure table exists (runs automatically on first access)
async function ensureWeddingVendorListingsTable() {
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

function requireAdmin(req: any, res: any, next: any) {
  const isAdmin = !!req.user?.isAdmin;
  if (!isAdmin) return res.status(403).json({ ok: false, error: "Admin only" });
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
 * Body: { status: "pending" | "approved" | "rejected" | "published" }
 */
router.patch("/vendor-listings/:id/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureWeddingVendorListingsTable();

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: "Invalid id" });

    const status = typeof req.body?.status === "string" ? req.body.status : "";
    const allowed = new Set(["pending", "approved", "rejected", "published"]);
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
