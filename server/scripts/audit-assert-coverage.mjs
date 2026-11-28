#!/usr/bin/env node
/**
 * Finds test blocks that cannot fail: a `test()` or `it()` whose body reaches no assertion.
 *
 * Done-condition 2 of the launch campaign is "no suite passes while asserting nothing, and no suite fails at
 * random". Four suites of the first kind were found by hand in two days -- the rendering smoke check's media
 * floor and colour probe, the drink-builder payload fixture, the premium-access fixture -- which is reason to
 * think there are more, and a poor reason to keep finding them by luck.
 *
 * An earlier attempt split the files on `test(` with a regular expression and reported 5,487 hits with
 * unreadable names, because that does not find test blocks. This walks the TypeScript AST instead, which the
 * repository already depends on.
 *
 * WHAT IT CAN AND CANNOT SEE. A block counts as asserting when an assertion appears anywhere inside it, or
 * inside a function declared in the same file that it calls (one hop, and the hop is followed transitively
 * through same-file helpers). So:
 *
 *   - a block whose only assertion lives in a helper imported from ANOTHER file reads as empty here. That is a
 *     false positive and the report says so, rather than the tool pretending otherwise.
 *   - a block that asserts on something vacuous -- `assert.ok(true)`, a "does not contain" check on an error
 *     body, a fixture arranged so the assertion cannot fail -- reads as asserting. Those are the interesting
 *     ones and no static tool finds them. This finds only the floor: blocks with nothing at all.
 *
 * So treat a hit as a question, not a verdict. The point is to make the list short enough to read.
 *
 * THE CALLBACK QUESTION, and why this reports two numbers instead of failing on one.
 *
 * Codex's tenth finding: handing a function to a call does not mean the function runs.
 *
 *     const emitter = new EventEmitter();
 *     emitter.on("never-emitted", () => { assert.fail("not invoked"); });
 *
 * Node passes that block, nothing emits, and the assertion never executes -- so deleting the emission from a
 * test whose only assertion is in its listener left the gate green. Real, and worth closing.
 *
 * The obvious close is to follow a callback only into APIs known to invoke it. That was implemented and
 * MEASURED, and it reported 800 blocks. Following callbacks into same-file helpers that call their own
 * parameter -- `withKeys(key, undefined, () => { ... })`, resolved by position, which is a resolved
 * invocation rather than a guess -- brought it to 276. The remainder are not fixable by reading syntax: in
 * `square-config-error-disconnect.postgres.test.ts` the callback goes to `during`, a function pulled out of an
 * array by a `for` loop, and no amount of parsing says whether it is called.
 *
 * 276 hits in a gate is the failure this script's own history is a record of: a tool whose output is mostly
 * noise gets skimmed, and then the two real hits in it are skimmed too. So the two questions are kept apart:
 *
 *   - reaches NO assertion by any route        -> a hit. Fails --ci. 0 of these today.
 *   - reaches one ONLY through a callback this
 *     tool cannot resolve                     -> reported, does not fail. 276 today.
 *
 * The second number is an honest statement of the gate's reach, not a to-do list. It can only shrink by the
 * suites changing shape or by a type-aware rewrite that resolves what a value actually is -- and the right
 * place to argue for that is the PR, not a silent 276-line failure in CI.
 *
 * In CI it runs with --ci and FAILS on any block that is not on the allowlist below. The repository has none
 * today, so the gate starts clean: the floor is held from here rather than audited once and forgotten.
 *
 * Codex reviewed this five times and found twelve holes, every one of them real. They are recorded at
 * the code that fixes them rather than summarised here, and each is a fixture in
 * audit-assert-coverage.test.ts. The pattern across all five is worth naming: each was a place where the
 * script treated something it could not see as something it had checked.
 *
 * Usage: node server/scripts/audit-assert-coverage.mjs [--ci] [--json] [paths...]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const ci = args.includes("--ci");
const roots = args.filter((a) => !a.startsWith("--"));

/**
 * Blocks allowed to reach no assertion IN THIS FILE, each with the reason.
 *
 * The only legitimate reason is that the assertion lives in a helper imported from another module, which this
 * tool does not follow. "It is fine, trust me" is not a reason: a block that genuinely cannot fail belongs
 * fixed, not listed. Key is `<repo-relative file>::<test title>`.
 *
 * Empty, deliberately. 519 files, 6,398 blocks, 6,301 checked, zero that reach no assertion, as of
 * 2026-11-28 -- and that count now survives a much stricter definition of "reaches an assertion" than the
 * first version used: the receiver has to be an assertion API, and a helper has to actually be called.
 */
