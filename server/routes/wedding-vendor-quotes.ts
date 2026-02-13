// server/routes/wedding-vendor-quotes.ts
//
// Wedding vendor "Get a Quote" requests.
// - Persists requests in Postgres (Neon) so "Quote Requested" survives refresh/device changes.
// - Sends an email notification so the vendor/admin actually receives the request.
//
// Endpoints (mounted under /api/wedding):
//   GET  /vendor-quotes          -> returns { ok, vendorIds: number[], quotes: Quote[] }
//   POST /vendor-quotes          -> creates one quote per (user_id, vendor_id)

import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";
import { sendVendorQuoteRequestEmail } from "../utils/mailer";

const router = Router();

function isEmail(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const v = s.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function cleanText(input: unknown, max = 2000): string {
  if (typeof input !== "string") return "";
  const t = input.trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) : t;
}

function cleanInt(input: unknown, min: number, max: number): number | null {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min || i > max) return null;
  return i;
}

/**
 * GET /api/wedding/vendor-quotes
 * Returns quote state for the currently logged-in user.
 */
router.get("/vendor-quotes", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const result: any = await db.execute(sql`
      SELECT id, vendor_id AS "vendorId", vendor_type AS "vendorType", vendor_name AS "vendorName",
             wedding_date AS "weddingDate", guest_count AS "guestCount",
             contact_email AS "contactEmail", contact_phone AS "contactPhone",
             message, status, created_at AS "createdAt"
      FROM wedding_vendor_quotes
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 200
    `);

    const rows = result?.rows ?? result ?? [];
    const vendorIds = Array.from(
      new Set(
        rows.map((r: any) => Number(r.vendorId)).filter((n: any) => Number.isFinite(n))
      )
    );

    return res.json({ ok: true, vendorIds, quotes: rows });
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
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const vendorId = cleanInt(req.body?.vendorId, 1, 1_000_000);
    if (!vendorId) return res.status(400).json({ ok: false, error: "vendorId is required" });

    const vendorName = cleanText(req.body?.vendorName, 120);
    const vendorType = cleanText(req.body?.vendorType, 40);

    const weddingDate = cleanText(req.body?.weddingDate, 32); // store as date in SQL below
    const guestCount = cleanInt(req.body?.guestCount, 0, 5000);

    const contactEmail = isEmail(req.body?.contactEmail) ? req.body.contactEmail.trim() : "";
    const contactPhone = cleanText(req.body?.contactPhone, 40);
    const message = cleanText(req.body?.message, 4000);

    const vendorEmail = isEmail(req.body?.vendorEmail) ? req.body.vendorEmail.trim() : "";

    const result: any = await db.execute(sql`
      INSERT INTO wedding_vendor_quotes (
        user_id, vendor_id, vendor_type, vendor_name, wedding_date, guest_count,
        contact_email, contact_phone, message, status, created_at
      )
      VALUES (
        ${userId},
        ${vendorId},
        ${vendorType || null},
        ${vendorName || null},
        ${weddingDate ? sql`${weddingDate}::date` : null},
        ${typeof guestCount === "number" ? guestCount : null},
        ${contactEmail || null},
        ${contactPhone || null},
        ${message || null},
        'requested',
        NOW()
      )
      ON CONFLICT (user_id, vendor_id)
      DO UPDATE SET
        vendor_type = COALESCE(EXCLUDED.vendor_type, wedding_vendor_quotes.vendor_type),
        vendor_name = COALESCE(EXCLUDED.vendor_name, wedding_vendor_quotes.vendor_name),
        wedding_date = COALESCE(EXCLUDED.wedding_date, wedding_vendor_quotes.wedding_date),
        guest_count = COALESCE(EXCLUDED.guest_count, wedding_vendor_quotes.guest_count),
        contact_email = COALESCE(EXCLUDED.contact_email, wedding_vendor_quotes.contact_email),
        contact_phone = COALESCE(EXCLUDED.contact_phone, wedding_vendor_quotes.contact_phone),
        message = COALESCE(EXCLUDED.message, wedding_vendor_quotes.message)
      RETURNING id, vendor_id AS "vendorId", vendor_type AS "vendorType", vendor_name AS "vendorName",
                wedding_date AS "weddingDate", guest_count AS "guestCount",
                contact_email AS "contactEmail", contact_phone AS "contactPhone",
                message, status, created_at AS "createdAt",
                (xmax = 0) AS "wasInserted"
    `);

    const row = (result?.rows?.[0] ?? result?.[0]) as any;
    if (!row) return res.status(500).json({ ok: false, error: "Failed to create quote" });

    // Only email on true insert (not repeat clicks)
    if (row.wasInserted) {
      const appUrl = process.env.APP_URL || process.env.PUBLIC_URL || "";
      try {
        await sendVendorQuoteRequestEmail({
          vendorTo: vendorEmail || undefined,
          vendorName: vendorName || undefined,
          vendorType: vendorType || undefined,
          userEmail: contactEmail || undefined,
          userPhone: contactPhone || undefined,
          weddingDate: weddingDate || undefined,
          guestCount: typeof guestCount === "number" ? guestCount : undefined,
          message: message || undefined,
          appUrl,
          quoteId: row.id,
        });
      } catch (e: any) {
        console.error("[Wedding Quotes] email send failed:", e?.message || e);
      }
    }

    return res.json({ ok: true, quote: row });
  } catch (err: any) {
    console.error("[Wedding Quotes] create error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

export default router;
