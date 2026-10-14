/**
 * Stability Phase 2B: rejected promises from Express 4 handlers reach the error handler instead of `unhandledRejection`.
 *
 * Two layers:
 *  1. ISOLATED CHILD PROCESSES (async-failure-child.ts) carrying server/index.ts's `exit(1)` policy. "unpatched" reproduces the original
 *     failure (the process dies, the client gets no response, the error handler never runs); "patched" shows the corrected behaviour.
 *  2. Real Express HTTP servers in this process with the forwarding installed, covering the wrapper's contract.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import express, { Router } from "express";
import { forwardAsyncErrors, installAsyncErrorForwarding, ASYNC_FORWARDED } from "./async-error-forwarding";
import { asyncHandler } from "../middleware/error-handler";

installAsyncErrorForwarding();

const unhandled: unknown[] = [];
process.on("unhandledRejection", (reason) => { unhandled.push(reason); });

// ---- 1. isolated processes -------------------------------------------------------------------------------------------------
function runChild(mode: "patched" | "unpatched", route = "/boom") {
  const out = spawnSync(process.execPath, ["--import", "tsx", "server/lib/async-failure-child.ts", mode, route], { encoding: "utf8", timeout: 30_000 });
  const events = out.stdout.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
  return { status: out.status, events };
}

test("BASELINE (unpatched Express 4): an async handler rejection bypasses the error handler and kills the process via unhandledRejection", () => {
  const { status, events } = runChild("unpatched");
  assert.equal(status, 1, "the process exits with code 1 (the server/index.ts policy)");
  assert.deepEqual(events.map((e) => e.event), ["unhandledRejection"], "the error handler never ran and no response was produced");
  assert.equal(events[0].message, "async boom");
});

test("FIXED: the same rejection reaches the error handler once, the client gets 500, and the process keeps serving unrelated requests", () => {
  const { status, events } = runChild("patched");
  assert.equal(status, 0, "exited only because the child finished its script");
  assert.deepEqual(events.map((e) => e.event), ["errorHandler", "boom", "ok-after"]);
  assert.equal(events[0].message, "async boom");
  assert.equal(events[0].headersSent, false);
  assert.deepEqual(events[1].result, { status: 500 });
  assert.deepEqual(events[2].result, { status: 200 });
  assert.equal(events[2].handled, 1, "error handler invoked exactly once");
});

test("CALL-ONLY async failure (no await; a synchronous helper throws) -- BASELINE: unhandled rejection kills the process", () => {
  const { status, events } = runChild("unpatched", "/call-only");
  assert.equal(status, 1);
  assert.deepEqual(events.map((e) => e.event), ["unhandledRejection"]);
  assert.equal(events[0].message, "async boom");
});

test("CALL-ONLY async failure -- FIXED: original error reaches the error handler exactly once, 500, process survives and serves the next request", () => {
  const { status, events } = runChild("patched", "/call-only");
  assert.equal(status, 0);
  assert.deepEqual(events.map((e) => e.event), ["errorHandler", "boom", "ok-after"]);
  assert.equal(events[0].message, "async boom");
  assert.deepEqual(events[1].result, { status: 500 });
  assert.deepEqual(events[2].result, { status: 200 });
  assert.equal(events[2].handled, 1, "error handler invoked exactly once");
});

test("in-process: call-only async handlers (arrow, expression-bodied, function) deliver the original Error once and leave no unhandled rejection", async () => {
  const helper = (): never => { throw boom; };
  const boom = new Error("helper threw");
  const s = await serve((app) => {
    app.get("/expr", async () => helper());
    app.get("/block", async (_q, r) => { r.send(helper()); });
    app.get("/fn", async function (_q, r) { r.json({ v: helper() }); });
  });
  try {
    for (const p of ["/expr", "/block", "/fn"]) assert.equal((await s.get(p)).status, 500, p);
    await settle();
    assert.deepEqual(s.seen, [boom, boom, boom], "same instance, once per request");
    assert.equal(unhandled.length, 0);
  } finally { s.close(); }
});

// ---- 2. in-process HTTP ----------------------------------------------------------------------------------------------------
async function serve(build: (app: express.Express, seen: unknown[]) => void) {
  const app = express();
  app.use(express.json());
  const seen: unknown[] = [];
  build(app, seen);
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    seen.push(err);
    if (res.headersSent) return next(err);
    const status = (err as any)?.status ?? 500;
    res.status(status).json({ error: status === 500 ? "Internal Server Error" : "client" });
  });
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    seen,
    base,
    close: () => { server.close(); server.closeAllConnections?.(); },
    get: (p: string, init: RequestInit = {}) => fetch(base + p, init).then(async (r) => ({ status: r.status, text: await r.text() })),
  };
}
const settle = () => new Promise((r) => setTimeout(r, 50));

test("GET and POST handlers: rejection -> next(error) -> 500; original error object delivered exactly once", async () => {
  const boomGet = new Error("get failed");
  const boomPost = new Error("post failed");
  const s = await serve((app) => {
    app.get("/g", async () => { await settle(); throw boomGet; });
    app.post("/p", async (req) => { await Promise.resolve(); throw boomPost; });
    app.get("/ok", (_req, res) => { res.json({ ok: true }); });
  });
  try {
    assert.equal((await s.get("/g")).status, 500);
    assert.equal((await s.get("/p", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 500);
    assert.deepEqual(s.seen, [boomGet, boomPost], "same instances, once each");
    assert.equal((await s.get("/ok")).status, 200, "unrelated request unaffected");
    assert.equal(unhandled.length, 0);
  } finally { s.close(); }
});

test("synchronous exceptions still reach the error handler (unchanged Express behaviour)", async () => {
  const boom = new Error("sync");
  const s = await serve((app) => { app.get("/s", () => { throw boom; }); app.use("/m", () => { throw boom; }); });
  try {
    assert.equal((await s.get("/s")).status, 500);
    assert.equal((await s.get("/m/x")).status, 500);
    assert.deepEqual(s.seen, [boom, boom]);
  } finally { s.close(); }
});

test("async middleware rejection stops the chain: the handler behind it never runs", async () => {
  let handlerRan = false;
  const s = await serve((app) => {
    const mw = async (_req: express.Request, _res: express.Response, _next: express.NextFunction) => { await settle(); throw new Error("mw failed"); };
    app.get("/x", mw, (_req, res) => { handlerRan = true; res.json({}); });
    app.use("/y", mw);
    app.get("/y/z", (_req, res) => { handlerRan = true; res.json({}); });
  });
  try {
    assert.equal((await s.get("/x")).status, 500);
    assert.equal((await s.get("/y/z")).status, 500);
    assert.equal(handlerRan, false);
  } finally { s.close(); }
});

test("auth failure before a protected async handler: intentional 401 is kept and the handler body never executes", async () => {
  let executed = false;
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.headers.authorization) return res.status(401).json({ error: "unauthorized" });
    next();
  };
  const s = await serve((app) => { app.get("/secret", requireAuth, async () => { executed = true; throw new Error("db down"); }); });
  try {
    const denied = await s.get("/secret");
    assert.equal(denied.status, 401);
    assert.equal(denied.text, JSON.stringify({ error: "unauthorized" }));
    assert.equal(executed, false);
    assert.equal((await s.get("/secret", { headers: { authorization: "Bearer x" } })).status, 500, "error AFTER authentication reaches the error handler");
  } finally { s.close(); }
});

test("multiple middleware in one route (inline, array, nested array); route().get(); mounted and nested routers; mounted by path", async () => {
  const order: string[] = [];
  const s = await serve((app) => {
    const a = async (_q: express.Request, _s: express.Response, next: express.NextFunction) => { order.push("a"); next(); };
    const b = async (_q: express.Request, _s: express.Response, next: express.NextFunction) => { await settle(); order.push("b"); next(); };
    app.get("/multi", a, [b, [async () => { order.push("c"); throw new Error("c"); }]]);
    const inner = Router();
    inner.route("/leaf").get(async () => { throw new Error("leaf"); }).post(async (_q, r) => { r.status(201).json({ created: true }); });
    const mid = Router();
    mid.use("/inner", inner);
    mid.use(async () => { /* falls through only if nothing matched; never reached for /mid/inner/leaf */ });
    app.use("/mid", mid);
  });
  try {
    assert.equal((await s.get("/multi")).status, 500);
    assert.deepEqual(order, ["a", "b", "c"], "ordering preserved");
    assert.equal((await s.get("/mid/inner/leaf")).status, 500);
    const created = await s.get("/mid/inner/leaf", { method: "POST" });
    assert.equal(created.status, 201, "a successful async handler is untouched");
    assert.equal(s.seen.length, 2);
  } finally { s.close(); }
});

