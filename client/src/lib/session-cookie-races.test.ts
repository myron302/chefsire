/**
 * Stability Phase 2C: login / logout / verification races at the BROWSER<->SERVER boundary.
 *
 * The session lives in one cookie jar. What decides the final cookie is the ORDER IN WHICH RESPONSES (with their Set-Cookie) ARE DELIVERED,
 * and a client cannot reorder responses it has already requested. These tests therefore model the boundary explicitly: a fake server whose
 * login/logout responses are delivered when the TEST says so, and whose Set-Cookie takes effect in the jar at delivery. After every scenario the
 * invariant is checked: the cookie, the controller's user and localStorage all name the same session.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createSessionController, LOGOUT_PENDING_KEY, USER_STORAGE_KEY } from "./session-controller";

type U = { id: string; email: string };
const USERS: Record<string, U> = {
  "a@example.test": { id: "alice", email: "a@example.test" },
  "b@example.test": { id: "bob", email: "b@example.test" },
  "c@example.test": { id: "carol", email: "c@example.test" },
  "d@example.test": { id: "dave", email: "d@example.test" },
};
const parseUser = (p: unknown): U => { if (!p || typeof p !== "object" || !("id" in p) || !("email" in p)) throw new Error("incomplete"); return p as U; };

type Pending = { n: number; email?: string; deliver: (outcome?: "ok" | "reject" | "network") => void };

function site(opts: { cookie?: string | null; stored?: U | null; logoutPending?: boolean; url?: string; deadline?: boolean } = {}) {
  const jar = { cookie: opts.cookie ?? null as string | null };
  const store = new Map<string, string>();
  if (opts.stored) store.set(USER_STORAGE_KEY, JSON.stringify(opts.stored));
  if (opts.logoutPending) store.set(LOGOUT_PENDING_KEY, "1");
  let loc = new URL(opts.url ?? "https://app.test/");
  /** Everything the browser sent, in order. */
  const sent: string[] = [];
  /** Everything the browser RECEIVED (cookie jar changes happen here), in order. */
  const delivered: string[] = [];
  const logins: Pending[] = [];
  const logouts: Pending[] = [];
  const meScript: Array<number> = [];
  const sleeps: Array<() => void> = [];
  const deadlines: Array<() => void> = [];
  let loginN = 0, logoutN = 0;

  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    if (url === "/api/auth/me") {
      sent.push("me");
      const forced = meScript.shift();
      if (forced && forced !== 200) return new Response("{}", { status: forced });
      if (!jar.cookie) return new Response("{}", { status: 401 });
      const user = Object.values(USERS).find((u) => u.id === jar.cookie)!;
      return new Response(JSON.stringify({ success: true, user }), { status: 200 });
    }
    if (url === "/api/auth/login") {
      const email = JSON.parse(String(init.body)).email as string;
      const n = ++loginN;
      sent.push(`login#${n}:${email}`);
      return new Promise<Response>((resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
        logins.push({ n, email, deliver: (outcome = "ok") => {
          if (outcome === "network") return reject(new TypeError("Failed to fetch"));
          if (outcome === "reject") { delivered.push(`login#${n}:401`); return resolve(new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 })); }
          jar.cookie = USERS[email].id; // Set-Cookie takes effect when the response is delivered
          delivered.push(`login#${n}:200 cookie=${jar.cookie}`);
          resolve(new Response(JSON.stringify({ success: true, user: USERS[email] }), { status: 200 }));
        } });
      });
    }
    if (url === "/api/auth/logout") {
      const n = ++logoutN;
      sent.push(`logout#${n}`);
      return new Promise<Response>((resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
        logouts.push({ n, deliver: (outcome = "ok") => {
          if (outcome === "network") return reject(new TypeError("Failed to fetch"));
          jar.cookie = null; // Set-Cookie: auth_token=; Max-Age=0
          delivered.push(`logout#${n}:200 cookie=null`);
          resolve(new Response("{}", { status: 200 }));
        } });
      });
    }
    throw new Error(`unexpected request ${url}`);
  }) as unknown as typeof fetch;

  const controller = createSessionController<U>({
    fetch: fetchFn,
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) },
    getLocation: () => ({ pathname: loc.pathname, search: loc.search, hash: loc.hash }),
    replaceUrl: (u) => { loc = new URL(u, loc); },
    sleep: (_ms, signal) => new Promise<void>((resolve) => { if (signal.aborted) return resolve(); const done = () => resolve(); signal.addEventListener("abort", done, { once: true }); sleeps.push(done); }),
    mutationDeadline: (_ms, signal) => new Promise<void>((resolve) => { if (signal.aborted) return resolve(); const done = () => resolve(); signal.addEventListener("abort", done, { once: true }); deadlines.push(done); }),
    parseUser,
    onChange: () => {},
  } as never);

  const flush = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };
  const cached = () => JSON.parse(store.get(USER_STORAGE_KEY) ?? "null") as U | null;
  /** The three views of "who am I" must agree. */
  const assertSynchronized = (label = "") => {
    const ui = controller.getState().user;
    assert.equal(ui?.id ?? null, jar.cookie, `${label} UI user vs cookie`);
    assert.equal(cached()?.id ?? null, jar.cookie, `${label} localStorage vs cookie`);
  };
  return { jar, store, controller, sent, delivered, logins, logouts, meScript, sleeps, deadlines, flush, cached, assertSynchronized, url: () => loc.pathname + loc.search + loc.hash };
}

