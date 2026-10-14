/**
 * Stability Phase 2B (Codex P2): the audit must count async handlers whose only failure source is a throwing synchronous call.
 * An async function turns ANY throw into a rejection, so `async () => helperThatThrows()` is as exposed as one with an `await`.
 */
import "../test-support/accept-test-sessions";
import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHandlerSource } from "./async-handler-analysis";

const a = (fn: Function | string) => analyzeHandlerSource(typeof fn === "string" ? fn : Function.prototype.toString.call(fn));
declare const helperThatThrows: () => any;
declare const db: any;
declare const res: any;
declare const req: any;

test("expression-bodied async arrow calling a throwing helper: unguarded, call-only (potential)", () => {
  const r = a("async (req, res) => helperThatThrows()");
  assert.equal(r.cls, "async-unguarded");
  assert.equal(r.severity, "potential");
  assert.equal(r.sites[0].kind, "call");
});

test("async function with a throwing helper call and no await: unguarded, potential", () => {
  const r = a(`async function (req, res) { const page = helperThatThrows(req.params.id); res.send(page); }`);
  assert.equal(r.cls, "async-unguarded");
  assert.equal(r.severity, "potential");
  assert.deepEqual(r.sites.map((s) => s.kind), ["call"]);
});

test("nested relevant call inside a response call is found: res.type('html').send(render(token))", () => {
  const r = a(`async (req, res) => { res.set("Cache-Control", "no-store"); res.type("html").send(render(req.query.token)); }`);
  assert.equal(r.cls, "async-unguarded");
  assert.ok(r.sites.some((s) => s.text.startsWith("render(")));
  assert.equal(r.sites.length, 1, "only the helper, not res.set/type/send");
});

test("explicit throw: unguarded, strong", () => {
  const r = a(`async (req, res) => { if (!req.body) throw new Error("no body"); res.json({}); }`);
  assert.equal(r.severity, "strong");
  assert.ok(r.sites.some((s) => s.kind === "throw"));
});

test("await: unguarded, strong", () => {
  const r = a(`async (req, res) => { const rows = await db.select(); res.json(rows); }`);
  assert.equal(r.cls, "async-unguarded");
  assert.equal(r.severity, "strong");
});

test(".then() chain: strong", () => {
  const r = a(`async (req, res) => { return db.select().then((rows) => res.json(rows)); }`);
  assert.equal(r.severity, "strong");
  assert.ok(r.sites.some((s) => s.kind === "then"));
});

test("partially guarded: a call outside the try is reported even though a try/catch exists", () => {
  const r = a(`async (req, res) => { const id = parseId(req.params.id); try { await db.update(id); res.json({}); } catch (e) { res.status(500).json({}); } }`);
  assert.equal(r.cls, "async-partial");
  assert.equal(r.hasTryCatch, true);
  assert.deepEqual(r.sites.map((s) => s.text), ["parseId(req.params.id)"], "the await inside the try is protected");
});

test("catch that rethrows is still a rejection: partial, strong", () => {
  const r = a(`async (req, res) => { try { await db.update(); } catch (e) { log(e); throw e; } }`);
  assert.equal(r.cls, "async-partial");
  assert.equal(r.severity, "strong");
  assert.ok(r.sites.some((s) => s.kind === "throw"));
});

test("fully guarded handler is not a risk; helper calls inside the catch are informational only", () => {
  const r = a(`async (req, res) => { try { const x = helper(); await db.q(x); res.json({}); } catch (e) { reportToMonitoring(e); res.status(500).json({ error: "x" }); } }`);
  assert.equal(r.cls, "async-guarded");
  assert.equal(r.severity, "none");
  assert.equal(r.catchRisk.length, 1, "reportToMonitoring() is noted, not counted as a risk");
});

test("static-response async handler is NOT a risk (res.status/json/send/set only)", () => {
  for (const src of [
    `async (_req, res) => { return res.status(503).json({ ok: false, code: "UNAVAILABLE" }); }`,
    `async (_req, res) => res.send("ok")`,
    `async (req, res) => { res.set("Cache-Control", "no-store"); if (!/^[a-f0-9]{64}$/.test(String(req.query.t))) return res.status(400).send("bad"); res.json({}); }`,
  ]) {
    const r = a(src);
    assert.equal(r.cls, "async-safe", src);
    assert.equal(r.severity, "none", src);
  }
});

test("uncertain calls are never assumed safe; nested functions are not walked; sync functions are out of scope", () => {
  assert.equal(a(`async (req, res) => { new URL(req.query.u); res.end(); }`).severity, "potential");
  assert.equal(a(`async (req, res) => { items.map((i) => explode(i)); res.end(); }`).sites.length, 1, "the .map call itself is a call; the callback body is not walked");
  assert.equal(a(`(req, res) => { helperThatThrows(); }`).cls, "sync");
  assert.equal(a(`async name(req, res) { await db.q(); }`).severity, "strong", "method shorthand parses");
});

test("the REAL GET /api/auth/verify-email route is classified as at-risk (call-only: verifyEmailPage)", async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL ||= "postgres://app:secret@127.0.0.1:9/chefsire_unreachable_test";
  const { default: routes } = await import("../routes");
  const find = (stack: any[]): any[] => stack.flatMap((l: any) => (l.route && l.route.path === "/auth/verify-email" && l.route.methods.get ? l.route.stack : l.handle?.stack ? find(l.handle.stack) : []));
  const layers = find((routes as any).stack);
  assert.ok(layers.length > 0, "route found in the real router tree");
  const handler = layers[layers.length - 1].handle;
  const original = handler[Symbol.for("chefsire.asyncOriginal")] ?? handler;
  const r = analyzeHandlerSource(Function.prototype.toString.call(original));
  assert.equal(r.isAsync, true);
  assert.equal(r.cls, "async-unguarded");
  assert.equal(r.severity, "potential");
  assert.ok(r.sites.some((s) => s.text.startsWith("verifyEmailPage(")), JSON.stringify(r.sites));
});
