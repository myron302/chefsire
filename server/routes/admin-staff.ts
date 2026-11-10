import { Router } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../middleware";
import {
  ALL_STAFF_PERMISSIONS,
  STAFF_PERMISSIONS,
  getStaffAccess,
  isStaffPermission,
  requireStaffPermission,
  writeAudit,
} from "../lib/staff-permissions";

/**
 * Back office: staff groups (permissions on groups, accounts in groups) and the audit log.
 * Mounted at /api/admin. Every change is written to admin_audit_log in the same transaction.
 */
const r = Router();
const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);
const actorOf = (req: any): string => req.user.id;

// Who am I in the back office? Used by the client to show the panel and its sections. Never a 403.
r.get("/me", requireAuth, async (req, res) => {
  const access = await getStaffAccess(actorOf(req));
  res.set("Cache-Control", "private, no-store");
  res.json({ ok: true, isStaff: access.isOwner || access.permissions.length > 0, ...access });
});

// The permission catalog (labels for the UI). staff.manage is listed but can only be held by Owners.
r.get("/permissions", requireAuth, requireStaffPermission("staff.manage"), (_req, res) => {
  res.json({ ok: true, permissions: ALL_STAFF_PERMISSIONS.map((key) => ({ key, label: STAFF_PERMISSIONS[key], ownerOnly: key === "staff.manage" })) });
});

async function listGroups() {
  const result = await db.execute(sql`
    SELECT g.id, g.name, g.description, g.built_in AS "builtIn", g.created_at AS "createdAt",
      coalesce((SELECT array_agg(p.permission ORDER BY p.permission) FROM staff_group_permissions p WHERE p.group_id = g.id), '{}') AS permissions,
      coalesce((SELECT json_agg(json_build_object('userId', u.id, 'username', u.username, 'displayName', u.display_name, 'addedAt', m.added_at) ORDER BY u.username)
                FROM staff_group_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = g.id), '[]'::json) AS members
    FROM staff_groups g
    ORDER BY g.built_in DESC, lower(g.name)
  `);
  return rowsOf(result);
}

r.get("/groups", requireAuth, requireStaffPermission("staff.manage"), async (_req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.json({ ok: true, groups: await listGroups() });
});

