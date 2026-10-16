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

type Outcome = "ok" | "reject" | "network" | "malformed" | "no-user" | "truncated" | "bad-user" | "applied-answer-lost" | "malformed-cookie-unchanged" | "stale-body-for-alice";
type Pending = { n: number; email?: string; deliver: (outcome?: Outcome) => void };

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
  const meScript: Array<number | ((signal?: AbortSignal) => Promise<Response>)> = [];
  const states: Array<{ user: U | null; loading: boolean; sessionStatus: string; pendingOAuth: boolean; verifying: boolean }> = [];
  const verifyDeadlines: Array<() => void> = [];
  const sleeps: Array<() => void> = [];
  const deadlines: Array<() => void> = [];
  let loginN = 0, logoutN = 0;

  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    if (url === "/api/auth/me") {
      sent.push("me");
      const forced = meScript.shift();
      if (typeof forced === "function") return forced(init.signal ?? undefined);
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
          if (outcome === "applied-answer-lost") { jar.cookie = USERS[email!].id; delivered.push(`login#${n}:cookie applied, answer lost`); return; } // never resolves
          if (outcome === "malformed-cookie-unchanged") { delivered.push(`login#${n}:200 garbage, cookie UNCHANGED (${jar.cookie})`); return resolve(new Response("<html>proxy error page</html>", { status: 200 })); }
          if (outcome === "stale-body-for-alice") { delivered.push(`login#${n}:200 body names alice, cookie UNCHANGED`); return resolve(new Response(JSON.stringify({ success: true, user: USERS["a@example.test"] }), { status: 200 })); }
          if (outcome === "reject") { delivered.push(`login#${n}:401`); return resolve(new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 })); }
          jar.cookie = USERS[email].id; // Set-Cookie takes effect when the response is delivered -- even if the BODY is unusable
          delivered.push(`login#${n}:200 cookie=${jar.cookie}`);
          const bodies: Record<string, string> = {
            ok: JSON.stringify({ success: true, user: USERS[email] }),
            malformed: "<html>proxy error page</html>",
            truncated: '{"success":true,"user":{"id":"bo',
            "no-user": JSON.stringify({ success: true }),
            "bad-user": JSON.stringify({ success: true, user: { id: USERS[email].id } }), // parseUser rejects: no email
          };
          resolve(new Response(bodies[outcome], { status: 200 }));
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
    verifyDeadline: (_ms: number, signal: AbortSignal) => new Promise<void>((resolve) => { if (signal.aborted) return resolve(); const done = () => resolve(); signal.addEventListener("abort", done, { once: true }); verifyDeadlines.push(done); }),
    parseUser,
    onChange: (st: never) => { states.push({ ...(st as object) } as never); },
  } as never);

  const flush = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };
  const cached = () => JSON.parse(store.get(USER_STORAGE_KEY) ?? "null") as U | null;
  /** The three views of "who am I" must agree. */
  const assertSynchronized = (label = "") => {
    const ui = controller.getState().user;
    assert.equal(ui?.id ?? null, jar.cookie, `${label} UI user vs cookie`);
    assert.equal(cached()?.id ?? null, jar.cookie, `${label} localStorage vs cookie`);
  };
  return { jar, store, controller, sent, delivered, logins, logouts, meScript, sleeps, deadlines, verifyDeadlines, states, flush, cached, assertSynchronized, url: () => loc.pathname + loc.search + loc.hash };
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
  assert.equal(s.controller.getState().sessionStatus, "checking");
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

// ---- P1-1: a 2xx login can change the cookie even when its body is unusable ---------------------------------------------------
const unusable: Outcome[] = ["malformed", "truncated", "no-user", "bad-user"];

for (const outcome of unusable) {
  test(`account switching: signed in as Alice, login as Bob answers 200 with a ${outcome} body (cookie IS Bob's): the server-authoritative identity (Bob) replaces Alice -- never Alice with Bob's cookie`, async () => {
    const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
    s.controller.start();
    await s.flush();
    assert.equal(s.controller.getState().user?.id, "alice");
    const p = s.controller.login("b@example.test", "pw");
    await s.flush();
    s.logins[0].deliver(outcome);
    const result = await p;
    await s.flush();
    assert.equal(s.jar.cookie, "bob");
    assert.equal(s.controller.getState().user?.id, "bob", "reconciled against /api/auth/me");
    assert.deepEqual(result, { ok: true });
    s.assertSynchronized(outcome);
    assert.deepEqual(s.sent.slice(-2), ["login#1:b@example.test", "me"], "one authoritative read, inside the same queue slot");
  });
}