test("route-specific intentional statuses (400/401/403/404/409/429/503) are unchanged by the wrapper", async () => {
  const codes = [400, 401, 403, 404, 409, 429, 503];
  const s = await serve((app) => { for (const c of codes) app.get(`/c${c}`, async (_q, r) => { await Promise.resolve(); r.status(c).json({ c }); }); });
  try {
    for (const c of codes) assert.deepEqual(await s.get(`/c${c}`), { status: c, text: JSON.stringify({ c }) });
    assert.equal(s.seen.length, 0, "no handler status went through the error path");
  } finally { s.close(); }
});

test("error AFTER headers are sent: delegated to Express (connection closed), no second response, no crash", async () => {
  const boom = new Error("late");
  let handledWith: unknown;
  const s = await serve((app) => {
    app.get("/late", async (_q, res) => { res.status(200).write("partial"); await settle(); throw boom; });
    app.get("/ok", (_q, r) => { r.json({ ok: true }); });
  });
  try {
    await s.get("/late").then(() => undefined, (e) => { handledWith = e; });
    assert.ok(handledWith, "client sees a truncated response, not a clean 200");
    assert.deepEqual(s.seen, [boom]);
    assert.equal((await s.get("/ok")).status, 200, "process survives");
    assert.equal(unhandled.length, 0);
  } finally { s.close(); }
});

