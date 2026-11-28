#!/usr/bin/env node
/**
 * Finds workflow steps that name a test suite and run none of it.
 *
 * Done-condition 1 of the launch campaign is "every test suite runs in CI, or is listed with the reason it
 * does not". That was checked by comparing filenames: every suite named somewhere in the workflow, and no
 * workflow step naming a file that does not exist. Both directions were clean, and the condition was recorded
 * as met.
 *
 * It was not met. Codex read the same workflow and found the third direction, which neither check could see:
 * a step that names a suite, runs it, and the suite skips itself because the connection string it reads was
 * not in that step's environment. Node exits 0. The step is green. Nothing ran.
 *
 * Reproduced before this was written, with the exact environment the step supplies:
 *
 *   server/db/db-outage.postgres.test.ts                  0 pass, 1 skipped, exit 0
 *   server/routes/auth-lookup-exhaustion.postgres.test.ts 0 pass, 1 skipped, exit 0
 *   server/routes/auth-db-outage.postgres.test.ts         0 pass, 1 skipped, exit 0
 *   server/routes/wedding-registry-links.postgres.test.ts 0 pass, 5 skipped, exit 0
 *
 * All four read TEST_DATABASE_URL; their job supplies WEDDING_SQUARE_TEST_DATABASE_URL and CS_TEST_PG_URL and
 * not that one. With it set they pass 13, 9, 15 and 5 -- forty-two tests that had never run anywhere.
 *
 * `run-ci-batch.mjs` already catches this empirically: it fails a batch that reports a skipped test. But 97 of
 * the workflow's test steps invoke `node --test` directly and bypass it, and converting all of them is a
 * separate and larger change. This catches the same mistake statically, at review time, with no database and
 * in under a second -- and it catches it for a step that does not exist yet, which is the half that matters.
 *
 * WHAT IT CHECKS. For each step that runs test files: the environment names the step supplies (its own `env`
 * plus its job's), against the environment names the suites it runs consult when deciding whether to skip.
 * A suite whose deciding variable is not supplied is reported.
 *
 * WHAT IT CANNOT SEE. A suite that skips for a reason other than a missing environment variable; a variable
 * supplied through a `.env` file, a composite action, or a shell export inside the `run` block; a step whose
 * `run` builds the file list dynamically; and a computed read -- `process.env[NAME]` -- where the name is not
 * in the syntax at all. It reads the deciding variable out of the syntax, so a suite that reaches its skip
 * decision in a way the patterns below do not cover reads as ungated -- a false negative, and the reason this
 * is a floor and not a proof. `--list-gates` prints what it believes about every suite, so the belief can be
 * checked rather than assumed.
 *
 * It parses rather than matching text, and that is load-bearing rather than tidy: a variable name that appears
 * only inside a string literal is not a gate, and the text-matching version of this reported one. A string's
 * contents are not nodes, so parsing removes that whole class.
 *
 * Usage: node server/scripts/audit-silent-skips.mjs [--ci] [--json] [--list-gates]
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import ts from "typescript";

const args = process.argv.slice(2);
const ci = args.includes("--ci");
const asJson = args.includes("--json");
const listGates = args.includes("--list-gates");

const WORKFLOW_DIR = ".github/workflows";
const TEST_TOKEN = /[A-Za-z0-9_@./\-[\]]*\.(?:test|spec)\.(?:tsx|ts|jsx|js|mjs|cjs)/g;

/**
 * Steps allowed to run a suite whose deciding variable they do not supply, each with the reason.
 *
 * A suite that cannot run in a step is a suite that step does not test, so the honest options are to supply
 * the variable or to stop naming the suite. An entry here says the skip is deliberate AND that something else
 * covers the suite -- name what. Key is `<job id>::<step name>::<suite path>`.
 *
 * Empty, deliberately.
 */
const ALLOWED = new Map([
  // ["job-id::Step name::path/to/suite.test.ts", "covered by <other step>; skips here because <reason>"],
]);

/* ------------------------------------------------------------------ *
 * Which environment variable decides whether a suite runs?
 * ------------------------------------------------------------------ */

/** `process.env.FOO` -> "FOO", for anything else -> null. */
function envNameOf(node) {
  if (!ts.isPropertyAccessExpression(node)) return null;
  const inner = node.expression;
  if (!ts.isPropertyAccessExpression(inner)) return null;
  if (!ts.isIdentifier(inner.expression) || inner.expression.text !== "process") return null;
  if (inner.name.text !== "env") return null;
  return node.name.text;
}

/** Every `process.env.X` name appearing anywhere under a node. Comments and string contents are not nodes. */
function envNamesUnder(node) {
  const found = new Set();
  const walk = (n) => {
    const name = envNameOf(n);
    if (name) found.add(name);
    ts.forEachChild(n, walk);
  };
  walk(node);
  return found;
}

/** Does a `test`/`it` call appear under this node, and is it one that skips? */
function testCallsUnder(node) {
  let any = false;
  let skipping = false;
  const walk = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      let name = "";
      if (ts.isIdentifier(e)) name = e.text;
      else if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression)) {
        name = `${e.expression.text}.${e.name.text}`;
      }
      const head = name.split(".")[0];
      if (head === "test" || head === "it") {
        any = true;
        if (name.endsWith(".skip") || name.endsWith(".todo")) skipping = true;
        for (const a of n.arguments) {
          if (!ts.isObjectLiteralExpression(a)) continue;
          for (const p of a.properties) {
            if (ts.isPropertyAssignment(p) && ["skip", "todo"].includes(p.name.getText(n.getSourceFile()))) {
              skipping = true;
            }
          }
        }
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(node);
  return { any, skipping };
}