test("while the identity is being reconciled nobody is displayed: the previous user is cleared the moment the cookie may have changed", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  const p = s.controller.login("b@example.test", "pw");
  await s.flush();
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  s.meScript.push(async () => { await gate; return new Response(JSON.stringify({ success: true, user: USERS["b@example.test"] }), { status: 200 }); });
  s.logins[0].deliver("malformed");
  await s.flush();
  assert.equal(s.controller.getState().user, null, "Alice is no longer shown while Bob's cookie is unverified");
  assert.equal(s.cached(), null, "and no longer stored");
  release();
  assert.deepEqual(await p, { ok: true });
  await s.flush();
  assert.equal(s.controller.getState().user?.id, "bob");
  s.assertSynchronized("reconciled");
});

test("malformed 2xx and the identity check is itself unavailable (503): the uncertain session is cleared -- signed out locally, logout requested, intent persisted", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  const p = s.controller.login("b@example.test", "pw");
  await s.flush();
  s.meScript.push(503);
  s.logins[0].deliver("malformed");
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.cached(), null);
  assert.equal(s.store.get(LOGOUT_PENDING_KEY), "1");
  assert.equal(s.sent.at(-1), "logout#1");
  s.logouts[0].deliver("ok");
  assert.equal((await p).ok, false);
  await s.flush();
  assert.equal(s.jar.cookie, null);
  assert.equal(s.store.has(LOGOUT_PENDING_KEY), false);
  s.assertSynchronized("cleared");
});

test("malformed 2xx and /me says 401: signed out, nothing displayed or stored", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  const p = s.controller.login("b@example.test", "pw");
  await s.flush();
  s.meScript.push(401);
  s.logins[0].deliver("truncated");
  assert.equal((await p).ok, false);
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.cached(), null);
});

test("superseded login with an unusable body: not adopted, not reconciled (no /me, no cleanup from its handler); the newer login decides the final identity", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  const a = s.controller.login("b@example.test", "pw");
  await s.flush();
  const b = s.controller.login("c@example.test", "pw");
  await s.flush();
  s.logins[0].deliver("malformed"); // cookie = bob, body unusable, and a newer intent exists
  assert.equal((await a).ok, false);
  await s.flush();
  assert.ok(!s.sent.slice(s.sent.indexOf("login#1:b@example.test") + 1).slice(0, 1).includes("me"), "no reconcile for a superseded login");
  s.logins[1].deliver("ok");
  assert.deepEqual(await b, { ok: true });
  await s.flush();
  assert.equal(s.jar.cookie, "carol");
  s.assertSynchronized("superseded malformed");
});

test("logout requested while the identity reconciliation is in flight: the reconciled user is discarded and the logout wins", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  const p = s.controller.login("b@example.test", "pw");
  await s.flush();
  s.logins[0].deliver("malformed");
  const out = s.controller.logout(); // intent arrives right after the unusable response
  await s.flush();
  s.logouts[0].deliver("ok");
  await Promise.all([p, out]);
  await s.flush();
  assert.equal(s.jar.cookie, null);
  assert.equal(s.controller.getState().user, null);
  s.assertSynchronized("logout wins");
});

test("concurrent authentication operations: login(malformed) + logout + login(ok) -> final state is the last intent, cookie = UI = storage", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  const a = s.controller.login("b@example.test", "pw");
  await s.flush();
  const out = s.controller.logout();
  const c = s.controller.login("c@example.test", "pw");
  await s.flush();
  s.logins[0].deliver("no-user");
  await a;
  await s.flush();
  s.logouts[0].deliver("ok");
  await out;
  await s.flush();
  s.logins[1].deliver("ok");
  assert.deepEqual(await c, { ok: true });
  await s.flush();
  assert.equal(s.jar.cookie, "carol");
  s.assertSynchronized("concurrent");
});

