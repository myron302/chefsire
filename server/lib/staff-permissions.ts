import type { RequestHandler } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { hasCurrentAdminAuthority } from "./admin-authority";

/**
 * ChefSire back office: group-based staff permissions (Active Directory style).
 *
 * - Permissions are granted to groups (staff_group_permissions); staff accounts are members of groups
 *   (staff_group_members). An account's permissions are the union of its groups' permissions.
 * - Owners are the accounts in INTERNAL_ADMIN_EMAILS with an authoritatively verified email
 *   (hasCurrentAdminAuthority). They implicitly hold every permission, including staff.manage, and are not stored
 *   in any group, so the business can't lock itself out through the panel.
 * - Everything is evaluated from the database on each request; nothing is trusted from the token or the client.
 * - Every staff action writes an append-only admin_audit_log entry (no foreign keys, so it outlives its subjects).
 */
export const STAFF_PERMISSIONS = {
  "members.view": "View member accounts and their transaction history",
  "members.restrict": "Restrict accounts (can browse, can't post, message, sell or buy)",
  "members.suspend": "Suspend accounts (no sign-in; content hidden) and reinstate them",
  "members.close": "Close accounts (personal info erased; transaction records kept)",
  "orders.view": "View marketplace orders",
  "orders.cancel": "Cancel unpaid orders",
  "orders.refund": "Refund and cancel paid orders",
  "reports.view": "View reports",
  "audit.view": "View the audit log",
  "staff.manage": "Manage staff groups, their permissions and members",
} as const;

export type StaffPermission = keyof typeof STAFF_PERMISSIONS;
export const ALL_STAFF_PERMISSIONS = Object.keys(STAFF_PERMISSIONS) as StaffPermission[];

export function isStaffPermission(value: unknown): value is StaffPermission {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(STAFF_PERMISSIONS, value);
}

const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

export type StaffAccess = { isOwner: boolean; permissions: StaffPermission[]; groups: { id: string; name: string }[] };

/** What this account may do in the back office right now. Any failure means no access. */
export async function getStaffAccess(userId: string | null | undefined): Promise<StaffAccess> {
  const none: StaffAccess = { isOwner: false, permissions: [], groups: [] };
  if (!userId) return none;
  try {
    if (await hasCurrentAdminAuthority(userId)) {
      return { isOwner: true, permissions: [...ALL_STAFF_PERMISSIONS], groups: [] };
    }
    const result = await db.execute(sql`
      SELECT g.id, g.name, coalesce(array_agg(p.permission) FILTER (WHERE p.permission IS NOT NULL), '{}') AS permissions
      FROM staff_group_members m
      JOIN staff_groups g ON g.id = m.group_id
      LEFT JOIN staff_group_permissions p ON p.group_id = g.id
      WHERE m.user_id = ${userId}
      GROUP BY g.id, g.name
      ORDER BY g.name
    `);
    const groups = rowsOf(result);
    const permissions = new Set<StaffPermission>();
    for (const g of groups) for (const p of g.permissions ?? []) if (isStaffPermission(p) && p !== "staff.manage") permissions.add(p);
    // staff.manage is reserved to Owners: a group can't grant it, so staff can never raise their own access.
    return { isOwner: false, permissions: ALL_STAFF_PERMISSIONS.filter((p) => permissions.has(p)), groups: groups.map((g) => ({ id: g.id, name: g.name })) };
  } catch (error) {
    console.error("[staff] permission lookup failed; denying.", (error as Error)?.message);
    return none;
  }
}

export async function hasStaffPermission(userId: string | null | undefined, permission: StaffPermission): Promise<boolean> {
  return (await getStaffAccess(userId)).permissions.includes(permission);
}

/** Route guard: 401 without a session, 403 without the permission. Use after requireAuth. */
export const requireStaffPermission = (permission: StaffPermission): RequestHandler => async (req, res, next) => {
  const userId = (req.user as { id?: string } | undefined)?.id;
  if (!userId) {
    res.status(401).json({ ok: false, error: "Not authenticated" });
    return;
  }
  if (!(await hasStaffPermission(userId, permission))) {
    res.status(403).json({ ok: false, code: "STAFF_PERMISSION_REQUIRED", error: "You don't have permission to do that." });
    return;
  }
  next();
};

export type AuditEntry = {
  actorId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
  details?: Record<string, unknown>;
};

/**
 * Appends an audit entry. The actor's username is copied in (actor_label) so the entry stays readable after the
 * account changes or is closed. Throws on failure: callers record the audit entry in the same transaction as the
 * change (pass `executor`), so an unaudited change can't happen.
 */
export async function writeAudit(entry: AuditEntry, executor: any = db): Promise<void> {
  await executor.execute(sql`
    INSERT INTO admin_audit_log (actor_id, actor_label, action, target_type, target_id, reason, details)
    VALUES (
      ${entry.actorId},
      (SELECT username FROM users WHERE id = ${entry.actorId}),
      ${entry.action},
      ${entry.targetType ?? null},
      ${entry.targetId ?? null},
      ${entry.reason ?? null},
      ${JSON.stringify(entry.details ?? {})}::jsonb
    )
  `);
}
