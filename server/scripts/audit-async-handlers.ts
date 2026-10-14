/**
 * Stability Phase 2B: read-only audit of every async Express handler reachable from the real router tree.
 *
 * Walks `router.stack` (Express 4 internals, acceptable in a READ-ONLY audit tool; never in runtime code) and classifies each registered
 * function with lib/async-handler-analysis (TypeScript AST; see that file for exactly what counts as a risk):
 *   error-handler    arity 4, never wrapped
 *   sync             not an async function (a sync throw is caught by Express itself)
 *   async-safe       async, no try/catch, nothing that can throw (static response)
 *   async-guarded    every risk site is inside a try/catch whose catch does not rethrow
 *   async-partial    has a try/catch, but a risk site (or a rethrow) sits outside it
 *   async-unguarded  no try/catch and at least one risk site
 * "At risk" = partial + unguarded. Severity "strong" = an unprotected await/throw/.then(); "potential" = only unprotected calls to helpers
 * the analysis cannot prove safe (never assumed safe). Neither is a proof that a rejection occurs at runtime: that is what the runtime
 * tests (server/routes/async-failure-http.test.ts) establish for specific routes.
 * With --patched the Phase 2B forwarding is installed first and each row reports whether the registered function forwards rejections:
 * "uncoveredAsync" and "atRiskExposed" must then be 0.
 * Usage: DATABASE_URL=postgres://x@127.0.0.1:9/x tsx server/scripts/audit-async-handlers.ts [--json] [--patched]
 */
import "../lib/load-env";
import { analyzeHandlerSource, type HandlerAnalysis } from "../lib/async-handler-analysis";

type Cls = HandlerAnalysis["cls"] | "error-handler";
type Row = { method: string; path: string; cls: Cls; severity: HandlerAnalysis["severity"]; category: string; forwarded: boolean; async: boolean; reasons: string[]; catchRisk: number };

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

function analyze(fn: any): { cls: Cls; severity: HandlerAnalysis["severity"]; async: boolean; reasons: string[]; catchRisk: number } {
  const original = fn?.[ORIGINAL] ?? fn; // classify what a wrapper wraps
  if (typeof original !== "function") return { cls: "sync", severity: "none", async: false, reasons: [], catchRisk: 0 };
  if (original.length === 4) return { cls: "error-handler", severity: "none", async: false, reasons: [], catchRisk: 0 };
  const isAsync = original.constructor?.name === "AsyncFunction";
  if (!isAsync) return { cls: "sync", severity: "none", async: false, reasons: [], catchRisk: 0 };
  const a = analyzeHandlerSource(Function.prototype.toString.call(original));
  // An async function the analyser cannot parse is treated as unguarded/potential: never assumed safe.
  if (a.cls === "unparsed") return { cls: "async-unguarded", severity: "potential", async: true, reasons: ["unparsed"], catchRisk: 0 };
  return { cls: a.cls, severity: a.severity, async: true, reasons: a.sites.map((s) => `${s.kind}:${s.text}`), catchRisk: a.catchRisk.length };
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
        out.push({ method: (rl.method || "all").toUpperCase(), path, category: categorize(path), forwarded: !!rl.handle[WRAP_MARK], ...analyze(rl.handle) });
      }
    } else if (layer.handle?.stack) {
      walk(layer.handle.stack, prefix + mountPath(layer), out);
    } else {
      const p = prefix + mountPath(layer) || "/";
      out.push({ method: "USE", path: p, category: categorize(p), forwarded: !!layer.handle?.[WRAP_MARK], ...analyze(layer.handle) });
    }
  }
}

async function main() {
  if (process.argv.includes("--patched")) await import("../lib/async-error-forwarding.install");
  const { default: routes } = await import("../routes");
  const rows: Row[] = [];
  walk((routes as any).stack, "/api", rows);

  const tally = (rs: Row[]) => rs.reduce<Record<string, number>>((a, r) => ((a[r.cls] = (a[r.cls] || 0) + 1), a), {});
  // Statically risky AND not already forwarding: without --patched this is the exposure on main (asyncHandler-wrapped routes are excluded);
  // with --patched it must be 0.
  const atRisk = rows.filter((r) => (r.cls === "async-unguarded" || r.cls === "async-partial") && !r.forwarded);
  const sev = (s: string) => atRisk.filter((r) => r.severity === s).length;
  const byCat: Record<string, { atRisk: number; strong: number; potential: number; byClass: Record<string, number> }> = {};
  for (const c of Array.from(new Set(rows.map((r) => r.category)))) {
    const inCat = rows.filter((r) => r.category === c);
    const risky = inCat.filter((r) => atRisk.includes(r));
    byCat[c] = { atRisk: risky.length, strong: risky.filter((r) => r.severity === "strong").length, potential: risky.filter((r) => r.severity === "potential").length, byClass: tally(inCat) };
  }
  const uncoveredAsync = rows.filter((r) => r.async && !r.forwarded).length;
  const summary = {
    total: rows.length,
    asyncTotal: rows.filter((r) => r.async).length,
    atRiskExposed: atRisk.length,
    atRiskStrong: sev("strong"),
    atRiskPotentialCallOnly: sev("potential"),
    asyncWithOnlyCatchBlockCalls: rows.filter((r) => r.cls === "async-guarded" && r.catchRisk > 0).length,
    forwarded: rows.filter((r) => r.forwarded).length,
    uncoveredAsync,
    byClass: tally(rows),
    byCategory: byCat,
  };
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ summary, atRisk: atRisk.map(({ method, path, category, cls, severity, reasons }) => ({ method, path, category, cls, severity, reasons })) }, null, 1));
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
