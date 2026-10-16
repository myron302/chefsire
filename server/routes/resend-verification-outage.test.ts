/**
 * Stability Phase 2C (Codex P2-2): a database outage inside AuthService.createAndSendVerification must reach the route as a retryable 503,
 * not be flattened into the generic 500 used for e-mail delivery failures.
 *
 * Real Express + the real auth router + the real AuthService; only the leaves are replaced: the account lookup (`storage.findByEmail`), the token
 * table operations (deletion / insertion via the db module's chain) and the mailer.
 */
import "../test-support/accept-test-sessions";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import cookieParser from "cookie-parser";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://app:secret@127.0.0.1:9/chefsire_unreachable_test";

const { storage } = await import("../storage");
const { db } = await import("../db");
const { AuthService } = await import("../services/auth.service");
const { default: authRouter } = await import("./auth");
const { default: authVerificationRouter } = await import("./auth.verification");

const SECRET = 'connect ECONNREFUSED ep-private-host.neon.tech:5432 role "neondb_owner" password authentication failed';
const unverified = { id: "u-1", email: "pending@example.test", emailVerifiedAt: null, emailVerifiedVia: null };
(storage as any).findByEmail = async () => unverified;

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.use("/api", authRouter);
const server = http.createServer(app);
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const realError = console.error;
console.error = () => {};
test.after(() => { console.error = realError; server.close(); server.closeAllConnections?.(); });

