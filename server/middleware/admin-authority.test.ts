/**
 * Security regression tests for admin authorization (P1-08).
 *
 * The defect these lock down: `requireAdmin` compared INTERNAL_ADMIN_EMAILS against
 * `req.user.email`, which `requireAuth` copies straight out of the JWT payload. A token carrying
 * an administrator's address was therefore an administrator, and a token minted while an address
 * still qualified stayed an administrator after the account changed.
 *
 * These run the real `requireAuth` + `requireAdmin` pair over real HTTP, with only the `storage`
 * singleton replaced by an in-memory world — so anything that reaches the fake database is
 * something the middleware actually allowed. Tokens are signed the way the application signs them.
 */
import { TEST_JWT_SECRET } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { requireAdmin, requireAuth } from "./auth";

const ADMIN_EMAIL = "ops@chefsire.test";
const NORMAL_EMAIL = "cook@chefsire.test";

/* ------------------------------------------------------------------ the world */

type UserRecord = { id: string; email: string; username: string };

let world: Record<string, UserRecord> = {};

function seedWorld() {
  world = {
    // A: an ordinary account.
    A: { id: "A", email: NORMAL_EMAIL, username: "a" },
    // ADM: an account whose *current stored* address is on the allowlist.
    ADM: { id: "ADM", email: ADMIN_EMAIL, username: "adm" },
  };
}

// `requireAuth` hydrates the nutrition-trial fields from the db module directly; `requireAdmin`
// reads the authoritative account through `storage`. Replacing `storage.getUser` is the seam that
// decides admin authority, which is exactly what these tests are about.
Object.assign(storage as any, {
  async getUser(id: string) {
    return world[id];
  },
  async findById(id: string) {
    return world[id];
  },
});

/* -------------------------------------------------------------------- the app */

