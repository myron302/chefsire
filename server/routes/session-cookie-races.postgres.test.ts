/**
 * Stability Phase 2C: the client session controller driven against the REAL auth routes (real login/logout/me handlers, real JWTs, real Set-Cookie
 * headers, a real disposable PostgreSQL), through a fetch wrapper that behaves like a browser: it keeps a cookie jar, applies Set-Cookie only when
 * a response is DELIVERED, and lets the test choose the delivery order. Proves the cookie ordering with the actual server responses.
 * Needs TEST_DATABASE_URL (loopback-only); skipped otherwise.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import pg from "pg";
import bcrypt from "bcryptjs";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";
import { createScratchDatabase } from "../test-support/scratch-database";
import "../test-support/auth-test-env";

const RAW = process.env.TEST_DATABASE_URL;

if (!RAW) {
  test("session cookie races against the real auth routes (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const scratch = await createScratchDatabase(RAW, "p2c_cookie");
  const local = parseLocalTestDatabaseUrl(scratch.url);
  // The app's pool speaks Neon's WebSocket protocol; this bridge (always in "pass" mode here) lets it reach the local PostgreSQL.
  const { startFaultProxy, useNeonFaultProxy } = await import("../test-support/neon-fault-proxy");
  const bridge = await startFaultProxy({ host: local.host, port: local.port });
  useNeonFaultProxy(bridge.port);
  process.env.DATABASE_URL = scratch.url;
  process.env.NODE_ENV = "test";
  const direct = new pg.Pool({ ...local, max: 2 });
  const { getTableColumns } = await import("drizzle-orm");
  const { users } = await import("../../shared/schema");
  const cols = Object.values(getTableColumns(users)).map((c: any) =>
    c.name === "id" ? `id varchar PRIMARY KEY DEFAULT gen_random_uuid()`
      : c.name === "username" || c.name === "email" ? `${c.name} text NOT NULL UNIQUE`
      : c.name === "auth_version" ? `auth_version integer NOT NULL DEFAULT 1`
      : `${c.name} ${c.columnType === "PgTimestamp" ? "timestamp" : c.columnType === "PgBoolean" ? "boolean" : "text"}`);
  await direct.query(`CREATE TABLE users (${cols.join(",")}); CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));`);
  const hash = await bcrypt.hash("pw-correct", 4);
  for (const [id, name] of [["u-alice", "alice"], ["u-bob", "bob"]]) {
    await direct.query(`INSERT INTO users (id, username, email, password, email_verified_at, auth_version) VALUES ($1,$2,$3,$4, now(), 1)`, [id, name, `${name}@example.test`, hash]);
  }

  const { default: app } = await import("../app");
  const { createSessionController, LOGOUT_PENDING_KEY, USER_STORAGE_KEY } = await import("../../client/src/lib/session-controller");
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const realError = console.error;
  console.error = () => {};
  test.after(async () => {
    console.error = realError;
    server.close(); server.closeAllConnections?.();
    const { pool } = await import("../db");
    await pool.end().catch(() => {});
    await direct.end();
    await bridge.close();
    await scratch.drop();
  });

  let addrSeq = 1;
  type Held = { label: string; deliver: (mode?: "ok" | "network") => void };
  function browser(opts: { cookie?: string | null; logoutPending?: boolean } = {}) {
    const jar = { cookie: opts.cookie ?? null as string | null };
    const store = new Map<string, string>();
    if (opts.logoutPending) store.set(LOGOUT_PENDING_KEY, "1");
    const held: Held[] = [];
    const mangle = { next: null as null | "truncated" | "html" | "no-user" | "proxy-page-no-cookie" };
    const sent: string[] = [];
    const delivered: string[] = [];
    const applySetCookie = (res: Response) => {
      for (const line of res.headers.getSetCookie()) {
        const [pair, ...attrs] = line.split(";").map((x) => x.trim());
        const [name, value] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
        if (name !== "auth_token") continue;
        const expired = value === "" || attrs.some((a) => /^max-age=0$/i.test(a) || /^expires=.*1970/i.test(a));
        jar.cookie = expired ? null : value;
      }
    };
    const fetchFn = (async (url: string, init: RequestInit = {}) => {
      const isMutation = url.endsWith("/login") || url.endsWith("/logout");
      sent.push(url.replace("/api/auth/", ""));
      // Each request comes from a distinct client address so the real per-IP login rate limiter (10/window) does not interfere with these scenarios.
      const headers = { ...(init.headers as Record<string, string> | undefined), ...(jar.cookie ? { cookie: `auth_token=${jar.cookie}` } : {}), "x-forwarded-for": `10.${(addrSeq >> 8) & 255}.${addrSeq & 255}.7` };
      addrSeq += 1;
      const real = await fetch(base + url, { ...init, headers, redirect: "manual" });
      let body = await real.text();
      let skipCookie = false; // a gateway page that replaced the login response: the real Set-Cookie never reached the browser
      if (url.endsWith("/login") && real.ok && mangle.next) {
        // The server really logged this user in and really sent Set-Cookie; the body that reaches the page is unusable.
        if (mangle.next === "proxy-page-no-cookie") skipCookie = true;
        body = mangle.next === "proxy-page-no-cookie" ? "<html>502 Bad Gateway</html>" : mangle.next === "truncated" ? body.slice(0, Math.floor(body.length / 2)) : mangle.next === "html" ? "<html>502</html>" : JSON.stringify({ success: true });
        mangle.next = null;
      }
      const rebuilt = () => new Response(body, { status: real.status, headers: real.headers });
      if (!isMutation) { applySetCookie(real); return rebuilt(); }
      return new Promise<Response>((resolve, reject) => {
        // The server HAS processed the request; the browser only sees the response (and its Set-Cookie) when it is delivered.
        init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
        held.push({ label: url.replace("/api/auth/", ""), deliver: (mode = "ok") => {
          if (mode === "network") return reject(new TypeError("Failed to fetch"));
          if (!skipCookie) applySetCookie(real);
          delivered.push(`${url.replace("/api/auth/", "")}:${real.status}`);
          resolve(rebuilt());
        } });
      });
    }) as typeof fetch;
    const controller = createSessionController<{ id: string; email: string; username?: string }>({
      fetch: fetchFn,
      storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) },
      getLocation: () => ({ pathname: "/", search: "", hash: "" }),
      replaceUrl: () => {},
      sleep: () => new Promise(() => {}),
      mutationDeadline: () => new Promise(() => {}),
      parseUser: (p: any) => { if (!p?.id || !p?.email) throw new Error("incomplete"); return p; },
      onChange: () => {},
    });
    const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 15)); };
    /** Who does the REAL server say the jar's cookie belongs to? */
    const serverView = async () => {
      const res = await fetch(base + "/api/auth/me", { headers: jar.cookie ? { cookie: `auth_token=${jar.cookie}` } : {} });
      return res.status === 200 ? ((await res.json()) as { user: { id: string } }).user.id : null;
    };
    const assertSynchronized = async (label: string) => {
      const authoritative = await serverView();
      assert.equal(controller.getState().user?.id ?? null, authoritative, `${label}: UI vs server session`);
      assert.equal(JSON.parse(store.get(USER_STORAGE_KEY) ?? "null")?.id ?? null, authoritative, `${label}: localStorage vs server session`);
    };
    return { jar, store, held, sent, delivered, controller, flush, serverView, assertSynchronized, mangle };
  }
  const login = (b: ReturnType<typeof browser>, who: string, pw = "pw-correct") => b.controller.login(`${who}@example.test`, pw);

  test("real server: Login A then Login B (A's response would be last) -> the jar, the UI and the SERVER's view all say Bob", async () => {
    const b = browser();
    const a = login(b, "alice");
    await b.flush();
    const bb = login(b, "bob");
    await b.flush();
    assert.deepEqual(b.sent, ["login"], "B is not sent while A is in flight");
    b.held[0].deliver();
    assert.equal((await a).ok, false);
    await b.flush();
    assert.deepEqual(b.sent, ["login", "login"]);
    b.held[1].deliver();
    assert.deepEqual(await bb, { ok: true });
    await b.flush();
    assert.equal(await b.serverView(), "u-bob");
    await b.assertSynchronized("A,B");
  });

  test("real server: Login A, logout, Login B -> Bob's cookie survives every response; the real logout Set-Cookie sits between them", async () => {
    const b = browser();
    const a = login(b, "alice");
    await b.flush();
    const out = b.controller.logout();
    const bb = login(b, "bob");
    await b.flush();
    b.held[0].deliver(); // Alice's real Set-Cookie
    await a;
    await b.flush();
    assert.equal(await b.serverView(), "u-alice", "the stale login's cookie is briefly real");
    b.held[1].deliver(); // the real logout's clearing Set-Cookie
    await out;
    await b.flush();
    assert.equal(b.jar.cookie, null);
    b.held[2].deliver();
    assert.deepEqual(await bb, { ok: true });
    await b.flush();
    assert.deepEqual(b.sent, ["login", "logout", "login"]);
    assert.equal(await b.serverView(), "u-bob");
    await b.assertSynchronized("A,logout,B");
  });

  test("real server: stale Login A succeeded and Login B is REJECTED (wrong password) -> the leftover Alice session is removed; everything says signed out", async () => {
    const b = browser();
    const a = login(b, "alice");
    await b.flush();
    const bb = login(b, "bob", "wrong");
    await b.flush();
    b.held[0].deliver();
    await a;
    await b.flush();
    assert.equal(await b.serverView(), "u-alice");
    b.held[1].deliver(); // 401 for B
    await b.flush();
    b.held[2].deliver(); // the cleanup logout
    assert.equal((await bb).ok, false);
    await b.flush();
    assert.deepEqual(b.sent, ["login", "login", "logout"]);
    assert.equal(await b.serverView(), null);
    await b.assertSynchronized("A ok, B rejected");
  });

  test("real server: logout fails (network) while a login is pending -> intent kept; the lingering real cookie is NOT used to restore the user on reload; the retry clears it", async () => {
    const b = browser();
    const a = login(b, "alice");
    await b.flush();
    const out = b.controller.logout();
    b.held[0].deliver();
    await a;
    await b.flush();
    b.held[1].deliver("network");
    await out;
    await b.flush();
    assert.equal(b.controller.getState().user, null);
    assert.equal(await b.serverView(), "u-alice", "the real session still exists server-side");
    assert.equal(b.store.get(LOGOUT_PENDING_KEY), "1");
    const reload = browser({ cookie: b.jar.cookie, logoutPending: true });
    reload.controller.start();
    await reload.flush();
    assert.equal(reload.controller.getState().user, null);
    assert.deepEqual(reload.sent, ["logout"], "no /me: nothing restored from the cookie");
    reload.held[0].deliver();
    await reload.flush();
    assert.equal(await reload.serverView(), null);
    assert.equal(reload.store.has(LOGOUT_PENDING_KEY), false);
  });

  for (const kind of ["truncated", "html", "no-user"] as const) {
    test(`real server, account switching: Alice is signed in, Bob's real login answers 200 with a ${kind} body -> the REAL /me identity (Bob) replaces Alice; never Alice with Bob's cookie`, async () => {
      // Sign Alice in for real, through the controller.
      const b = browser();
      const first = login(b, "alice");
      await b.flush();
      b.held[0].deliver();
      assert.deepEqual(await first, { ok: true });
      await b.flush();
      assert.equal(b.controller.getState().user?.id, "u-alice");
      // Now Bob, with the body mangled in transit.
      b.mangle.next = kind;
      const second = login(b, "bob");
      await b.flush();
      b.held[1].deliver();
      assert.deepEqual(await second, { ok: true });
      await b.flush();
      assert.equal(b.jar.cookie !== null, true);
      assert.equal(await b.serverView(), "u-bob");
      assert.equal(b.controller.getState().user?.id, "u-bob");
      await b.assertSynchronized(`switch(${kind})`);
      assert.deepEqual(b.sent, ["login", "login", "me"], "exactly one authoritative read to reconcile");
    });
  }

  test("real server, Codex P2: Alice is signed in; Bob's login is swallowed by a gateway page (200, no Set-Cookie) -> reconciliation returns ALICE -> Bob's login FAILS and Alice's real session stays displayed", async () => {
    const b = browser();
    const first = login(b, "alice");
    await b.flush();
    b.held[0].deliver();
    assert.deepEqual(await first, { ok: true });
    await b.flush();
    b.mangle.next = "proxy-page-no-cookie";
    const second = login(b, "bob");
    await b.flush();
    b.held[1].deliver();
    const result = await second;
    await b.flush();
    assert.equal(result.ok, false, "never a success for Bob");
    assert.equal(await b.serverView(), "u-alice");
    assert.equal(b.controller.getState().user?.id, "u-alice");
    await b.assertSynchronized("gateway page");
    assert.deepEqual(b.sent, ["login", "login", "me"], "one authoritative read, no logout");
  });
}