test("superseded login with an unusable body AND the newer login is rejected: the leftover session is cleared (cookie, UI, storage agree)", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  const a = s.controller.login("b@example.test", "pw");
  await s.flush();
  const b = s.controller.login("c@example.test", "wrong");
  await s.flush();
  s.logins[0].deliver("malformed"); // cookie = bob, body unusable
  await a;
  await s.flush();
  s.logins[1].deliver("reject");
  await s.flush();
  s.logouts[0].deliver("ok");
  assert.equal((await b).ok, false);
  await s.flush();
  assert.equal(s.jar.cookie, null);
  s.assertSynchronized("superseded malformed + rejected");
});

test("a failed (non-2xx) login with a body that is not JSON changes nothing and signs nobody out", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  const p = s.controller.login("b@example.test", "wrong");
  await s.flush();
  s.logins[0].deliver("reject");
  assert.equal((await p).ok, false);
  await s.flush();
  assert.equal(s.jar.cookie, "alice");
  assert.equal(s.controller.getState().user?.id, "alice");
  s.assertSynchronized("non-2xx");
});

// ---- Codex P1-2: a foreign cookie must not survive a failed replacement login --------------------------------------------------
async function aliceBobCarol(s: ReturnType<typeof site>) {
  const a = s.controller.login("a@example.test", "pw");
  await s.flush();
  const b = s.controller.login("b@example.test", "pw"); // supersedes A (queued behind it)
  const c = s.controller.login("c@example.test", "pw"); // supersedes B (never sent)
  await s.flush();
  s.logins[0].deliver("ok"); // Alice's login was accepted by the server: her cookie is in the jar, but nobody wants it any more
  await Promise.all([a, b]);
  await s.flush();
  return { c }; // wrapped: returning the promise itself would make the caller wait for it
}

test("Alice → Bob → Carol: Carol's login fails at the NETWORK layer -> Alice's leftover cookie is removed (a logout is sent), nobody is displayed or stored", async () => {
  const s = site();
  const { c } = await aliceBobCarol(s);
  assert.equal(s.jar.cookie, "alice");
  assert.deepEqual(s.sent, ["login#1:a@example.test", "login#2:c@example.test"], "Bob's superseded login was never sent");
  s.logins[1].deliver("network");
  await s.flush();
  assert.equal(s.sent.at(-1), "logout#1", "cleanup runs inside Carol's own queue slot");
  s.logouts[0].deliver("ok");
  assert.equal((await c).ok, false);
  await s.flush();
  assert.equal(s.jar.cookie, null);
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.cached(), null);
  s.assertSynchronized("A,B,C(network)");
});

test("…and when that cleanup logout ALSO fails: signed out locally, logout intent persisted; a reload does not restore Alice and finishes the cleanup", async () => {
  const s = site();
  const { c } = await aliceBobCarol(s);
  s.logins[1].deliver("network");
  await s.flush();
  s.logouts[0].deliver("network");
  assert.equal((await c).ok, false);
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.cached(), null);
  assert.equal(s.jar.cookie, "alice", "the server-side session is still there");
  assert.equal(s.store.get(LOGOUT_PENDING_KEY), "1");
  const reload = site({ cookie: "alice", logoutPending: true });
  reload.controller.start();
  await reload.flush();
  assert.equal(reload.controller.getState().user, null);
  assert.deepEqual(reload.sent, ["logout#1"]);
  reload.logouts[0].deliver("ok");
  await reload.flush();
  assert.equal(reload.jar.cookie, null);
  assert.equal(reload.store.has(LOGOUT_PENDING_KEY), false);
});

test("Carol's login TIMES OUT (deadline) while Alice's stale cookie is in the jar: Alice is not adopted; the leftover session is cleared", async () => {
  const s = site();
  const { c } = await aliceBobCarol(s);
  s.deadlines.at(-1)!(); // the deadline of the in-flight login (the last one armed)
  await s.flush();
  assert.equal(s.controller.getState().user, null, "never Alice");
  assert.equal(s.sent.at(-1), "logout#1");
  s.logouts[0].deliver("ok");
  assert.equal((await c).ok, false);
  await s.flush();
  assert.equal(s.jar.cookie, null);
  s.assertSynchronized("A,B,C(timeout)");
});

