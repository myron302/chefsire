/**
 * Staff portal (ops host): the host boundary, cross-site request protection, invite-only accounts, password +
 * authenticator sign-in (enrollment, replay protection, recovery codes, lockout), session lifetime, and Owner controls
 * over staff accounts. Real HTTP (with real Host headers) on a real local PostgreSQL with the production DDL.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { BACK_OFFICE_SQL, CLEAN_UP_BACK_OFFICE, DROP_BACK_OFFICE, STAFF_COOKIE_NAME } from "../test-support/staff-portal-harness";
import { createHash, randomBytes } from "node:crypto";

const OPS = "ops.chefsire.test";
const SITE = "chefsire.test";

type Res = { status: number; headers: http.IncomingHttpHeaders; text: string; json: any };

if (!PG_URL) {
  test("Staff portal (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  process.env.OPS_HOST = OPS;

  test("staff portal: host boundary, invite-only sign-in with authenticator, lockout, sessions and Owner controls", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { opsHostBoundary } = await import("../lib/ops-host");
    const { createOpsRouter } = await import("./ops");
    const { totpCode, totpStep, base32Encode } = await import("../lib/staff-crypto");

    const clientDir = mkdtempSync(path.join(tmpdir(), "ops-client-"));
    writeFileSync(path.join(clientDir, "index.html"), "<html>customer app</html>");
    writeFileSync(path.join(clientDir, "ops.html"), "<html>staff portal</html>");
    mkdirSync(path.join(clientDir, "assets"));
    writeFileSync(path.join(clientDir, "assets", "app.js"), "console.log(1)");

    const app = express();
    app.use(opsHostBoundary(() => clientDir));
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/ops", createOpsRouter({ authLimit: 1000 }));
    app.get("/api/posts", (_req, res) => res.json({ customer: true }));
    app.use(express.static(clientDir));
    app.get("*", (_req, res) => res.sendFile(path.join(clientDir, "index.html")));
    const server = app.listen(0, "127.0.0.1");
    const port = () => (server.address() as AddressInfo).port;

    /** A browser on one host: keeps its staff cookie, sends the portal header unless told not to. */
    function browser(host = OPS) {
      let cookie: string | null = null;
      const send = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> =>
        new Promise((resolve, reject) => {
          const payload = body !== undefined ? JSON.stringify(body) : undefined;
          const req = http.request({
            host: "127.0.0.1", port: port(), method, path: url,
            headers: {
              host,
              "x-chefsire-ops": "1",
              ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}),
              ...(cookie ? { cookie } : {}),
              ...headers,
            },
          }, (res) => {
            let text = "";
            res.on("data", (c) => (text += c));
            res.on("end", () => {
              for (const c of ([] as string[]).concat(res.headers["set-cookie"] ?? [])) {
                const [pair] = c.split(";");
                if (pair.startsWith(`${STAFF_COOKIE_NAME}=`)) cookie = /=$/.test(pair) || /Expires=Thu, 01 Jan 1970/.test(c) ? null : pair;
              }
              let json: any = null;
              try { json = JSON.parse(text); } catch { /* not JSON */ }
              resolve({ status: res.statusCode ?? 0, headers: res.headers, text, json });
            });
          });
          req.setTimeout(15000, () => { console.error("TIMEOUT", method, url); req.destroy(new Error(`timeout ${method} ${url}`)); });
          req.on("error", reject);
          if (payload) req.write(payload);
          req.end();
        });
      return { send, get cookie() { return cookie; }, set cookie(v) { cookie = v; } };
    }

    let secret = "";
    const codeAt = (offset = 0, s = secret) => totpCode(s, totpStep() + offset);

    try {
      await local.query(`${DROP_BACK_OFFICE} DROP TABLE IF EXISTS users CASCADE; ${ddl(schema.users, "users")}; ${BACK_OFFICE_SQL}`);

      // ---- Host boundary.
      const site = browser(SITE);
      assert.equal((await site.send("GET", "/api/ops/auth/me")).status, 404, "the staff API doesn't exist on the customer site");
      assert.equal((await site.send("GET", "/ops.html")).status, 404);
      assert.match((await site.send("GET", "/")).text, /customer app/);
      const anon = browser();
      const me0 = await anon.send("GET", "/api/ops/auth/me");
      assert.equal(me0.status, 200);
      assert.equal(me0.json.signedIn, false);
      assert.match(String(me0.headers["content-security-policy"]), /frame-ancestors 'none'/);
      assert.equal(me0.headers["x-frame-options"], "DENY");
      assert.equal((await anon.send("GET", "/api/posts")).status, 404, "customer APIs don't exist on the ops host");
      assert.equal((await anon.send("GET", "/uploads/x.jpg")).status, 404);
      assert.equal((await anon.send("GET", "/index.html")).status, 404);
      assert.match((await anon.send("GET", "/")).text, /staff portal/, "every page path on the ops host is the portal");
      assert.match((await anon.send("GET", "/invite")).text, /staff portal/);
      assert.equal((await anon.send("GET", "/assets/app.js")).status, 200);
      assert.equal((await anon.send("GET", "/assets/missing.js")).status, 404, "a missing asset is a 404, never the customer page");
      assert.equal((await anon.send("GET", "/assets/../index.html")).status, 404);
      // Apache (Plesk) hands ops-host requests over as /__ops-portal + the original path; the rules apply to the original.
      assert.match((await anon.send("GET", "/__ops-portal/")).text, /staff portal/);
      assert.match((await anon.send("GET", "/__ops-portal/invite?x=1")).text, /staff portal/);
      assert.equal((await anon.send("GET", "/__ops-portal/uploads/x.jpg")).status, 404);
      assert.equal((await anon.send("GET", "/__ops-portal/index.html")).status, 404);
      assert.equal((await anon.send("GET", "/__ops-portal/api/posts")).status, 404);
      assert.equal((await anon.send("GET", "/__ops-portal/assets/missing.js")).status, 404);
      assert.equal((await anon.send("GET", "/__ops-portal/api/ops/auth/me")).json.signedIn, false);
      assert.match(String((await anon.send("GET", "/__ops-portal/invite")).headers["content-security-policy"]), /frame-ancestors 'none'/);
      assert.match((await site.send("GET", "/__ops-portal/")).text, /customer app/, "the prefix means nothing on the customer site");
      const preflight = await anon.send("OPTIONS", "/api/ops/auth/login", undefined, { origin: `https://${SITE}`, "access-control-request-method": "POST" });
      assert.equal(preflight.status, 403);
      assert.equal(preflight.headers["access-control-allow-origin"], undefined);

      // ---- Cross-site request protection on every write.
      assert.equal((await anon.send("POST", "/api/ops/auth/login", { login: "x", password: "y" }, { "x-chefsire-ops": "" })).status, 403);
      assert.equal((await anon.send("POST", "/api/ops/auth/login", { login: "x", password: "y" }, { origin: `https://${SITE}` })).status, 403);
      assert.equal((await anon.send("POST", "/api/ops/auth/login", { login: "x", password: "y" }, { "sec-fetch-site": "same-site" })).status, 403);
      assert.equal((await anon.send("POST", "/api/ops/auth/login", { login: "x", password: "y" }, { origin: `https://${OPS}`, "sec-fetch-site": "same-origin" })).status, 401);

      // ---- Bootstrap: the first Owner's one-time invite (as created by the setup script / SQL).
      const ownerToken = randomBytes(32).toString("base64url");
      await local.query(`INSERT INTO staff_invites (token_hash, login, display_name, is_owner, expires_at)
        VALUES ($1, 'myron', 'Myron', true, now() + interval '1 day')`, [createHash("sha256").update(ownerToken).digest("hex")]);
      const myron = browser();
      assert.equal((await myron.send("POST", "/api/ops/auth/invite/check", { token: "x".repeat(40) })).status, 404);
      const check = await myron.send("POST", "/api/ops/auth/invite/check", { token: ownerToken });
      assert.deepEqual([check.status, check.json.login, check.json.reset], [200, "myron", false]);
      assert.equal((await myron.send("POST", "/api/ops/auth/invite/accept", { token: ownerToken, password: "short" })).status, 400);
      const accepted = await myron.send("POST", "/api/ops/auth/invite/accept", { token: ownerToken, password: "correct horse battery staple" });
      assert.equal(accepted.status, 201, accepted.text);
      assert.equal(accepted.json.stage, "enroll");
      assert.equal((await browser().send("POST", "/api/ops/auth/invite/accept", { token: ownerToken, password: "another long password" })).status, 404, "an invite works once");
      assert.equal((await myron.send("GET", "/api/ops/admin/me")).status, 401, "no access before the authenticator is set up");
      assert.equal((await myron.send("GET", "/api/ops/auth/me")).json.stage, "enroll");

      // ---- Authenticator setup.
      const setup = await myron.send("POST", "/api/ops/auth/mfa/setup");
      assert.equal(setup.status, 200);
      secret = setup.json.secret;
      assert.match(setup.json.uri, /^otpauth:\/\/totp\/ChefSire%20Staff%3Amyron\?secret=/);
      const stored = (await local.query("SELECT totp_pending_enc, totp_secret_enc FROM staff_users WHERE login = 'myron'")).rows[0];
      assert.ok(stored.totp_pending_enc.startsWith("v1.") && !stored.totp_pending_enc.includes(secret), "the secret is stored encrypted");
      assert.equal((await myron.send("POST", "/api/ops/auth/mfa/enroll", { code: codeAt(5) })).status, 401, "a wrong setup code counts as a failure");
      assert.equal((await local.query("SELECT failed_attempts FROM staff_users WHERE login = 'myron'")).rows[0].failed_attempts, 1);
      const preEnrollCookie = myron.cookie;
      const enrolled = await myron.send("POST", "/api/ops/auth/mfa/enroll", { code: codeAt(0) });
      assert.equal(enrolled.status, 200, enrolled.text);
      assert.equal(enrolled.json.recoveryCodes.length, 10);
      assert.notEqual(myron.cookie, preEnrollCookie, "a new session id once signed in");
      const stale = browser();
      stale.cookie = preEnrollCookie;
      assert.equal((await stale.send("GET", "/api/ops/admin/me")).status, 401, "the pre-sign-in session id no longer works");
      const ownerMe = await myron.send("GET", "/api/ops/admin/me");
      assert.equal(ownerMe.status, 200);
      assert.equal(ownerMe.json.isOwner, true);
      const recovery: string[] = enrolled.json.recoveryCodes;

      // ---- The Owner invites Support staff.
      assert.equal((await myron.send("POST", "/api/ops/admin/staff/invites", { login: "bad login!", displayName: "X" })).status, 400);
      assert.equal((await myron.send("POST", "/api/ops/admin/staff/invites", { login: "someone", displayName: "X", groupIds: ["grp-nope"] })).status, 400);
      const invite2 = await myron.send("POST", "/api/ops/admin/staff/invites", { login: "Helper", displayName: "Hannah Helper", groupIds: ["grp-support"] });
      assert.equal(invite2.status, 201, invite2.text);
      assert.ok(invite2.json.link.startsWith(`https://${OPS}/invite#`));
      assert.equal((await myron.send("POST", "/api/ops/admin/staff/invites", { login: "helper", displayName: "Again" })).status, 409);
      const helperToken = invite2.json.link.split("#")[1];
      const helper = browser();
      assert.equal((await helper.send("POST", "/api/ops/auth/invite/accept", { token: helperToken, password: "helper password 123" })).status, 201);
      const hs = (await helper.send("POST", "/api/ops/auth/mfa/setup")).json.secret;
      const helperEnrollCode = codeAt(0, hs);
      assert.equal((await helper.send("POST", "/api/ops/auth/mfa/enroll", { code: helperEnrollCode })).status, 200);
      const helperMe = (await helper.send("GET", "/api/ops/admin/me")).json;
      assert.deepEqual([helperMe.isOwner, helperMe.groups.map((g: any) => g.name)], [false, ["Support"]]);
      assert.equal((await helper.send("GET", "/api/ops/admin/members")).status, 200);
      assert.equal((await helper.send("GET", "/api/ops/admin/staff")).status, 403, "only Owners manage staff");
      assert.equal((await helper.send("POST", "/api/ops/admin/staff/invites", { login: "sneaky", displayName: "S", isOwner: true })).status, 403);

      // ---- Sign-in: password, then a code; codes can't be replayed; wrong logins look the same.
      assert.equal((await helper.send("POST", "/api/ops/auth/logout")).status, 200);
      assert.equal((await helper.send("GET", "/api/ops/admin/me")).status, 401);
      assert.equal((await helper.send("POST", "/api/ops/auth/login", { login: "nobody", password: "helper password 123" })).json.error, "Wrong login or password.");
      assert.equal((await helper.send("POST", "/api/ops/auth/login", { login: "helper", password: "wrong" })).json.error, "Wrong login or password.");
      const pw = await helper.send("POST", "/api/ops/auth/login", { login: "HELPER", password: "helper password 123" });
      assert.deepEqual([pw.status, pw.json.stage], [200, "mfa"]);
      assert.equal((await helper.send("GET", "/api/ops/admin/me")).status, 401, "a password alone is not a sign-in");
      assert.equal((await helper.send("POST", "/api/ops/auth/mfa/verify", { code: helperEnrollCode })).status, 401, "the code already used at setup can't be used again");
      const nextCode = codeAt(1, hs);
      assert.equal((await helper.send("POST", "/api/ops/auth/mfa/verify", { code: nextCode })).status, 200);
      assert.equal((await helper.send("GET", "/api/ops/admin/me")).status, 200);
      await helper.send("POST", "/api/ops/auth/logout");
      await helper.send("POST", "/api/ops/auth/login", { login: "helper", password: "helper password 123" });
      assert.equal((await helper.send("POST", "/api/ops/auth/mfa/verify", { code: nextCode })).status, 401, "nor the same code twice");

      // ---- Lockout after 5 failures (wrong code counts too); then even the right password is refused.
      // (the replayed code above was failure 1)
      for (let i = 0; i < 2; i++) assert.equal((await helper.send("POST", "/api/ops/auth/mfa/verify", { code: "000000" })).status, 401);
      const locked = await helper.send("POST", "/api/ops/auth/mfa/verify", { code: "000001" });
      assert.equal(locked.status, 401, "the 4th failure");
      const fifth = await helper.send("POST", "/api/ops/auth/mfa/verify", { code: "000002" });
      assert.equal(fifth.status, 423, "the 5th failure locks the account and ends the pending sign-in");
      assert.equal((await helper.send("POST", "/api/ops/auth/login", { login: "helper", password: "helper password 123" })).status, 423);
      await local.query("UPDATE staff_users SET locked_until = now() - interval '1 second' WHERE login = 'helper'");

      // ---- Recovery codes: each works once.
      await myron.send("POST", "/api/ops/auth/logout");
      await myron.send("POST", "/api/ops/auth/login", { login: "myron", password: "correct horse battery staple" });
      assert.equal((await myron.send("POST", "/api/ops/auth/mfa/verify", { recoveryCode: recovery[0].toUpperCase() })).status, 200);
      await myron.send("POST", "/api/ops/auth/logout");
      await myron.send("POST", "/api/ops/auth/login", { login: "myron", password: "correct horse battery staple" });
      assert.equal((await myron.send("POST", "/api/ops/auth/mfa/verify", { recoveryCode: recovery[0] })).status, 401);
      assert.equal((await myron.send("POST", "/api/ops/auth/mfa/verify", { code: codeAt(1) })).status, 200);

      // ---- Sessions end when idle.
      const idle = browser();
      await idle.send("POST", "/api/ops/auth/login", { login: "helper", password: "helper password 123" });
      await local.query("UPDATE staff_users SET totp_last_step = NULL WHERE login = 'helper'");
      assert.equal((await idle.send("POST", "/api/ops/auth/mfa/verify", { code: codeAt(0, hs) })).status, 200);
      assert.equal((await idle.send("GET", "/api/ops/admin/me")).status, 200);
      await local.query("UPDATE staff_sessions SET last_seen_at = now() - interval '31 minutes'");
      assert.equal((await idle.send("GET", "/api/ops/admin/me")).status, 401);
      assert.equal((await myron.send("GET", "/api/ops/admin/me")).status, 401, "the Owner's idle session ended too");
      await myron.send("POST", "/api/ops/auth/login", { login: "myron", password: "correct horse battery staple" });
      await local.query("UPDATE staff_users SET totp_last_step = NULL WHERE login = 'myron'");
      assert.equal((await myron.send("POST", "/api/ops/auth/mfa/verify", { code: codeAt(0) })).status, 200);
      await idle.send("POST", "/api/ops/auth/login", { login: "helper", password: "helper password 123" });
      assert.equal((await idle.send("POST", "/api/ops/auth/mfa/verify", { code: codeAt(1, hs) })).status, 200);

      // ---- Owner controls: disable ends sessions at once; reset access issues a new one-time link.
      const list = (await myron.send("GET", "/api/ops/admin/staff")).json;
      const helperId = list.staff.find((s: any) => s.login === "helper").id;
      const myronId = list.staff.find((s: any) => s.login === "myron").id;
      assert.equal((await myron.send("POST", `/api/ops/admin/staff/${helperId}/status`, { status: "disabled" })).status, 400, "a reason is required");
      assert.equal((await myron.send("POST", `/api/ops/admin/staff/${helperId}/status`, { status: "disabled", reason: "Left the company" })).status, 200);
      assert.equal((await idle.send("GET", "/api/ops/admin/members")).status, 401, "disabled: the live session stops working");
      assert.equal((await idle.send("POST", "/api/ops/auth/login", { login: "helper", password: "helper password 123" })).status, 401);
      assert.equal((await myron.send("POST", `/api/ops/admin/staff/${helperId}/reset-access`, { reason: "Lost phone" })).status, 400, "enable first");
      assert.equal((await myron.send("POST", `/api/ops/admin/staff/${helperId}/status`, { status: "active", reason: "Rehired" })).status, 200);
      const reset = await myron.send("POST", `/api/ops/admin/staff/${helperId}/reset-access`, { reason: "Lost phone" });
      assert.equal(reset.status, 200, reset.text);
      assert.equal((await idle.send("POST", "/api/ops/auth/login", { login: "helper", password: "helper password 123" })).status, 401, "the old password no longer works");
      const again = browser();
      const resetCheck = await again.send("POST", "/api/ops/auth/invite/check", { token: reset.json.link.split("#")[1] });
      assert.deepEqual([resetCheck.json.login, resetCheck.json.reset], ["helper", true]);
      assert.equal((await again.send("POST", "/api/ops/auth/invite/accept", { token: reset.json.link.split("#")[1], password: "brand new password!" })).status, 201);
      assert.equal((await again.send("GET", "/api/ops/auth/me")).json.stage, "enroll", "the authenticator is set up again");
      assert.deepEqual((await local.query("SELECT count(*)::int n FROM staff_user_groups g JOIN staff_users u ON u.id = g.staff_user_id WHERE u.login = 'helper'")).rows[0], { n: 1 }, "groups are kept");

      // ---- There must always be an active Owner; nobody changes their own account.
      assert.equal((await myron.send("POST", `/api/ops/admin/staff/${myronId}/status`, { status: "disabled", reason: "Testing" })).status, 400);
      assert.equal((await myron.send("POST", `/api/ops/admin/staff/${helperId}/owner`, { isOwner: true, reason: "Promotion" })).status, 200);
      const helperSession = browser();
      await helperSession.send("POST", "/api/ops/auth/login", { login: "helper", password: "brand new password!" });
      assert.equal((await helperSession.send("GET", "/api/ops/admin/staff")).status, 401, "not signed in yet: authenticator setup pending");

      // ---- Everything is in the audit log, attributed to staff.
      const audit = (await myron.send("GET", "/api/ops/admin/audit?limit=200")).json.entries;
      const actions = audit.map((e: any) => e.action);
      for (const a of ["staff.user.created", "staff.mfa.enrolled", "staff.invite.create", "staff.signin", "staff.user.disable", "staff.user.enable", "staff.access.reset", "staff.access.reset.completed", "staff.owner.grant"]) {
        assert.ok(actions.includes(a), `audited: ${a}`);
      }
      assert.ok(audit.every((e: any) => e.actorType === "staff"));
      assert.equal(audit.find((e: any) => e.action === "staff.user.disable").reason, "Left the company");

      // ---- Without STAFF_SECRET_KEY the portal refuses to sign anyone in.
      const key = process.env.STAFF_SECRET_KEY;
      delete process.env.STAFF_SECRET_KEY;
      try {
        assert.equal((await browser().send("POST", "/api/ops/auth/login", { login: "myron", password: "correct horse battery staple" })).status, 503);
      } finally {
        process.env.STAFF_SECRET_KEY = key;
      }
      assert.equal(base32Encode(Buffer.from("12345678901234567890")), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
      assert.equal(totpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1), "287082", "RFC 6238 test vector");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query(`${CLEAN_UP_BACK_OFFICE} DROP TABLE IF EXISTS users CASCADE;`);
      await local.end();
    }
  });
}