const ALLOWED = new Map([
  // ["path/to/suite.test.ts::the test title", "asserts via <helper> imported from <module>"],
]);

/**
 * Anything that can make a test fail -- judged by the RECEIVER, not by the method name.
 *
 * The first version also counted any call whose last member was in a list of assertion-sounding names, which
 * included `match`. Codex's probe was `test("empty", () => { "anything".match(/missing/); })`: Node runs it,
 * it asserts nothing, and the gate passed it because `String.prototype.match` shares a name with
 * `assert.match`. A real suite does the same thing for setup -- `sample-post-counts.postgres.test.ts` calls
 * `seed.match(...)` -- so deleting its actual assertion would have left the block reading as covered.
 *
 * A method name is not evidence. So an assertion is a call whose receiver is an assertion API: a head
 * identifier of `assert`/`expect`/`should`/`invariant` (which covers `assert.equal`, `assert.rejects`,
 * `assert(x)`), or a matcher chained onto a call to one of those (`expect(x).toBe(y)`).
 */
const ASSERTION = /^(assert|expect|should|invariant)$/i;

/**
 * Every suite extension this repository actually uses, not just the TypeScript ones.
 *
 * The first version matched `.test.(ts|tsx|mts)` and so never opened
 * `scripts/wedding-square-acceptance-evidence.test.mjs`, `scripts/wedding-square-sandbox-readiness.test.mjs`
 * or `operator/square-sandbox-fixtures.guard.test.cjs` -- all three executed by the workflow. Codex found it:
 * removing every assertion from one of them left the gate green. Worse, the filter also kept them out of the
 * `unrecognised` report, so the tool could not even tell on itself about them. A gate that silently declines
 * to look at a file is the thing this script exists to catch.
 */
const SUITE_FILE = /\.(?:test|spec)\.(?:tsx|ts|mts|cts|jsx|js|mjs|cjs)$/;
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", "uploads", "attached_assets"]);

function testFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) testFiles(full, out);
    else if (SUITE_FILE.test(entry)) out.push(full);
  }
  return out;
}

/** The name a call expression is calling, flattened: `assert.deepEqual` -> "assert.deepEqual". */
function calleeName(node) {
  const e = node.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) {
    const parts = [];
    let cur = e;
    while (ts.isPropertyAccessExpression(cur)) { parts.unshift(cur.name.text); cur = cur.expression; }
    if (ts.isIdentifier(cur)) parts.unshift(cur.text);
    return parts.join(".");
  }
  return "";
}

/** The identifier a chain of property accesses and calls bottoms out at: `expect(x).a.b()` -> "expect". */
function rootIdentifier(expr) {
  let cur = expr;
  for (;;) {
    if (ts.isPropertyAccessExpression(cur) || ts.isElementAccessExpression(cur)) { cur = cur.expression; continue; }
    if (ts.isCallExpression(cur)) { cur = cur.expression; continue; }
    if (ts.isNonNullExpression(cur) || ts.isParenthesizedExpression(cur)) { cur = cur.expression; continue; }
    if (ts.isAwaitExpression(cur)) { cur = cur.expression; continue; }
    return ts.isIdentifier(cur) ? cur.text : "";
  }
}