test("Login A starts, then Login B starts; A's response is the one that would arrive last: B is not even sent until A is delivered, so A's Set-Cookie can never overwrite B's", async () => {
  const s = site();
  const a = s.controller.login("a@example.test", "pw");
  await s.flush();
  const b = s.controller.login("b@example.test", "pw");
  await s.flush();
  assert.deepEqual(s.sent, ["login#1:a@example.test"], "B waits for A: cookie-changing requests are serialized");
  s.logins[0].deliver("ok");
  assert.deepEqual(await a, { ok: false, error: "Sign-in was superseded by a newer request." }, "A's result is not applied");
  assert.equal(s.controller.getState().user, null, "A is never displayed");
  await s.flush();
  assert.deepEqual(s.sent, ["login#1:a@example.test", "login#2:b@example.test"]);
  s.logins[1].deliver("ok");
  assert.deepEqual(await b, { ok: true });
  await s.flush();
  assert.equal(s.jar.cookie, "bob");
  assert.equal(s.controller.getState().user?.id, "bob");
  s.assertSynchronized();
  assert.ok(!s.sent.some((x) => x.startsWith("logout")), "no cleanup logout was needed or sent");
});

test("Login A starts, logout, then Login B succeeds: order of requests is A, logout, B; B's cookie survives", async () => {
  const s = site();
  const a = s.controller.login("a@example.test", "pw");
  await s.flush();
  const out = s.controller.logout();
  const b = s.controller.login("b@example.test", "pw");
  await s.flush();
  assert.deepEqual(s.sent, ["login#1:a@example.test"]);
  s.logins[0].deliver("ok"); // A's cookie lands (stale: nobody wants it)
  await a;
  await s.flush();
  assert.equal(s.jar.cookie, "alice");
  assert.deepEqual(s.sent, ["login#1:a@example.test", "logout#1"], "the logout is next, not B");
  s.logouts[0].deliver("ok");
  await out;
  await s.flush();
  assert.equal(s.jar.cookie, null);
  s.logins[1].deliver("ok");
  assert.deepEqual(await b, { ok: true });
  await s.flush();
  assert.equal(s.jar.cookie, "bob");
  s.assertSynchronized();
  assert.equal(s.sent.filter((x) => x.startsWith("logout")).length, 1, "exactly the user's own logout; no stray cleanup after B");
  assert.equal(s.store.has(LOGOUT_PENDING_KEY), false);
});