test("a newer successful login queued behind the cleanup survives it: A(stale) → C(network) → cleanup logout → D succeeds", async () => {
  const s = site();
  const { c } = await aliceBobCarol(s);
  const d = s.controller.login("d@example.test", "pw"); // supersedes C while C is in flight
  await s.flush();
  s.logins[1].deliver("network"); // C fails, but it is superseded: it must not clean up on D's behalf... D's slot is next
  assert.equal((await c).ok, false);
  await s.flush();
  // C was superseded by D, so cleanup is D's job only if D fails; D now runs.
  assert.equal(s.sent.at(-1), "login#3:d@example.test");
  s.logins[2].deliver("ok");
  assert.deepEqual(await d, { ok: true });
  await s.flush();
  assert.equal(s.jar.cookie, "dave");
  assert.ok(!s.sent.some((x) => x.startsWith("logout")), "no cleanup was needed: D replaced Alice's cookie");
  s.assertSynchronized("A,C(network, superseded),D");
});

test("the answer to Carol's login is LOST after the server applied her cookie (deadline): the server-authoritative identity (Carol) is adopted, never assumed", async () => {
  const s = site();
  const c = s.controller.login("c@example.test", "pw");
  await s.flush();
  s.logins[0].deliver("applied-answer-lost"); // Set-Cookie applied, response never delivered
  s.deadlines.at(-1)!();
  await s.flush();
  assert.equal((await c).ok, true, "the typed account is the one now authenticated");
  assert.equal(s.controller.getState().user?.id, "carol");
  s.assertSynchronized("answer lost");
});

test("deadline with an existing Alice session and a hung login for Bob that did NOT apply: the reconciliation confirms Alice; nothing is lost", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  const b = s.controller.login("b@example.test", "pw");
  await s.flush();
  s.deadlines.at(-1)!();
  assert.equal((await b).ok, false);
  await s.flush();
  assert.equal(s.controller.getState().user?.id, "alice");
  s.assertSynchronized("hung login, session unchanged");
});

test("answer lost after the cookie was applied AND the identity check is unavailable (503): the uncertain session is cleared and the cleanup logout is sent", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  const c = s.controller.login("c@example.test", "pw");
  await s.flush();
  s.logins[0].deliver("applied-answer-lost");
  s.meScript.push(503);
  s.deadlines.at(-1)!();
  await s.flush();
  assert.equal(s.controller.getState().user, null, "neither Alice nor Carol is shown on an unverified cookie");
  assert.equal(s.cached(), null);
  assert.equal(s.sent.at(-1), "logout#1");
  s.logouts[0].deliver("ok");
  assert.equal((await c).ok, false);
  await s.flush();
  assert.equal(s.jar.cookie, null);
  s.assertSynchronized("answer lost + /me unavailable");
});

test("a fetch that IGNORES the abort cannot leave the operation pending forever: after the grace period the exchange is abandoned, the session cleared, and the queue moves on", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  const b = s.controller.login("b@example.test", "pw");
  await s.flush();
  s.meScript.push(() => new Promise<Response>(() => {})); // the reconciliation request hangs and does not honour abort
  s.logins[0].deliver("malformed"); // unusable body -> reconcile
  await s.flush();
  const before = s.deadlines.length;
  s.deadlines[before - 1](); // reconcile's deadline: aborts (ignored by this fetch)
  await s.flush();
  s.deadlines[s.deadlines.length - 1](); // the grace period ends: abandoned
  await s.flush();
  assert.equal(s.sent.at(-1), "logout#1", "abandoned reconciliation -> uncertain session cleared");
  s.logouts[0].deliver("ok");
  assert.equal((await b).ok, false);
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.jar.cookie, null);
  // The queue is free: a later login runs.
  const c = s.controller.login("c@example.test", "pw");
  await s.flush();
  s.logins[1].deliver("ok");
  assert.deepEqual(await c, { ok: true });
  s.assertSynchronized("queue still usable");
});

