import { Router } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  ALL_STAFF_PERMISSIONS,
  STAFF_PERMISSIONS,
  getStaffAccess,
  isStaffPermission,
  requireStaffPermission,
  writeAudit,
} from "../lib/staff-permissions";

/**
 * Back office: staff groups (permissions on groups, staff in groups) and the audit log.
 * Mounted at /api/ops/admin behind requireStaffSession (ops host only). Every change is written to admin_audit_log in
 * the same transaction.
 */
const r = Router();
const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);
const actorOf = (req: any): string => req.staff.id;

// Who am I in the back office? Used by the client to show the panel and its sections. Never a 403.
r.get("/me", async (req: any, res) => {
  const access = await getStaffAccess(actorOf(req));
  res.set("Cache-Control", "private, no-store");
  res.json({ ok: true, staff: { id: req.staff.id, login: req.staff.login, displayName: req.staff.displayName }, ...access });
});

// The permission catalog (labels for the UI). staff.manage is listed but can only be held by Owners.
r.get("/permissions", requireStaffPermission("staff.manage"), (_req, res) => {
  res.json({ ok: true, permissions: ALL_STAFF_PERMISSIONS.map((key) => ({ key, label: STAFF_PERMISSIONS[key], ownerOnly: key === "staff.manage" })) });
});

async function listGroups() {
  const result = await db.execute(sql`
    SELECT g.id, g.name, g.description, g.built_in AS "builtIn", g.created_at AS "createdAt",
      coalesce((SELECT array_agg(p.permission ORDER BY p.permission) FROM staff_group_permissions p WHERE p.group_id = g.id), '{}') AS permissions,
      g.external_group_id AS "externalGroupId",
      coalesce((SELECT json_agg(json_build_object('staffId', u.id, 'login', u.login, 'displayName', u.display_name, 'status', u.status, 'addedAt', m.added_at) ORDER BY u.login)
                FROM staff_user_groups m JOIN staff_users u ON u.id = m.staff_user_id WHERE m.group_id = g.id), '[]'::json) AS members
    FROM staff_groups g
    ORDER BY g.built_in DESC, lower(g.name)
  `);
  return rowsOf(result);
}

r.get("/groups", requireStaffPermission("staff.manage"), async (_req, res) => {
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

r.post("/groups", requireStaffPermission("staff.manage"), async (req, res) => {
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
    console.error("[ops] create group failed", error);
    res.status(500).json({ ok: false, error: "Failed to create group" });
  }
});

r.patch("/groups/:id", requireStaffPermission("staff.manage"), async (req, res) => {
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
    console.error("[ops] update group failed", error);
    res.status(500).json({ ok: false, error: "Failed to update group" });
  }
});

r.delete("/groups/:id", requireStaffPermission("staff.manage"), async (req, res) => {
  try {
    const outcome = await db.transaction(async (tx: any) => {
      const [group] = rowsOf(await tx.execute(sql`SELECT id, name, built_in AS "builtIn" FROM staff_groups WHERE id = ${req.params.id} FOR UPDATE`));
      if (!group) return "missing";
      if (group.builtIn) return "builtin";
      const members = rowsOf(await tx.execute(sql`SELECT staff_user_id FROM staff_user_groups WHERE group_id = ${group.id}`)).map((m) => m.staff_user_id);
      await tx.execute(sql`DELETE FROM staff_groups WHERE id = ${group.id}`);
      await writeAudit({ actorId: actorOf(req), action: "staff.group.delete", targetType: "staff_group", targetId: group.id, details: { name: group.name, removedMembers: members } }, tx);
      return "deleted";
    });
    if (outcome === "missing") return res.status(404).json({ ok: false, error: "Group not found" });
    if (outcome === "builtin") return res.status(400).json({ ok: false, error: "Built-in groups can't be deleted" });
    res.json({ ok: true });
  } catch (error) {
    console.error("[ops] delete group failed", error);
    res.status(500).json({ ok: false, error: "Failed to delete group" });
  }
});

const memberBody = z.object({ staffId: z.string().trim().min(1).max(100) }).strict();

// Put a staff member in a group.
r.post("/groups/:id/members", requireStaffPermission("staff.manage"), async (req, res) => {
  try {
    const { staffId } = memberBody.parse(req.body);
    const outcome = await db.transaction(async (tx: any) => {
      const [group] = rowsOf(await tx.execute(sql`SELECT id, name FROM staff_groups WHERE id = ${req.params.id}`));
      if (!group) return { status: 404, body: { ok: false, error: "Group not found" } };
      const [staff] = rowsOf(await tx.execute(sql`SELECT id, login FROM staff_users WHERE id = ${staffId}`));
      if (!staff) return { status: 404, body: { ok: false, error: "Staff member not found" } };
      const added = rowsOf(await tx.execute(sql`
        INSERT INTO staff_user_groups (group_id, staff_user_id, added_by) VALUES (${group.id}, ${staff.id}, ${actorOf(req)})
        ON CONFLICT DO NOTHING RETURNING staff_user_id
      `));
      if (!added.length) return { status: 200, body: { ok: true, alreadyMember: true } };
      await writeAudit({ actorId: actorOf(req), action: "staff.member.add", targetType: "staff_user", targetId: staff.id, details: { groupId: group.id, groupName: group.name, login: staff.login } }, tx);
      return { status: 201, body: { ok: true, staffId: staff.id } };
    });
    res.status(outcome.status).json(outcome.body);
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ ok: false, error: "Choose a staff member" });
    console.error("[ops] add to group failed", error);
    res.status(500).json({ ok: false, error: "Failed to add to group" });
  }
});

r.delete("/groups/:id/members/:staffId", requireStaffPermission("staff.manage"), async (req, res) => {
  try {
    const removed = await db.transaction(async (tx: any) => {
      const rows = rowsOf(await tx.execute(sql`
        DELETE FROM staff_user_groups m USING staff_groups g, staff_users u
        WHERE m.group_id = ${req.params.id} AND m.staff_user_id = ${req.params.staffId} AND g.id = m.group_id AND u.id = m.staff_user_id
        RETURNING g.name AS "groupName", u.login
      `));
      if (!rows.length) return false;
      await writeAudit({ actorId: actorOf(req), action: "staff.member.remove", targetType: "staff_user", targetId: req.params.staffId, details: { groupId: req.params.id, groupName: rows[0].groupName, login: rows[0].login } }, tx);
      return true;
    });
    if (!removed) return res.status(404).json({ ok: false, error: "Not in that group" });
    res.json({ ok: true });
  } catch (error) {
    console.error("[ops] remove from group failed", error);
    res.status(500).json({ ok: false, error: "Failed to remove from group" });
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
r.get("/audit", requireStaffPermission("audit.view"), async (req, res) => {
  try {
    const q = auditQuery.parse(req.query);
    const result = await db.execute(sql`
      SELECT id, actor_type AS "actorType", actor_id AS "actorId", actor_label AS "actorLabel", action, target_type AS "targetType",
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
    console.error("[ops] audit read failed", error);
    res.status(500).json({ ok: false, error: "Failed to read the audit log" });
  }
});

export default r;