/**
 * The environment names a suite's skip decision depends on.
 *
 * Three shapes are used in this repository, and each is matched on the syntax rather than on a name:
 *
 *   const pgTest = process.env.X ? test : test.skip;            // a conditional producing test or test.skip
 *   if (!process.env.X) { test(..., { skip: true }) } else {...} // a branch registering a skipping placeholder
 *   const RAW = process.env.X; ... if (!RAW) { ... }             // either of the above, one binding removed
 *
 * The third is why this resolves local bindings: reading only `process.env` references inside the condition
 * itself would miss every suite that names the value first, which is most of them.
 */
function gateVariables(file) {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  // Local bindings initialised from process.env, so `if (!RAW)` can be traced back to the variable name.
  const bindings = new Map();
  const collect = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const names = envNamesUnder(n.initializer);
      if (names.size > 0) bindings.set(n.name.text, names);
    }
    ts.forEachChild(n, collect);
  };
  collect(sf);

  /** Env names an expression depends on, directly or through a local binding. */
  const dependsOn = (expr) => {
    const names = new Set(envNamesUnder(expr));
    const walk = (n) => {
      if (ts.isIdentifier(n)) for (const v of bindings.get(n.text) ?? []) names.add(v);
      ts.forEachChild(n, walk);
    };
    walk(expr);
    return names;
  };

  const gates = new Set();
  const visit = (node) => {
    // const pgTest = <cond> ? test : test.skip
    if (ts.isConditionalExpression(node)) {
      const branches = testCallsUnder(node.whenTrue).any || testCallsUnder(node.whenFalse).any ||
        [node.whenTrue, node.whenFalse].some((b) => {
          const t = b.getText(sf);
          return /^(test|it)(\.(skip|todo))?$/.test(t.trim());
        });
      if (branches) for (const v of dependsOn(node.condition)) gates.add(v);
    }
    // if (<cond>) { ...a skipping placeholder... } else { ...the real tests... }
    if (ts.isIfStatement(node)) {
      const then = testCallsUnder(node.thenStatement);
      const other = node.elseStatement ? testCallsUnder(node.elseStatement) : { any: false, skipping: false };
      if ((then.skipping && then.any) || (other.skipping && other.any) ||
          (then.skipping && other.any) || (other.skipping && then.any)) {
        for (const v of dependsOn(node.expression)) gates.add(v);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return gates;
}

/* ------------------------------------------------------------------ *
 * The workflow side
 * ------------------------------------------------------------------ */

const findings = [];
const gatesSeen = [];
let stepsChecked = 0;
let pairsChecked = 0;

for (const entry of readdirSync(WORKFLOW_DIR)) {
  if (!/\.ya?ml$/.test(entry)) continue;
  const wf = YAML.parse(readFileSync(join(WORKFLOW_DIR, entry), "utf8"));
  for (const [jobId, job] of Object.entries(wf?.jobs ?? {})) {
    const jobEnv = new Set(Object.keys(job?.env ?? {}));
    for (const step of job?.steps ?? []) {
      if (typeof step?.run !== "string") continue;
      const supplied = new Set([...jobEnv, ...Object.keys(step.env ?? {})]);
      const files = [...new Set([...step.run.matchAll(TEST_TOKEN)].map((m) => m[0]))]
        .filter((f) => !f.startsWith("*") && existsSync(f));
      if (files.length === 0) continue;
      stepsChecked += 1;
      const stepName = step.name ?? "(unnamed step)";
      for (const file of files) {
        pairsChecked += 1;
        const gates = gateVariables(file);
        if (listGates) gatesSeen.push({ file, gates: [...gates] });
        const missing = [...gates].filter((v) => !supplied.has(v));
        if (missing.length === 0) continue;
        const key = `${jobId}::${stepName}::${file}`;
        if (ALLOWED.has(key)) continue;
        findings.push({ workflow: entry, job: jobId, step: stepName, file, missing });
      }
    }
  }
}

if (asJson) {
  console.log(JSON.stringify({ stepsChecked, pairsChecked, findings, gates: listGates ? gatesSeen : undefined }, null, 2));
} else {
  console.log(`audit-silent-skips: ${stepsChecked} test steps, ${pairsChecked} suite/step pairs checked.`);
  if (listGates) {
    for (const g of gatesSeen) {
      if (g.gates.length > 0) console.log(`  gated on ${g.gates.join(", ")}  ${g.file}`);
    }
  }
  if (findings.length === 0) {
    console.log("Every suite a step names can actually run in that step's environment.");
  } else {
    console.log("");
    console.log(`${findings.length} suite(s) skip themselves in the step that runs them, so the step proves nothing:`);
    console.log("");
    for (const f of findings) {
      console.log(`  ${f.file}`);
      console.log(`      run by "${f.step}" in job ${f.job} (${f.workflow})`);
      console.log(`      reads ${f.missing.join(", ")}, which that step does not supply`);
    }
    console.log("");
    console.log("Supply the variable at job scope, or stop naming the suite in that step. A green step that");
    console.log("ran nothing is worse than a red one: it is read as coverage by everyone who comes after.");
  }
}

process.exitCode = ci && findings.length > 0 ? 1 : 0;
