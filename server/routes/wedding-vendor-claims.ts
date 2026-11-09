// server/routes/wedding-vendor-claims.ts
//
// Claiming and reporting UNCLAIMED wedding-vendor listings (imported from open business data).
//
// Claim: a signed-in user asks to manage a listing. If the listing has a business email on file, a one-time link
// goes ONLY to that address; opening it while signed in to the same account makes that account the owner.
// Without an email, the request waits for an admin. Reports: three different signed-in users reporting an
// unclaimed listing hides it until an admin restores it.
//
// Mounted under /api/wedding

import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";
import { hasCurrentAdminAuthority } from "../lib/admin-authority";
import { sendVendorClaimVerificationEmail } from "../utils/mailer";
import { ensureWeddingVendorListingsTable } from "./wedding-vendor-listings";

const router = Router();

/** Test seam: replaced in tests so no email is sent. */
export const claimDelivery = {
  send: (params: Parameters<typeof sendVendorClaimVerificationEmail>[0]) => sendVendorClaimVerificationEmail(params),
};

export const CLAIM_TTL_HOURS = 48;
export const CLAIMS_PER_USER_PER_DAY = 5;
export const REPORTS_TO_HIDE = 3;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** "owner@example.com" -> "o***@example.com" so the claimer knows which inbox to check without exposing it. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "the business email on file";
  return `${local.slice(0, 1)}***@${domain}`;
}

const rowsOf = (r: any) => (r?.rows ?? r ?? []) as any[];

