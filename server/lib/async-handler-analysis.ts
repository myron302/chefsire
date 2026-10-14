/**
 * Static rejection-risk analysis of a single handler's source text (Stability Phase 2B audit).
 *
 * An `async` function never throws synchronously: ANY throw inside it -- an explicit `throw`, a rejected `await`, a rejected `.then()`
 * chain, OR a plain synchronous helper call that throws (`res.send(renderPage(token))`) -- becomes a rejected promise. On Express 4 that
 * rejection is unhandled unless something forwards it. So the question for each handler is: can anything outside a protecting
 * `try { } catch { }` throw?
 *
 * Method (TypeScript AST, conservative):
 *  - Walk the function body, NOT descending into nested functions (their bodies run later, under their own rules).
 *  - Code in a `try` block that has a `catch` clause is protected. Code in that try's own `catch` block, in its `finally`, and everywhere else is
 *    not protected BY IT: recovery logic that awaits or calls a helper can reject just as well (a payment handler whose catch awaits a ledger
 *    settlement is the motivating case). Protection nests: a catch/finally inside an OUTER try-with-catch's try block is protected by the outer
 *    one; a try inside a catch protects only its own try block.
 *  - Unprotected "risk sites":
 *      throw        an explicit `throw`                                     (strong)
 *      await        an `await`                                              (strong)
 *      then         a `.then(` chain                                        (strong)
 *      call         ANY other call/new whose callee is not on the allowlist (potential: the helper was not analysed, so it is never assumed safe)
 *    The allowlist is only response plumbing on `res` (`res.status().json()`, `.send`, `.set`, ...), `next(...)`, `console.*`, and a few
 *    side-effect-free builtins (RegExp#test, Math.*, parseInt, Array.isArray, ...). A handler whose ONLY calls are those is a static
 *    response and is NOT counted as a risk.
 *  - Every unprotected site is a site, wherever it is (`where`: body | catch | finally). `catchRisk` is just the subset of `sites` located in a
 *    catch/finally, so `sites`, `cls` and `severity` all describe the one escaping-rejection model. A handler is NOT safe merely because it
 *    contains a try/catch.
 *  - Limits: property access on undefined (`req.body.x.y`), getters, and implicit conversions can throw without any call; they are not modelled.
 */
import ts from "typescript";

export type RiskKind = "throw" | "await" | "then" | "call";
export type RiskSite = { kind: RiskKind; text: string; where: "body" | "catch" | "finally" };
export type HandlerAnalysis = {
  isAsync: boolean;
  /** safe-static: async, no unprotected risk. guarded: try/catch covers every risk. partial/unguarded: unprotected risk exists. */
  cls: "sync" | "async-safe" | "async-guarded" | "async-partial" | "async-unguarded" | "unparsed";
  /** strong = an await/throw/then can escape; potential = only unanalysed helper calls can escape; none = nothing can escape. */
  severity: "strong" | "potential" | "none";
  hasTryCatch: boolean;
  /** Every site whose failure escapes the handler as a rejection. */
  sites: RiskSite[];
  /** The subset of `sites` that sits in a catch/finally block (recovery logic). */
  catchRisk: RiskSite[];
};

const RES_METHODS = new Set(["status", "json", "send", "sendStatus", "set", "setHeader", "header", "type", "contentType", "redirect", "end", "cookie", "clearCookie", "location", "vary", "append", "links", "write", "writeHead", "sendFile", "attachment", "get", "removeHeader"]);
const SAFE_GLOBAL_FUNCS = new Set(["parseInt", "parseFloat", "isNaN", "isFinite", "Boolean", "Number", "String"]);
const SAFE_NAMESPACES = new Set(["Math"]);
const SAFE_QUALIFIED = new Set(["Array.isArray", "Number.isFinite", "Number.isInteger", "Number.isNaN", "Number.isSafeInteger", "Date.now", "Object.keys", "Object.values", "Object.entries"]);

/** Root identifier of `a.b(c).d(e)` -> `a`. */
function rootIdentifier(expr: ts.Expression): string | undefined {
  let cur: ts.Node = expr;
  for (;;) {
    if (ts.isCallExpression(cur) || ts.isNonNullExpression(cur) || ts.isParenthesizedExpression(cur)) cur = cur.expression;
    else if (ts.isPropertyAccessExpression(cur) || ts.isElementAccessExpression(cur)) cur = cur.expression;
    else break;
  }
  return ts.isIdentifier(cur) ? cur.text : undefined;
}