const permissionList = z.array(z.string()).max(ALL_STAFF_PERMISSIONS.length).transform((list, ctx) => {
  const clean = Array.from(new Set(list));
  for (const p of clean) {
    if (!isStaffPermission(p)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown permission: ${p}` });
    if (p === "staff.manage") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "staff.manage is reserved to Owners" });
  }
  return clean;
});
const groupBody = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional().nullable(),
  permissions: permissionList.optional(),
}).strict();

const isUniqueViolation = (error: any) => error?.code === "23505";

r.post("/groups", requireAuth, requireStaffPermission("staff.manage"), async (req, res) => {
  try {
    const body = groupBody.parse(req.body);
    const created = await db.transaction(async (tx: any) => {
      const [group] = rowsOf(await tx.execute(sql`
        INSERT INTO staff_groups (name, description) VALUES (${body.name}, ${body.description ?? null}) RETURNING id, name
      `));
      for (const p of body.permissions ?? []) {
        await tx.execute(sql`INSERT INTO staff_group_permissions (group_id, permission) VALUES (${group.id}, ${p})`);
      }
      await writeAudit({ actorId: actorOf(req), action: "staff.group.create", targetType: "staff_group", targetId: group.id, details: { name: group.name, permissions: body.permissions ?? [] } }, tx);
      return group;
    });
    res.status(201).json({ ok: true, group: created });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ ok: false, error: "Invalid group", issues: error.issues });
    if (isUniqueViolation(error)) return res.status(409).json({ ok: false, error: "A group with that name already exists" });
    console.error("[admin] create group failed", error);
    res.status(500).json({ ok: false, error: "Failed to create group" });
  }
});

r.patch("/groups/:id", requireAuth, requireStaffPermission("staff.manage"), async (req, res) => {
  try {
    const body = groupBody.partial().parse(req.body);
    const result = await db.transaction(async (tx: any) => {
      const [group] = rowsOf(await tx.execute(sql`SELECT id, name, built_in AS "builtIn" FROM staff_groups WHERE id = ${req.params.id} FOR UPDATE`));
      if (!group) return null;
      if (body.name !== undefined || body.description !== undefined) {
        if (group.builtIn && body.name !== undefined && body.name !== group.name) {
          throw Object.assign(new Error("Built-in groups can't be renamed"), { status: 400 });
        }
        await tx.execute(sql`
          UPDATE staff_groups SET name = coalesce(${body.name ?? null}, name),
            description = CASE WHEN ${body.description !== undefined} THEN ${body.description ?? null} ELSE description END
          WHERE id = ${group.id}
        `);
      }
      let before: string[] | undefined;
      if (body.permissions !== undefined) {
        before = rowsOf(await tx.execute(sql`SELECT permission FROM staff_group_permissions WHERE group_id = ${group.id} ORDER BY permission`)).map((p) => p.permission);
        await tx.execute(sql`DELETE FROM staff_group_permissions WHERE group_id = ${group.id}`);
        for (const p of body.permissions) {
          await tx.execute(sql`INSERT INTO staff_group_permissions (group_id, permission) VALUES (${group.id}, ${p})`);
        }
      }
      await writeAudit({
        actorId: actorOf(req), action: "staff.group.update", targetType: "staff_group", targetId: group.id,
        details: { name: body.name ?? group.name, ...(body.description !== undefined ? { description: body.description } : {}), ...(body.permissions !== undefined ? { permissionsBefore: before, permissionsAfter: body.permissions } : {}) },
      }, tx);
      return group;
    });
    if (!result) return res.status(404).json({ ok: false, error: "Group not found" });
    res.json({ ok: true });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ ok: false, error: "Invalid group", issues: error.issues });
    if (error?.status === 400) return res.status(400).json({ ok: false, error: error.message });
    if (isUniqueViolation(error)) return res.status(409).json({ ok: false, error: "A group with that name already exists" });
    console.error("[admin] update group failed", error);
    res.status(500).json({ ok: false, error: "Failed to update group" });
  }
});

r.delete("/groups/:id", requireAuth, requireStaffPermission("staff.manage"), async (req, res) => {
  try {
    const outcome = await db.transaction(async (tx: any) => {
      const [group] = rowsOf(await tx.execute(sql`SELECT id, name, built_in AS "builtIn" FROM staff_groups WHERE id = ${req.params.id} FOR UPDATE`));
      if (!group) return "missing";
      if (group.builtIn) return "builtin";
      const members = rowsOf(await tx.execute(sql`SELECT user_id FROM staff_group_members WHERE group_id = ${group.id}`)).map((m) => m.user_id);
      await tx.execute(sql`DELETE FROM staff_groups WHERE id = ${group.id}`);
      await writeAudit({ actorId: actorOf(req), action: "staff.group.delete", targetType: "staff_group", targetId: group.id, details: { name: group.name, removedMembers: members } }, tx);
      return "deleted";
    });
    if (outcome === "missing") return res.status(404).json({ ok: false, error: "Group not found" });
    if (outcome === "builtin") return res.status(400).json({ ok: false, error: "Built-in groups can't be deleted" });
    res.json({ ok: true });
  } catch (error) {
    console.error("[admin] delete group failed", error);
    res.status(500).json({ ok: false, error: "Failed to delete group" });
  }
});

const memberBody = z.object({ account: z.string().trim().min(1).max(255) }).strict();

// Add an account to a group by username or email (exact, case-insensitive).
r.post("/groups/:id/members", requireAuth, requireStaffPermission("staff.manage"), async (req, res) => {
  try {
    const { account } = memberBody.parse(req.body);
    const outcome = await db.transaction(async (tx: any) => {
      const [group] = rowsOf(await tx.execute(sql`SELECT id, name FROM staff_groups WHERE id = ${req.params.id}`));
      if (!group) return { status: 404, body: { ok: false, error: "Group not found" } };
      const matches = rowsOf(await tx.execute(sql`
        SELECT id, username FROM users WHERE lower(username) = lower(${account}) OR lower(email) = lower(${account}) LIMIT 2
      `));
      if (matches.length !== 1) return { status: 404, body: { ok: false, error: "No single account matches that username or email" } };
      const user = matches[0];
      const added = rowsOf(await tx.execute(sql`
        INSERT INTO staff_group_members (group_id, user_id, added_by) VALUES (${group.id}, ${user.id}, ${actorOf(req)})
        ON CONFLICT DO NOTHING RETURNING user_id
      `));
      if (!added.length) return { status: 200, body: { ok: true, alreadyMember: true } };
      await writeAudit({ actorId: actorOf(req), action: "staff.member.add", targetType: "user", targetId: user.id, details: { groupId: group.id, groupName: group.name, username: user.username } }, tx);
      return { status: 201, body: { ok: true, userId: user.id, username: user.username } };
    });
    res.status(outcome.status).json(outcome.body);
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ ok: false, error: "Enter a username or email" });
    console.error("[admin] add member failed", error);
    res.status(500).json({ ok: false, error: "Failed to add member" });
  }
});

r.delete("/groups/:id/members/:userId", requireAuth, requireStaffPermission("staff.manage"), async (req, res) => {
  try {
    const removed = await db.transaction(async (tx: any) => {
      const rows = rowsOf(await tx.execute(sql`
        DELETE FROM staff_group_members m USING staff_groups g
        WHERE m.group_id = ${req.params.id} AND m.user_id = ${req.params.userId} AND g.id = m.group_id
        RETURNING g.name AS "groupName"
      `));
      if (!rows.length) return false;
      await writeAudit({ actorId: actorOf(req), action: "staff.member.remove", targetType: "user", targetId: req.params.userId, details: { groupId: req.params.id, groupName: rows[0].groupName } }, tx);
      return true;
    });
    if (!removed) return res.status(404).json({ ok: false, error: "Not a member of that group" });
    res.json({ ok: true });
  } catch (error) {
    console.error("[admin] remove member failed", error);
    res.status(500).json({ ok: false, error: "Failed to remove member" });
  }
});

const auditQuery = z.object({
  targetType: z.string().max(40).optional(),
  targetId: z.string().max(100).optional(),
  actorId: z.string().max(100).optional(),
  action: z.string().max(60).optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// Newest first; page with ?before=<id of the last entry>.
r.get("/audit", requireAuth, requireStaffPermission("audit.view"), async (req, res) => {
  try {
    const q = auditQuery.parse(req.query);
    const result = await db.execute(sql`
      SELECT id, actor_id AS "actorId", actor_label AS "actorLabel", action, target_type AS "targetType",
        target_id AS "targetId", reason, details, created_at AS "createdAt"
      FROM admin_audit_log
      WHERE (${q.targetType ?? null}::text IS NULL OR target_type = ${q.targetType ?? null})
        AND (${q.targetId ?? null}::text IS NULL OR target_id = ${q.targetId ?? null})
        AND (${q.actorId ?? null}::text IS NULL OR actor_id = ${q.actorId ?? null})
        AND (${q.action ?? null}::text IS NULL OR action = ${q.action ?? null})
        AND (${q.before ?? null}::bigint IS NULL OR id < ${q.before ?? null})
      ORDER BY id DESC
      LIMIT ${q.limit + 1}
    `);
    const entries = rowsOf(result);
    res.set("Cache-Control", "private, no-store");
    res.json({ ok: true, entries: entries.slice(0, q.limit), hasMore: entries.length > q.limit });
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ ok: false, error: "Invalid filter" });
    console.error("[admin] audit read failed", error);
    res.status(500).json({ ok: false, error: "Failed to read the audit log" });
  }
});

export default r;
