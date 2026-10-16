/**
 * Stability Phase 2C: the client session lifecycle (cached check, Google OAuth return, background retries, login, logout, refresh) and its races.
 * Deterministic: fetch, storage, location and timers are injected; every response and every retry delay is released by the test.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { beginGoogleSignIn, createSessionController, LOGOUT_PENDING_KEY, OAUTH_INITIATION_KEY, USER_STORAGE_KEY, type SessionState } from "./session-controller";
import { SESSION_RECHECK_DELAYS_MS } from "./session-verification";

type U = { id: string; email: string; name?: string };
const parseUser = (p: unknown): U => {
  if (!p || typeof p !== "object" || !("id" in p) || !("email" in p)) throw new Error("Incomplete authenticated user response");
  return { ...(p as object), id: String((p as { id: unknown }).id) } as U;
};
const alice: U = { id: "alice", email: "a@example.test", name: "Alice" };
const bob: U = { id: "bob", email: "b@example.test", name: "Bob" };

type Plan = (signal: AbortSignal | undefined) => Promise<Response>;
const json = (status: number, body: unknown): Plan => async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = (user: unknown) => json(200, { success: true, user });
const status = (code: number) => json(code, { error: "x" });
const network: Plan = async () => { throw new TypeError("Failed to fetch"); };
/** A plan whose response the test releases by hand; honours the abort signal like fetch does. */
function deferred() {
  let release!: (r: Response | Error) => void;
  const gate = new Promise<Response | Error>((resolve) => { release = resolve; });
  const plan: Plan = (signal) => new Promise<Response>((resolve, reject) => {
    const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
    gate.then((r) => (r instanceof Error ? reject(r) : resolve(r)));
  });
  return { plan, release };
}
/** A 200 whose BODY is released by hand: "verification succeeded, response not yet applied". */
function slowBody(user: unknown) {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const plan: Plan = async () => {
    const res = new Response(JSON.stringify({ success: true, user }), { status: 200 });
    const original = res.json.bind(res);
    res.json = async () => { await gate; return original(); };
    return res;
  };
  return { plan, release };
}

function setup(opts: { url?: string; stored?: U | null; logoutPending?: boolean } = {}) {
  const store = new Map<string, string>();
  if (opts.stored) store.set(USER_STORAGE_KEY, JSON.stringify(opts.stored));
  if (opts.logoutPending) store.set(LOGOUT_PENDING_KEY, "1");
  let loc = new URL(opts.url ?? "https://app.test/");
  const requests: Array<{ url: string; method: string; headers: unknown; credentials?: string; signal?: AbortSignal }> = [];
  const mePlans: Plan[] = [];
  const logoutPlans: Plan[] = [];
  const loginPlans: Plan[] = [];
  const sleeps: Array<{ ms: number; done: () => void }> = [];
  const states: SessionState<U>[] = [];
  const fetchFn = (async (input: string, init: RequestInit = {}) => {
    requests.push({ url: input, method: init.method ?? "GET", headers: init.headers, credentials: init.credentials, signal: init.signal ?? undefined });
    const queue = input === "/api/auth/me" ? mePlans : input === "/api/auth/logout" ? logoutPlans : input === "/api/auth/login" ? loginPlans : undefined;
    const plan = queue?.shift();
    assert.ok(plan, `unexpected request: ${init.method ?? "GET"} ${input}`);
    return plan(init.signal ?? undefined);
  }) as unknown as typeof fetch;
  const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
    const entry = { ms, done: () => { signal.removeEventListener("abort", entry.done); resolve(); } };
    if (signal.aborted) return resolve();
    signal.addEventListener("abort", entry.done, { once: true });
    sleeps.push(entry);
  });
  const controller = createSessionController<U>({
    fetch: fetchFn,
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) },
    getLocation: () => ({ pathname: loc.pathname, search: loc.search, hash: loc.hash }),
    replaceUrl: (u) => { loc = new URL(u, loc); },
    sleep,
    parseUser,
    onChange: (s) => states.push(s),
  });
  const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
  /** Release the oldest pending retry delay. */
  const tick = async () => { const next = sleeps.shift(); assert.ok(next, "a retry delay was pending"); next.done(); await flush(); };
  const meRequests = () => requests.filter((r) => r.url === "/api/auth/me");
  return { store, controller, requests, mePlans, logoutPlans, loginPlans, sleeps, states, flush, tick, meRequests, url: () => loc.pathname + loc.search + loc.hash };
}
const cached = (s: ReturnType<typeof setup>) => JSON.parse(s.store.get(USER_STORAGE_KEY) ?? "null");