let claimTablesReady = false;
async function ensureClaimTables() {
  await ensureWeddingVendorListingsTable();
  if (claimTablesReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wedding_vendor_claims (
      id BIGSERIAL PRIMARY KEY,
      listing_id BIGINT NOT NULL REFERENCES wedding_vendor_listings(id) ON DELETE CASCADE,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      method VARCHAR(16) NOT NULL,
      token_hash VARCHAR(64),
      sent_to VARCHAR(255),
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP,
      resolved_at TIMESTAMP
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS wedding_vendor_claims_token_uidx ON wedding_vendor_claims(token_hash) WHERE token_hash IS NOT NULL`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS wedding_vendor_claims_user_idx ON wedding_vendor_claims(user_id, created_at)`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wedding_vendor_reports (
      id BIGSERIAL PRIMARY KEY,
      listing_id BIGINT NOT NULL REFERENCES wedding_vendor_listings(id) ON DELETE CASCADE,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason VARCHAR(32) NOT NULL,
      details TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (listing_id, user_id)
    )
  `);
  claimTablesReady = true;
}

async function requireAdmin(req: any, res: any, next: any) {
  if (!(await hasCurrentAdminAuthority(req.user?.id))) return res.status(403).json({ ok: false, error: "Admin only" });
  next();
}

async function findUnclaimedListing(id: number) {
  return rowsOf(await db.execute(sql`
    SELECT id, business_name AS "businessName", email
    FROM wedding_vendor_listings
    WHERE id = ${id} AND status = 'published' AND source IS NOT NULL AND user_id IS NULL
    LIMIT 1
  `))[0] ?? null;
}

/** Makes `userId` the owner if the listing is still unclaimed. Returns the listing, or null if someone beat them. */
async function assignOwner(listingId: number, userId: string) {
  return rowsOf(await db.execute(sql`
    UPDATE wedding_vendor_listings
    SET user_id = ${userId}, claimed_at = NOW(), updated_at = NOW()
    WHERE id = ${listingId} AND user_id IS NULL
    RETURNING id, business_name AS "businessName"
  `))[0] ?? null;
}

const parseId = (raw: unknown) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** POST /api/wedding/vendor-listings/:id/claim */
router.post("/vendor-listings/:id/claim", requireAuth, async (req: any, res) => {
  try {
    await ensureClaimTables();
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });
    const userId = String(req.user.id);

    const listing = await findUnclaimedListing(id);
    if (!listing) return res.status(409).json({ ok: false, error: "This listing can't be claimed (it's already managed or no longer listed)." });

    const recent = rowsOf(await db.execute(sql`
      SELECT count(*)::int AS n FROM wedding_vendor_claims
      WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '24 hours'
    `))[0]?.n ?? 0;
    if (recent >= CLAIMS_PER_USER_PER_DAY) {
      return res.status(429).json({ ok: false, error: "Too many claim requests today. Please try again tomorrow." });
    }

    const email: string | null = typeof listing.email === "string" && listing.email.includes("@") ? listing.email : null;
    if (email) {
      const token = randomBytes(32).toString("base64url");
      const inserted = rowsOf(await db.execute(sql`
        INSERT INTO wedding_vendor_claims (listing_id, user_id, method, token_hash, sent_to, expires_at)
        VALUES (${id}, ${userId}, 'email', ${hashToken(token)}, ${email}, NOW() + (${CLAIM_TTL_HOURS} * INTERVAL '1 hour'))
        RETURNING id
      `))[0];
      const appUrl = (process.env.APP_URL || "https://chefsire.com").replace(/\/$/, "");
      try {
        await claimDelivery.send({
          to: email,
          businessName: listing.businessName,
          verifyUrl: `${appUrl}/services/vendor-claim?token=${encodeURIComponent(token)}`,
        });
        return res.json({ ok: true, method: "email", sentTo: maskEmail(email) });
      } catch (err) {
        console.error("[Wedding Vendor Claims] verification email failed:", err);
        await db.execute(sql`UPDATE wedding_vendor_claims SET method = 'review', token_hash = NULL WHERE id = ${inserted.id}`);
        return res.json({ ok: true, method: "review" });
      }
    }

    await db.execute(sql`
      INSERT INTO wedding_vendor_claims (listing_id, user_id, method) VALUES (${id}, ${userId}, 'review')
    `);
    return res.json({ ok: true, method: "review" });
  } catch (err: any) {
    console.error("[Wedding Vendor Claims] claim error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/** POST /api/wedding/vendor-listings/claims/verify  { token } */
router.post("/vendor-listings/claims/verify", requireAuth, async (req: any, res) => {
  try {
    await ensureClaimTables();
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!token || token.length > 200) return res.status(400).json({ ok: false, error: "Missing or invalid link." });

    const claim = rowsOf(await db.execute(sql`
      SELECT id, listing_id AS "listingId", user_id AS "userId", status, (expires_at < NOW()) AS expired
      FROM wedding_vendor_claims WHERE token_hash = ${hashToken(token)} AND method = 'email'
      LIMIT 1
    `))[0];
    if (!claim) return res.status(404).json({ ok: false, error: "This link isn't valid." });
    if (claim.status !== "pending") return res.status(409).json({ ok: false, error: "This link was already used." });
    if (claim.expired) return res.status(410).json({ ok: false, error: "This link expired. Request a new one from the listing." });
    if (String(claim.userId) !== String(req.user.id)) {
      return res.status(403).json({ ok: false, error: "Sign in with the ChefSire account that started the claim, then open the link again." });
    }

    const listing = await assignOwner(Number(claim.listingId), String(req.user.id));
    await db.execute(sql`
      UPDATE wedding_vendor_claims SET status = ${listing ? "verified" : "rejected"}, resolved_at = NOW() WHERE id = ${claim.id}
    `);
    if (!listing) return res.status(409).json({ ok: false, error: "Another account already manages this listing." });
    return res.json({ ok: true, listing });
  } catch (err: any) {
    console.error("[Wedding Vendor Claims] verify error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

const ReportSchema = z.object({
  reason: z.enum(["closed", "wrong_info", "not_wedding", "duplicate", "other"]),
  details: z.string().max(500).optional(),
});

/** POST /api/wedding/vendor-listings/:id/report  { reason, details? } */
router.post("/vendor-listings/:id/report", requireAuth, async (req: any, res) => {
  try {
    await ensureClaimTables();
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });
    const parsed = ReportSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ ok: false, error: "Choose a reason." });

    const exists = rowsOf(await db.execute(sql`SELECT id FROM wedding_vendor_listings WHERE id = ${id} AND status = 'published' LIMIT 1`))[0];
    if (!exists) return res.status(404).json({ ok: false, error: "Not found" });

    await db.execute(sql`
      INSERT INTO wedding_vendor_reports (listing_id, user_id, reason, details)
      VALUES (${id}, ${String(req.user.id)}, ${parsed.data.reason}, ${parsed.data.details ?? null})
      ON CONFLICT (listing_id, user_id) DO NOTHING
    `);
    // Enough independent reports hide an unclaimed listing; claimed listings go to admin review instead.
    const hidden = rowsOf(await db.execute(sql`
      UPDATE wedding_vendor_listings SET status = 'hidden', updated_at = NOW()
      WHERE id = ${id} AND status = 'published' AND user_id IS NULL AND source IS NOT NULL
        AND (SELECT count(*) FROM wedding_vendor_reports WHERE listing_id = ${id}) >= ${REPORTS_TO_HIDE}
      RETURNING id
    `)).length > 0;
    return res.json({ ok: true, hidden });
  } catch (err: any) {
    console.error("[Wedding Vendor Claims] report error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/** GET /api/wedding/vendor-claims  (admin) — claims waiting for review */
router.get("/vendor-claims", requireAuth, requireAdmin, async (_req, res) => {
  try {
    await ensureClaimTables();
    const claims = rowsOf(await db.execute(sql`
      SELECT c.id, c.listing_id AS "listingId", l.business_name AS "businessName", l.city, l.website, l.phone,
             c.user_id AS "userId", u.username, u.email AS "userEmail", c.created_at AS "createdAt"
      FROM wedding_vendor_claims c
      JOIN wedding_vendor_listings l ON l.id = c.listing_id
      JOIN users u ON u.id = c.user_id
      WHERE c.method = 'review' AND c.status = 'pending'
      ORDER BY c.created_at ASC LIMIT 200
    `));
    return res.json({ ok: true, claims });
  } catch (err: any) {
    console.error("[Wedding Vendor Claims] admin list error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/** POST /api/wedding/vendor-claims/:id/approve | /reject  (admin) */
router.post("/vendor-claims/:id/:decision(approve|reject)", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    await ensureClaimTables();
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });
    const claim = rowsOf(await db.execute(sql`
      SELECT id, listing_id AS "listingId", user_id AS "userId" FROM wedding_vendor_claims
      WHERE id = ${id} AND status = 'pending' LIMIT 1
    `))[0];
    if (!claim) return res.status(404).json({ ok: false, error: "Not found" });

    if (req.params.decision === "reject") {
      await db.execute(sql`UPDATE wedding_vendor_claims SET status = 'rejected', resolved_at = NOW() WHERE id = ${id}`);
      return res.json({ ok: true, status: "rejected" });
    }
    const listing = await assignOwner(Number(claim.listingId), String(claim.userId));
    await db.execute(sql`
      UPDATE wedding_vendor_claims SET status = ${listing ? "approved" : "rejected"}, resolved_at = NOW() WHERE id = ${id}
    `);
    if (!listing) return res.status(409).json({ ok: false, error: "Another account already manages this listing." });
    return res.json({ ok: true, status: "approved", listing });
  } catch (err: any) {
    console.error("[Wedding Vendor Claims] admin decision error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/** GET /api/wedding/vendor-reports  (admin) */
router.get("/vendor-reports", requireAuth, requireAdmin, async (_req, res) => {
  try {
    await ensureClaimTables();
    const reports = rowsOf(await db.execute(sql`
      SELECT l.id AS "listingId", l.business_name AS "businessName", l.city, l.status,
             count(r.id)::int AS reports, array_agg(DISTINCT r.reason) AS reasons, max(r.created_at) AS "lastReportedAt"
      FROM wedding_vendor_reports r JOIN wedding_vendor_listings l ON l.id = r.listing_id
      GROUP BY l.id ORDER BY max(r.created_at) DESC LIMIT 200
    `));
    return res.json({ ok: true, reports });
  } catch (err: any) {
    console.error("[Wedding Vendor Claims] admin reports error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
