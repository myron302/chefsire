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
 * Empty, deliberately. 515 files, zero blocks that reach no assertion, as of 2026-11-28.
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

function testCall(node) {
  if (!ts.isCallExpression(node)) return null;
  const name = calleeName(node);
  const parts = name.split(".");
  const head = parts[0];
  if (head !== "test" && head !== "it") return null;
  // `test.before(...)` and friends are fixtures, not assertions-bearing blocks.
  if (parts.length > 1 && HOOKS.has(parts[1])) return null;
  if (parts.length > 1 && !["only", "skip", "todo"].includes(parts[1])) return null;
  const title = node.arguments.find(
    (a) => ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a) || ts.isTemplateExpression(a),
  );
  const body = node.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
  if (!body) return null;
  const skipped = name.endsWith(".skip") || node.arguments.some(
    (a) => ts.isObjectLiteralExpression(a) && a.properties.some(
      (p) => ts.isPropertyAssignment(p) && p.name.getText() === "skip",
    ),
  );
  const rendered = title
    ? (ts.isTemplateExpression(title) ? title.getText(title.getSourceFile()) : title.text)
    : "(title is not a literal)";
  return { title: rendered, body, skipped: skipped || parts[1] === "skip" || parts[1] === "todo", node };
}

function auditFile(file) {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  /** Same-file helper functions, so an assertion one hop away still counts. */
  const helpers = new Map();
  const collect = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) helpers.set(node.name.text, node.body);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      helpers.set(node.name.text, node.initializer.body);
    }
    ts.forEachChild(node, collect);
  };
  collect(sf);

  function asserts(node, seen) {
    let found = false;
    const walk = (n) => {
      if (found) return;
      if (ts.isCallExpression(n)) {
        if (isAssertionCall(n)) { found = true; return; }
        const name = calleeName(n).split(".")[0];
        const helper = helpers.get(name);
        if (helper && !seen.has(name)) { seen.add(name); if (asserts(helper, seen)) { found = true; return; } }
      }
      ts.forEachChild(n, walk);
    };
    walk(node);
    return found;
  }

  const empty = [];
  const visit = (node) => {
    const t = testCall(node);
    if (t && !t.skipped && !asserts(t.body, new Set())) {
      const { line } = sf.getLineAndCharacterOfPosition(t.node.getStart(sf));
      empty.push({ file: relative(ROOT, file), line: line + 1, title: t.title });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return empty;
}

const files = roots.length > 0
  ? roots.flatMap((r) => (statSync(r).isDirectory() ? testFiles(r) : [r]))
  : ["server", "client", "shared", "tools", "scripts"].flatMap((d) => { try { return testFiles(d); } catch { return []; } });

const all = files.flatMap(auditFile);
const hits = all.filter((h) => !ALLOWED.has(`${h.file}::${h.title}`));
const excused = all.length - hits.length;

if (asJson) {
  console.log(JSON.stringify({ filesScanned: files.length, hits, excused }, null, 2));
} else {
  console.log(`audit-assert-coverage: ${files.length} test files scanned.`);
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