/**
 * Function properties that hand back or describe a function instead of running it.
 *
 * Codex's eleventh finding: `assert.equal.bind(null, 1, 2)` is rooted at `assert`, so reducing the chain to
 * its root counted it as an assertion. Node runs that block and asserts nothing. `call` and `apply` are
 * deliberately NOT here -- `assert.equal.call(null, 1, 1)` does execute the assertion.
 */
const DOES_NOT_INVOKE = new Set([
  "bind", "toString", "valueOf", "name", "length", "prototype", "constructor", "caller", "arguments",
]);

function isAssertionCall(node) {
  const root = rootIdentifier(node.expression);
  if (root === "" || !ASSERTION.test(root)) return false;
  // The thing being CALLED has to be the assertion operation, not a property of it.
  const callee = node.expression;
  if (ts.isPropertyAccessExpression(callee) && DOES_NOT_INVOKE.has(callee.name.text)) return false;
  return true;
}

/**
 * `test("name", fn)` / `it(...)`, including `test.only`, `test.skip` and `test.todo`.
 *
 * NOT the hooks. `test.before`, `test.after`, `test.beforeEach` and `test.afterEach` correctly contain no
 * assertions -- they build and tear down fixtures -- and counting them produced 109 hits on the first run, of
 * which the overwhelming majority were exactly that. A tool whose output is mostly noise gets skimmed, which
 * is the failure this one exists to avoid.
 */
const HOOKS = new Set(["before", "after", "beforeEach", "afterEach", "describe", "suite"]);

/**
 * Whether an options property skips the block NO MATTER WHAT the environment is.
 *
 * The first version of this excluded any options object carrying a `skip` property at all, whatever its value,
 * and Codex was right that this is a hole in the gate rather than a rough edge. `test("x", { skip: false }, fn)`
 * is RUN by Node -- confirmed, it reports `ok` and not `# SKIP` -- so a block written that way asserted nothing
 * and passed the gate. The same went for `{ skip: !process.env.SOME_URL }`, which is how several suites in this
 * repository arrange to skip without a database: outside CI they skip, and IN CI, where the variable is set,
 * they run. Excluding those meant the gate was blind to them exactly where it matters.
 *
 * So only a literal that is always truthy counts: `skip: true`, or `skip: "a reason"`. An expression, a
 * shorthand `{ skip }`, and `skip: false` are all conditionally runnable, and a conditionally runnable block
 * gets audited. `todo` follows the same rule -- Node runs a todo block but will not fail on it.
 */
/** A property's key as written, or null when it cannot be read statically. */
function propertyKey(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  if (ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name)) {
    const e = name.expression;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    return null; // computed from something this tool does not evaluate
  }
  return null;
}

function alwaysTruthy(v) {
  return v.kind === ts.SyntaxKind.TrueKeyword || ts.isStringLiteral(v) ||
    ts.isNoSubstitutionTemplateLiteral(v);
}

/**
 * Whether an options OBJECT skips the block no matter what, reading its properties in order.
 *
 * Order matters because a later spread wins. Codex's probe was
 * `const options = { skip: false }; test("empty", { skip: true, ...options }, () => {})`, which Node runs --
 * confirmed, it reports `ok` -- while a check that merely looked for a literal `skip: true` anywhere in the
 * object excluded it. So a literal truthy skip counts only when no spread follows it; a spread whose contents
 * this tool cannot see makes the decision unknown, and an unknown skip decision gets audited rather than
 * excused. A block wrongly audited is a question in a list someone reads; a block wrongly excused is a hole.
 */