// ---- P2 #1: Google OAuth return --------------------------------------------------------------------------------------------
test("OAuth return, no cached user, 503 then 200: stays pending (marker kept), retries on its own, then signs in and restores the intended URL", async () => {
  const s = setup({ url: "https://app.test/recipes/42?tab=reviews&google-login=success#comments" });
  s.mePlans.push(status(503), me(alice));
  s.controller.start();
  await s.flush();
  let st = s.controller.getState();
  assert.equal(st.user, null, "no user is invented without verified identity");
  assert.equal(st.sessionStatus, "unavailable");
  assert.equal(st.pendingOAuth, true);
  assert.equal(st.verifying, true, "a bounded retry is scheduled");
  assert.equal(s.sleeps[0].ms, SESSION_RECHECK_DELAYS_MS[0]);
  assert.match(s.url(), /google-login=success/, "the pending-login marker is kept until resolved");
  await s.tick();
  st = s.controller.getState();
  assert.deepEqual(st.user, alice);
  assert.equal(st.sessionStatus, "authenticated");
  assert.equal(st.pendingOAuth, false);
  assert.deepEqual(cached(s), alice, "the returned user is persisted");
  assert.equal(s.url(), "/recipes/42?tab=reviews#comments", "path, other query parameters and the fragment survive; only the marker is removed");
  assert.equal(s.meRequests().length, 2);
});

test("OAuth return, no cached user, network failure then 200: recovers", async () => {
  const s = setup({ url: "https://app.test/?google-login=success" });
  s.mePlans.push(network, me(alice));
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().sessionStatus, "unavailable");
  assert.equal(s.controller.getState().user, null);
  await s.tick();
  assert.deepEqual(s.controller.getState().user, alice);
  assert.equal(s.url(), "/");
});

test("OAuth return receiving 401: definitive -- pending state cleared, nothing cached, no retries scheduled", async () => {
  const s = setup({ url: "https://app.test/x?google-login=success&a=1", stored: bob });
  s.mePlans.push(status(401));
  s.controller.start();
  await s.flush();
  const st = s.controller.getState();
  assert.equal(st.user, null);
  assert.equal(st.sessionStatus, "anonymous");
  assert.equal(st.pendingOAuth, false);
  assert.equal(s.store.has(USER_STORAGE_KEY), false, "the stale cached profile (possibly another account) is cleared");
  assert.equal(s.url(), "/x?a=1");
  assert.equal(s.sleeps.length, 0);
});

test("OAuth return never shows a previously cached (possibly different) account while verifying or during an outage", async () => {
  const s = setup({ url: "https://app.test/?google-login=success", stored: bob });
  s.mePlans.push(status(503), status(503), status(503), status(503));
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  for (let i = 0; i < 3; i++) await s.tick();
  assert.equal(s.controller.getState().user, null, "still not Bob");
});

test("OAuth retries exhausted: bounded (1 + 3 requests, 3 delays), recoverable, marker kept, no silent 'invalid'; user-initiated retry then succeeds", async () => {
  const s = setup({ url: "https://app.test/p?q=1&google-login=success#f" });
  s.mePlans.push(status(503), status(503), network, status(500));
  s.controller.start();
  await s.flush();
  for (let i = 0; i < 3; i++) await s.tick();
  const st = s.controller.getState();
  assert.equal(s.meRequests().length, 4);
  assert.deepEqual(SESSION_RECHECK_DELAYS_MS, [5000, 15000, 45000]);
  assert.equal(s.sleeps.length, 0, "no timer left behind");
  assert.equal(st.verifying, false);
  assert.equal(st.sessionStatus, "unavailable", "not claimed invalid");
  assert.equal(st.pendingOAuth, true);
  assert.equal(st.user, null);
  assert.match(s.url(), /google-login=success/);
  await s.flush();
  assert.equal(s.meRequests().length, 4, "and nothing else happens by itself (no infinite loop)");
  s.mePlans.push(me(alice));
  s.controller.retry();
  await s.flush();
  assert.deepEqual(s.controller.getState().user, alice);
  assert.equal(s.url(), "/p?q=1#f");
});

