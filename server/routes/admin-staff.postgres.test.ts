/**
 * Back office: group-based staff permissions (permissions on groups, staff in groups) and the audit log, through the
 * staff portal API (/api/ops/admin) with staff accounts. Real HTTP against the real routers and permission engine;
 * SQL on a real local PostgreSQL (CS_TEST_PG_URL) with the production DDL in docs/ops.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";
import { BACK_OFFICE_SQL, DROP_BACK_OFFICE, makeStaff, makeStaffCaller } from "../test-support/staff-portal-harness";

if (!PG_URL) {
  test("Back office staff groups (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("owners manage groups; staff get exactly their groups' permissions; every change is audited", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { createOpsRouter } = await import("./ops");
    const { getStaffAccess, hasStaffPermission } = await import("../lib/staff-permissions");
    const app = express();
    app.use(express.json());
    app.use("/api/ops", createOpsRouter());
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`${DROP_BACK_OFFICE} DROP TABLE IF EXISTS users CASCADE; ${ddl(schema.users, "users")}; ${BACK_OFFICE_SQL}`);
      const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const staff: Record<string, { id: string; cookie: string }> = {};
      staff.owner = await makeStaff(local, "owner", { isOwner: true });
      staff.helper = await makeStaff(local, "helper");
      staff.marketer = await makeStaff(local, "marketer");
      staff.mod = await makeStaff(local, "mod");
      const call = makeStaffCaller(base, (who) => staff[who]?.cookie);
      const memberId = (await local.query(`INSERT INTO users (username, email, display_name, password, auth_version) VALUES ('member', 'm@example.test', 'member', 'x', 1) RETURNING id`)).rows[0].id;

      // Built-in groups are seeded with their permissions.
      const groups = (await call("GET", "/api/ops/admin/groups", "owner")).json.groups;
      assert.deepEqual(groups.map((g: any) => g.name), ["Administrators", "Marketing", "Support"]);
      assert.ok(groups.find((g: any) => g.name === "Support").permissions.includes("members.suspend"));
      assert.ok(!groups.find((g: any) => g.name === "Marketing").permissions.includes("members.suspend"));

      // Owners hold everything; staff without groups hold nothing; no session = 401; a member's sign-in is not a staff session.
      const ownerMe = (await call("GET", "/api/ops/admin/me", "owner")).json;
      assert.equal(ownerMe.isOwner, true);
      assert.ok(ownerMe.permissions.includes("staff.manage"));
      assert.deepEqual((await call("GET", "/api/ops/admin/me", "helper")).json.permissions, []);
      assert.equal((await call("GET", "/api/ops/admin/me", "anon")).status, 401);
      const memberCall = makeCaller(base, () => memberId);
      assert.equal((await memberCall("GET", "/api/ops/admin/me", "member")).status, 401, "a member token is not a staff session");
      for (const who of ["helper", "anon"]) {
        assert.notEqual((await call("GET", "/api/ops/admin/groups", who)).status, 200);
        assert.notEqual((await call("GET", "/api/ops/admin/audit", who)).status, 200);
      }

      // Put staff into groups; permissions follow the group.
      assert.equal((await call("POST", "/api/ops/admin/groups/grp-support/members", "owner", { staffId: staff.helper.id })).status, 201);
      assert.equal((await call("POST", "/api/ops/admin/groups/grp-support/members", "owner", { staffId: staff.helper.id })).json.alreadyMember, true);
      assert.equal((await call("POST", "/api/ops/admin/groups/grp-marketing/members", "owner", { staffId: staff.marketer.id })).status, 201);
      assert.equal((await call("POST", "/api/ops/admin/groups/grp-marketing/members", "owner", { staffId: memberId })).status, 404, "member accounts can't be put in staff groups");
      assert.equal(await hasStaffPermission(staff.helper.id, "members.suspend"), true);
      assert.equal(await hasStaffPermission(staff.marketer.id, "members.suspend"), false);
      assert.equal(await hasStaffPermission(staff.marketer.id, "reports.view"), true);

      // Staff can't manage staff (staff.manage is Owner-only and can't be granted to a group).
      assert.equal((await call("GET", "/api/ops/admin/groups", "helper")).status, 403);
      assert.equal((await call("POST", "/api/ops/admin/groups/grp-support/members", "helper", { staffId: staff.mod.id })).status, 403);
      assert.equal((await call("POST", "/api/ops/admin/groups", "owner", { name: "Sneaky", permissions: ["staff.manage"] })).status, 400);
      await local.query("INSERT INTO staff_group_permissions (group_id, permission) VALUES ('grp-support', 'staff.manage')");
      assert.equal(await hasStaffPermission(staff.helper.id, "staff.manage"), false, "even if written directly, a group can't confer staff.manage");

      // Custom groups: create with permissions, edit them, unknown permissions refused, duplicate names refused.
      const created = await call("POST", "/api/ops/admin/groups", "owner", { name: "Moderators", description: "Content team", permissions: ["members.view", "members.restrict"] });
      assert.equal(created.status, 201, created.text);
      const gid = created.json.group.id;
      assert.equal((await call("POST", "/api/ops/admin/groups", "owner", { name: "moderators" })).status, 409);
      assert.equal((await call("PATCH", `/api/ops/admin/groups/${gid}`, "owner", { permissions: ["members.view", "made.up"] })).status, 400);
      assert.equal((await call("POST", `/api/ops/admin/groups/${gid}/members`, "owner", { staffId: staff.mod.id })).status, 201);
      assert.equal(await hasStaffPermission(staff.mod.id, "members.restrict"), true);
      assert.equal((await call("PATCH", `/api/ops/admin/groups/${gid}`, "owner", { permissions: ["members.view"] })).status, 200);
      assert.equal(await hasStaffPermission(staff.mod.id, "members.restrict"), false, "removing a permission from the group takes effect immediately");
      assert.deepEqual((await getStaffAccess(staff.mod.id)).groups.map((g) => g.name), ["Moderators"]);
      const listed = (await call("GET", "/api/ops/admin/groups", "owner")).json.groups.find((g: any) => g.id === gid);
      assert.deepEqual(listed.members.map((m: any) => m.login), ["mod"]);

      // Built-ins can't be deleted or renamed; custom groups can be deleted (members lose its permissions).
      assert.equal((await call("DELETE", "/api/ops/admin/groups/grp-support", "owner")).status, 400);
      assert.equal((await call("PATCH", "/api/ops/admin/groups/grp-support", "owner", { name: "Help Desk" })).status, 400);
      assert.equal((await call("DELETE", `/api/ops/admin/groups/grp-support/members/${staff.mod.id}`, "owner")).status, 404);
      assert.equal((await call("DELETE", `/api/ops/admin/groups/grp-marketing/members/${staff.marketer.id}`, "owner")).status, 200);
      assert.equal(await hasStaffPermission(staff.marketer.id, "reports.view"), false);
      assert.equal((await call("DELETE", `/api/ops/admin/groups/${gid}`, "owner")).status, 200);
      assert.equal(await hasStaffPermission(staff.mod.id, "members.view"), false);

      // The audit log records every change, newest first, by staff identity; readable by audit.view holders only.
      const audit = await call("GET", "/api/ops/admin/audit?limit=200", "owner");
      assert.equal(audit.status, 200);
      const actions = audit.json.entries.map((e: any) => e.action);
      for (const a of ["staff.member.add", "staff.member.remove", "staff.group.create", "staff.group.update", "staff.group.delete"]) {
        assert.ok(actions.includes(a), `audited: ${a}`);
      }
      assert.ok(audit.json.entries.every((e: any) => e.actorLabel === "Owner (owner)" && e.actorType === "staff"));
      assert.deepEqual(audit.json.entries.find((e: any) => e.action === "staff.group.delete").details.removedMembers, [staff.mod.id]);
      assert.equal((await call("GET", "/api/ops/admin/audit", "helper")).status, 403, "Support has no audit.view");

      // Audit entries outlive the staff accounts they mention (no foreign keys).
      await local.query("DELETE FROM staff_users WHERE id = $1", [staff.marketer.id]);
      assert.ok((await call("GET", `/api/ops/admin/audit?targetId=${staff.marketer.id}`, "owner")).json.entries.length >= 2);

      // A disabled staff account has no access, even with a live session cookie.
      await local.query("UPDATE staff_users SET status = 'disabled' WHERE id = $1", [staff.helper.id]);
      assert.equal((await call("GET", "/api/ops/admin/members", "helper")).status, 401);
      assert.equal(await hasStaffPermission(staff.helper.id, "members.view"), false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query(`${DROP_BACK_OFFICE} DROP TABLE IF EXISTS users CASCADE;`);
      await local.end();
    }
  });
}