function isAllowedCall(node: ts.CallExpression | ts.NewExpression): boolean {
  if (ts.isNewExpression(node)) return false;
  const callee = node.expression;
  if (ts.isIdentifier(callee)) {
    // `next(...)` is Express control flow; `__name(...)` is esbuild's keepNames helper, injected into transpiled sources.
    return callee.text === "next" || callee.text.startsWith("__name") || SAFE_GLOBAL_FUNCS.has(callee.text);
  }
  if (ts.isPropertyAccessExpression(callee)) {
    const root = rootIdentifier(callee);
    const method = callee.name.text;
    if ((root === "res" || root === "response") && RES_METHODS.has(method)) return true;
    if (root === "console") return true;
    if (root && SAFE_NAMESPACES.has(root) && ts.isIdentifier(callee.expression)) return true;
    if (ts.isIdentifier(callee.expression) && SAFE_QUALIFIED.has(`${callee.expression.text}.${method}`)) return true;
    // A regex literal or a conventionally named regex constant: `/^[a-f0-9]{64}$/.test(token)`, `VERIFY_TOKEN_SHAPE.test(token)`.
    if (method === "test" && (ts.isRegularExpressionLiteral(callee.expression) || (ts.isIdentifier(callee.expression) && /^[A-Z0-9_]+$/.test(callee.expression.text)))) return true;
  }
  return false;
}

function findFunction(sf: ts.SourceFile): ts.FunctionLikeDeclaration | undefined {
  let found: ts.FunctionLikeDeclaration | undefined;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) found = n;
    else ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

export function analyzeHandlerSource(src: string): HandlerAnalysis {
  const empty = (cls: HandlerAnalysis["cls"], isAsync = false): HandlerAnalysis => ({ isAsync, cls, severity: "none", hasTryCatch: false, sites: [], catchRisk: [] });
  let fn: ts.FunctionLikeDeclaration | undefined;
  for (const wrapped of [`(${src})`, `({${src}})`]) {
    const sf = ts.createSourceFile("h.ts", wrapped, ts.ScriptTarget.ES2022, true);
    fn = findFunction(sf);
    if (fn) break;
  }
  if (!fn || !fn.body) return empty("unparsed");
  const isAsync = !!fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
  if (!isAsync) return empty("sync");

  const sites: RiskSite[] = [];
  let hasTryCatch = false;
  const text = (n: ts.Node) => n.getText().replace(/\s+/g, " ").slice(0, 80);

  const walk = (node: ts.Node, protectedCode: boolean, where: RiskSite["where"]) => {
    const sink = (kind: RiskKind) => {
      if (!protectedCode) sites.push({ kind, text: text(node), where });
    };
    if (ts.isFunctionLike(node) && node !== fn) return; // nested function: runs later, under its own rules
    if (ts.isThrowStatement(node)) sink("throw");
    else if (ts.isAwaitExpression(node)) sink("await");
    else if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "then") sink("then");
      else if (!isAllowedCall(node)) sink("call");
    }
    if (ts.isTryStatement(node)) {
      if (node.catchClause) hasTryCatch = true;
      // The try block is protected by its own catch; the catch block and the finally block are protected only by an ENCLOSING try
      // (`protectedCode` as inherited) -- never by the statement they belong to.
      walk(node.tryBlock, protectedCode || !!node.catchClause, where);
      if (node.catchClause) walk(node.catchClause.block, protectedCode, "catch");
      if (node.finallyBlock) walk(node.finallyBlock, protectedCode, "finally");
      return;
    }
    ts.forEachChild(node, (c) => walk(c, protectedCode, where));
  };
  // Parameter default initialisers can also throw.
  fn.parameters.forEach((p) => p.initializer && walk(p.initializer, false, "body"));
  walk(fn.body, false, "body");

  const strong = sites.some((s) => s.kind === "throw" || s.kind === "await" || s.kind === "then");
  let cls: HandlerAnalysis["cls"];
  if (sites.length === 0) cls = hasTryCatch ? "async-guarded" : "async-safe";
  else cls = hasTryCatch ? "async-partial" : "async-unguarded";
  return { isAsync, cls, severity: sites.length === 0 ? "none" : strong ? "strong" : "potential", hasTryCatch, sites, catchRisk: sites.filter((s) => s.where !== "body") };
}