// ---- cached session ----------------------------------------------------------------------------------------------------------
test("cached session, transient 503 then 200: the cached profile is shown for continuity (status unavailable), then replaced by the SAME response's user", async () => {
  const s = setup({ stored: { ...alice, name: "Old name" } });
  s.mePlans.push(status(503), me({ ...alice, name: "New name" }));
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().user?.name, "Old name");
  assert.equal(s.controller.getState().sessionStatus, "unavailable", "continuity is not verification");
  await s.tick();
  assert.equal(s.controller.getState().user?.name, "New name");
  assert.equal(s.controller.getState().sessionStatus, "authenticated");
  assert.equal(s.meRequests().length, 2, "exactly one request per check: no redundant second GET to fetch the user");
});

test("cached session with 401: cleared, no retry", async () => {
  const s = setup({ stored: alice });
  s.mePlans.push(status(401));
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.store.has(USER_STORAGE_KEY), false);
  assert.equal(s.sleeps.length, 0);
});

test("the cached user is not shown before the server has answered (loading until then)", async () => {
  const s = setup({ stored: alice });
  const d = deferred();
  s.mePlans.push(d.plan);
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.controller.getState().loading, true);
  d.release(new Response(JSON.stringify({ success: true, user: alice }), { status: 200 }));
  await s.flush();
  assert.deepEqual(s.controller.getState().user, alice);
});

test("no stored user and no OAuth marker: nothing to verify, no request", async () => {
  const s = setup();
  s.controller.start();
  await s.flush();
  assert.equal(s.requests.length, 0);
  assert.equal(s.controller.getState().sessionStatus, "anonymous");
  assert.equal(s.controller.getState().loading, false);
});

// ---- P2 #3: single authoritative response ------------------------------------------------------------------------------------
test("a 200 with malformed or incomplete user data is NOT a verification: nothing persisted, status stays unavailable, cached profile is not rewritten", async () => {
  for (const body of [{ success: true }, { success: true, user: {} }, { success: true, user: { id: "alice" } }, { success: true, user: null }]) {
    const s = setup({ stored: { ...alice, name: "Cached" } });
    s.mePlans.push(json(200, body), json(200, body), json(200, body), json(200, body));
    s.controller.start();
    await s.flush();
    for (let i = 0; i < 3; i++) await s.tick();
    const st = s.controller.getState();
    assert.equal(st.sessionStatus, "unavailable", JSON.stringify(body));
    assert.equal(st.user?.name, "Cached", "the cache is shown as continuity, not as verified");
    assert.equal(cached(s).name, "Cached");
    assert.equal(s.meRequests().length, 4);
  }
  const s = setup({ stored: alice });
  s.mePlans.push(async () => new Response("<html>bad gateway</html>", { status: 200 }), me(alice));
  s.controller.start();
  await s.flush();
  assert.equal(s.controller.getState().sessionStatus, "unavailable");
  await s.tick();
  assert.equal(s.controller.getState().sessionStatus, "authenticated");
});

test("flapping 503 / 401: the definitive 401 ends it (cleared); a 503 after a 200 does not undo a completed verification", async () => {
  const s = setup({ stored: alice });
  s.mePlans.push(status(503), status(401));
  s.controller.start();
  await s.flush();
  await s.tick();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.store.has(USER_STORAGE_KEY), false);
  assert.equal(s.sleeps.length, 0);

  const t = setup({ stored: alice });
  t.mePlans.push(status(503), me(alice));
  t.controller.start();
  await t.flush();
  await t.tick();
  assert.equal(t.controller.getState().sessionStatus, "authenticated");
  t.mePlans.push(status(503));
  await assert.rejects(t.controller.refresh(), /Unable to refresh/);
  assert.equal(t.controller.getState().sessionStatus, "authenticated", "a failed refresh is reported to its caller, it does not log the user out");
  assert.deepEqual(t.controller.getState().user, alice);
});