const app = express();
app.get("/admin/thing", requireAuth, requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

let server: ReturnType<typeof app.listen> | null = null;
let baseUrl = "";

async function listen() {
  if (server) return;
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server!.address();
  if (typeof address === "object" && address) baseUrl = `http://127.0.0.1:${address.port}`;
}

test.after(() => {
  server?.close();
});

/**
 * INTERNAL_ADMIN_EMAILS is read per request, so each case sets it for the duration of that case
 * and restores whatever was there before — no cross-test leakage.
 */
async function withAdminAllowlist<T>(value: string | undefined, body: () => Promise<T>): Promise<T> {
  const previous = process.env.INTERNAL_ADMIN_EMAILS;
  if (value === undefined) delete process.env.INTERNAL_ADMIN_EMAILS;
  else process.env.INTERNAL_ADMIN_EMAILS = value;
  try {
    return await body();
  } finally {
    if (previous === undefined) delete process.env.INTERNAL_ADMIN_EMAILS;
    else process.env.INTERNAL_ADMIN_EMAILS = previous;
  }
}

const token = (claims: Record<string, unknown>, options: jwt.SignOptions = { expiresIn: "5m" }) =>
  jwt.sign(claims, TEST_JWT_SECRET, { algorithm: "HS256", ...options });

async function callAdminRoute(bearer: string | null) {
  await listen();
  seedWorld();
  return fetch(`${baseUrl}/admin/thing`, {
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
  });
}

/* --------------------------------------------------------------------- cases */

test("an anonymous request is rejected before admin authority is even considered", async () => {
  const response = await withAdminAllowlist(ADMIN_EMAIL, () => callAdminRoute(null));
  assert.equal(response.status, 401);
});

test("a normal authenticated user is denied the admin route", async () => {
  const response = await withAdminAllowlist(ADMIN_EMAIL, () =>
    callAdminRoute(token({ id: "A", email: NORMAL_EMAIL, username: "a" })),
  );
  assert.equal(response.status, 403);
});

test("a legitimate current admin is allowed", async () => {
  const response = await withAdminAllowlist(ADMIN_EMAIL, () =>
    callAdminRoute(token({ id: "ADM", email: ADMIN_EMAIL, username: "adm" })),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("a forged admin email claim does not grant authority to a normal account", async () => {
  // Correctly signed — this is the post-repair world where the attacker has a valid token for
  // their own account — but the payload lies about who they are.
  const response = await withAdminAllowlist(ADMIN_EMAIL, () =>
    callAdminRoute(token({ id: "A", email: ADMIN_EMAIL, username: "adm" })),
  );
  assert.equal(response.status, 403);
});

test("a stale admin claim is denied once the stored account no longer qualifies", async () => {
  const staleToken = token({ id: "ADM", email: ADMIN_EMAIL, username: "adm" });

  const stillAdmin = await withAdminAllowlist(ADMIN_EMAIL, () => callAdminRoute(staleToken));
  assert.equal(stillAdmin.status, 200, "precondition: the token works while the account qualifies");

  // The account's authoritative address changes to something that is not on the allowlist.
  const demoted = await withAdminAllowlist(ADMIN_EMAIL, async () => {
    await listen();
    seedWorld();
    world.ADM.email = "former-admin@chefsire.test";
    return fetch(`${baseUrl}/admin/thing`, { headers: { authorization: `Bearer ${staleToken}` } });
  });
  assert.equal(demoted.status, 403);
});

test("a stale admin claim is denied once the allowlist no longer names the account", async () => {
  const staleToken = token({ id: "ADM", email: ADMIN_EMAIL, username: "adm" });
  const response = await withAdminAllowlist("someone-else@chefsire.test", () => callAdminRoute(staleToken));
  assert.equal(response.status, 403);
});

test("a token for a deleted account is denied", async () => {
  const response = await withAdminAllowlist(ADMIN_EMAIL, async () => {
    await listen();
    seedWorld();
    delete world.ADM;
    return fetch(`${baseUrl}/admin/thing`, {
      headers: { authorization: `Bearer ${token({ id: "ADM", email: ADMIN_EMAIL })}` },
    });
  });
  assert.equal(response.status, 403);
});

test("a token signed with the publicly known fallback is not accepted when a real secret is configured", async () => {
  // The historical attack: mint a token with the committed fallback secret. It only works here if
  // the run's own secret happens to be that fallback, so assert against a *different* secret to
  // stand in for a production deployment with a real one.
  const forged = jwt.sign({ id: "ADM", email: ADMIN_EMAIL }, "a-different-production-secret-0123456789", {
    algorithm: "HS256",
    expiresIn: "5m",
  });
  const response = await withAdminAllowlist(ADMIN_EMAIL, () => callAdminRoute(forged));
  assert.equal(response.status, 401);
});

test("a tampered token is rejected", async () => {
  const valid = token({ id: "A", email: NORMAL_EMAIL });
  const [header, payload, signature] = valid.split(".");
  const tamperedPayload = Buffer.from(
    JSON.stringify({ id: "ADM", email: ADMIN_EMAIL, exp: Math.floor(Date.now() / 1000) + 300 }),
  )
    .toString("base64url")
    .replace(/=+$/, "");
  const response = await withAdminAllowlist(ADMIN_EMAIL, () =>
    callAdminRoute(`${header}.${tamperedPayload}.${signature}`),
  );
  assert.equal(response.status, 401);
});

test("an expired admin token is rejected", async () => {
  const response = await withAdminAllowlist(ADMIN_EMAIL, () =>
    callAdminRoute(token({ id: "ADM", email: ADMIN_EMAIL }, { expiresIn: -1 })),
  );
  assert.equal(response.status, 401);
});

test("an empty or unset allowlist grants nobody admin authority", async () => {
  for (const allowlist of [undefined, "", "  ,  , "]) {
    const response = await withAdminAllowlist(allowlist, () =>
      callAdminRoute(token({ id: "ADM", email: ADMIN_EMAIL })),
    );
    assert.equal(response.status, 403, `allowlist ${JSON.stringify(allowlist)} must grant nothing`);
  }
});

test("allowlist entries are trimmed and matched case-insensitively", async () => {
  const response = await withAdminAllowlist(`  , OPS@CheFSire.TEST ,,`, () =>
    callAdminRoute(token({ id: "ADM", email: ADMIN_EMAIL })),
  );
  assert.equal(response.status, 200);
});
