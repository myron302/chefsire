// server/routes/wedding-vendor-quotes.ts
//
// Wedding vendor "Get a Quote" requests.
// - Persists requests in Postgres (Neon) so "Quote Requested" survives refresh/logins.
// - Prevents duplicates by upserting on (user_id, vendor_id).
//
// Routes (mounted under /api/wedding):
// GET  /api/wedding/vendor-quotes   -> list user's requested quotes
// POST /api/wedding/vendor-quotes   -> create/update quote request

import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";
import { sendVendorQuoteRequestEmail } from "../utils/mailer";
import { ensureWeddingVendorListingsTable } from "./wedding-vendor-listings";

const router = Router();

// ────────────────────────────────────────────────────────────────
// Ensure table exists (runs automatically on first access)
async function ensureWeddingVendorQuotesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wedding_vendor_quotes (
      id BIGSERIAL PRIMARY KEY,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vendor_id INTEGER NOT NULL,
      vendor_type VARCHAR(64),
      vendor_name VARCHAR(255),

      wedding_date DATE,
      guest_count INTEGER,

      contact_email VARCHAR(255),
      contact_phone VARCHAR(64),
      message TEXT,

      status VARCHAR(64) NOT NULL DEFAULT 'requested',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS wedding_vendor_quotes_user_vendor_uq
      ON wedding_vendor_quotes(user_id, vendor_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS wedding_vendor_quotes_user_idx
      ON wedding_vendor_quotes(user_id)
  `);
}
// ────────────────────────────────────────────────────────────────

/**
 * How a quote request reaches the vendor. Indirected so tests can observe delivery without SMTP.
 * Delivery goes ONLY to the published listing's own email address -- never to a fallback inbox -- so
 * "sent to the vendor" is only ever reported when the vendor's address was actually handed to the mailer.
 */
export const quoteDelivery = {
  send: (params: Parameters<typeof sendVendorQuoteRequestEmail>[0]) => sendVendorQuoteRequestEmail(params),
};

const isMissingRelation = (err: any) => err?.code === "42P01" || /relation .* does not exist/i.test(err?.message || "");

/** The published listing a quote may target, or null (unpublished, nonexistent, or directory not created). */
async function findPublishedListing(vendorId: number) {
  try {
    await ensureWeddingVendorListingsTable();
    const result: any = await db.execute(sql`
      SELECT id, business_name AS "businessName", category, email,
             (source IS NOT NULL AND user_id IS NULL) AS unclaimed
      FROM wedding_vendor_listings
      WHERE id = ${vendorId} AND status = 'published'
      LIMIT 1
    `);
    return (result?.rows ?? result ?? [])[0] ?? null;
  } catch (err: any) {
    if (isMissingRelation(err)) return null;
    throw err;
  }
}

const QuoteSchema = z.object({
  vendorId: z.number().int().nonnegative(),
  vendorType: z.string().min(1).max(64).optional(),
  vendorName: z.string().min(1).max(255).optional(),
  weddingDate: z.string().optional(), // ISO yyyy-mm-dd from client
  guestCount: z.number().int().nonnegative().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(64).optional(),
  message: z.string().max(5000).optional(),
});

function toDateOrNull(iso: any): string | null {
  if (!iso) return null;
  if (typeof iso !== "string") return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * GET /api/wedding/vendor-quotes
 */
router.get("/vendor-quotes", requireAuth, async (req, res) => {
  try {
    await ensureWeddingVendorQuotesTable();

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const result: any = await db.execute(sql`
      SELECT
        id,
        vendor_id AS "vendorId",
        vendor_type AS "vendorType",
        vendor_name AS "vendorName",
        wedding_date AS "weddingDate",
        guest_count AS "guestCount",
        contact_email AS "contactEmail",
        contact_phone AS "contactPhone",
        message,
        status,
        created_at AS "createdAt"
      FROM wedding_vendor_quotes
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `);

    const rows = result?.rows ?? result ?? [];
    const quotes = (rows || []).map((r: any) => ({
      id: r.id,
      vendorId: r.vendorId,
      vendorType: r.vendorType ?? null,
      vendorName: r.vendorName ?? null,
      weddingDate: r.weddingDate ? String(r.weddingDate).slice(0, 10) : null,
      guestCount: typeof r.guestCount === "number" ? r.guestCount : null,
      contactEmail: r.contactEmail ?? null,
      contactPhone: r.contactPhone ?? null,
      message: r.message ?? null,
      status: r.status ?? "requested",
      createdAt: r.createdAt ?? null,
    }));

    return res.json({ ok: true, quotes });
  } catch (err: any) {
    console.error("[Wedding Quotes] fetch error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

/**
 * POST /api/wedding/vendor-quotes
 */
router.post("/vendor-quotes", requireAuth, async (req, res) => {
  try {
    await ensureWeddingVendorQuotesTable();

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const parsed = QuoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.message });
    }

    const q = parsed.data;
    const weddingDate = toDateOrNull(q.weddingDate);

    // Quotes may only target a vendor that is published in the directory right now.
    const listing = await findPublishedListing(q.vendorId);
    if (!listing) {
      return res.status(404).json({ ok: false, error: "This vendor isn't accepting quote requests through ChefSire." });
    }
    // Unclaimed listings come from public business data; nobody at the business has joined, so don't email them leads.
    if (listing.unclaimed) {
      return res.status(409).json({
        ok: false,
        unclaimed: true,
        error: "This business hasn't joined ChefSire yet. Contact them directly by phone or through their website.",
      });
    }
    const vendorName: string = listing.businessName;
    const vendorType: string | null = listing.category ?? null;

    const result: any = await db.execute(sql`
      INSERT INTO wedding_vendor_quotes (
        user_id, vendor_id, vendor_type, vendor_name,
        wedding_date, guest_count, contact_email, contact_phone,
        message, status
      )
      VALUES (
        ${userId}, ${q.vendorId}, ${vendorType}, ${vendorName},
        ${weddingDate}::date, ${q.guestCount ?? null}, ${q.contactEmail ?? null}, ${q.contactPhone ?? null},
        ${q.message ?? null}, 'requested'
      )
      ON CONFLICT (user_id, vendor_id)
      DO UPDATE SET
        vendor_type = EXCLUDED.vendor_type,
        vendor_name = EXCLUDED.vendor_name,
        wedding_date = EXCLUDED.wedding_date,
        guest_count = EXCLUDED.guest_count,
        contact_email = EXCLUDED.contact_email,
        contact_phone = EXCLUDED.contact_phone,
        message = EXCLUDED.message,
        status = 'requested'
      RETURNING
        id,
        vendor_id AS "vendorId",
        vendor_type AS "vendorType",
        vendor_name AS "vendorName",
        wedding_date AS "weddingDate",
        guest_count AS "guestCount",
        contact_email AS "contactEmail",
        contact_phone AS "contactPhone",
        message,
        status,
        created_at AS "createdAt",
        (xmax = 0) AS "inserted"
    `);

    const row = result?.rows?.[0] ?? result?.[0];
    const created = !!row?.inserted;

    // Deliver to the vendor's own listed address. Reported honestly: delivered is true only if the mailer accepted it.
    let delivered = false;
    const vendorEmail = typeof listing.email === "string" && listing.email.includes("@") ? listing.email : null;
    if (vendorEmail) {
      try {
        await quoteDelivery.send({
          vendorTo: vendorEmail,
          vendorName,
          vendorType: vendorType ?? undefined,
          userEmail: q.contactEmail ?? (req.user as any)?.email ?? undefined,
          userPhone: q.contactPhone ?? undefined,
          weddingDate: weddingDate ?? undefined,
          guestCount: q.guestCount ?? undefined,
          message: q.message ?? undefined,
          quoteId: row?.id ?? undefined,
        });
        delivered = true;
      } catch (err) {
        console.error("[Wedding Quotes] vendor delivery failed:", (err as any)?.message || err);
      }
    }

    return res.json({
      ok: true,
      created,
      delivered,
      vendorName,
      quote: {
        id: row?.id ?? null,
        vendorId: row?.vendorId ?? q.vendorId,
        vendorType: row?.vendorType ?? vendorType,
        vendorName: row?.vendorName ?? vendorName,
        weddingDate: row?.weddingDate ? String(row.weddingDate).slice(0, 10) : weddingDate,
        guestCount: typeof row?.guestCount === "number" ? row.guestCount : q.guestCount ?? null,
        contactEmail: row?.contactEmail ?? q.contactEmail ?? null,
        contactPhone: row?.contactPhone ?? q.contactPhone ?? null,
        message: row?.message ?? q.message ?? null,
        status: row?.status ?? "requested",
        createdAt: row?.createdAt ?? null,
      },
    });
  } catch (err: any) {
    console.error("[Wedding Quotes] save error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

export default router;