// ---- P2 #2: logout and stale responses ---------------------------------------------------------------------------------------
test("logout during the pending retry delay: the retry never fires, nothing is restored", async () => {
  const s = setup({ stored: alice });
  s.mePlans.push(status(503));
  s.logoutPlans.push(status(200));
  s.controller.start();
  await s.flush();
  assert.equal(s.sleeps.length, 1);
  await s.controller.logout();
  await s.tick().catch(() => {});
  await s.flush();
  assert.equal(s.meRequests().length, 1, "no request after logout");
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.store.has(USER_STORAGE_KEY), false);
  assert.equal(s.store.has(LOGOUT_PENDING_KEY), false, "the server confirmed, so the logout intent is settled");
});

test("logout during an in-flight verification: the request is aborted and a late 200 cannot resurrect the user", async () => {
  const s = setup({ stored: alice });
  const d = deferred();
  s.mePlans.push(d.plan);
  s.logoutPlans.push(status(200));
  s.controller.start();
  await s.flush();
  const inflight = s.meRequests()[0].signal!;
  await s.controller.logout();
  assert.equal(inflight.aborted, true);
  d.release(new Response(JSON.stringify({ success: true, user: alice }), { status: 200 }));
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.store.has(USER_STORAGE_KEY), false);
});

test("logout AFTER the 200 arrived but BEFORE it was applied: the verified data is discarded (stale generation)", async () => {
  const s = setup({ stored: alice });
  const slow = slowBody(alice);
  s.mePlans.push(slow.plan);
  s.logoutPlans.push(status(200));
  s.controller.start();
  await s.flush();
  await s.controller.logout();
  slow.release();
  await s.flush();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.store.has(USER_STORAGE_KEY), false);
  assert.equal(s.controller.getState().sessionStatus, "anonymous");
});

test("server logout FAILS with the old cookie still valid: local logout intent is kept; a reload does not restore the session and retries the logout", async () => {
  const s = setup({ stored: alice });
  s.logoutPlans.push(network);
  s.mePlans.push(me(alice));
  s.controller.start();
  await s.flush();
  await s.controller.logout();
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.store.has(USER_STORAGE_KEY), false);
  assert.equal(s.store.get(LOGOUT_PENDING_KEY), "1", "the intent survives the failed request");
  // "Reload": a new controller over the same storage, cookie still valid on the server (/me would answer 200).
  const reload = setup({ logoutPending: true });
  reload.mePlans.push(me(alice));
  reload.logoutPlans.push(status(200));
  reload.controller.start();
  await reload.flush();
  assert.equal(reload.controller.getState().user, null, "the lingering cookie does not sign them back in");
  assert.equal(reload.meRequests().length, 0, "no verification is even attempted");
  assert.equal(reload.requests.filter((r) => r.url === "/api/auth/logout").length, 1, "the logout is retried");
  assert.equal(reload.store.has(LOGOUT_PENDING_KEY), false, "and settled once the server confirms");
});

test("an explicit new sign-in clears a pending logout intent: a password login, or a Google return that carries the nonce this browser created (a bare marker does not)", async () => {
  const s = setup({ logoutPending: true });
  s.loginPlans.push(json(200, { success: true, user: bob }));
  assert.deepEqual(await s.controller.login("B@Example.test ", "pw"), { ok: true });
  assert.equal(s.store.has(LOGOUT_PENDING_KEY), false);
  // Google: the click recorded a nonce; the callback echoed it.
  const nonce = beginGoogleSignIn({ getItem: (k) => s.store.get(k) ?? null, setItem: (k, v) => void s.store.set(k, v), removeItem: (k) => void s.store.delete(k) } as never, Date.now());
  const store = new Map<string, string>([[LOGOUT_PENDING_KEY, "1"], [OAUTH_INITIATION_KEY, s.store.get(OAUTH_INITIATION_KEY)!]]);
  const g = setup({ logoutPending: true, url: `https://app.test/?google-login=success&oauth_state=${nonce}` });
  g.store.set(OAUTH_INITIATION_KEY, store.get(OAUTH_INITIATION_KEY)!);
  g.mePlans.push(me(bob));
  g.controller.start();
  await g.flush();
  assert.deepEqual(g.controller.getState().user, bob);
  assert.equal(g.store.has(LOGOUT_PENDING_KEY), false);
  // …whereas the bare marker does not.
  const forged = setup({ logoutPending: true, url: "https://app.test/?google-login=success" });
  forged.logoutPlans.push(status(200));
  forged.controller.start();
  await forged.flush();
  assert.equal(forged.controller.getState().user, null);
  assert.equal(forged.meRequests().length, 0);
});

