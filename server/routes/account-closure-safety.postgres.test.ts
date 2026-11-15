/** Part 3b safety foundation: terminal closed accounts and no legacy hard deletion. */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";
import { BACK_OFFICE_SQL, CLEAN_UP_BACK_OFFICE, DROP_BACK_OFFICE } from "../test-support/staff-portal-harness";
import { sql } from "drizzle-orm";

const CLOSURE_SQL = readFileSync(new URL("../../docs/ops/2026-11-10-account-closure-preparation.sql", import.meta.url), "utf8");

if (!PG_URL) {
  test("Part 3b closure safety requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("closed is terminal, sign-in is refused, and legacy delete is disabled", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: auth } = await import("./auth");
    const { default: users } = await import("./users");
    const { setAccountStatus, getAccountStatus, isAccountHidden, AccountStatusError } = await import("../lib/account-status");
    const { default: bcrypt } = await import("bcryptjs");
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api", auth);
    app.use("/api/users", users);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`${DROP_BACK_OFFICE} DROP TABLE IF EXISTS users CASCADE; ${ddl(schema.users, "users")}; ${BACK_OFFICE_SQL} ${CLOSURE_SQL}`);
      const password = await bcrypt.hash("verified-password", 4);
      const [closed] = (await local.query(
        "INSERT INTO users (username, email, display_name, password, email_verified_at, email_verified_via) VALUES ('closed', 'closed@example.test', 'Closed', $1, now(), 'email_link') RETURNING id",
        [password],
      )).rows;
      const [active] = (await local.query(
        "INSERT INTO users (username, email, display_name, password, email_verified_at, email_verified_via) VALUES ('active', 'active@example.test', 'Active', $1, now(), 'email_link') RETURNING id",
        [password],
      )).rows;
      await local.query("INSERT INTO account_status (user_id, status, reason) VALUES ($1, 'closed', 'Test terminal account')", [closed.id]);
      const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const call = makeCaller(base, (who) => who === "closed" ? closed.id : active.id);
      const login = await fetch(base() + "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "closed@example.test", password: "verified-password" }),
      });
      assert.equal(login.status, 403, await login.clone().text());
      assert.equal((await login.json()).code, "ACCOUNT_CLOSED");
      assert.equal(login.headers.get("set-cookie"), null);
      assert.equal((await getAccountStatus(closed.id)).status, "closed");
      assert.equal(await isAccountHidden(closed.id), true);
      await assert.rejects(
        setAccountStatus({ actorId: active.id, userId: closed.id, status: "active", reason: "Attempt to reopen", protectedTarget: false, authorize: () => true }),
        (error: unknown) => error instanceof AccountStatusError && error.status === 409,
      );
      const [stillClosed] = (await local.query("SELECT status FROM account_status WHERE user_id = $1", [closed.id])).rows;
      assert.equal(stillClosed.status, "closed");
      const deletion = await call("DELETE", `/api/users/${active.id}`, "active");
      assert.equal(deletion.status, 503, deletion.text);
      assert.equal(deletion.json.code, "PERMANENT_CLOSURE_DISABLED");
      assert.equal((await local.query("SELECT count(*)::int AS n FROM users")).rows[0].n, 2);
      const [notReopened] = (await local.query("SELECT count(*)::int AS n FROM admin_audit_log WHERE target_id = $1", [closed.id])).rows;
      assert.equal(notReopened.n, 0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query(`${CLEAN_UP_BACK_OFFICE} DROP TABLE IF EXISTS users CASCADE;`);
      await local.end();
    }
  });
}