test("a stale login's cleanup can no longer resolve after Login B: there is no cleanup request issued from a response handler", async () => {
  const s = site();
  const a = s.controller.login("a@example.test", "pw");
  await s.flush();
  const b = s.controller.login("b@example.test", "pw");
  await s.flush();
  s.logins[0].deliver("ok");
  await a;
  await s.flush();
  s.logins[1].deliver("ok");
  await b;
  await s.flush();
  await new Promise((r) => setTimeout(r, 20));
  await s.flush();
  assert.equal(s.jar.cookie, "bob", "nothing issued later by login A's handling touched the cookie");
  assert.deepEqual(s.delivered, ["login#1:200 cookie=alice", "login#2:200 cookie=bob"]);
  s.assertSynchronized();
});

test("stale login A succeeded, newer Login B is REJECTED: the leftover Alice cookie is cleared (cookie, UI and storage agree: signed out)", async () => {
  const s = site();
  const a = s.controller.login("a@example.test", "pw");
  await s.flush();
  const b = s.controller.login("b@example.test", "wrong");
  await s.flush();
  s.logins[0].deliver("ok");
  await a;
  await s.flush();
  assert.equal(s.jar.cookie, "alice", "Alice's session exists server-side though she is not displayed");
  s.logins[1].deliver("reject");
  await s.flush();
  assert.deepEqual(s.sent.slice(-1), ["logout#1"], "the leftover session is removed");
  s.logouts[0].deliver("ok");
  const result = await b;
  await s.flush();
  assert.equal(result.ok, false);
  assert.equal(s.jar.cookie, null);
  assert.equal(s.controller.getState().user, null);
  s.assertSynchronized();
});

test("a failed login does NOT sign out an unrelated existing session (no foreign cookie was ever set)", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().user?.id, "alice");
  const b = s.controller.login("b@example.test", "wrong");
  await s.flush();
  s.logins[0].deliver("reject");
  await b;
  await s.flush();
  assert.ok(!s.sent.some((x) => x.startsWith("logout")));
  assert.equal(s.jar.cookie, "alice");
});

test("a network failure while logging in does not log out the existing session either", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  const b = s.controller.login("b@example.test", "pw");
  await s.flush();
  s.logins[0].deliver("network");
  assert.equal((await b).ok, false);
  await s.flush();
  assert.ok(!s.sent.some((x) => x.startsWith("logout")));
  assert.equal(s.jar.cookie, "alice");
});

test("server logout FAILS while a login is pending: local logout intent is kept, the lingering cookie does not bring the session back on reload, and the retry clears it", async () => {
  const s = site();
  const a = s.controller.login("a@example.test", "pw");
  await s.flush();
  const out = s.controller.logout();
  s.logins[0].deliver("ok");
  await a;
  await s.flush();
  s.logouts[0].deliver("network");
  await out;
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.jar.cookie, "alice", "the server session is still there");
  assert.equal(s.store.get(LOGOUT_PENDING_KEY), "1", "intent preserved");
  // Reload: new controller over the same storage and cookie jar.
  const reload = site({ cookie: "alice", logoutPending: true });
  reload.controller.start();
  await reload.flush();
  assert.equal(reload.controller.getState().user, null, "not restored from the cookie");
  assert.ok(!reload.sent.includes("me"), "no verification attempted");
  assert.deepEqual(reload.sent, ["logout#1"]);
  reload.logouts[0].deliver("ok");
  await reload.flush();
  assert.equal(reload.jar.cookie, null);
  assert.equal(reload.store.has(LOGOUT_PENDING_KEY), false);
});