test("new account login while an old session check is in flight: the old response is aborted/ignored and never overwrites the new user", async () => {
  const s = setup({ stored: alice });
  const old = deferred();
  s.mePlans.push(old.plan);
  s.controller.start();
  await s.flush();
  s.loginPlans.push(json(200, { success: true, user: bob }));
  const result = await s.controller.login("bob@example.test", "pw");
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(s.controller.getState().user, bob);
  old.release(new Response(JSON.stringify({ success: true, user: alice }), { status: 200 }));
  await s.flush();
  assert.deepEqual(s.controller.getState().user, bob, "stale Alice cannot replace Bob");
  assert.deepEqual(cached(s), bob);
});

test("a check that BEGINS during a login but finishes after it is also stale", async () => {
  const s = setup({ stored: alice });
  const loginGate = deferred();
  s.loginPlans.push(loginGate.plan);
  const loginPromise = s.controller.login("bob@example.test", "pw");
  await s.flush();
  const inflightCheck = deferred();
  s.mePlans.push(inflightCheck.plan);
  s.controller.retry(); // a verification run that starts mid-login (old cookie)
  await s.flush();
  loginGate.release(new Response(JSON.stringify({ success: true, user: bob }), { status: 200 }));
  await loginPromise;
  inflightCheck.release(new Response(JSON.stringify({ success: true, user: alice }), { status: 200 }));
  await s.flush();
  assert.deepEqual(s.controller.getState().user, bob);
});

test("login superseded by logout: not signed in; the logout is sent only AFTER the login response (so it removes that cookie), exactly once", async () => {
  const s = setup();
  const loginGate = deferred();
  s.loginPlans.push(loginGate.plan);
  s.logoutPlans.push(status(200));
  const loginPromise = s.controller.login("bob@example.test", "pw");
  await s.flush();
  const logoutPromise = s.controller.logout();
  await s.flush();
  assert.equal(s.requests.filter((r) => r.url === "/api/auth/logout").length, 0, "cookie-changing requests are serialized: logout waits for the login to be delivered");
  loginGate.release(new Response(JSON.stringify({ success: true, user: bob }), { status: 200 }));
  const result = await loginPromise;
  await logoutPromise;
  await s.flush();
  assert.equal(result.ok, false);
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.store.has(USER_STORAGE_KEY), false);
  assert.equal(s.requests.filter((r) => r.url === "/api/auth/logout").length, 1, "one logout: the user's own, which also removes the stray cookie");
});

test("refresh is stale-safe too: a refresh answered after logout applies nothing", async () => {
  const s = setup({ stored: alice });
  s.mePlans.push(me(alice));
  s.controller.start();
  await s.flush();
  const d = deferred();
  s.mePlans.push(d.plan);
  s.logoutPlans.push(status(200));
  const refreshing = s.controller.refresh();
  await s.flush();
  await s.controller.logout();
  d.release(new Response(JSON.stringify({ success: true, user: alice }), { status: 200 }));
  await refreshing;
  assert.equal(s.controller.getState().user, null);
  assert.equal(s.store.has(USER_STORAGE_KEY), false);
});

test("refresh uses the one response it examined and applies the validated user", async () => {
  const s = setup({ stored: alice });
  s.mePlans.push(me(alice), me({ ...alice, name: "Refreshed" }));
  s.controller.start();
  await s.flush();
  await s.controller.refresh();
  assert.equal(s.controller.getState().user?.name, "Refreshed");
  assert.equal(s.meRequests().length, 2);
});