// ---- Codex P2-1: the ?google-login=success URL marker is NOT proof of a Google sign-in ------------------------------------------------------
// A failed logout leaves a valid cookie plus a persisted logout intent. An untrusted URL parameter must not be able to cancel that intent.
import { beginGoogleSignIn, OAUTH_INITIATION_KEY } from "./session-controller";

const withMarker = (extra = "") => `https://app.test/recipes/9?google-login=success${extra}#top`;

test("FORGED marker: after a failed logout, ?google-login=success alone does NOT cancel the logout intent or restore the old session", async () => {
  const s = site({ cookie: "alice", logoutPending: true, url: withMarker() });
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().user, null, "Alice is not restored");
  assert.ok(!s.sent.includes("me"), "no verification of the lingering cookie is even attempted");
  assert.equal(s.store.get(LOGOUT_PENDING_KEY), "1", "the explicit logout intent survives");
  assert.equal(s.sent[0], "logout#1", "the logout is retried instead");
  assert.equal(s.url(), "/recipes/9#top", "the untrusted marker is removed from the URL");
  s.logouts[0].deliver("ok");
  await s.flush();
  assert.equal(s.jar.cookie, null);
  assert.equal(s.store.has(LOGOUT_PENDING_KEY), false);
  s.assertSynchronized("forged marker");
});

test("marker with a WRONG state, an EXPIRED state, or a REPLAYED (already consumed) state is ignored the same way", async () => {
  // wrong
  const w = site({ cookie: "alice", logoutPending: true, url: withMarker("&oauth_state=AAAAAAAAAAAAAAAAAAAAAAAA") });
  w.store.set(OAUTH_INITIATION_KEY, JSON.stringify({ nonce: "BBBBBBBBBBBBBBBBBBBBBBBB", at: Date.now() }));
  w.controller.start();
  await w.flush();
  assert.equal(w.controller.getState().user, null);
  assert.ok(!w.sent.includes("me"));
  assert.equal(w.store.get(LOGOUT_PENDING_KEY), "1");
  // expired (initiated 11 minutes ago)
  const e = site({ cookie: "alice", logoutPending: true, url: withMarker("&oauth_state=CCCCCCCCCCCCCCCCCCCCCCCC") });
  e.store.set(OAUTH_INITIATION_KEY, JSON.stringify({ nonce: "CCCCCCCCCCCCCCCCCCCCCCCC", at: Date.now() - 11 * 60_000 }));
  e.controller.start();
  await e.flush();
  assert.equal(e.controller.getState().user, null);
  assert.ok(!e.sent.includes("me"));
  assert.equal(e.store.get(LOGOUT_PENDING_KEY), "1");
  // replayed: no initiation record at all (it was consumed by the genuine completion)
  const r = site({ cookie: "alice", logoutPending: true, url: withMarker("&oauth_state=DDDDDDDDDDDDDDDDDDDDDDDD") });
  r.controller.start();
  await r.flush();
  assert.equal(r.controller.getState().user, null);
  assert.ok(!r.sent.includes("me"));
});

test("GENUINE Google sign-in after a failed logout: the click recorded a nonce, the callback echoed it, so the new sign-in supersedes the pending logout and the SERVER's identity is adopted", async () => {
  const store0 = new Map<string, string>();
  const nonce = beginGoogleSignIn({ getItem: (k) => store0.get(k) ?? null, setItem: (k, v) => void store0.set(k, v), removeItem: (k) => void store0.delete(k) }, Date.now());
  assert.match(nonce, /^[A-Za-z0-9_-]{16,64}$/);
  const s = site({ cookie: "carol", logoutPending: true, url: withMarker(`&oauth_state=${nonce}`) });
  s.store.set(OAUTH_INITIATION_KEY, store0.get(OAUTH_INITIATION_KEY)!);
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().user?.id, "carol");
  assert.equal(s.store.has(LOGOUT_PENDING_KEY), false, "cleared by the bound transition, not by the bare marker");
  assert.equal(s.store.has(OAUTH_INITIATION_KEY), false, "the nonce is single-use");
  assert.equal(s.url(), "/recipes/9#top", "both the marker and the state are removed; path and fragment preserved");
  s.assertSynchronized("genuine");
});