let ip = 1;
const resend = async () => {
  const r = await fetch(`${base}/api/auth/resend-verification`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${ip >> 8}.${ip++ & 255}` }, body: JSON.stringify({ email: "pending@example.test" }) });
  const text = await r.text();
  let json: any; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, text, json, retryAfter: r.headers.get("retry-after") };
};
const chain = (rejectWith?: unknown): any => new Proxy(function () {}, {
  get: (_t, p) => (p === "then" ? (res: any, rej: any) => (rejectWith ? rej(rejectWith) : res([])) : () => chain(rejectWith)),
  apply: () => chain(rejectWith),
});
const restore = { del: (db as any).delete, ins: (db as any).insert, send: (AuthService as any).sendVerificationEmail };
test.afterEach(() => { Object.assign(db as any, { delete: restore.del, insert: restore.ins }); (AuthService as any).sendVerificationEmail = restore.send; });
const sent: string[] = [];
const mailerOk = async (email: string, token: string) => { sent.push(`${email}:${token.length}`); };
const outage = (code = "ECONNREFUSED") => Object.assign(new Error(SECRET), { code });

function assertClean(text: string) {
  for (const s of ["ECONNREFUSED", "neon.tech", "neondb_owner", "password authentication", "5432", "secret@"]) assert.ok(!text.includes(s), `leaked ${s}: ${text}`);
}

test("healthy: token deleted, token inserted, e-mail sent -> 200", async () => {
  (db as any).delete = () => chain();
  (db as any).insert = () => chain();
  (AuthService as any).sendVerificationEmail = mailerOk;
  const r = await resend();
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json, { message: "Verification email sent" });
});

test("database outage while DELETING the old token -> retryable 503 (Retry-After), fixed body, no database detail, and NO e-mail is sent", async () => {
  sent.length = 0;
  (db as any).delete = () => chain(outage());
  (db as any).insert = () => chain();
  (AuthService as any).sendVerificationEmail = mailerOk;
  const r = await resend();
  assert.equal(r.status, 503, r.text);
  assert.equal(r.retryAfter, "5");
  assert.equal(r.json.code, "SERVICE_UNAVAILABLE");
  assert.equal(r.json.retryable, true);
  assertClean(r.text);
  assert.deepEqual(sent, [], "no e-mail goes out for a token that was never stored");
});

test("database outage while INSERTING the new token -> retryable 503, no e-mail", async () => {
  sent.length = 0;
  (db as any).delete = () => chain();
  (db as any).insert = () => chain(outage("ETIMEDOUT"));
  (AuthService as any).sendVerificationEmail = mailerOk;
  const r = await resend();
  assert.equal(r.status, 503, r.text);
  assertClean(r.text);
  assert.deepEqual(sent, []);
});

test("every connectivity signature the pool can produce is a 503 (connection terminated, connect timeout, 57P01, 08006)", async () => {
  for (const e of [new Error("Connection terminated unexpectedly"), new Error("timeout exceeded when trying to connect"), outage("57P01"), outage("08006")]) {
    (db as any).delete = () => chain(e);
    (AuthService as any).sendVerificationEmail = mailerOk;
    const r = await resend();
    assert.equal(r.status, 503, `${(e as Error).message}: ${r.text}`);
  }
});

test("ordinary e-mail DELIVERY failure keeps its existing response: 500 'Failed to send verification email', never 503 -- even if the mailer error looks like a network error", async () => {
  (db as any).delete = () => chain();
  (db as any).insert = () => chain();
  for (const err of [new Error("SMTP 550 mailbox unavailable"), Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:587"), { code: "ECONNREFUSED" })]) {
    (AuthService as any).sendVerificationEmail = async () => { throw err; };
    const r = await resend();
    assert.equal(r.status, 500, r.text);
    assert.equal(r.json.error, "Failed to send verification email. Please try again later.");
    assert.equal(r.retryAfter, null);
  }
});

test("a non-connectivity database error (constraint violation / missing table) stays a generic 500 with no detail", async () => {
  (AuthService as any).sendVerificationEmail = mailerOk;
  for (const code of ["23505", "42P01"]) {
    (db as any).delete = () => chain();
    (db as any).insert = () => chain(Object.assign(new Error(`relation "email_verification_tokens" violates ${code}`), { code }));
    const r = await resend();
    assert.equal(r.status, 500, r.text);
    assert.ok(!r.text.includes("email_verification_tokens"));
  }
});

// ---- the service contract and its other callers --------------------------------------------------------------------------------------------
test("service contract: structured cause, sanitized message for database failures, original message kept for delivery failures; never throws", async () => {
  (AuthService as any).sendVerificationEmail = mailerOk;
  (db as any).delete = () => chain(outage());
  const dbDown: any = await AuthService.createAndSendVerification("u-1", "a@example.test");
  assert.equal(dbDown.success, false);
  assert.equal(dbDown.cause, "database_unavailable");
  assertClean(JSON.stringify(dbDown));

  (db as any).delete = () => chain();
  (db as any).insert = () => chain();
  (AuthService as any).sendVerificationEmail = async () => { throw new Error("SMTP 550 mailbox unavailable"); };
  const mailFail: any = await AuthService.createAndSendVerification("u-1", "a@example.test");
  assert.deepEqual({ success: mailFail.success, cause: mailFail.cause, error: mailFail.error }, { success: false, cause: "email_delivery", error: "SMTP 550 mailbox unavailable" });

  (db as any).insert = () => chain(Object.assign(new Error("boom"), { code: "23505" }));
  const other: any = await AuthService.createAndSendVerification("u-1", "a@example.test");
  assert.equal(other.cause, "unknown");

  (db as any).insert = () => chain();
  (AuthService as any).sendVerificationEmail = mailerOk;
  assert.deepEqual(await AuthService.createAndSendVerification("u-1", "a@example.test"), { success: true });
});

test("the other callers: the verification router maps an outage to 503 and delivery failure to 500", async () => {
  const vApp = express();
  vApp.use(express.json());
  vApp.use("/v", authVerificationRouter);
  const vServer = http.createServer(vApp);
  await new Promise<void>((r) => vServer.listen(0, "127.0.0.1", r));
  const vBase = `http://127.0.0.1:${(vServer.address() as AddressInfo).port}`;
  try {
    const select = (rows: unknown[]) => chain();
    void select;
    (db as any).select = () => new Proxy(function () {}, { get: (_t, p) => (p === "then" ? (res: any) => res([{ id: "u-1" }]) : () => (db as any).select()), apply: () => (db as any).select() });
    (db as any).delete = () => chain(outage());
    (AuthService as any).sendVerificationEmail = mailerOk;
    const down = await fetch(`${vBase}/v/send-email-verification`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: "u-1", email: "a@example.test" }) });
    const downText = await down.text();
    assert.equal(down.status, 503, downText);
    assertClean(downText);
    (db as any).delete = () => chain();
    (db as any).insert = () => chain();
    (AuthService as any).sendVerificationEmail = async () => { throw new Error("SMTP 550 mailbox unavailable"); };
    const mail = await fetch(`${vBase}/v/send-email-verification`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: "u-1", email: "a@example.test" }) });
    assert.equal(mail.status, 500);
  } finally { vServer.close(); vServer.closeAllConnections?.(); delete (db as any).select; }
});

test("signup: the account already exists when the token write fails, so the 201 contract is kept (no 503 that would invite a duplicate signup) and no detail leaks", async () => {
  const originalFind = (storage as any).findByEmail;
  const originalCreate = (storage as any).createUser;
  (storage as any).findByEmail = async () => undefined;
  (storage as any).createUser = async (u: any) => ({ id: "u-new", email: u.email });
  (db as any).delete = () => chain(outage());
  (AuthService as any).sendVerificationEmail = mailerOk;
  try {
    const r = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "10.77.0.1" },
      body: JSON.stringify({ firstName: "A", lastName: "B", username: "newbie", email: "new@example.test", password: "correct-horse-1" }),
    });
    const text = await r.text();
    assert.equal(r.status, 201, text);
    assert.equal(JSON.parse(text).userId, "u-new");
    assert.match(text, /Email sending is currently unavailable/);
    assertClean(text);
  } finally {
    (storage as any).findByEmail = originalFind;
    (storage as any).createUser = originalCreate;
  }
});
