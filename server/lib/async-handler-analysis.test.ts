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

test("fully guarded handler (nothing in catch can throw) is not a risk", () => {
  const r = a(`async (req, res) => { try { const x = helper(); await db.q(x); res.json({}); } catch (e) { console.error(e); res.status(500).json({ error: "x" }); } }`);
  assert.equal(r.cls, "async-guarded");
  assert.equal(r.severity, "none");
  assert.deepEqual(r.sites, []);
  assert.deepEqual(r.catchRisk, []);
});

// ---- recovery logic: catch / finally blocks are NOT protected by their own try ------------------------------------------------
const kinds = (r: ReturnType<typeof a>) => r.sites.map((s) => `${s.kind}@${s.where}`);

test("await inside catch that can reject: partial, strong, located in the catch", () => {
  const r = a(`async (req, res) => { try { await charge(); res.json({}); } catch (e) { await db.update(orders).set({ s: "x" }); res.status(500).json({}); } }`);
  assert.equal(r.cls, "async-partial");
  assert.equal(r.severity, "strong");
  assert.ok(kinds(r).includes("await@catch"));
  assert.ok(r.sites.every((s) => s.where === "catch"), "the protected try body contributes nothing");
  assert.deepEqual(r.catchRisk, r.sites, "catchRisk is a subset view of the same sites");
});

test("helper call inside catch that may throw: partial, potential", () => {
  const r = a(`async (req, res) => { try { res.json(compute()); } catch (e) { logAndMap(e, res); } }`);
  assert.equal(r.cls, "async-partial");
  assert.equal(r.severity, "potential");
  assert.deepEqual(kinds(r), ["call@catch"]);
});

test(".then() chain inside catch: strong", () => {
  const r = a(`async (req, res) => { try { await work(); } catch (e) { return db.rollback().then(() => res.status(500).json({})); } }`);
  assert.equal(r.severity, "strong");
  assert.ok(kinds(r).includes("then@catch"));
});

test("explicit throw inside catch: partial, strong", () => {
  const r = a(`async (req, res) => { try { await work(); } catch (e) { throw new HttpError(500); } }`);
  assert.equal(r.cls, "async-partial");
  assert.equal(r.severity, "strong");
  assert.ok(kinds(r).includes("throw@catch"));
});

test("database update inside catch: partial, strong (recovery write can reject)", () => {
  const r = a(`async (req, res) => { try { await refund(); } catch (error) { await db.update(orders).set({ paymentStatus: "captured" }).where(eq(orders.id, id)); res.status(502).json({}); } }`);
  assert.equal(r.cls, "async-partial");
  assert.equal(r.severity, "strong");
  assert.ok(r.sites.some((s) => s.kind === "await" && s.where === "catch"));
});

test("await / helper call / explicit throw inside finally are unprotected", () => {
  const fin = (body: string) => a(`async (req, res) => { try { res.json({}); } catch (e) { res.status(500).json({}); } finally { ${body} } }`);
  assert.deepEqual(kinds(fin("await releaseLock();")), ["await@finally", "call@finally"]);
  assert.equal(fin("await releaseLock();").severity, "strong");
  const call = fin("cleanup();");
  assert.deepEqual(kinds(call), ["call@finally"]);
  assert.equal(call.severity, "potential");
  const thr = fin("throw new Error('x');");
  assert.equal(thr.severity, "strong");
  assert.ok(kinds(thr).includes("throw@finally"));
  assert.equal(thr.cls, "async-partial");
});

test("nested try/catch: a recovery operation protected by an inner try/catch is handled internally (not a risk)", () => {
  const r = a(`async (req, res) => {
    try { await charge(); res.json({}); }
    catch (e) { try { await db.update(orders).set({ s: 1 }); } catch (inner) { console.error(inner); } res.status(502).json({}); }
  }`);
  assert.equal(r.cls, "async-guarded");
  assert.equal(r.severity, "none");
  assert.deepEqual(r.sites, []);
});

test("nested try/catch: a rejection escaping the outer handler is still a risk (inner catch recovery is unprotected)", () => {
  const r = a(`async (req, res) => {
    try { await charge(); res.json({}); }
    catch (e) { try { await db.update(orders).set({ s: 1 }); } catch (inner) { await notifyOps(inner); } res.status(502).json({}); }
  }`);
  assert.equal(r.cls, "async-partial");
  assert.deepEqual(kinds(r), ["await@catch", "call@catch"], "only the inner catch's own recovery escapes; the inner try body is protected");
  assert.match(r.sites[0].text, /notifyOps/);
});

