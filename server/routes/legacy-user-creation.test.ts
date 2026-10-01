/**
 * CS-CL-04 -- the legacy unauthenticated `POST /api/users` account-creation route is retired.
 *
 * It stored the caller's password unhashed, returned the whole created row, and bypassed canonical signup's
 * validation, email verification and rate limiter. Driven over real HTTP with the same mounting as routes/index.ts
 * (`/api` -> auth router, `/api/users` -> users router). `storage` is stubbed and records what reaches persistence.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://legacy-user-creation-tests/none";

const { storage } = await import("../storage");
const { AuthService } = await import("../services/auth.service");

const rows: any[] = [];
const created: any[] = [];
let verificationCalls: Array<[string, string]> = [];

(storage as any).findByEmail = async (email: string) => rows.find((r) => r.email === email);
// Returns a WIDER row than any route should serialize, to prove nothing serializes a persistence result wholesale.
(storage as any).createUser = async (input: any) => {
  created.push(input);
  const row = {
    id: `user-${created.length}`,
    ...input,
    verificationToken: "verification-token-secret",
    resetToken: "reset-token-secret",
  };
  rows.push(row);
  return row;
};
(AuthService as any).createAndSendVerification = async (id: string, email: string) => {
  verificationCalls.push([id, email]);
  return { success: true };
};

const authRouter = (await import("./auth")).default;
const usersRouter = (await import("./users")).default;

const app = express();
app.use(express.json());
const api = express.Router();
api.use(authRouter);
api.use("/users", usersRouter);
app.use("/api", api);
const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", () => resolve()));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => server.close());

async function post(path: string, body: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, text };
}

const PLAINTEXT = "plaintext-secret";

test("POST /api/users cannot create an account and returns no credential material", async () => {
  const before = created.length;
  for (const body of [
    { email: "victim@example.com", password: PLAINTEXT },
    { username: "victim", email: "victim@example.com", password: PLAINTEXT },
    { id: "attacker-chosen-id", username: "v", email: "victim@example.com", password: PLAINTEXT, isChef: true },
  ]) {
    const response = await post("/api/users", body);
    assert.ok([404, 405, 410].includes(response.status), `status ${response.status}`);
    assert.doesNotMatch(response.text, /plaintext-secret|password|hash|token/i);
  }
  assert.equal(created.length, before);
  assert.equal(rows.some((r) => r.email === "victim@example.com"), false);
  // Trailing-slash alias too.
  assert.ok([404, 405, 410].includes((await post("/api/users/", { email: "victim@example.com", password: PLAINTEXT })).status));
});

test("the users router declares no POST handler for account creation", () => {
  const source = readFileSync(new URL("./users.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\br\.post\(\s*["']\/["']/);
  assert.doesNotMatch(source, /createUser\(/);
});

test("canonical signup still creates the account, hashes the password and returns no credentials", async () => {
  const response = await post("/api/auth/signup", {
    firstName: "A",
    lastName: "B",
    username: "canon",
    email: "Canon@Example.com",
    password: PLAINTEXT,
  });
  assert.equal(response.status, 201);
  const stored = created.at(-1);
  assert.equal(stored.email, "canon@example.com");
  assert.notEqual(stored.password, PLAINTEXT);
  assert.equal(typeof stored.password, "string");
  assert.equal(await bcrypt.compare(PLAINTEXT, stored.password), true);
  assert.equal(stored.emailVerifiedAt, null);
  // The stub's persistence result carried verification/reset tokens and the hash; none may be serialized.
  assert.doesNotMatch(response.text, new RegExp(`${PLAINTEXT}|password|hash|token|\\$2[aby]\\$`, "i"));
  assert.deepEqual(Object.keys(JSON.parse(response.text)).sort(), ["message", "userId"]);
  assert.deepEqual(verificationCalls.at(-1), [stored.id ?? "user-" + created.length, "Canon@Example.com"]);
});

test("canonical signup keeps duplicate-email and validation behavior", async () => {
  const before = created.length;
  const duplicate = await post("/api/auth/signup", {
    firstName: "A", lastName: "B", username: "other", email: "canon@example.com", password: PLAINTEXT,
  });
  assert.equal(duplicate.status, 400);
  assert.equal(JSON.parse(duplicate.text).error, "Email already registered");
  const invalid = await post("/api/auth/signup", { email: "x@example.com" });
  assert.equal(invalid.status, 400);
  assert.equal(created.length, before);
  assert.doesNotMatch(duplicate.text + invalid.text, /plaintext-secret|\$2[aby]\$/);
});

test("signup route is still rate limited and verification is issued", () => {
  const source = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
  assert.match(source, /router\.post\("\/auth\/signup", signupLimiter/);
  assert.equal(verificationCalls.length >= 1, true);
});
