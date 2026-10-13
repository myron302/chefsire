/**
 * Stability Phase 2B: read-only audit of every async Express handler reachable from the real router tree.
 *
 * Walks `router.stack` (Express 4 internals, acceptable in a READ-ONLY audit tool; never in runtime code) and classifies each handler:
 *   error-handler  : arity 4, never wrapped
 *   wrapped        : already forwards rejections to next() (asyncHandler / the Phase 2B wrapper)
 *   sync           : not an async function (a sync throw is caught by Express itself)
 *   async-guarded  : async body is exactly one try/catch whose catch does not rethrow
 *   async-partial  : has a try/catch but other statements (awaits/calls) sit outside it, or the catch rethrows
 *   async-unguarded: async with no try/catch at all -> a rejection is unhandled on Express 4
 * With --patched the Phase 2B forwarding is installed first, and each row also reports whether the registered function forwards rejections:
 * "uncoveredAsync" must then be 0 (every async handler/middleware is covered, whether or not it has its own try/catch).
 * Usage: DATABASE_URL=postgres://x@127.0.0.1:9/x tsx server/scripts/audit-async-handlers.ts [--json] [--patched]
 */
import "../lib/load-env";
import ts from "typescript";

type Cls = "error-handler" | "wrapped" | "sync" | "async-guarded" | "async-partial" | "async-unguarded";
type Row = { method: string; path: string; cls: Cls; category: string; middleware: boolean; forwarded: boolean; async: boolean; canReject: boolean };

const CATEGORIES: Array<[string, RegExp]> = [
  ["square-payments-webhooks", /square|webhook|\/payments|\/payouts/i],
  ["catering", /catering/i],
  ["auth-oauth", /\/auth|oauth|google|facebook|tiktok|\/login|\/signup|\/session/i],
  ["wedding", /wedding|vendor-sub/i],
  ["marketplace-orders", /marketplace|\/orders|\/stores|store-drops|subscriptions/i],
  ["nutrition-meal-planning", /nutrition|meal|pantry|adaptive|substitution|allerg/i],
  ["messaging-notifications", /\/dm\b|\/dm\/|notification|\/clubs|\/events|cook-together|duets/i],
  ["uploads-media", /upload|media|import-paprika/i],
  ["users-social", /\/users|follows|posts|bites|reviews|recipes|remix|leaderboard|achievement|streak|quest|suggest|competition/i],
];
const categorize = (p: string) => CATEGORIES.find(([, re]) => re.test(p))?.[0] ?? "other";

const WRAP_MARK = Symbol.for("chefsire.asyncForwarded");
const ORIGINAL = Symbol.for("chefsire.asyncOriginal");
const isAsync = (fn: any) => (fn?.[ORIGINAL] ?? fn)?.constructor?.name === "AsyncFunction";

/** Handlers classified unguarded/partial that can actually reject: an `await`/call sits outside any catch. Static 503/201 stubs cannot. */
const canReject = new WeakMap<object, boolean>();
function classify(fn: any): Cls {
  if (fn?.[ORIGINAL]) fn = fn[ORIGINAL]; // classify what the wrapper wraps
  if (typeof fn !== "function") return "sync";
  if (fn.length === 4) return "error-handler";
  const src = Function.prototype.toString.call(fn);
  if (/\.catch\(\s*next\s*\)/.test(src)) return "wrapped"; // pre-2B asyncHandler closure
  if (fn.constructor?.name !== "AsyncFunction") return "sync";
  const sf = ts.createSourceFile("h.ts", `(${src})`, ts.ScriptTarget.ES2022, true);
  let body: ts.Node | undefined;
  const visit = (n: ts.Node) => {
    if (body) return;
    if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n.body) body = n.body;
    else ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!body || !ts.isBlock(body)) return "async-unguarded"; // expression-bodied async arrow
  const stmts = (body as ts.Block).statements;
  const tries = stmts.filter(ts.isTryStatement);
  const hasCatch = (t: ts.TryStatement) => !!t.catchClause;
  const rethrows = (t: ts.TryStatement) => {
    let r = false;
    const v = (n: ts.Node) => { if (ts.isThrowStatement(n)) r = true; else ts.forEachChild(n, v); };
    if (t.catchClause) v(t.catchClause.block);
    return r;
  };
  if (!tries.some(hasCatch)) { canReject.set(fn, /\bawait\b|\.then\(/.test(src)); return "async-unguarded"; }
  const others = stmts.filter((s) => !ts.isTryStatement(s));
  const risky = others.some((s) => {
    let bad = false;
    const v = (n: ts.Node) => { if (ts.isAwaitExpression(n) || ts.isCallExpression(n)) bad = true; else ts.forEachChild(n, v); };
    v(s);
    return bad;
  });
  if (risky || tries.some(rethrows)) { canReject.set(fn, true); return "async-partial"; }
  return "async-guarded";
}

function mountPath(layer: any): string {
  const src: string = layer.regexp?.source ?? "";
  if (layer.regexp?.fast_slash) return "";
  return src.replace("^", "").replace("\\/?(?=\\/|$)", "").replace(/\\\//g, "/").replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ":p");
}

function walk(stack: any[], prefix: string, out: Row[]) {
  for (const layer of stack) {
    if (layer.route) {
      const path = prefix + layer.route.path;
      for (const rl of layer.route.stack) {
        out.push({ method: (rl.method || "all").toUpperCase(), path, cls: classify(rl.handle), category: categorize(path), middleware: rl !== layer.route.stack[layer.route.stack.length - 1], forwarded: !!rl.handle[WRAP_MARK], async: isAsync(rl.handle), canReject: canReject.get(rl.handle?.[ORIGINAL] ?? rl.handle) ?? false });
      }
    } else if (layer.handle?.stack) {
      walk(layer.handle.stack, prefix + mountPath(layer), out);
    } else {
      out.push({ method: "USE", path: prefix + mountPath(layer) || "/", cls: classify(layer.handle), category: categorize(prefix + mountPath(layer)), middleware: true, forwarded: !!layer.handle?.[WRAP_MARK], async: isAsync(layer.handle), canReject: canReject.get(layer.handle?.[ORIGINAL] ?? layer.handle) ?? false });
    }
  }
}

async function main() {
if (process.argv.includes("--patched")) await import("../lib/async-error-forwarding.install");
const { default: routes } = await import("../routes");
const rows: Row[] = [];
walk((routes as any).stack, "/api", rows);

const tally = (rs: Row[]) => rs.reduce<Record<string, number>>((a, r) => ((a[r.cls] = (a[r.cls] || 0) + 1), a), {});
const byCat: Record<string, Record<string, number>> = {};
for (const c of Array.from(new Set(rows.map((r) => r.category)))) byCat[c] = tally(rows.filter((r) => r.category === c));
const uncoveredAsync = rows.filter((r) => r.async && !r.forwarded && r.cls !== "wrapped" && r.cls !== "error-handler").length;
const atRisk = rows.filter((r) => (r.cls === "async-unguarded" || r.cls === "async-partial") && r.canReject);
const summary = { atRiskCanReject: atRisk.length, total: rows.length, asyncTotal: rows.filter((r) => r.async).length, forwarded: rows.filter((r) => r.forwarded).length, uncoveredAsync, byClass: tally(rows), byCategory: byCat };

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ summary, vulnerable: atRisk }, null, 1));
} else {
  console.log(JSON.stringify(summary, null, 2));
}
process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