test("browser RELOAD after a genuine completion: the URL is clean, nothing is re-adopted from a marker; and a later failed logout is not undone by revisiting the old callback URL", async () => {
  const store0 = new Map<string, string>();
  const nonce = beginGoogleSignIn({ getItem: (k) => store0.get(k) ?? null, setItem: (k, v) => void store0.set(k, v), removeItem: (k) => void store0.delete(k) }, Date.now());
  const first = site({ cookie: "carol", url: withMarker(`&oauth_state=${nonce}`) });
  first.store.set(OAUTH_INITIATION_KEY, store0.get(OAUTH_INITIATION_KEY)!);
  first.controller.start();
  await first.flush();
  assert.equal(first.controller.getState().user?.id, "carol");
  // reload: same storage, URL already cleaned
  const reload = site({ cookie: "carol", stored: USERS["c@example.test"], url: `https://app.test${first.url()}` });
  reload.controller.start();
  await reload.flush();
  assert.equal(reload.sent.filter((x) => x === "me").length, 1, "an ordinary cached-user check, not an OAuth adoption");
  // The user logs out, the server call fails, and they open the OLD callback URL again (bookmark / history).
  const again = site({ cookie: "carol", logoutPending: true, url: withMarker(`&oauth_state=${nonce}`) });
  again.controller.start();
  await again.flush();
  assert.equal(again.controller.getState().user, null, "the consumed nonce cannot be replayed");
  assert.ok(!again.sent.includes("me"));
});

test("account switching: signed in as Alice (no pending logout), a genuine Google sign-in as Bob -> Bob (server identity), via the same verification run", async () => {
  const s = site({ cookie: "bob", stored: USERS["a@example.test"], url: withMarker() });
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().user?.id, "bob", "no pending logout, so the marker triggers an authoritative /me read exactly as before");
  s.assertSynchronized("switch");
});

test("a genuine sign-in whose callback never arrives (user abandoned Google): the nonce expires harmlessly and the pending logout still holds", async () => {
  const s = site({ cookie: "alice", logoutPending: true, url: "https://app.test/login" });
  s.store.set(OAUTH_INITIATION_KEY, JSON.stringify({ nonce: "EEEEEEEEEEEEEEEEEEEEEEEE", at: Date.now() - 20 * 60_000 }));
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.store.get(LOGOUT_PENDING_KEY), "1");
});

test("forged marker while NOT logged out and with a cached user is still verified by the server (no behaviour change when there is no pending logout)", async () => {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"], url: withMarker() });
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().user?.id, "alice");
  assert.deepEqual(s.sent, ["me"]);
});

// ---- Codex P2: a reconciled identity must be the account the user asked for ---------------------------------------------------------------------
async function signedInAlice() {
  const s = site({ cookie: "alice", stored: USERS["a@example.test"] });
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().user?.id, "alice");
  return s;
}

test("Alice is signed in and attempts Bob: a malformed 2xx that did NOT replace her cookie, reconciliation returns ALICE -> Bob's login FAILS, Alice's untouched session stays displayed (cookie = UI = storage)", async () => {
  const s = await signedInAlice();
  const p = s.controller.login("b@example.test", "pw");
  await s.flush();
  s.logins[0].deliver("malformed-cookie-unchanged");
  const result = await p;
  await s.flush();
  assert.equal(result.ok, false, "never a success for Bob");
  assert.equal(s.jar.cookie, "alice");
  assert.equal(s.controller.getState().user?.id, "alice", "the session that really exists is shown; nothing misleading");
  s.assertSynchronized("Alice kept");
  assert.ok(!s.sent.some((x) => x.startsWith("logout")), "her valid session is not logged out by the failed attempt");
});

test("a usable body that names a DIFFERENT account than the one requested is not trusted: reconciled with the server, and the login fails if the server says Alice", async () => {
  const s = await signedInAlice();
  const p = s.controller.login("b@example.test", "pw");
  await s.flush();
  s.logins[0].deliver("stale-body-for-alice"); // e.g. a cached response
  const result = await p;
  await s.flush();
  assert.equal(result.ok, false);
  assert.equal(s.sent.at(-1), "me", "the body was cross-checked against the server");
  assert.equal(s.controller.getState().user?.id, "alice");
  s.assertSynchronized("body named another account");
});

