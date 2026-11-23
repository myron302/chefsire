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
import "../test-support/accept-test-sessions";
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

const asUser = (id: string) => ({ Authorization: `Bearer ${signAuthToken({ id, av: 1 })}` });

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

test("nobody can delete an account at all while permanent closure is off", async () => {
  // The hard delete is GONE, not merely gated. It removed the users row, and the references reaching it cascade
  // into shared content and ledgers ChefSire has to keep, so the route now refuses unconditionally before reading
  // anything -- a slow or missing ledger cannot turn that refusal into a 409 or a 500. This test used to assert a
  // 200 and a deleted:true body; asserting that today would be asserting a feature that was deliberately removed.
  //
  // What is worth proving instead is the property the refusal exists for: NOTHING reaches the storage layer.
  given();
  const result = await send("DELETE", `/api/users/${OWNER}`, undefined, asUser(OWNER));
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "PERMANENT_CLOSURE_DISABLED");
  assert.deepEqual(deleteCalls, [], "no deletion may reach storage by any path");
});

test("an account cannot delete another account", async () => {
  given();
  const result = await send("DELETE", `/api/users/${VICTIM}`, undefined, asUser(OWNER));
  assert.equal(result.status, 403);
  assert.match(result.body.message, /only delete your own account/i);
  assert.deepEqual(deleteCalls, [], "the victim's account was never touched");
});

test("a forged body userId cannot redirect the refusal onto another account", async () => {
  // The ownership check still runs FIRST, before the refusal, which is what keeps the endpoint from being used to
  // probe other accounts: your own id answers 503, someone else's answers 403, and the two never swap.
  given();
  const result = await send("DELETE", `/api/users/${OWNER}`, { userId: VICTIM, id: VICTIM }, asUser(OWNER));
  assert.equal(result.status, 503, "the body cannot turn this into someone else's request");
  assert.deepEqual(deleteCalls, [], "nothing reached storage");
});

test("a forged query userId cannot redirect the refusal onto another account", async () => {
  given();
  const result = await send("DELETE", `/api/users/${OWNER}?userId=${VICTIM}`, undefined, asUser(OWNER));
  assert.equal(result.status, 503);
  assert.deepEqual(deleteCalls, [], "nothing reached storage");
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
  assert.equal(own.status, 503, "the header does not make this the victim's request either");
  assert.deepEqual(deleteCalls, []);
});

// The three tests below once covered the hard delete's failure modes: 404 for a missing account, 500 when the
// delete returned false, 500 when it threw a foreign-key violation. None of those paths can run now, because the
// route refuses BEFORE reading anything.
//
// That ordering is the whole safety property, and it is worth testing directly rather than deleting the coverage:
// the route's own comment promises that "a ledger that is slow or missing cannot turn the refusal into a 409 or a
// 500". So each case now asserts that the condition which used to produce another status still produces 503, and
// still never reaches storage. That is a stronger claim than the originals made.

test("a missing account does not turn the refusal into a 404", async () => {
  given();
  existingUsers = [];
  const result = await send("DELETE", `/api/users/${OWNER}`, undefined, asUser(OWNER));
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "PERMANENT_CLOSURE_DISABLED");
  assert.deepEqual(deleteCalls, [], "a lookup never happened, so its outcome cannot change the answer");
});

test("a storage layer that would fail does not turn the refusal into a 500", async () => {
  given();
  deleteResult = false;
  const result = await send("DELETE", `/api/users/${OWNER}`, undefined, asUser(OWNER));
  assert.equal(result.status, 503);
  assert.deepEqual(deleteCalls, [], "storage was never asked, so it cannot fail");
});

test("a storage layer that would throw does not turn the refusal into a 500", async () => {
  given();
  let reached = false;
  (storage as any).deleteUser = async (id: string) => {
    reached = true;
    deleteCalls.push(id);
    const error: any = new Error("update or delete on table \"users\" violates foreign key constraint");
    error.code = "23503";
    throw error;
  };
  const result = await send("DELETE", `/api/users/${OWNER}`, undefined, asUser(OWNER));
  assert.equal(result.status, 503);
  assert.equal(reached, false, "the refusal comes before anything that could throw");
  assert.deepEqual(deleteCalls, []);
  (storage as any).deleteUser = async (id: string) => {
    deleteCalls.push(id);
    return deleteResult;
  };
});