function unconditionallySkipped(obj) {
  let skipped = false;
  for (const prop of obj.properties) {
    if (ts.isSpreadAssignment(prop)) {
      // Anything could come out of a spread, including `skip: false`. Decision void from here on.
      skipped = false;
      continue;
    }
    if (!ts.isPropertyAssignment(prop)) {
      // Shorthand `{ skip }` is a variable, so conditional by definition.
      if (ts.isShorthandPropertyAssignment(prop) && ["skip", "todo"].includes(prop.name.text)) skipped = false;
      continue;
    }
    const key = propertyKey(prop.name);
    // A key this tool cannot read could BE "skip", and a later property wins. Codex's probe was
    // `{ skip: true, [key]: false }` with `const key = ["skip"].join("")`, which Node runs. So an unreadable
    // key voids the decision for the same reason a spread does.
    if (key === null) { skipped = false; continue; }
    if (key !== "skip" && key !== "todo") continue;
    skipped = alwaysTruthy(prop.initializer);
  }
  return skipped;
}

function testCall(node, aliases) {
  if (!ts.isCallExpression(node)) return null;
  const name = calleeName(node);
  const parts = name.split(".");
  const head = parts[0];
  if (!aliases.has(head)) return null;
  // `test.before(...)` and friends are fixtures, not assertions-bearing blocks.
  if (parts.length > 1 && HOOKS.has(parts[1])) return null;
  if (parts.length > 1 && !["only", "skip", "todo"].includes(parts[1])) return null;
  const title = node.arguments.find(
    (a) => ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a) || ts.isTemplateExpression(a),
  );
  const body = node.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
  if (!body) return null;
  const skipped = name.endsWith(".skip") || name.endsWith(".todo") ||
    node.arguments.some((a) => ts.isObjectLiteralExpression(a) && unconditionallySkipped(a));
  const rendered = title
    ? (ts.isTemplateExpression(title) ? title.getText(title.getSourceFile()) : title.text)
    : "(title is not a literal)";
  return { title: rendered, body, skipped: skipped || parts[1] === "skip" || parts[1] === "todo", node };
}

/**
 * Local aliases for `test`, because thirteen suites call one and the detector was blind to every block in them.
 *
 * The shape is always the same here: a suite that needs a database writes
 *
 *     const postgresTest = connectionString ? test : test.skip;
 *
 * so that it skips wholesale when the variable is unset -- `render-smoke.browser.test.ts` uses `smokeTest`,
 * the migration suites use `postgresTest`. Matching only the literal names `test` and `it` recognised no block
 * at all in those files, which means "515 files scanned" would have been true and misleading at the same time.
 * This resolves any local binding initialised from test/it, directly or through a conditional.
 */