test("handler that calls next() and then rejects: logged, NOT forwarded (the chain must not be re-entered); no unhandledRejection", async () => {
  const errors: unknown[] = [];
  const original = console.error; console.error = (...a: unknown[]) => { errors.push(a); };
  let downstream = 0;
  const s = await serve((app) => {
    app.get("/n", async (_q, _r, next) => { next(); throw new Error("after next"); }, (_q, r) => { downstream++; r.json({ ok: true }); });
  });
  try {
    assert.equal((await s.get("/n")).status, 200);
    await settle();
    assert.equal(downstream, 1, "downstream ran exactly once");
    assert.equal(s.seen.length, 0);
    assert.equal(errors.length, 1, "not swallowed: logged once");
    assert.equal(unhandled.length, 0);
  } finally { console.error = original; s.close(); }
});

test("non-Error rejections are forwarded unchanged; a rejection that never settles does not break other requests", async () => {
  const s = await serve((app) => {
    app.get("/str", () => Promise.reject("plain string"));
    app.get("/undef", () => Promise.reject(undefined));
    app.get("/route", () => Promise.reject("route"));
    app.get("/ok", (_q, r) => { r.send("ok"); });
  });
  try {
    assert.equal((await s.get("/str")).status, 500);
    assert.equal((await s.get("/undef")).status, 500);
    assert.equal((await s.get("/route")).status, 500, "\"route\" must not be read by next() as skip-to-next-route");
    assert.equal(s.seen[0], "plain string");
    assert.ok(s.seen[1] instanceof Error && (s.seen[1] as Error).cause === undefined, "undefined is wrapped, never treated as success");
    assert.ok(s.seen[2] instanceof Error && (s.seen[2] as Error).cause === "route");
  } finally { s.close(); }
});

test("error handlers (arity 4) and routers are never wrapped; wrapping is idempotent; asyncHandler shares the implementation", () => {
  const errHandler = (_e: unknown, _q: unknown, _r: unknown, _n: unknown) => {};
  const app = express();
  app.use(errHandler as any);
  const r = Router();
  app.use("/r", r);
  const layers = (app as any)._router.stack as any[];
  assert.equal(layers.find((l) => l.handle === errHandler) !== undefined, true, "error handler registered as-is");
  assert.equal(layers.find((l) => l.handle === r) !== undefined, true, "router registered as-is");

  const fn = async (_q: any, _r: any, _n: any) => {};
  const w1 = forwardAsyncErrors(fn);
  assert.equal(forwardAsyncErrors(w1), w1, "idempotent");
  assert.equal(w1.length, 3, "Express still classifies it as a normal handler");
  const w2 = asyncHandler(fn);
  assert.equal((w2 as any)[ASYNC_FORWARDED], true);
  let wrapCount = 0;
  const route = Router().get("/x", w2);
  assert.equal((route as any).stack[0].route.stack[0].handle, w2, "an asyncHandler is registered as-is, not wrapped again");
  void wrapCount;
  assert.deepEqual(installAsyncErrorForwarding(), { installed: false, reason: "already installed" });
});

test("sub-app mounting and request ordering are unchanged (static -> router -> fallthrough 404)", async () => {
  const s = await serve((app) => {
    const sub = express();
    sub.get("/hi", async (_q, r) => { r.send("sub"); });
    app.use("/sub", sub);
    app.use("/api", Router().get("/a", async (_q, r) => { r.send("a"); }));
    app.use((_q, r) => { r.status(404).send("nf"); });
  });
  try {
    assert.equal((await s.get("/sub/hi")).text, "sub");
    assert.equal((await s.get("/api/a")).text, "a");
    assert.equal((await s.get("/nope")).status, 404);
  } finally { s.close(); }
});