test("a catch inside an OUTER try's try-block is protected by the outer catch", () => {
  const r = a(`async (req, res) => {
    try { try { await a1(); } catch (e) { await recover(e); } res.json({}); }
    catch (outer) { res.status(500).json({}); }
  }`);
  assert.equal(r.cls, "async-guarded");
  assert.deepEqual(r.sites, []);
});

test("a try WITHOUT catch (try/finally) protects nothing", () => {
  const r = a(`async (req, res) => { try { await work(); } finally { res.end(); } }`);
  assert.equal(r.cls, "async-unguarded");
  assert.equal(r.severity, "strong");
});

test("static response inside catch cannot throw under the documented assumptions: still guarded", () => {
  const r = a(`async (req, res) => { try { await work(); res.json({}); } catch (e) { console.error("x", e); return res.status(500).json({ error: "Internal Server Error" }); } }`);
  assert.equal(r.cls, "async-guarded");
  assert.equal(r.severity, "none");
});

test("expression-bodied async handler: sites found, no try possible", () => {
  assert.equal(a(`async (req, res) => recover(req)`).cls, "async-unguarded");
  assert.equal(a(`async (req, res) => (await db.q(), res.end())`).severity, "strong");
  assert.equal(a(`async (req, res) => res.status(204).end()`).cls, "async-safe");
});

test("async recovery logic that returns a rejected promise: caught only if the return is inside a protected try", () => {
  const escaping = a(`async (req, res) => { try { await work(); } catch (e) { return recover(e).catch(() => reRaise()); } }`);
  assert.equal(escaping.severity, "potential", "a .catch( chain is a plain unanalysed call, not an await/throw/.then");
  assert.ok(escaping.sites.length > 0 && escaping.sites.every((s) => s.where === "catch"));
  const rejects = a(`async (req, res) => { try { await work(); } catch (e) { return Promise.reject(e); } }`);
  assert.equal(rejects.cls, "async-partial", "Promise.reject is an unanalysed call");
  assert.ok(rejects.sites.some((s) => s.where === "catch"));
});

test("nested function bodies (callbacks) are still not walked, including inside catch", () => {
  const r = a(`async (req, res) => { try { await work(); } catch (e) { setTimeout(() => explode(), 0); res.status(500).json({}); } }`);
  assert.deepEqual(kinds(r), ["call@catch"], "setTimeout(...) is the call; the callback's explode() is not counted");
});

test("business-logic helpers are not exempted just because they sit next to res.*", () => {
  const r = a(`async (req, res) => { try { await work(); } catch (e) { res.status(500).json({ id: mapError(e) }); } }`);
  assert.deepEqual(r.sites.map((s) => s.text), ["mapError(e)"]);
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

// ---- real payment routes, from the actual router tree -----------------------------------------------------------------------
async function realHandler(method: "get" | "post", path: string): Promise<Function> {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL ||= "postgres://app:secret@127.0.0.1:9/chefsire_unreachable_test";
  const { default: routes } = await import("../routes");
  const find = (stack: any[], prefix: string): any[] => stack.flatMap((l: any) => (l.route && l.route.methods[method] && prefix + l.route.path === path ? l.route.stack : l.handle?.stack ? find(l.handle.stack, prefix + ((l.regexp?.source ?? "").replace("^", "").replace("\\/?(?=\\/|$)", "").replace(/\\\//g, "/"))) : []));
  const layers = find((routes as any).stack, "/api");
  assert.ok(layers.length > 0, `${method} ${path} found in the real router tree`);
  const h = layers[layers.length - 1].handle;
  return h[Symbol.for("chefsire.asyncOriginal")] ?? h;
}

test("REAL POST /api/payments/create-payment: recovery (settleMarketplaceCaptureFailure) in the catch is reported as an escaping, strong risk", async () => {
  const r = analyzeHandlerSource(Function.prototype.toString.call(await realHandler("post", "/api/payments/create-payment")));
  assert.equal(r.cls, "async-partial");
  assert.equal(r.severity, "strong");
  assert.ok(r.sites.some((s) => s.kind === "await" && s.where === "catch" && s.text.includes("settleMarketplaceCaptureFailure")), JSON.stringify(r.sites));
  assert.ok(r.sites.every((s) => s.where === "catch"), "the main body is fully inside the try");
});

test("REAL POST /api/payments/refund: the recovery database update in the catch is reported as an escaping, strong risk", async () => {
  const r = analyzeHandlerSource(Function.prototype.toString.call(await realHandler("post", "/api/payments/refund")));
  assert.equal(r.cls, "async-partial");
  assert.equal(r.severity, "strong");
  assert.ok(r.sites.some((s) => s.kind === "await" && s.where === "catch" && /db\.update\(orders\)/.test(s.text)), JSON.stringify(r.sites));
});