test("a malformed 2xx that GENUINELY installed Bob's cookie: reconciliation confirms Bob -> login succeeds (typed address normalized: case and whitespace)", async () => {
  const s = await signedInAlice();
  const p = s.controller.login("  B@Example.TEST ", "pw");
  await s.flush();
  s.logins[0].deliver("malformed"); // cookie = bob
  assert.deepEqual(await p, { ok: true });
  await s.flush();
  assert.equal(s.controller.getState().user?.id, "bob");
  s.assertSynchronized("Bob confirmed");
});

test("reconciliation meets a temporary database outage: login fails, nothing is displayed on an unverified cookie, cleanup logout is sent, nothing is left misleading", async () => {
  const s = await signedInAlice();
  const p = s.controller.login("b@example.test", "pw");
  await s.flush();
  s.meScript.push(503);
  s.logins[0].deliver("malformed-cookie-unchanged");
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.cached(), null);
  s.logouts[0].deliver("ok");
  assert.equal((await p).ok, false);
  await s.flush();
  assert.equal(s.jar.cookie, null);
  s.assertSynchronized("outage during reconciliation");
});

test("another LOGIN supersedes the pending reconciliation: the old verdict is discarded, the newer login decides, and no cleanup logout deletes its cookie", async () => {
  const s = await signedInAlice();
  const p = s.controller.login("b@example.test", "pw");
  await s.flush();
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  s.meScript.push(async () => { await gate; return new Response(JSON.stringify({ success: true, user: USERS["a@example.test"] }), { status: 200 }); });
  s.logins[0].deliver("malformed-cookie-unchanged");
  await s.flush();
  const c = s.controller.login("c@example.test", "pw"); // newer intent while /me is in flight
  await s.flush();
  release();
  assert.equal((await p).ok, false);
  await s.flush();
  assert.equal(s.sent.at(-1), "login#2:c@example.test", "Carol's login runs next; nothing was cleaned up on her behalf");
  s.logins[1].deliver("ok");
  assert.deepEqual(await c, { ok: true });
  await s.flush();
  assert.equal(s.jar.cookie, "carol");
  assert.ok(!s.sent.some((x) => x.startsWith("logout")));
  s.assertSynchronized("superseded by login");
});

test("a LOGOUT supersedes the pending reconciliation: nothing is adopted, the logout wins", async () => {
  const s = await signedInAlice();
  const p = s.controller.login("b@example.test", "pw");
  await s.flush();
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  s.meScript.push(async () => { await gate; return new Response(JSON.stringify({ success: true, user: USERS["a@example.test"] }), { status: 200 }); });
  s.logins[0].deliver("malformed-cookie-unchanged");
  await s.flush();
  const out = s.controller.logout();
  release();
  await s.flush();
  s.logouts[0].deliver("ok");
  await Promise.all([p, out]);
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.jar.cookie, null);
  s.assertSynchronized("superseded by logout");
});

test("a mismatching reconciled account while a FOREIGN session is already suspected (stale accepted login) is dropped, not adopted", async () => {
  const s = site();
  const a = s.controller.login("a@example.test", "pw");
  await s.flush();
  const b = s.controller.login("b@example.test", "pw"); // supersedes A
  await s.flush();
  s.logins[0].deliver("ok"); // Alice's cookie lands (stale); foreign session suspected
  await a;
  await s.flush();
  s.logins[1].deliver("malformed-cookie-unchanged"); // Bob's 2xx is garbage and did not replace Alice's cookie
  await s.flush();
  assert.equal(s.controller.getState().user, null, "the abandoned account is never displayed");
  assert.equal(s.sent.at(-1), "logout#1");
  s.logouts[0].deliver("ok");
  assert.equal((await b).ok, false);
  await s.flush();
  assert.equal(s.jar.cookie, null);
  s.assertSynchronized("foreign dropped");
});