// ---- unmount, bounds, authority ----------------------------------------------------------------------------------------------
test("unmount during verification and during a retry delay: requests aborted, no timers, no state or storage writes afterwards", async () => {
  const s = setup({ stored: alice });
  const d = deferred();
  s.mePlans.push(d.plan);
  s.controller.start();
  await s.flush();
  const before = s.states.length;
  s.controller.dispose();
  d.release(new Response(JSON.stringify({ success: true, user: bob }), { status: 200 }));
  await s.flush();
  assert.equal(s.states.length, before, "no state update after dispose");
  assert.equal(JSON.parse(s.store.get(USER_STORAGE_KEY)!).id, "alice", "storage untouched");

  const t = setup({ stored: alice });
  t.mePlans.push(status(503));
  t.controller.start();
  await t.flush();
  assert.equal(t.sleeps.length, 1);
  t.controller.dispose();
  await t.flush();
  await t.tick().catch(() => {});
  assert.equal(t.meRequests().length, 1, "the retry never fires after unmount");
});

test("only one verification run is ever active: a second retry() while verifying is ignored; a newer run supersedes an older one", async () => {
  const s = setup({ url: "https://app.test/?google-login=success" });
  s.mePlans.push(status(503), status(503), status(503), status(503));
  s.controller.start();
  await s.flush();
  s.controller.retry();
  s.controller.retry();
  await s.flush();
  assert.equal(s.meRequests().length, 1, "retry() during an active run is a no-op: no duplicate loops");
});

test("no unauthorized access: the controller only talks to /api/auth/*, always with the cookie, never with a credential taken from localStorage", async () => {
  const s = setup({ stored: { ...alice, token: "should-never-be-sent" } as U });
  s.mePlans.push(status(503), me(alice));
  s.controller.start();
  await s.flush();
  await s.tick();
  for (const r of s.requests) {
    assert.match(r.url, /^\/api\/auth\//);
    assert.equal(r.credentials, "include");
    assert.equal(JSON.stringify(r.headers ?? {}).toLowerCase().includes("authorization"), false);
  }
  // During the outage the cached profile was only displayed; it granted no request of its own.
  assert.equal(s.requests.length, 2);
});

test("patchUser edits only a signed-in user and persists locally; after logout it is ignored", async () => {
  const s = setup({ stored: alice });
  s.mePlans.push(me(alice));
  s.logoutPlans.push(status(200));
  s.controller.start();
  await s.flush();
  s.controller.patchUser({ name: "Edited" });
  assert.equal(cached(s).name, "Edited");
  await s.controller.logout();
  s.controller.patchUser({ name: "Zombie" });
  assert.equal(s.store.has(USER_STORAGE_KEY), false);
});

// ---- neighbouring failure paths of the same lifecycle --------------------------------------------------------------------------------------
test("localStorage that throws (private mode / quota) does not break sign-in, sign-out or the session decision", async () => {
  let calls = 0;
  const angry = () => { calls++; throw new Error("QuotaExceededError"); };
  const controller = createSessionController<U>({
    fetch: (async () => new Response(JSON.stringify({ success: true, user: bob }), { status: 200 })) as unknown as typeof fetch,
    storage: { getItem: angry, setItem: angry, removeItem: angry },
    getLocation: () => ({ pathname: "/", search: "", hash: "" }),
    replaceUrl: () => {},
    sleep: async () => {},
    parseUser,
    onChange: () => {},
  });
  controller.start();
  assert.deepEqual(await controller.login("b@example.test", "pw"), { ok: true });
  assert.equal(controller.getState().user?.id, "bob", "state is set even though the cache could not be written");
  await controller.logout();
  assert.equal(controller.getState().user, null);
  assert.ok(calls > 0);
});

test("an unexpected exception inside a login slot resolves to an error (never rejects the caller) and does not wedge the queue", async () => {
  let boom = true;
  const seen: Array<unknown> = [];
  const controller = createSessionController<U>({
    fetch: (async () => new Response(JSON.stringify({ success: true, user: bob }), { status: 200 })) as unknown as typeof fetch,
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    getLocation: () => ({ pathname: "/", search: "", hash: "" }),
    replaceUrl: () => {},
    sleep: async () => {},
    parseUser,
    onChange: (st) => { seen.push(st); if (boom && st.user) { boom = false; throw new Error("listener exploded"); } },
  });
  const r1 = await controller.login("b@example.test", "pw");
  assert.equal(r1.ok, false);
  const r2 = await controller.login("b@example.test", "pw"); // the queue still works
  assert.equal(r2.ok, true);
});
