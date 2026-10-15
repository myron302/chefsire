/**
 * Stability Phase 2C (Codex P1-1): the login request/response lifecycle with a REAL fetch against a REAL HTTP server (undici's fetch has the same abort
 * semantics as a browser's: aborting the signal after the headers arrive terminates the body stream). The controller must be able to READ an ordinary
 * successful login body, must stay bounded, and must never be left permanently pending.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createSessionController, LOGOUT_PENDING_KEY, USER_STORAGE_KEY } from "./session-controller";

type U = { id: string; email: string };
const USERS: Record<string, U> = { "a@example.test": { id: "alice", email: "a@example.test" }, "b@example.test": { id: "bob", email: "b@example.test" } };
const parseUser = (p: unknown): U => { if (!p || typeof p !== "object" || !("id" in p) || !("email" in p)) throw new Error("incomplete"); return p as U; };

type Behavior =
  | { kind: "ok"; bodyDelayMs?: number; chunks?: number }
  | { kind: "html" }
  | { kind: "badjson" }
  | { kind: "no-user" }
  | { kind: "truncate" }   // headers + half the body, then the connection dies
  | { kind: "reset" }      // connection dies before any response
  | { kind: "hang" }       // never answers
  | { kind: "hang-body" }; // headers (with Set-Cookie), then never sends the body

async function realSite(opts: { mutationTimeoutMs?: number } = {}) {
  const script: Behavior[] = [];
  const log: string[] = [];
  const server = { cookie: null as string | null };
  const sockets = new Set<import("node:net").Socket>();
  const srv = http.createServer((req, res) => {
    const url = req.url!;
    if (url === "/api/auth/me") {
      log.push("me");
      if (!server.cookie) { res.writeHead(401, { "content-type": "application/json" }).end("{}"); return; }
      const user = Object.values(USERS).find((u) => u.id === server.cookie)!;
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ success: true, user }));
      return;
    }
    if (url === "/api/auth/logout") { log.push("logout"); server.cookie = null; res.writeHead(200, { "set-cookie": "auth_token=; Max-Age=0; Path=/" }).end("{}"); return; }
    if (url === "/api/auth/login") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const email = JSON.parse(raw).email as string;
        log.push(`login:${email}`);
        const b = script.shift() ?? { kind: "ok" as const };
        if (b.kind === "reset") { req.socket.destroy(); return; }
        if (b.kind === "hang") return;
        const user = USERS[email];
        server.cookie = user.id; // the real server has authenticated this user
        const head = { "content-type": "application/json", "set-cookie": `auth_token=${user.id}; Path=/; HttpOnly` };
        const body = JSON.stringify({ success: true, user });
        if (b.kind === "html") { res.writeHead(200, { "content-type": "text/html" }).end("<html>gateway</html>"); return; }
        if (b.kind === "badjson") { res.writeHead(200, head).end("{not json"); return; }
        if (b.kind === "no-user") { res.writeHead(200, head).end(JSON.stringify({ success: true })); return; }
        if (b.kind === "truncate") { res.writeHead(200, { ...head, "content-length": String(body.length) }); res.write(body.slice(0, 10)); setTimeout(() => req.socket.destroy(), 20); return; }
        if (b.kind === "hang-body") { res.writeHead(200, { ...head, "transfer-encoding": "chunked" }); res.write(" "); return; }
        // ok: headers first, then the body (optionally in pieces, optionally later)
        res.writeHead(200, { ...head, "transfer-encoding": "chunked" });
        res.flushHeaders();
        const pieces = Math.max(1, b.chunks ?? 1);
        const size = Math.ceil(body.length / pieces);
        let i = 0;
        const send = () => { const part = body.slice(i * size, (i + 1) * size); i += 1; if (i >= pieces) res.end(part); else { res.write(part); setTimeout(send, 15); } };
        setTimeout(send, b.bodyDelayMs ?? 0);
      });
      return;
    }
    res.writeHead(404).end();
  });
  srv.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const store = new Map<string, string>();
  const controller = createSessionController<U>({
    fetch: ((url: string, init?: RequestInit) => fetch(base + url, init)) as typeof fetch,
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) },
    getLocation: () => ({ pathname: "/", search: "", hash: "" }),
    replaceUrl: () => {},
    sleep: () => new Promise(() => {}),
    parseUser,
    onChange: () => {},
    mutationTimeoutMs: opts.mutationTimeoutMs ?? 5000,
  });
  const close = async () => { controller.dispose(); for (const s of sockets) s.destroy(); await new Promise<void>((r) => srv.close(() => r())); };
  return { controller, script, log, server, store, close };
}
const withTimeout = <T>(p: Promise<T>, ms: number, label: string) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${label}: still pending after ${ms}ms`)), ms))]);

test("an ordinary successful login is read from its own response: user adopted, NO /api/auth/me reconciliation", async () => {
  const s = await realSite();
  try {
    s.script.push({ kind: "ok" });
    assert.deepEqual(await withTimeout(s.controller.login("a@example.test", "pw"), 3000, "login"), { ok: true });
    assert.equal(s.controller.getState().user?.id, "alice");
    assert.deepEqual(s.log, ["login:a@example.test"], "no reconciliation request");
    assert.equal(JSON.parse(s.store.get(USER_STORAGE_KEY)!).id, "alice");
  } finally { await s.close(); }
});

test("a login whose BODY arrives after the headers (delayed, and in several chunks) is still read in full", async () => {
  const s = await realSite();
  try {
    s.script.push({ kind: "ok", bodyDelayMs: 150, chunks: 4 });
    assert.deepEqual(await withTimeout(s.controller.login("b@example.test", "pw"), 3000, "login"), { ok: true });
    assert.equal(s.controller.getState().user?.id, "bob");
    assert.deepEqual(s.log, ["login:b@example.test"]);
  } finally { await s.close(); }
});

test("malformed JSON / HTML / missing user in a 2xx: reconciled with the server (exactly one /me), server identity adopted", async () => {
  for (const kind of ["badjson", "html", "no-user"] as const) {
    const s = await realSite();
    try {
      s.script.push({ kind });
      assert.deepEqual(await withTimeout(s.controller.login("b@example.test", "pw"), 3000, kind), { ok: true }, kind);
      assert.equal(s.controller.getState().user?.id, "bob", kind);
      assert.deepEqual(s.log, ["login:b@example.test", "me"], kind);
    } finally { await s.close(); }
  }
});

test("a body that is cut off mid-stream (connection dies after the headers) is reconciled, not trusted", async () => {
  const s = await realSite();
  try {
    s.script.push({ kind: "truncate" });
    const r = await withTimeout(s.controller.login("a@example.test", "pw"), 3000, "truncate");
    assert.equal(r.ok, true);
    assert.equal(s.controller.getState().user?.id, "alice");
    assert.deepEqual(s.log, ["login:a@example.test", "me"]);
  } finally { await s.close(); }
});

test("network failure before any response: a clean error, nobody signed out, no reconciliation", async () => {
  const s = await realSite();
  try {
    s.script.push({ kind: "ok" });
    await s.controller.login("a@example.test", "pw"); // Alice signed in
    s.script.push({ kind: "reset" });
    const r = await withTimeout(s.controller.login("b@example.test", "pw"), 3000, "reset");
    assert.equal(r.ok, false);
    assert.equal(s.controller.getState().user?.id, "alice", "an unrelated existing session is untouched");
    assert.ok(!s.log.includes("logout"));
  } finally { await s.close(); }
});

test("a login that never answers is bounded by the deadline and does not leave the queue pending: the next operation still runs", async () => {
  const s = await realSite({ mutationTimeoutMs: 250 });
  try {
    s.script.push({ kind: "hang" });
    const t = Date.now();
    const r = await withTimeout(s.controller.login("a@example.test", "pw"), 4000, "hang");
    assert.equal(r.ok, false);
    assert.ok(Date.now() - t < 3000);
    s.script.push({ kind: "ok" });
    assert.deepEqual(await withTimeout(s.controller.login("b@example.test", "pw"), 3000, "next login"), { ok: true });
    assert.equal(s.controller.getState().user?.id, "bob");
  } finally { await s.close(); }
});

test("headers arrive but the body never does: the deadline ends the exchange (not pending forever), the session is reconciled with the server", async () => {
  const s = await realSite({ mutationTimeoutMs: 250 });
  try {
    s.script.push({ kind: "hang-body" });
    const r = await withTimeout(s.controller.login("a@example.test", "pw"), 4000, "hang-body");
    assert.ok(r);
    assert.equal(s.controller.getState().user?.id, "alice", "the server authenticated Alice; that is what is shown");
    assert.ok(s.log.includes("me"));
    assert.equal(s.store.has(LOGOUT_PENDING_KEY), false);
  } finally { await s.close(); }
});
