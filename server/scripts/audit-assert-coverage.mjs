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
 * In CI it runs with --ci and FAILS on any block that is not on the allowlist below. The repository has none
 * today, so the gate starts clean: the floor is held from here rather than audited once and forgotten.
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
 * Empty, deliberately. 516 files, zero blocks that reach no assertion, as of 2026-11-28 -- including the 19
 * conditionally-skipped blocks that the first version of the skip rule excluded from the gate entirely.
 */
const ALLOWED = new Map([
  // ["path/to/suite.test.ts::the test title", "asserts via <helper> imported from <module>"],
]);

/** Anything that can make a test fail. Deliberately generous: a false negative here hides a real hit. */
const ASSERTION = /^(assert|expect|should|invariant)$/i;
const ASSERTION_MEMBER = /^(toBe|toEqual|toThrow|toMatch|rejects|throws|deepEqual|deepStrictEqual|strictEqual|notEqual|ok|fail|match|doesNotMatch|doesNotThrow|doesNotReject|ifError)$/;

function testFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) testFiles(full, out);
    else if (/\.test\.(ts|tsx|mts)$/.test(entry)) out.push(full);
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

function isAssertionCall(node) {
  const name = calleeName(node);
  if (!name) return false;
  const head = name.split(".")[0];
  if (ASSERTION.test(head)) return true;
  const tail = name.split(".").pop();
  return ASSERTION_MEMBER.test(tail ?? "");
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
function unconditionalSkip(prop) {
  if (!ts.isPropertyAssignment(prop)) return false;
  const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : "";
  if (key !== "skip" && key !== "todo") return false;
  const v = prop.initializer;
  return v.kind === ts.SyntaxKind.TrueKeyword || ts.isStringLiteral(v) ||
    ts.isNoSubstitutionTemplateLiteral(v);
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
    node.arguments.some((a) => ts.isObjectLiteralExpression(a) && a.properties.some(unconditionalSkip));
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
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
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

  /** The body of a callable named `name` declared directly in this scope, if there is one. */
  function declaredIn(scope, name) {
    const stmts = statementsOf(scope);
    if (!stmts) return undefined;
    for (const st of stmts) {
      if (ts.isFunctionDeclaration(st) && st.name && st.name.text === name && st.body) return st.body;
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer &&
              (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
            return d.initializer.body;
          }
        }
      }
    }
    return undefined;
  }

  /** Innermost declaration of `name` visible from `fromNode`, or undefined. */
  function resolveHelper(name, fromNode) {
    for (let cur = fromNode; cur; cur = cur.parent) {
      const body = declaredIn(cur, name);
      if (body) return body;
    }
    return undefined;
  }

  /**
   * `seen` holds helper BODIES, not names: two different functions can share a name in one file, and keying
   * the recursion guard by name was how one of them could stand in for the other.
   */
  function asserts(node, seen) {
    let found = false;
    const walk = (n) => {
      if (found) return;
      if (ts.isCallExpression(n)) {
        if (isAssertionCall(n)) { found = true; return; }
        const name = calleeName(n).split(".")[0];
        const helper = name ? resolveHelper(name, n) : undefined;
        if (helper && !seen.has(helper)) {
          seen.add(helper);
          if (asserts(helper, seen)) { found = true; return; }
        }
      }
      ts.forEachChild(n, walk);
    };
    walk(node);
    return found;
  }

  const empty = [];
  let recognised = 0;
  let skipped = 0;
  const visit = (node) => {
    const t = testCall(node, aliases);
    if (t) recognised += 1;
    if (t && t.skipped) skipped += 1;
    if (t && !t.skipped && !asserts(t.body, new Set())) {
      const { line } = sf.getLineAndCharacterOfPosition(t.node.getStart(sf));
      empty.push({ file: relative(ROOT, file), line: line + 1, title: t.title });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { empty, recognised, skipped };
}

const files = roots.length > 0
  ? roots.flatMap((r) => (statSync(r).isDirectory() ? testFiles(r) : [r]))
  : ["server", "client", "shared", "tools", "scripts"].flatMap((d) => { try { return testFiles(d); } catch { return []; } });

const audited = files.map((f) => ({ file: relative(ROOT, f), ...auditFile(f) }));
const all = audited.flatMap((a) => a.empty);
const hits = all.filter((h) => !ALLOWED.has(`${h.file}::${h.title}`));
const excused = all.length - hits.length;
// The honest denominator: a file the detector finds no block in was not examined, whatever the scan count says.
const unrecognised = audited.filter((a) => a.recognised === 0).map((a) => a.file);

const blocks = audited.reduce((n, a) => n + a.recognised, 0);
const skippedBlocks = audited.reduce((n, a) => n + a.skipped, 0);

if (asJson) {
  console.log(JSON.stringify(
    { filesScanned: files.length, blocks, checked: blocks - skippedBlocks, unconditionallySkipped: skippedBlocks, hits, excused, unrecognised },
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
