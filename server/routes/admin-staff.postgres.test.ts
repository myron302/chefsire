/**
 * Back office part 1: group-based staff permissions (permissions on groups, accounts in groups) and the audit log.
 * Real HTTP against the real router and permission engine; SQL on a real local PostgreSQL (CS_TEST_PG_URL),
 * using the production DDL from docs/ops/2026-11-09-staff-groups.sql.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

if (!PG_URL) {
  test("Back office staff groups (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  process.env.INTERNAL_ADMIN_EMAILS = "owner@chefsire.test";

  test("owners manage groups; staff get exactly their groups' permissions; every change is audited", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: router } = await import("./admin-staff");
    const { getStaffAccess, hasStaffPermission } = await import("../lib/staff-permissions");
    const app = express();
    app.use(express.json());
    app.use("/api/admin", router);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`
        DROP TABLE IF EXISTS admin_audit_log, staff_group_members, staff_group_permissions, staff_groups, users CASCADE;
        ${ddl(schema.users, "users")};
        ${readFileSync(new URL("../../docs/ops/2026-11-09-staff-groups.sql", import.meta.url), "utf8")}
      `);
      const ids: Record<string, string> = {};
      const mk = async (name: string, email: string) => {
        ids[name] = (await local.query(
          `INSERT INTO users (username, email, display_name, password, auth_version, email_verified_at, email_verified_via)
           VALUES ($1, $2, $1, 'fixture', 1, now(), 'email_link') RETURNING id`, [name, email],
        )).rows[0].id;
      };
      await mk("owner", "owner@chefsire.test");
      await mk("helper", "helper@example.test");
      await mk("marketer", "marketer@example.test");
      await mk("member", "member@example.test");
      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);

      // Built-in groups are seeded with their permissions.
      const groups = (await call("GET", "/api/admin/groups", "owner")).json.groups;
      assert.deepEqual(groups.map((g: any) => g.name), ["Administrators", "Marketing", "Support"]);
      assert.ok(groups.find((g: any) => g.name === "Support").permissions.includes("members.suspend"));
      assert.ok(!groups.find((g: any) => g.name === "Marketing").permissions.includes("members.suspend"));

      // Who is staff: the owner holds everything; ordinary members hold nothing and can't reach the panel.
      const ownerMe = (await call("GET", "/api/admin/me", "owner")).json;
      assert.equal(ownerMe.isOwner, true);
      assert.ok(ownerMe.permissions.includes("staff.manage"));
      const memberMe = (await call("GET", "/api/admin/me", "member")).json;
      assert.equal(memberMe.isStaff, false);
      assert.equal((await call("GET", "/api/admin/me", "anon")).status, 401);
      for (const who of ["member", "anon"]) {
        assert.notEqual((await call("GET", "/api/admin/groups", who)).status, 200);
        assert.notEqual((await call("GET", "/api/admin/audit", who)).status, 200);
      }

      // Put accounts into groups (by username or email); permissions follow the group.
      assert.equal((await call("POST", "/api/admin/groups/grp-support/members", "owner", { account: "HELPER" })).status, 201);
      assert.equal((await call("POST", "/api/admin/groups/grp-support/members", "owner", { account: "helper@example.test" })).json.alreadyMember, true);
      assert.equal((await call("POST", "/api/admin/groups/grp-marketing/members", "owner", { account: "marketer" })).status, 201);
      assert.equal((await call("POST", "/api/admin/groups/grp-marketing/members", "owner", { account: "nobody-here" })).status, 404);
      assert.equal(await hasStaffPermission(ids.helper, "members.suspend"), true);
      assert.equal(await hasStaffPermission(ids.marketer, "members.suspend"), false);
      assert.equal(await hasStaffPermission(ids.marketer, "reports.view"), true);

      // Staff can't manage staff (staff.manage is Owner-only and can't be granted to a group).
      assert.equal((await call("GET", "/api/admin/groups", "helper")).status, 403);
      assert.equal((await call("POST", "/api/admin/groups/grp-support/members", "helper", { account: "member" })).status, 403);
      const grantManage = await call("POST", "/api/admin/groups", "owner", { name: "Sneaky", permissions: ["staff.manage"] });
      assert.equal(grantManage.status, 400);
      await local.query("INSERT INTO staff_group_permissions (group_id, permission) VALUES ('grp-support', 'staff.manage')");
      assert.equal(await hasStaffPermission(ids.helper, "staff.manage"), false, "even if written directly, a group can't confer staff.manage");

      // Custom groups: create with permissions, edit them, unknown permissions refused, duplicate names refused.
      const created = await call("POST", "/api/admin/groups", "owner", { name: "Moderators", description: "Content team", permissions: ["members.view", "members.restrict"] });
      assert.equal(created.status, 201, created.text);
      const gid = created.json.group.id;
      assert.equal((await call("POST", "/api/admin/groups", "owner", { name: "moderators" })).status, 409);
      assert.equal((await call("PATCH", `/api/admin/groups/${gid}`, "owner", { permissions: ["members.view", "made.up"] })).status, 400);
      assert.equal((await call("POST", `/api/admin/groups/${gid}/members`, "owner", { account: "member" })).status, 201);
      assert.equal(await hasStaffPermission(ids.member, "members.restrict"), true);
      assert.equal((await call("PATCH", `/api/admin/groups/${gid}`, "owner", { permissions: ["members.view"] })).status, 200);
      assert.equal(await hasStaffPermission(ids.member, "members.restrict"), false, "removing a permission from the group takes effect immediately");
      assert.deepEqual((await getStaffAccess(ids.member)).groups.map((g) => g.name), ["Moderators"]);

      // Built-ins can't be deleted or renamed; custom groups can be deleted (members lose its permissions).
      assert.equal((await call("DELETE", "/api/admin/groups/grp-support", "owner")).status, 400);
      assert.equal((await call("PATCH", "/api/admin/groups/grp-support", "owner", { name: "Help Desk" })).status, 400);
      assert.equal((await call("DELETE", `/api/admin/groups/${ids.member}/members/${ids.member}`, "owner")).status, 404);
      assert.equal((await call("DELETE", `/api/admin/groups/grp-marketing/members/${ids.marketer}`, "owner")).status, 200);
      assert.equal(await hasStaffPermission(ids.marketer, "reports.view"), false);
      assert.equal((await call("DELETE", `/api/admin/groups/${gid}`, "owner")).status, 200);
      assert.equal(await hasStaffPermission(ids.member, "members.view"), false);

      // The audit log records every change, newest first, readable by audit.view holders only.
      const audit = await call("GET", "/api/admin/audit?limit=200", "owner");
      assert.equal(audit.status, 200);
      const actions = audit.json.entries.map((e: any) => e.action);
      for (const a of ["staff.member.add", "staff.member.remove", "staff.group.create", "staff.group.update", "staff.group.delete"]) {
        assert.ok(actions.includes(a), `audited: ${a}`);
      }
      assert.ok(audit.json.entries.every((e: any) => e.actorLabel === "owner"));
      const del = audit.json.entries.find((e: any) => e.action === "staff.group.delete");
      assert.deepEqual(del.details.removedMembers, [ids.member]);
      assert.equal((await call("GET", "/api/admin/audit", "helper")).status, 403, "Support has no audit.view");

      // Audit entries outlive the accounts they mention (no foreign keys).
      await local.query("DELETE FROM users WHERE id = $1", [ids.marketer]);
      const kept = (await call("GET", `/api/admin/audit?targetId=${ids.marketer}`, "owner")).json.entries;
      assert.ok(kept.length >= 2);

      // An owner whose email is no longer verified loses owner powers.
      await local.query("UPDATE users SET email_verified_at = NULL, email_verified_via = NULL WHERE id = $1", [ids.owner]);
      assert.equal((await call("GET", "/api/admin/groups", "owner")).status, 403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS admin_audit_log, staff_group_members, staff_group_permissions, staff_groups, users CASCADE");
      await local.end();
    }
  });
}
