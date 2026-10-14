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
 *  - Code in a `try` block that has a `catch` clause is protected. Code in the `catch` block, in `finally`, and everywhere else is not.
 *  - Unprotected "risk sites":
 *      throw        an explicit `throw`                                     (strong)
 *      await        an `await`                                              (strong)
 *      then         a `.then(` chain                                        (strong)
 *      call         ANY other call/new whose callee is not on the allowlist (potential: the helper was not analysed, so it is never assumed safe)
 *    The allowlist is only response plumbing on `res` (`res.status().json()`, `.send`, `.set`, ...), `next(...)`, `console.*`, and a few
 *    side-effect-free builtins (RegExp#test, Math.*, parseInt, Array.isArray, ...). A handler whose ONLY calls are those is a static
 *    response and is NOT counted as a risk.
 *  - Risk inside a catch/finally block is reported separately (`catchRisk`), as informational: it only matters if the catch itself throws.
 *  - Limits: property access on undefined (`req.body.x.y`), getters, and implicit conversions can throw without any call; they are not modelled.
 */
import ts from "typescript";

export type RiskKind = "throw" | "await" | "then" | "call";
export type RiskSite = { kind: RiskKind; text: string };
export type HandlerAnalysis = {
  isAsync: boolean;
  /** safe-static: async, no unprotected risk. guarded: try/catch covers every risk. partial/unguarded: unprotected risk exists. */
  cls: "sync" | "async-safe" | "async-guarded" | "async-partial" | "async-unguarded" | "unparsed";
  /** strong = an await/throw/then is unprotected; potential = only unanalysed helper calls are unprotected; none = no unprotected risk. */
  severity: "strong" | "potential" | "none";
  hasTryCatch: boolean;
  sites: RiskSite[];
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
  const catchRisk: RiskSite[] = [];
  let hasTryCatch = false;
  const text = (n: ts.Node) => n.getText().replace(/\s+/g, " ").slice(0, 80);

  const walk = (node: ts.Node, protectedCode: boolean, inCatch: boolean) => {
    const sink = (kind: RiskKind) => {
      if (protectedCode) return;
      (inCatch ? catchRisk : sites).push({ kind, text: text(node) });
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
      walk(node.tryBlock, protectedCode || !!node.catchClause, inCatch);
      // Whatever the catch block does is NOT covered by its own try.
      if (node.catchClause) walk(node.catchClause.block, protectedCode, true);
      if (node.finallyBlock) walk(node.finallyBlock, protectedCode, true);
      return;
    }
    ts.forEachChild(node, (c) => walk(c, protectedCode, inCatch));
  };
  // Walk the body (or the single expression of an expression-bodied arrow); parameter default initialisers can also throw.
  fn.parameters.forEach((p) => p.initializer && walk(p.initializer, false, false));
  walk(fn.body, false, false);

  // Rethrow inside a catch is the one catch-block site that is certain to reject: promote it into the main list.
  const rethrows = catchRisk.filter((s) => s.kind === "throw");
  const allSites = [...sites, ...rethrows];
  const strong = allSites.some((s) => s.kind === "throw" || s.kind === "await" || s.kind === "then");
  let cls: HandlerAnalysis["cls"];
  if (allSites.length === 0) cls = hasTryCatch ? "async-guarded" : "async-safe";
  else cls = hasTryCatch ? "async-partial" : "async-unguarded";
  return { isAsync, cls, severity: allSites.length === 0 ? "none" : strong ? "strong" : "potential", hasTryCatch, sites: allSites, catchRisk: catchRisk.filter((s) => s.kind !== "throw") };
}