function testAliases(sf) {
  const names = new Set(["test", "it"]);
  const fromTest = (node) => {
    if (!node) return false;
    if (ts.isIdentifier(node)) return names.has(node.text);
    if (ts.isPropertyAccessExpression(node)) {
      let cur = node;
      while (ts.isPropertyAccessExpression(cur)) cur = cur.expression;
      return ts.isIdentifier(cur) && names.has(cur.text);
    }
    if (ts.isConditionalExpression(node)) return fromTest(node.whenTrue) || fromTest(node.whenFalse);
    if (ts.isBinaryExpression(node)) return fromTest(node.left) || fromTest(node.right);
    if (ts.isParenthesizedExpression(node)) return fromTest(node.expression);
    return false;
  };
  // Repeat to a fixed point: an alias of an alias (rare, but free to support).
  for (let pass = 0; pass < 3; pass += 1) {
    const before = names.size;
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && fromTest(node.initializer)) {
        names.add(node.name.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    if (names.size === before) break;
  }
  return names;
}

function auditFile(file) {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  const aliases = testAliases(sf);

  /**
   * Same-file helper functions, so an assertion one hop away still counts -- resolved LEXICALLY.
   *
   * The first version collected every helper in the file into one name-keyed map, and Codex reproduced both
   * ways that goes wrong. A `const verify = ...` declared inside one test block overwrote a top-level
   * `verify` used by another, so a legitimate test reading through the outer helper was rejected; and with the
   * two swapped, an empty block passed because some unrelated block's same-named helper asserted. A flat map
   * answers "is there any function called verify in this file", which is not the question.
   *
   * This walks the parent chain from the call site outwards and takes the first scope that declares the name,
   * which is what the language does. The source file is parsed with parent pointers for exactly this.
   */
  function statementsOf(scope) {
    if (ts.isSourceFile(scope) || ts.isBlock(scope) || ts.isModuleBlock(scope)) return scope.statements;
    if (ts.isCaseClause(scope) || ts.isDefaultClause(scope)) return scope.statements;
    return null;
  }

  /** Does a parameter or variable name -- plain or destructured -- bind `name`? */
  function bindsName(nameNode, name) {
    if (!nameNode) return false;
    if (ts.isIdentifier(nameNode)) return nameNode.text === name;
    if (ts.isObjectBindingPattern(nameNode) || ts.isArrayBindingPattern(nameNode)) {
      return nameNode.elements.some((el) => ts.isBindingElement(el) && bindsName(el.name, name));
    }
    return false;
  }

  /**
   * What this scope says about `name`: a callable body, a binding whose body is unknown, or nothing.
   *
   * The three answers have to stay distinct. Codex's probe was
   *
   *     function verify() { assert.fail("unused"); }
   *     function run(verify: () => void) { verify(); }
   *     test("empty", () => run(() => {}));
   *
   * which Node runs and passes while asserting nothing -- confirmed. The call to `verify()` inside `run` is
   * the PARAMETER, and the parameter's value comes from the call site, so its body is unknown here. Treating
   * "no declaration in this scope" and "bound in this scope to something I cannot follow" as the same answer
   * made the walk continue outwards and find the unrelated outer `verify`, which asserts. The empty block
   * read as asserting.
   *
   * So a shadowing binding stops the search and yields no helper, which makes the block read as empty: a
   * question in the report rather than a hole in the gate. The same goes for a `const verify = makeIt()`
   * whose initializer is not a literal function, a catch variable, and an import -- an imported helper is the
   * one documented allowlist case, and it is reached by this path.
   */
  const FOUND = (body, fn) => ({ body, fn });
  const SHADOWED = { body: null, fn: null };

  function declaredIn(scope, name) {
    // Parameters belong to the function-like node, whose body block is a child, so the inner block is
    // examined first and this runs only when the block itself did not bind the name.
    if (ts.isFunctionDeclaration(scope) || ts.isFunctionExpression(scope) || ts.isArrowFunction(scope) ||
        ts.isMethodDeclaration(scope) || ts.isConstructorDeclaration(scope) ||
        ts.isGetAccessorDeclaration(scope) || ts.isSetAccessorDeclaration(scope)) {
      if (scope.parameters.some((param) => bindsName(param.name, name))) return SHADOWED;
    }
    if (ts.isCatchClause(scope) && bindsName(scope.variableDeclaration?.name, name)) return SHADOWED;

    const stmts = statementsOf(scope);
    if (!stmts) return undefined;
    for (const st of stmts) {
      if (ts.isFunctionDeclaration(st) && st.name && st.name.text === name) {
        return st.body ? FOUND(st.body, st) : SHADOWED;
      }
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) {
          if (!bindsName(d.name, name)) continue;
          const callable = d.initializer &&
            (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer));
          // A binding of this name that is not a literal function shadows whatever is outside it.
          return callable ? FOUND(d.initializer.body, d.initializer) : SHADOWED;
        }
      }
      if (ts.isImportDeclaration(st)) {
        const clause = st.importClause;
        const named = clause?.namedBindings;
        const binds = (clause?.name && clause.name.text === name) ||
          (named && ts.isNamespaceImport(named) && named.name.text === name) ||
          (named && ts.isNamedImports(named) && named.elements.some((el) => el.name.text === name));
        if (binds) return SHADOWED;
      }
    }
    return undefined;
  }

  /**
   * Innermost binding of `name` visible from `fromNode`: its body if this file declares one, otherwise
   * undefined -- including when the name is bound to something whose body is not in this file.
   */
  function resolveHelper(name, fromNode) {
    for (let cur = fromNode; cur; cur = cur.parent) {
      const answer = declaredIn(cur, name);
      if (answer) return answer.body ? { body: answer.body, fn: answer.fn } : undefined;
    }
    return undefined;
  }

  /**
   * Which of a helper's parameters does its own body CALL?
   *
   * This is how a callback becomes reachable without a list of blessed API names. `withKeys(key, undefined,
   * () => { ...assertions... })` is the commonest shape in this repository -- a same-file helper that sets
   * something up, calls the function it was given, and tears down -- and it is a resolved invocation, not a
   * guess. Codex's `emitter.on("never-emitted", cb)` is not: `on` is a property of an object this tool knows
   * nothing about, there is no body to read, and the callback stays unreachable.
   *
   * Matched by position, so only the argument that is actually called is followed.
   */
  function invokedParameters(fn) {
    const indexes = new Set();
    if (!fn || !fn.parameters || !fn.body) return indexes;
    const names = new Map();
    fn.parameters.forEach((param, i) => {
      if (ts.isIdentifier(param.name)) names.set(param.name.text, i);
    });
    if (names.size === 0) return indexes;
    const walk = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && names.has(n.expression.text)) {
        indexes.add(names.get(n.expression.text));
      }
      // `fn.call(...)`, `fn.apply(...)`, `await fn()` all reach the body too.
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
          ts.isIdentifier(n.expression.expression) && names.has(n.expression.expression.text) &&
          ["call", "apply", "bind"].includes(n.expression.name.text) && n.expression.name.text !== "bind") {
        indexes.add(names.get(n.expression.expression.text));
      }
      ts.forEachChild(n, walk);
    };
    walk(fn.body);
    return indexes;
  }

  /**
   * `seen` holds helper BODIES, not names: two different functions can share a name in one file, and keying
   * the recursion guard by name was how one of them could stand in for the other.
   */
  /**
   * A declaration whose body only runs if something calls it, so the walk must NOT descend into it.
   *
   * Codex's probe was `test("empty", () => { function unused() { assert.fail("never called"); } })`: Node runs
   * the block, nothing calls `unused`, and the walk counted the assertion inside it simply because the
   * declaration sat under the test body. That made the gate's central promise false in the worst direction --
   * deleting a helper's INVOCATION did not trip it as long as the definition stayed.
   *
   * A function expression passed straight to a call is different and is still followed: `rows.forEach(() =>
   * assert.ok(x))` and `await assert.rejects(async () => { ... })` run their callback, and refusing to look
   * inside those would reject most of the suites in this repository.
   */
  function onlyRunsWhenCalled(n) {
    if (ts.isFunctionDeclaration(n)) return true;
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      const parent = n.parent;
      // Bound to a name -- reachable only through a resolved call to that name.
      if (parent && (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent))) return true;
      return false;
    }
    return false;
  }

  /**
   * Calls that are known to RUN a function handed to them, so a callback's body is reachable through them.
   *
   * Codex's probe for why this cannot be "any call with a function argument":
   *
   *     const emitter = new EventEmitter();
   *     emitter.on("never-emitted", () => { assert.fail("not invoked"); });
   *
   * Node runs the block, nothing emits, and the assertion never executes -- so deleting the emission from a
   * test whose only assertion lives in its listener left the gate green. Registering a callback is not
   * calling it. The difference is not visible in the syntax, so this is a list of APIs that do invoke, and
   * anything not on it makes the block read as empty.
   *
   * That is the conservative direction on purpose: the cost is a hit on a block that does assert through
   * some invoking API not listed here, and a hit is a question in a report that someone reads. The cost the
   * other way is a block that cannot fail, reading as coverage forever.
   */
  const INVOKES_ITS_CALLBACK = new Set([
    // array and iterable traversal
    "forEach", "map", "filter", "some", "every", "find", "findIndex", "findLast", "findLastIndex",
    "flatMap", "reduce", "reduceRight", "sort", "from",
    // assertion APIs that call the function they are given
    "rejects", "throws", "doesNotThrow", "doesNotReject",
    // promise and scheduling shapes that run the body
    "then", "catch", "finally", "all", "allSettled", "race", "any",
  ]);

  /** `new Promise(fn)` and `new Map([...])`-style constructors that run what they are given. */
  function constructorInvokes(n) {
    if (!ts.isNewExpression(n)) return false;
    return ts.isIdentifier(n.expression) && n.expression.text === "Promise";
  }

  function callInvokesItsCallback(n) {
    if (constructorInvokes(n)) return true;
    if (!ts.isCallExpression(n)) return false;
    const e = n.expression;
    // An immediately-invoked function expression runs by definition.
    if (ts.isParenthesizedExpression(e) || ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return true;
    const name = calleeName(n);
    if (name === "") return true; // cannot read the callee: assume it runs rather than hide an assertion
    const tail = name.split(".").pop() ?? "";
    if (INVOKES_ITS_CALLBACK.has(tail)) return true;
    // A same-file helper called with a callback: the helper's own body decides, and it is followed below.
    return false;
  }

  function asserts(node, seen, strict) {
    let found = false;
    const walk = (n) => {
      if (found) return;
      if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
        if (ts.isCallExpression(n) && isAssertionCall(n)) { found = true; return; }
        // Only a BARE identifier callee invokes a same-file helper. `verify.bind(null)` and
        // `verify.toString()` call a property OF the function and never run its body -- splitting the callee
        // at the first dot treated those as invocations, which Codex reproduced both ways.
        let calledParams = null;
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
          const helper = resolveHelper(n.expression.text, n);
          if (helper) {
            calledParams = invokedParameters(helper.fn);
            if (!seen.has(helper.body)) {
              seen.add(helper.body);
              if (asserts(helper.body, seen, strict)) { found = true; return; }
            }
          }
        }
        // The receiver still runs: `f().g()` executes `f()`.
        if (n.expression) walk(n.expression);
        const invokes = callInvokesItsCallback(n);
        (n.arguments ?? []).forEach((arg, i) => {
          if (found) return;
          const isFn = ts.isArrowFunction(arg) || ts.isFunctionExpression(arg);
          const positionRuns = invokes || Boolean(calledParams && calledParams.has(i));
          // A callback passed BY NAME at a position that runs. Codex's twelfth finding, and the only one of
          // the twelve that was a false POSITIVE: `function run(cb) { cb(); }` with `run(verify)` executes
          // `verify`, but walking the identifier `verify` never reached its body, so a legitimate test became
          // a hard hit and failed CI. Extracting an inline callback into a same-file helper must not break
          // the build.
          if (positionRuns && ts.isIdentifier(arg)) {
            const named = resolveHelper(arg.text, n);
            if (named && !seen.has(named.body)) {
              seen.add(named.body);
              if (asserts(named.body, seen, strict)) { found = true; return; }
            }
          }
          // In STRICT mode a function handed to something that is not known to call it is unreachable. In
          // permissive mode it is followed, which is what the gate did before and what most suites rely on.
          if (strict && isFn && !positionRuns) return;
          walk(arg);
        });
        return;
      }
      if (n !== node && onlyRunsWhenCalled(n)) return;
      ts.forEachChild(n, walk);
    };
    walk(node);
    return found;
  }

  const empty = [];
  const viaCallback = [];
  let recognised = 0;
  let skipped = 0;
  const visit = (node) => {
    const t = testCall(node, aliases);
    if (t) recognised += 1;
    if (t && t.skipped) skipped += 1;
    if (t && !t.skipped) {
      // Two questions, because the answers mean different things. STRICT: is an assertion reachable without
      // assuming that a function handed to an unknown API gets called? PERMISSIVE: is one reachable at all?
      const strictly = asserts(t.body, new Set(), true);
      if (!strictly) {
        const { line } = sf.getLineAndCharacterOfPosition(t.node.getStart(sf));
        const where = { file: relative(ROOT, file), line: line + 1, title: t.title };
        if (asserts(t.body, new Set(), false)) viaCallback.push(where); else empty.push(where);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { empty, viaCallback, recognised, skipped };
}

// From the repository root, not a hand-written list of directories: `operator/` held a suite the workflow
// runs and no list included it, which is the same silent exclusion one level up.
const files = roots.length > 0
  ? roots.flatMap((r) => (statSync(r).isDirectory() ? testFiles(r) : [r]))
  : testFiles(ROOT).map((f) => relative(ROOT, f));

const audited = files.map((f) => ({ file: relative(ROOT, f), ...auditFile(f) }));
const all = audited.flatMap((a) => a.empty);
const soft = audited.flatMap((a) => a.viaCallback);
const hits = all.filter((h) => !ALLOWED.has(`${h.file}::${h.title}`));
const excused = all.length - hits.length;
// The honest denominator: a file the detector finds no block in was not examined, whatever the scan count says.
const unrecognised = audited.filter((a) => a.recognised === 0).map((a) => a.file);

const blocks = audited.reduce((n, a) => n + a.recognised, 0);
const skippedBlocks = audited.reduce((n, a) => n + a.skipped, 0);

if (asJson) {
  console.log(JSON.stringify(
    { filesScanned: files.length, blocks, checked: blocks - skippedBlocks, unconditionallySkipped: skippedBlocks, hits, viaCallback: soft, excused, unrecognised },
    null, 2,
  ));
} else {
  console.log(`audit-assert-coverage: ${files.length} test files, ${blocks} test blocks, ${blocks - skippedBlocks} checked.`);
  // Say how many are outside the gate. A block the gate does not check is not a block it found clean, and
  // over-counting them is how the first version excluded 19 conditionally-skipped blocks that do run in CI.
  if (skippedBlocks > 0) console.log(`${skippedBlocks} unconditionally skipped (skip: true, a string reason, or test.skip), so not checked.`);
  if (unrecognised.length > 0) {
    // Say it out loud: these were counted as scanned and were not examined at all.
    console.log("");
    console.log(`${unrecognised.length} file(s) declare tests in a way this tool does not recognise, so NOTHING`);
    console.log("in them was examined. Each needs its test-declaring call taught to testAliases():");
    for (const f of unrecognised) console.log(`  ${f}`);
    console.log("");
  }
  if (hits.length === 0) {
    console.log("Every test block reaches an assertion, directly or through a same-file helper.");
    if (excused > 0) console.log(`(${excused} on the allowlist, each with a recorded reason.)`);
    if (soft.length > 0) {
      console.log("");
      console.log(`${soft.length} of them reach it ONLY through a callback handed to an API this tool cannot`);
      console.log("resolve, so it cannot tell a callback that runs from one that is merely registered. These do");
      console.log("NOT fail the gate -- see 'the callback question' in this script's header for why.");
    }
  } else {
    console.log("");
    console.log(`${hits.length} test block(s) reach no assertion, so nothing in them can fail:`);
    console.log("");
    for (const h of hits) console.log(`  ${h.file}:${h.line}  ${h.title}`);
    console.log("");
    console.log("A hit is a question, not a verdict. An assertion inside a helper imported from ANOTHER file");
    console.log("reads as empty here, and that is the one legitimate case -- add it to ALLOWED in this script");
    console.log("with the helper named. Anything else should be fixed: a block that cannot fail is a block");
    console.log("that tells you nothing, and it reads as coverage to everyone who comes after.");
  }
}

process.exitCode = ci && hits.length > 0 ? 1 : 0;
