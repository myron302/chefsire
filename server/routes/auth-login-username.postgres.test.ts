/**
 * Password login accepts a username as well as an email address.
 *
 * Real HTTP against the real auth router and storage layer, SQL executed by a real local PostgreSQL
 * (set CS_TEST_PG_URL; skipped otherwise).
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

process.env.DATABASE_URL ||= "postgres://u:p@login-username-tests.invalid/none";
const PG_URL = process.env.CS_TEST_PG_URL;

if (!PG_URL) {
  test("login by username (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = new pg.Pool(parseLocalTestDatabaseUrl(PG_URL));
  const { pool } = await import("../db/index");
  (pool as any).connect = () => local.connect();
  (pool as any).query = (q: any, params?: any[]) => (typeof q === "string" ? local.query(q, params) : local.query(params ? { ...q, values: params } : q));

  const { users } = await import("../../shared/schema");
  // Usernames are unique as stored (case-sensitive), like production; emails are unique case-insensitively.
  const userCols = Object.values(getTableColumns(users)).map((c: any) =>
    c.name === "id" ? `id varchar PRIMARY KEY DEFAULT gen_random_uuid()`
      : c.name === "username" || c.name === "email" ? `${c.name} text NOT NULL UNIQUE`
      : c.name === "auth_version" ? `auth_version integer NOT NULL DEFAULT 1`
      : `${c.name} ${c.columnType === "PgTimestamp" ? "timestamp" : "text"}`);
  await local.query(`
    DROP TABLE IF EXISTS email_verification_tokens, users CASCADE;
    CREATE TABLE users (${userCols.join(",")});
    CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));`);

  const { default: authRouter } = await import("./auth");
  const { default: bcryptjs } = await import("bcryptjs");

  const app = express();
  app.set("trust proxy", true);
  let ipCounter = 0;
  const nextIp = () => `10.${(++ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api", authRouter);
  const server = app.listen(0);
  test.after(async () => {
    server.close();
    await local.query("DROP TABLE IF EXISTS users CASCADE");
    await local.end();
  });

  const login = (email: unknown, password: string) =>
    fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
      body: JSON.stringify({ email, password }),
    });
  const seed = async (username: string, email: string, password: string | null, verified = true) =>
    (await local.query(
      `INSERT INTO users (username, email, display_name, password, email_verified_at) VALUES ($1,$2,'d',$3,$4) RETURNING id`,
      [username, email, password ? await bcryptjs.hash(password, 4) : null, verified ? new Date() : null],
    )).rows[0].id as string;

  test("username or email logs in; wildcards, ambiguity and the usual refusals still hold", async () => {
    const chef = await seed("chef_alexandra", "alexandra@example.test", "correct-horse");
    await seed("Dup", "dup1@example.test", "dup-password");
    await seed("dup", "dup2@example.test", "dup-password");
    await seed("pending_user", "pending@example.test", "pending-password", false);
    await seed("google_only", "google@example.test", null);

    const byUsername = await login("chef_alexandra", "correct-horse");
    assert.equal(byUsername.status, 200);
    assert.equal((await byUsername.json()).user.id, chef);
    assert.match(byUsername.headers.get("set-cookie") ?? "", /auth_token=/);
    assert.equal((await login("  Chef_Alexandra ", "correct-horse")).status, 200, "case-insensitive, trimmed");
    assert.equal((await login("ALEXANDRA@example.test", "correct-horse")).status, 200, "email still works");

    assert.equal((await login("chef_alexandra", "wrong-password")).status, 401);
    // No LIKE semantics: "_" and "%" are literal characters.
    assert.equal((await login("chefxalexandra", "correct-horse")).status, 401);
    assert.equal((await login("chef%", "correct-horse")).status, 401);
    // Two accounts that differ only by case: the name identifies nobody.
    assert.equal((await login("dup", "dup-password")).status, 401);
    assert.equal((await login("DUP", "dup-password")).status, 401);
    // Same rules as email login.
    assert.equal((await login("pending_user", "pending-password")).status, 403);
    assert.equal((await login("google_only", "anything-at-all")).status, 401);
    assert.equal((await login("", "correct-horse")).status, 400);
    assert.equal((await login(["chef_alexandra"], "correct-horse")).status, 400);
  });
}
