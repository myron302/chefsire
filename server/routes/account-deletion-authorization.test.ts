/**
 * DELETE /api/users/:id -- the authenticated self-account-deletion route, driven over real HTTP.
 *
 * P2-03 gave `storage.deleteUser` real work to do (clear the account's remix engagement and repair
 * the counters it backed, transactionally). This suite covers the other half: that giving it that
 * work changed nothing about WHO may invoke it. The authorization boundary here is narrow -- an
 * account may delete only itself -- and it is decided from the verified token, never from anything
 * the request carries.
 *
 * `storage` is a singleton, so the two methods the handler calls are stubbed and recorded. That is
 * deliberate: what is under test is the route's gate and the identity it passes down, not the
 * deletion mechanics, which are exercised against a real PostgreSQL server in
 * server/lib/remix-engagement-cleanup.test.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import type { AddressInfo } from "node:net";
import { signAuthToken } from "../lib/jwt-config";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://account-deletion-tests/none";

const { storage } = await import("../storage");

const OWNER = "owner-user-id";
const VICTIM = "victim-user-id";

/** Every deleteUser call the route made, in order. */
let deleteCalls: string[] = [];
let existingUsers: string[] = [];
let deleteResult = true;

(storage as any).getUser = async (id: string) =>
  existingUsers.includes(id) ? { id, username: `user-${id}` } : undefined;
(storage as any).deleteUser = async (id: string) => {
  deleteCalls.push(id);
  return deleteResult;
};

const usersRouter = (await import("./users")).default;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/users", usersRouter);
const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", () => resolve()));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => server.close());

const asUser = (id: string) => ({ Authorization: `Bearer ${signAuthToken({ id })}` });

function given() {
  deleteCalls = [];
  existingUsers = [OWNER, VICTIM];
  deleteResult = true;
}

async function send(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

test("an anonymous request cannot delete an account", async () => {
  given();
  const result = await send("DELETE", `/api/users/${OWNER}`);
  assert.equal(result.status, 401);
  assert.deepEqual(deleteCalls, [], "nothing reached the storage layer");
});

test("an account may delete itself", async () => {
  given();
  const result = await send("DELETE", `/api/users/${OWNER}`, undefined, asUser(OWNER));
  assert.equal(result.status, 200);
  assert.equal(result.body.deleted, true);
  assert.deepEqual(deleteCalls, [OWNER]);
});

test("an account cannot delete another account", async () => {
  given();
  const result = await send("DELETE", `/api/users/${VICTIM}`, undefined, asUser(OWNER));
  assert.equal(result.status, 403);
  assert.match(result.body.message, /only delete your own account/i);
  assert.deepEqual(deleteCalls, [], "the victim's account was never touched");
});

test("a forged body userId cannot redirect the deletion", async () => {
  given();
  const result = await send("DELETE", `/api/users/${OWNER}`, { userId: VICTIM, id: VICTIM }, asUser(OWNER));
  assert.equal(result.status, 200);
  assert.deepEqual(deleteCalls, [OWNER], "the token's account is the one deleted");
});

test("a forged query userId cannot redirect the deletion", async () => {
  given();
  const result = await send("DELETE", `/api/users/${OWNER}?userId=${VICTIM}`, undefined, asUser(OWNER));
  assert.equal(result.status, 200);
  assert.deepEqual(deleteCalls, [OWNER]);
});

test("a forged x-user-id header cannot redirect or authorize the deletion", async () => {
  given();
  // Claiming to be the victim does not let OWNER delete them...
  const impersonation = await send("DELETE", `/api/users/${VICTIM}`, undefined, {
    ...asUser(OWNER),
    "x-user-id": VICTIM,
  });
  assert.equal(impersonation.status, 403);
  assert.deepEqual(deleteCalls, []);

  // ...and it does not redirect a legitimate self-deletion either.
  const own = await send("DELETE", `/api/users/${OWNER}`, undefined, {
    ...asUser(OWNER),
    "x-user-id": VICTIM,
  });
  assert.equal(own.status, 200);
  assert.deepEqual(deleteCalls, [OWNER]);
});

test("deleting an account that does not exist is a 404, not a silent success", async () => {
  given();
  existingUsers = [];
  const result = await send("DELETE", `/api/users/${OWNER}`, undefined, asUser(OWNER));
  assert.equal(result.status, 404);
  assert.deepEqual(deleteCalls, []);
});

test("a failed deletion is reported, not dressed up as success", async () => {
  given();
  deleteResult = false;
  const result = await send("DELETE", `/api/users/${OWNER}`, undefined, asUser(OWNER));
  assert.equal(result.status, 500);
  assert.equal(result.body.deleted, undefined);
});

test("a deletion that throws surfaces as a 500 rather than a partial success", async () => {
  given();
  (storage as any).deleteUser = async (id: string) => {
    deleteCalls.push(id);
    // What a rolled-back transaction looks like from here: a concurrent like committed first and the
    // foreign key refused the account delete.
    const error: any = new Error("update or delete on table \"users\" violates foreign key constraint");
    error.code = "23503";
    throw error;
  };
  const result = await send("DELETE", `/api/users/${OWNER}`, undefined, asUser(OWNER));
  assert.equal(result.status, 500);
  assert.equal(result.body.deleted, undefined);
  assert.deepEqual(deleteCalls, [OWNER]);
  // Restore for any later test.
  (storage as any).deleteUser = async (id: string) => {
    deleteCalls.push(id);
    return deleteResult;
  };
});
