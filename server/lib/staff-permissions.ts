import type { RequestHandler } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * ChefSire back office: group-based staff permissions (Active Directory style).
 *
 * - Staff are staff portal accounts (staff_users), not member accounts. They sign in on the ops host only.
 * - Permissions are granted to groups (staff_group_permissions); staff are members of groups (staff_user_groups).
 *   A staff member's permissions are the union of their groups' permissions.
 * - Owners (staff_users.is_owner) implicitly hold every permission, including staff.manage, which no group can grant,
 *   so staff can never raise their own access.
 * - Everything is evaluated from the database on each request; a disabled staff account has no access.
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

/** What this staff member may do right now. Any failure, or a disabled or unknown account, means no access. */
export async function getStaffAccess(staffUserId: string | null | undefined): Promise<StaffAccess> {
  const none: StaffAccess = { isOwner: false, permissions: [], groups: [] };
  if (!staffUserId) return none;
  try {
    const [staff] = rowsOf(await db.execute(sql`SELECT is_owner AS "isOwner" FROM staff_users WHERE id = ${staffUserId} AND status = 'active'`));
    if (!staff) return none;
    const result = await db.execute(sql`
      SELECT g.id, g.name, coalesce(array_agg(p.permission) FILTER (WHERE p.permission IS NOT NULL), '{}') AS permissions
      FROM staff_user_groups m
      JOIN staff_groups g ON g.id = m.group_id
      LEFT JOIN staff_group_permissions p ON p.group_id = g.id
      WHERE m.staff_user_id = ${staffUserId}
      GROUP BY g.id, g.name
      ORDER BY g.name
    `);
    const groups = rowsOf(result).map((g) => ({ id: g.id, name: g.name, permissions: g.permissions ?? [] }));
    if (staff.isOwner === true) {
      return { isOwner: true, permissions: [...ALL_STAFF_PERMISSIONS], groups: groups.map(({ id, name }) => ({ id, name })) };
    }
    const permissions = new Set<StaffPermission>();
    for (const g of groups) for (const p of g.permissions) if (isStaffPermission(p) && p !== "staff.manage") permissions.add(p);
    // staff.manage is reserved to Owners: a group can't grant it, so staff can never raise their own access.
    return { isOwner: false, permissions: ALL_STAFF_PERMISSIONS.filter((p) => permissions.has(p)), groups: groups.map(({ id, name }) => ({ id, name })) };
  } catch (error) {
    console.error("[staff] permission lookup failed; denying.", (error as Error)?.message);
    return none;
  }
}

export async function hasStaffPermission(staffUserId: string | null | undefined, permission: StaffPermission): Promise<boolean> {
  return (await getStaffAccess(staffUserId)).permissions.includes(permission);
}

/** Route guard: 401 without a staff session, 403 without the permission. Use after requireStaffSession. */
export const requireStaffPermission = (permission: StaffPermission): RequestHandler => async (req, res, next) => {
  const staffId = (req as any).staff?.id as string | undefined;
  if (!staffId) {
    res.status(401).json({ ok: false, code: "STAFF_SIGN_IN_REQUIRED", error: "Sign in to the staff portal." });
    return;
  }
  if (!(await hasStaffPermission(staffId, permission))) {
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
 * Appends an audit entry by a staff member. Their name and login are copied in (actor_label) so the entry stays
 * readable after the staff account changes or is removed. Throws on failure: callers record the audit entry in the
 * same transaction as the change (pass `executor`), so an unaudited change can't happen.
 */
export async function writeAudit(entry: AuditEntry, executor: any = db): Promise<void> {
  await executor.execute(sql`
    INSERT INTO admin_audit_log (actor_type, actor_id, actor_label, action, target_type, target_id, reason, details)
    VALUES (
      'staff',
      ${entry.actorId},
      (SELECT display_name || ' (' || login || ')' FROM staff_users WHERE id = ${entry.actorId}),
      ${entry.action},
      ${entry.targetType ?? null},
      ${entry.targetId ?? null},
      ${entry.reason ?? null},
      ${JSON.stringify(entry.details ?? {})}::jsonb
    )
  `);
}
