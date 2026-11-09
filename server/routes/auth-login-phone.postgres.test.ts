/**
 * Phone numbers: optional at signup and in profile settings, stored as E.164, and usable to sign in alongside
 * email and username (the password is always required). Never in public user responses.
 *
 * Real HTTP against the real auth and users routers and storage; SQL on a real local PostgreSQL (CS_TEST_PG_URL).
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import pg from "pg";
import type { AddressInfo } from "node:net";
import { getTableColumns } from "drizzle-orm";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";

process.env.DATABASE_URL ||= "postgres://u:p@login-phone-tests.invalid/none";
const PG_URL = process.env.CS_TEST_PG_URL;

if (!PG_URL) {
  test("phone login (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = new pg.Pool(parseLocalTestDatabaseUrl(PG_URL));
  const { pool } = await import("../db/index");
  (pool as any).connect = () => local.connect();
  (pool as any).query = (q: any, params?: any[]) => (typeof q === "string" ? local.query(q, params) : local.query(params ? { ...q, values: params } : q));

  const { users } = await import("../../shared/schema");
  const userCols = Object.values(getTableColumns(users)).map((c: any) =>
    c.name === "id" ? `id varchar PRIMARY KEY DEFAULT gen_random_uuid()`
      : c.name === "username" || c.name === "email" ? `${c.name} text NOT NULL UNIQUE`
      : c.name === "auth_version" ? `auth_version integer NOT NULL DEFAULT 1`
      : c.columnType === "PgTimestamp" ? `${c.name} timestamp`
      : c.columnType === "PgBoolean" ? `${c.name} boolean`
      : `${c.name} text`);
  // Production's constraints for phone (applied 2026-11-09).
  await local.query(`
    DROP TABLE IF EXISTS email_verification_tokens, users CASCADE;
    CREATE TABLE users (${userCols.join(",")});
    CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));
    ALTER TABLE users ADD CONSTRAINT users_phone_e164_check CHECK (phone IS NULL OR phone ~ '^\\+[1-9][0-9]{7,14}$');
    CREATE UNIQUE INDEX users_phone_unique ON users (phone) WHERE phone IS NOT NULL;
    CREATE TABLE email_verification_tokens (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, token_hash varchar(64) NOT NULL,
      email varchar(255) NOT NULL, expires_at timestamp NOT NULL DEFAULT now() + interval '24 hours', consumed_at timestamp, created_at timestamp NOT NULL DEFAULT now());`);

  const { default: authRouter } = await import("./auth");
  const { default: usersRouter } = await import("./users");
  const { AuthService } = await import("../services/auth.service");
  const { default: bcryptjs } = await import("bcryptjs");
  (AuthService as any).sendVerificationEmail = async () => {};

  const app = express();
  app.set("trust proxy", true);
  let ipCounter = 0;
  const nextIp = () => `10.${(++ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api", authRouter);
  app.use("/api/users", usersRouter);
  const server = app.listen(0);
  test.after(async () => {
    server.close();
    await local.query("DROP TABLE IF EXISTS email_verification_tokens, users CASCADE");
    await local.end();
  });

  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(base() + p, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": nextIp(), ...headers }, body: JSON.stringify(body) });
  const login = (email: unknown, password: string) => post("/auth/login", { email, password });
  const seed = async (username: string, email: string, password: string | null, phone: string | null = null) =>
    (await local.query(
      `INSERT INTO users (username, email, display_name, password, email_verified_at, phone) VALUES ($1,$2,'d',$3,now(),$4) RETURNING id`,
      [username, email, password ? await bcryptjs.hash(password, 4) : null, phone],
    )).rows[0].id as string;
  const phoneOf = async (id: string) => (await local.query("SELECT phone FROM users WHERE id = $1", [id])).rows[0].phone;

  test("a phone number signs in like an email or username; the password is still required", async () => {
    const chef = await seed("chef_phone", "chefphone@example.test", "correct-horse", "+18605551234");
    for (const id of ["(860) 555-1234", "860-555-1234", "+1 860 555 1234", "18605551234"]) {
      const r = await login(id, "correct-horse");
      assert.equal(r.status, 200, id);
      assert.equal((await r.json()).user.id, chef);
    }
    assert.equal((await login("chef_phone", "correct-horse")).status, 200, "username still works");
    assert.equal((await login("chefphone@example.test", "correct-horse")).status, 200, "email still works");
    const wrong = await login("860-555-1234", "wrong-password");
    assert.equal(wrong.status, 401);
    assert.equal((await wrong.json()).error, "Invalid email or password", "same generic answer for every miss");
    assert.equal((await login("860-555-9999", "correct-horse")).status, 401, "unknown phone");
  });

  test("an all-digit username still signs in, and a phone/username clash names nobody", async () => {
    await seed("8605550000", "digits@example.test", "digits-password");
    assert.equal((await login("8605550000", "digits-password")).status, 200, "no account has that phone: falls back to username");
    await seed("8605557777", "clash-username@example.test", "clash-password");
    await seed("someone_else", "clash-phone@example.test", "clash-password", "+18605557777");
    assert.equal((await login("8605557777", "clash-password")).status, 401);
  });

  test("signup stores the phone normalized, refuses junk, and a taken phone can't be reused", async () => {
    const signup = (username: string, email: string, phone?: string) => post("/auth/signup", {
      firstName: "F", lastName: "L", username, email, password: "signup-password", ...(phone === undefined ? {} : { phone }),
    });
    const ok = await signup("new_phone", "newphone@example.test", "(203) 555-0147");
    assert.equal(ok.status, 201, await ok.clone().text());
    assert.equal(await phoneOf((await ok.json()).userId), "+12035550147");
    const blank = await signup("no_phone", "nophone@example.test", "  ");
    assert.equal(blank.status, 201);
    assert.equal(await phoneOf((await blank.json()).userId), null);
    const junk = await signup("junk_phone", "junk@example.test", "call me");
    assert.equal(junk.status, 400);
    assert.match((await junk.json()).error, /valid phone/);
    const taken = await signup("taken_phone", "taken@example.test", "203.555.0147");
    assert.equal(taken.status, 400);
    assert.doesNotMatch((await taken.json()).error, /registered|exists|belongs/i);
    assert.equal((await local.query("SELECT count(*)::int n FROM users WHERE username = 'taken_phone'")).rows[0].n, 0);
    const dupName = await signup("new_phone", "other@example.test");
    assert.equal(dupName.status, 400);
    assert.match((await dupName.json()).error, /username is taken/i);
  });

  test("owners add, change and remove their phone in profile settings; it never appears publicly", async () => {
    const id = await seed("settings_user", "settings@example.test", "settings-password");
    await seed("other_owner", "other-owner@example.test", "x-password", "+12035550199");
    const session = await login("settings_user", "settings-password");
    const cookie = (session.headers.get("set-cookie") ?? "").split(";")[0];
    const put = (body: unknown) => fetch(`${base()}/users/${id}`, {
      method: "PUT", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body),
    });
    const added = await put({ phone: "(860) 555-0101" });
    assert.equal(added.status, 200);
    assert.equal((await added.json()).user.phone, "+18605550101", "the owner sees their own phone");
    assert.equal((await login("860-555-0101", "settings-password")).status, 200);
    assert.equal((await put({ phone: "555" })).status, 400);
    const clash = await put({ phone: "203-555-0199" });
    assert.equal(clash.status, 400);
    assert.equal(await phoneOf(id), "+18605550101", "unchanged after refused updates");
    assert.equal((await put({ bio: "hello" })).status, 200);
    assert.equal(await phoneOf(id), "+18605550101", "omitting phone leaves it alone");
    assert.equal((await put({ phone: "" })).status, 200);
    assert.equal(await phoneOf(id), null);

    const { serializePublicUser } = await import("../serializers/public-user");
    const row = (await local.query("SELECT * FROM users WHERE username = 'other_owner'")).rows[0];
    assert.ok(!JSON.stringify(serializePublicUser({ ...row, phone: row.phone } as any)).includes("2035550199"));
  });
}
