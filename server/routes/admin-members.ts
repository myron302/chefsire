import { Router } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { getStaffAccess, requireStaffPermission } from "../lib/staff-permissions";
import { hasCurrentAdminAuthority } from "../lib/admin-authority";
import { inspectMemberClosurePreview } from "../lib/closure-preview";
import { ACCOUNT_STATUSES, STAFF_SETTABLE_STATUSES, AccountStatusError, getAccountStatus, setAccountStatus, type AccountStatus } from "../lib/account-status";

/**
 * Back office: members. Search, a member's record (profile, status, staff groups, their transactions - the newest
 * 200 per section with the full count - and their audit history), and status changes. Mounted at /api/ops/admin
 * behind requireStaffSession (ops host only).
 *
 * Transaction records are read from their own tables and are never modified here: they exist whether the member is
 * active, restricted or suspended.
 */
const r = Router();
const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

const searchQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

// Search by username, display name, email or phone (contains, case-insensitive), optionally by status.
r.get("/members", requireStaffPermission("members.view"), async (req, res) => {
  try {
    const q = searchQuery.parse(req.query);
    const term = q.q ? `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const digits = q.q ? q.q.replace(/\D/g, "") : "";
    const result = await db.execute(sql`
      SELECT u.id, u.username, u.display_name AS "displayName", u.email, u.created_at AS "createdAt",
        coalesce(s.status, 'active') AS status
      FROM users u LEFT JOIN account_status s ON s.user_id = u.id
      WHERE (${term}::text IS NULL OR u.username ILIKE ${term} OR u.display_name ILIKE ${term} OR u.email ILIKE ${term}
             OR (${digits.length >= 4} AND u.phone LIKE ${"%" + digits + "%"}))
        AND (${q.status ?? null}::text IS NULL OR coalesce(s.status, 'active') = ${q.status ?? null})
      ORDER BY u.created_at DESC NULLS LAST, u.username
      LIMIT ${q.limit + 1} OFFSET ${q.offset}
    `);
    const rows = rowsOf(result);
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, members: rows.slice(0, q.limit), hasMore: rows.length > q.limit });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ ok: false, error: "Invalid search" });
    console.error("[ops] member search failed", error);
    res.status(500).json({ ok: false, error: "Failed to search members" });
  }
});

export const MEMBER_RECORD_SECTION_LIMIT = 200;

/**
 * One section of a member's record: the newest MEMBER_RECORD_SECTION_LIMIT rows plus the full count, so the UI says
 * "newest 200 of N" instead of implying it shows everything. A missing or unreadable table is reported, never fatal.
 */
async function section(name: string, query: ReturnType<typeof sql>, countQuery?: ReturnType<typeof sql>) {
  try {
    const [rows, count] = await Promise.all([
      db.execute(query),
      countQuery ? db.execute(countQuery) : Promise.resolve(null),
    ]);
    const list = rowsOf(rows);
    const total = count ? Number(rowsOf(count)[0]?.n ?? list.length) : list.length;
    return { name, rows: list, total, truncated: total > list.length, error: null as string | null };
  } catch (error) {
    console.error(`[ops] member record section ${name} failed`, (error as Error)?.message);
    return { name, rows: [] as any[], total: 0, truncated: false, error: "Unavailable" };
  }
}

r.get("/members/:id", requireStaffPermission("members.view"), async (req, res) => {
  try {
    const id = req.params.id;
    const [user] = rowsOf(await db.execute(sql`
      SELECT id, username, display_name AS "displayName", email, phone, royal_title AS "royalTitle", avatar,
        created_at AS "createdAt", email_verified_at AS "emailVerifiedAt", is_private AS "isPrivate"
      FROM users WHERE id = ${id}
    `));
    if (!user) return res.status(404).json({ ok: false, error: "Member not found" });
    const viewer = await getStaffAccess((req as any).staff.id);
    const [status, isOwner] = await Promise.all([getAccountStatus(id), hasCurrentAdminAuthority(id)]);
    const canSeeMoney = viewer.permissions.includes("orders.view");
    const sections = await Promise.all([
      canSeeMoney ? section("Marketplace orders (buying)", sql`
        SELECT o.id, o.created_at AS "createdAt", p.name AS item, o.quantity, o.total_amount AS total, o.status,
          o.payment_status AS "paymentStatus", s.username AS counterparty
        FROM orders o LEFT JOIN products p ON p.id = o.product_id LEFT JOIN users s ON s.id = o.seller_id
        WHERE o.buyer_id = ${id} ORDER BY o.created_at DESC LIMIT ${MEMBER_RECORD_SECTION_LIMIT}`,
        sql`SELECT count(*)::int AS n FROM orders WHERE buyer_id = ${id}`) : null,
      canSeeMoney ? section("Marketplace orders (selling)", sql`
        SELECT o.id, o.created_at AS "createdAt", p.name AS item, o.quantity, o.total_amount AS total, o.status,
          o.payment_status AS "paymentStatus", b.username AS counterparty
        FROM orders o LEFT JOIN products p ON p.id = o.product_id LEFT JOIN users b ON b.id = o.buyer_id
        WHERE o.seller_id = ${id} ORDER BY o.created_at DESC LIMIT ${MEMBER_RECORD_SECTION_LIMIT}`,
        sql`SELECT count(*)::int AS n FROM orders WHERE seller_id = ${id}`) : null,
      canSeeMoney ? section("Catering bookings", sql`
        SELECT b.id, b.created_at AS "createdAt", b.event_date AS "eventDate", b.agreed_price AS total, b.currency, b.status,
          CASE WHEN b.customer_id = ${id} THEN 'customer' ELSE 'provider' END AS role
        FROM catering_bookings b WHERE b.customer_id = ${id} OR b.provider_id = ${id} ORDER BY b.created_at DESC LIMIT ${MEMBER_RECORD_SECTION_LIMIT}`,
        sql`SELECT count(*)::int AS n FROM catering_bookings WHERE customer_id = ${id} OR provider_id = ${id}`) : null,
      canSeeMoney ? section("Meal plan purchases", sql`
        SELECT id, created_at AS "createdAt", price_paid_cents AS "priceCents", payment_status AS "paymentStatus", acquisition_type AS "acquisitionType"
        FROM meal_plan_purchases WHERE user_id = ${id} ORDER BY created_at DESC LIMIT ${MEMBER_RECORD_SECTION_LIMIT}`,
        sql`SELECT count(*)::int AS n FROM meal_plan_purchases WHERE user_id = ${id}`) : null,
      section("Plans and trials", sql`
        SELECT 'Wedding trial' AS plan, tier, activated_at AS "startedAt", expires_at AS "endsAt", revoked_at AS "cancelledAt" FROM wedding_intro_trials WHERE user_id = ${id}
        UNION ALL
        SELECT 'Nutrition trial', 'premium', activated_at, expires_at, revoked_at FROM nutrition_intro_trials WHERE user_id = ${id}`),
    ]);
    const history = await db.execute(sql`
      SELECT id, actor_label AS "actorLabel", action, reason, details, created_at AS "createdAt"
      FROM admin_audit_log WHERE target_type = 'user' AND target_id = ${id} ORDER BY id DESC LIMIT 100
    `);
    res.set("Cache-Control", "private, no-store");
    res.json({
      ok: true,
      member: { ...user, isOwner },
      status,
      records: sections.filter(Boolean),
      history: rowsOf(history),
      canChangeStatus: {
        restrict: viewer.permissions.includes("members.restrict"),
        suspend: viewer.permissions.includes("members.suspend"),
      },
    });
  } catch (error) {
    console.error("[ops] member record failed", error);
    res.status(500).json({ ok: false, error: "Failed to load member" });
  }
});

/** Staff can inspect LOCAL closure blockers, but the irreversible operation stays disabled. */
r.get("/members/:id/closure-preview", requireStaffPermission("members.close"), async (req, res) => {
  const preview = await inspectMemberClosurePreview(req.params.id);
  res.set("Cache-Control", "private, no-store");
  res.status(preview.verification === "unavailable" ? 503 : preview.accountExists ? 200 : 404)
    .json({ ok: preview.verification !== "unavailable" && preview.accountExists, ...preview });
});

const statusBody = z.object({
  status: z.enum(STAFF_SETTABLE_STATUSES),
  reason: z.string().trim().min(3, "Give a reason (at least 3 characters)").max(500),
}).strict();

/** Which permission a change needs: suspending or reinstating from suspension needs members.suspend. */
function permissionFor(from: AccountStatus, to: AccountStatus) {
  return to === "suspended" || from === "suspended" ? "members.suspend" : "members.restrict";
}

r.post("/members/:id/status", requireStaffPermission("members.view"), async (req, res) => {
  try {
    const body = statusBody.parse(req.body);
    const actorId = (req as any).staff.id;
    const access = await getStaffAccess(actorId);
    const result = await setAccountStatus({
      actorId,
      userId: req.params.id,
      status: body.status,
      reason: body.reason,
      protectedTarget: await hasCurrentAdminAuthority(req.params.id),
      // Checked against the status as locked inside the transaction, so a concurrent change can't be exploited.
      authorize: (from, to) => access.permissions.includes(permissionFor(from, to)),
    });
    res.json({ ok: true, ...result });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ ok: false, error: error.issues[0]?.message ?? "Invalid request" });
    if (error instanceof AccountStatusError) return res.status(error.status).json({ ok: false, error: error.message });
    console.error("[ops] status change failed", error);
    res.status(500).json({ ok: false, error: "Failed to change status" });
  }
});

export default r;