test("multiple rapid login attempts: only the in-flight one and the LAST are sent; superseded queued attempts never reach the server", async () => {
  const s = site();
  const a = s.controller.login("a@example.test", "pw");
  await s.flush();
  const b = s.controller.login("b@example.test", "pw");
  const c = s.controller.login("c@example.test", "pw");
  const d = s.controller.login("d@example.test", "pw");
  await s.flush();
  s.logins[0].deliver("ok");
  const [ra, rb, rc] = await Promise.all([a, b, c]);
  await s.flush();
  assert.ok(!ra.ok && !rb.ok && !rc.ok);
  assert.deepEqual(s.sent, ["login#1:a@example.test", "login#2:d@example.test"], "B and C were skipped");
  s.logins[1].deliver("ok");
  assert.deepEqual(await d, { ok: true });
  await s.flush();
  assert.equal(s.jar.cookie, "dave");
  s.assertSynchronized();
});

test("responses cannot arrive in reverse order: delivering B's response before A's is impossible because B was never sent", async () => {
  const s = site();
  s.controller.login("a@example.test", "pw");
  await s.flush();
  s.controller.login("b@example.test", "pw");
  await s.flush();
  assert.equal(s.logins.length, 1);
  assert.throws(() => s.logins[1].deliver("ok"), TypeError);
});

test("login → logout → login in rapid succession: the second login's user is shown, its cookie is the one in the jar, storage agrees", async () => {
  const s = site();
  const a = s.controller.login("a@example.test", "pw");
  await s.flush();
  s.logins[0].deliver("ok");
  assert.deepEqual(await a, { ok: true });
  await s.flush();
  s.assertSynchronized("after A");
  const out = s.controller.logout();
  const b = s.controller.login("b@example.test", "pw");
  await s.flush();
  s.logouts[0].deliver("ok");
  await out;
  await s.flush();
  s.logins[1].deliver("ok");
  assert.deepEqual(await b, { ok: true });
  await s.flush();
  assert.equal(s.controller.getState().user?.id, "bob");
  s.assertSynchronized("after B");
  assert.equal(s.store.has(LOGOUT_PENDING_KEY), false);
});

test("stale session verification after logout cannot restore a user: the verification was answered 200 while the cookie still lingered", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  // Hold the /me response by wrapping the controller's first check: start it, then log out before the answer is applied.
  s.meScript.length = 0;
  s.controller.start();
  const out = s.controller.logout(); // runs before the (microtask-delayed) response can be applied
  await s.flush();
  s.logouts[0].deliver("network"); // the server never confirmed: the cookie lingers
  await out;
  await s.flush();
  assert.equal(s.jar.cookie, "alice", "cookie lingers");
  assert.equal(s.controller.getState().user, null, "but the stale 200 did not restore the user");
  assert.equal(s.cached(), null);
  assert.equal(s.store.get(LOGOUT_PENDING_KEY), "1");
});

test("OAuth return during transient database unavailability retries and then signs in (cookie from the redirect, 503 then 200)", async () => {
  const s = site({ cookie: "carol", url: "https://app.test/recipes/7?x=1&google-login=success#top" });
  s.meScript.push(503);
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().sessionStatus, "unavailable");
  assert.equal(s.controller.getState().user, null);
  s.sleeps.shift()!();
  await s.flush();
  assert.equal(s.controller.getState().user?.id, "carol");
  assert.equal(s.url(), "/recipes/7?x=1#top");
  s.assertSynchronized();
  assert.deepEqual(s.sent, ["me", "me"], "bounded policy unchanged");
});

test("a hung login cannot block logout forever: the deadline aborts it, the queue moves on, and the logout still runs", async () => {
  const s = site();
  const a = s.controller.login("a@example.test", "pw");
  await s.flush();
  const out = s.controller.logout();
  await s.flush();
  assert.deepEqual(s.sent, ["login#1:a@example.test"]);
  s.deadlines[0](); // the request deadline fires
  assert.equal((await a).ok, false);
  await s.flush();
  assert.deepEqual(s.sent, ["login#1:a@example.test", "logout#1"]);
  s.logouts[0].deliver("ok");
  await out;
  await s.flush();
  assert.equal(s.jar.cookie, null);
  s.assertSynchronized();
});