test("the cookie was changed by ANOTHER tab to Carol, then Bob's login yields garbage: the server's truth (Carol) is shown, Bob's login fails, and Carol's session is NOT logged out", async () => {
  const s = await signedInAlice();
  s.jar.cookie = "carol"; // another tab signed in as Carol
  const p = s.controller.login("b@example.test", "pw");
  await s.flush();
  s.logins[0].deliver("malformed-cookie-unchanged");
  assert.equal((await p).ok, false);
  await s.flush();
  assert.equal(s.controller.getState().user?.id, "carol");
  assert.ok(!s.sent.some((x) => x.startsWith("logout")), "cleanup must not destroy a session the user legitimately has");
  s.assertSynchronized("other tab");
});

test("the deadline path keeps its identity check: the requested account → success, any other → failure", async () => {
  const mismatch = await signedInAlice();
  const p1 = mismatch.controller.login("b@example.test", "pw");
  await mismatch.flush();
  mismatch.deadlines.at(-1)!(); // hung; cookie unchanged (Alice)
  assert.equal((await p1).ok, false);
  await mismatch.flush();
  assert.equal(mismatch.controller.getState().user?.id, "alice");
  mismatch.assertSynchronized("deadline mismatch");

  const match = await signedInAlice();
  const p2 = match.controller.login("b@example.test", "pw");
  await match.flush();
  match.logins[0].deliver("applied-answer-lost");
  match.deadlines.at(-1)!();
  assert.deepEqual(await p2, { ok: true });
  await match.flush();
  match.assertSynchronized("deadline match");
});


// ---- Codex P2: Google OAuth retries must not look like "logged out" to protected-route guards ----------------------------------------------------
// The guard in catering-provider.tsx was `if (!loading && !user) navigate("/login…")`. With a 503 on the OAuth return the controller used to publish
// { loading:false, user:null } while its retries were still running, so the page redirected away from the protected destination mid-sign-in.
const pageGuardToday = (st: { loading: boolean; user: unknown }) => !st.loading && !st.user;
const PROTECTED = "https://app.test/services/catering/provider?tab=menu&google-login=success#billing";

test("REPRO/guard: during Google OAuth verification retries no published state is 'confirmed signed out' (loading=false, user=null) until the retries are finished", async () => {
  const s = site({ cookie: "carol", url: PROTECTED });
  s.meScript.push(503, 503);
  s.controller.start();
  await s.flush();
  assert.equal(s.states.some((st) => pageGuardToday(st)), false, "the first 503 must not publish a signed-out-looking state");
  assert.equal(s.controller.getState().loading, true, "still indeterminate");
  s.sleeps.shift()!();
  await s.flush();
  assert.equal(s.states.some((st) => pageGuardToday(st)), false, "nor the second");
  s.sleeps.shift()!();
  await s.flush();
  assert.equal(s.controller.getState().user?.id, "carol");
  assert.equal(s.url(), "/services/catering/provider?tab=menu#billing", "the protected destination (path, query, fragment) was never left");
  s.assertSynchronized("oauth recovered");
});

test("stalled /api/auth/me: deadline = unavailable (not invalid), bounded retry proceeds and succeeds; late body cannot overwrite; dispose settles", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (e: unknown) => unhandled.push(e);
  process.on("unhandledRejection", onUnhandled);
  const s = site({ cookie: "carol", url: "https://app.test/?google-login=success" });
  s.meScript.push((signal?: AbortSignal) => new Promise<Response>((_, reject) => signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true })));
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().sessionStatus, "checking");
  assert.equal(s.verifyDeadlines.length, 1);
  s.verifyDeadlines.shift()!(); // the per-attempt deadline fires
  await s.flush();
  const st = s.controller.getState();
  assert.equal(st.sessionStatus, "checking", "timeout is unavailable, never anonymous; OAuth stays indeterminate");
  assert.equal(st.user, null);
  assert.equal(st.verifying, true);
  s.sleeps.shift()!();
  await s.flush();
  assert.equal(s.controller.getState().sessionStatus, "authenticated");
  assert.ok(!s.states.some((x: any) => !x.loading && !x.user && x.sessionStatus !== "unavailable" && x.sessionStatus !== "anonymous" && x.pendingOAuth));
  s.controller.dispose();
  await s.flush();
  assert.deepEqual(unhandled, []);
  process.off("unhandledRejection", onUnhandled);
});
