#!/usr/bin/env node
/**
 * Finds suites that CI names and then does not run, because the environment variable they gate on is absent.
 *
 * Done-condition 1 is "every test suite in the repository runs in CI, or is listed below with the reason it
 * does not". Comparing filenames in the workflow against filenames on disk does NOT establish that, and the
 * campaign record said it did. Codex found the counterexample:
 *
 *   the `wedding-square-postgres-migration-tests` job supplies WEDDING_SQUARE_TEST_DATABASE_URL and its
 *   batches supply CS_TEST_PG_URL, but nothing supplies TEST_DATABASE_URL -- so db-outage.postgres,
 *   auth-db-outage.postgres and wedding-registry-links.postgres register SKIPPED placeholders and node exits
 *   0. Seven skipped, zero passed, green. Thirty-three real tests, dormant.
 *
 * `run-ci-batch.mjs` already rejects a skip, but only 26 of the workflow's 120 test steps go through it; the
 * other 94 invoke node directly and cannot see it. Rewriting all 94 is a bigger change than one run should
 * make blind, so this reads the workflow instead and answers the question for every step at once.
 *
 * HOW IT DECIDES. For each test file a step names, it collects the database-URL environment names that file
 * mentions. If the file can skip at all and NONE of those names is available to that step (job env, step env,
 * or the workflow's top-level env), the suite is reported: it is named by CI and will not run.
 *
 * WHAT IT CANNOT SEE: a suite that skips for a reason other than a missing database URL, and a step whose env
 * comes from a secret or an expression this does not evaluate. It is a floor, like the other audits here --
 * it catches the class that has actually bitten, and says so rather than implying more.
 *
 * Usage: node server/scripts/audit-ci-skips.mjs [--ci] [--json] [workflow.yml...]
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { parse } from "yaml";
import ts from "typescript";

const args = process.argv.slice(2);
const ci = args.includes("--ci");
const asJson = args.includes("--json");
/** Positional arguments override the workflow list, so the suite below can point this at fixtures. */
const given = args.filter((a) => !a.startsWith("--"));
const WORKFLOWS = given.length > 0 ? given : [".github/workflows/pr-validation.yml"];

/**
 * The connection-string names these suites gate on; any one being present is enough for most.
 *
 * Matched only as `process.env.NAME`, never as a bare mention. The first version matched the bare name and
 * reported video-transcode.ffmpeg.test.ts, which skips when FFMPEG is missing and merely mentions
 * CS_TEST_PG_URL in a comment explaining that it skips "the same way the PostgreSQL suites skip". A checker
 * that cries wolf about a comment teaches people to ignore it.
 */
// PGURL is in the list because seven suites accept it: the schema-push fallback chains read
// `process.env.TEST_DATABASE_URL, process.env.PGURL, ...` and genuinely take either. Checked that no suite
// gates on it ALONE, so adding it cannot clear anything whose real gate is missing -- it only lets a step that
// supplies PGURL be judged correctly. Everything else that looked database-ish in a skippable suite turned out
// to be a feature flag (WEDDING_SQUARE_SANDBOX_*_ENABLED, a merchant id, a webhook URL), not a connection
// string, and those gates are outside what this script claims to judge.
const DB_NAMES = ["TEST_DATABASE_URL", "DATABASE_URL", "CS_TEST_PG_URL", "CATERING_TEST_PG_URL", "WEDDING_SQUARE_TEST_DATABASE_URL", "ADMIN_TEST_PG_URL", "PGURL"];
const isDbName = (name) => DB_NAMES.includes(name);

/**
 * The database URLs a suite READS, as distinct from the ones it WRITES.
 *
 * Codex's second finding here, and it made the gate unsound in the direction that matters. The first version
 * counted any `process.env.NAME` occurrence, so a suite that gates on TEST_DATABASE_URL and then ASSIGNS
 * `process.env.DATABASE_URL = scratch.url` -- which session-cookie-races.postgres.test.ts does, at lines 17
 * and 28 -- looked satisfied by DATABASE_URL alone. Supply only that name and the audit reported clean while
 * the suite skipped, zero passes, exit 0. The exact silent green this script exists to catch, waved through by
 * the script.
 *
 * An assignment target is not an input, so it is excluded. Walking the AST rather than matching text also
 * drops names in comments, which the version before this one got wrong the other way.
 */
/** Relative import specifiers in a file, resolved to files on disk. */
function localImports(sf, file) {
  const dir = dirname(file);
  const out = [];
  for (const stmt of sf.statements) {
    const spec = (ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt)) ? stmt.moduleSpecifier : undefined;
    if (!spec || !ts.isStringLiteral(spec) || !spec.text.startsWith(".")) continue;
    const base = resolvePath(dir, spec.text);
    // `existsSync` is true for a directory, and `../test-support` is one -- the extension candidates have to
    // be tried first and the result has to be a FILE.
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}.mts`, join(base, "index.ts"), base]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) { out.push(candidate); break; }
    }
  }
  return out;
}

function envReads(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const reads = new Set();
  // A gate this function cannot read: `const { TEST_DATABASE_URL } = process.env`, or `process.env[name]` with
  // a key it cannot evaluate. Neither appears as a DB gate in this repository today -- checked, not assumed:
  // no test file destructures process.env at all, and every bracket access is a save/restore helper over
  // NODE_ENV, CORS or SQUARE_ names. But a suite that grew one would have an INVISIBLE gate and land straight
  // back in the silent-green class, so it is reported as undeterminable rather than quietly cleared.
  let opaque = false;
  const isAssignmentTarget = (node) => {
    const parent = node.parent;
    if (!parent) return false;
    if (ts.isBinaryExpression(parent) && parent.left === node) {
      // `=` and every compound assignment; a comparison is a read.
      return parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
        && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
    }
    if (ts.isDeleteExpression(parent)) return true;
    return false;
  };
  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "process" &&
      node.expression.name.text === "env" &&
      isDbName(node.name.text) &&
      !isAssignmentTarget(node)
    ) {
      reads.add(node.name.text);
    }
    // `const { ... } = process.env`
    if (
      ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer &&
      ts.isPropertyAccessExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "process" && node.initializer.name.text === "env"
    ) {
      opaque = true;
    }
    // `process.env[expr]` where expr is not a string literal, read rather than written
    if (
      ts.isElementAccessExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "process" &&
      node.expression.name.text === "env" && !ts.isStringLiteral(node.argumentExpression) &&
      !isAssignmentTarget(node) && !(node.parent && ts.isDeleteExpression(node.parent))
    ) {
      opaque = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { reads, opaque, sf };
}

/**
 * The gate a suite reads, following its own relative imports.
 *
 * Codex's third finding here, and the largest: 53 suites in this repository gate on an IMPORTED constant --
 * `import { PG_URL } from "../test-support/authz-pg-harness"`, where the harness exports
 * `process.env.CS_TEST_PG_URL`. A suite like that has no local `process.env` read at all, so the version
 * before this cleared every one of them. Codex reproduced it on
 * marketplace-sample-listings.postgres.test.ts: remove CS_TEST_PG_URL from its step and the audit reported
 * zero hits while the suite produced zero passes, one skip, exit 0.
 *
 * Local reads and imported reads are kept SEPARATE, and a suite is judged on its local reads when it has any.
 * Unioning them was unsound, and the unsoundness was live rather than theoretical: 35 skippable suites here
 * have a local gate plus an imported `DATABASE_URL` their gate does not use, so with one set and
 * `some(available)`, supplying DATABASE_URL cleared a suite whose real gate was absent. Measured: dropping
 * TEST_DATABASE_URL from batch 1 while leaving DATABASE_URL reported 4 suites where it should report 8, and
 * square-connection-service.postgres.test.ts -- 0 pass, 1 skip with that environment -- was one of the four it
 * cleared. A gate that can clear a silently-green suite is the only failure that costs anything, and it is the
 * one I had just reintroduced while fixing another.
 *
 * Shapes measured across the skippable suites: 21 gate locally only, 53 gate through an import only, 35 do
 * both. Judging on local-when-present is correct for all three.
 */
function gateReads(file, depth = 0, seen = new Set()) {
  if (seen.has(file) || depth > 3) return { local: new Set(), inherited: new Set(), opaque: false };
  seen.add(file);
  const own = envReads(file, readFileSync(file, "utf8"));
  const inherited = new Set();
  let opaque = own.opaque;
  for (const imported of localImports(own.sf, file)) {
    const inner = gateReads(imported, depth + 1, seen);
    for (const name of inner.local) inherited.add(name);
    for (const name of inner.inherited) inherited.add(name);
    opaque = opaque || inner.opaque;
  }
  return { local: own.reads, inherited, opaque };
}

/** The names that actually decide this suite's gate: its own if it has any, otherwise the ones it imports. */
function effectiveGate(file) {
  const { local, inherited, opaque } = gateReads(file);
  return { reads: local.size > 0 ? local : inherited, opaque };
}

/**
 * Suites allowed to be named by CI and skip anyway, each with the reason and what would change it.
 * This is the "or is listed below with the reason it does not" half of done-condition 1, made executable.
 */
const ALLOWED = new Map([
  // ["server/foo.postgres.test.ts", "needs a second cluster; would run if CI started one"],
]);

/**
 * The environment names a step can ACTUALLY use: resolved by precedence, with empty values rejected.
 *
 * Codex's fourth finding here, and the fourth of the false-clean kind. The version before this one took
 * `Object.keys` of each layer and unioned them, so a key counted as satisfying a gate whatever it was set to.
 * Two shapes slipped through, both of which a suite treats as absent and node then exits 0 on:
 *
 *   env:
 *     TEST_DATABASE_URL: ""     # present as a key, empty as a value
 *
 *   job env: TEST_DATABASE_URL: postgres://...   # populated
 *   step env: TEST_DATABASE_URL: ""              # and overridden to nothing, which the union hid entirely
 *
 * Precedence is GitHub's: workflow env, then job env, then step env, each layer overriding the last -- so an
 * empty step-level value does not merely fail to help, it REMOVES a populated job-level one, and a union
 * could not express that. A value of `null` is the `NAME:` form with nothing after it, which Actions also
 * passes as the empty string.
 *
 * Neither shape exists in pr-validation.yml today -- checked, every database name there has a literal URL --
 * so this fixes a false clean that has not yet fired rather than one that has. It goes in because the gate is
 * now a CI gate: the cheap failure in this file is noise and the expensive one is silence, and silence is
 * what it has produced four times.
 *
 * Still not evaluated, and still the documented limit: a value from a secret or a `${{ }}` expression counts
 * as present, because this tool cannot know what it expands to. There are none in the workflow today.
 */
function effectiveEnv(...layers) {
  const resolved = new Map();
  for (const layer of layers) {
    if (!layer || typeof layer !== "object") continue;
    for (const [name, value] of Object.entries(layer)) resolved.set(name, value);
  }
  const usable = new Set();
  for (const [name, value] of resolved) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    usable.add(name);
  }
  return usable;
}

const findings = [];
const checked = { steps: 0, files: 0 };

for (const wf of WORKFLOWS) {
  if (!existsSync(wf)) continue;
  const doc = parse(readFileSync(wf, "utf8"));
  for (const [jobId, job] of Object.entries(doc.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      const run = typeof step.run === "string" ? step.run : "";
      if (!/node .*--test|run-ci-batch\.mjs/.test(run)) continue;
      const available = effectiveEnv(doc.env, job.env, step.env);
      const viaWrapper = run.includes("run-ci-batch.mjs");
      const files = [...run.matchAll(/\S+\.test\.(?:ts|tsx|mts)/g)].map((m) => m[0]);
      if (files.length === 0) continue;
      checked.steps += 1;
      for (const file of files) {
        if (!existsSync(file)) continue;
        checked.files += 1;
        const text = readFileSync(file, "utf8");
        // Only suites with a real skip MECHANISM are candidates. Matching the bare word "skip" flagged
        // wedding-square-renewal-scan.test.ts, which has no gate at all, always runs its 7 tests, and simply
        // contains a test NAMED "unchanged invoice is skipped, never reinserted or paid through twice". A
        // checker that reads test titles as control flow is the regex mistake again, one layer in.
        // `.skip` must match as a VALUE, not only as a call. The dominant postgres pattern in this repository
        // is `const postgresTest = adminUrl ? test : test.skip;` -- the alias form -- where `.skip` is never
        // invoked at that point. Requiring `(` missed schema-push-apply and schema-push-protected, which skip
        // 23 and 7 tests respectively without TEST_DATABASE_URL, so the audit reported 6 where the truth was 8.
        // `\.skip\b` does not match `.skipped`, so a destructured `{ skipped }` result stays out.
        if (!/\bskip\s*:|\.skip\b/.test(text)) continue;
        const { reads: wanted, opaque } = effectiveGate(file);
        // Only undeterminable when there is no direct read to go on: a suite with both is judged on the read.
        if (wanted.size === 0 && opaque) {
          findings.push({
            file, job: jobId, step: step.name ?? "(unnamed step)", undeterminable: true,
            wants: [], available: [...available].filter(isDbName).sort(), viaWrapper,
          });
          continue;
        }
        if (wanted.size === 0) continue;
        if ([...wanted].some((name) => available.has(name))) continue;
        findings.push({
          file,
          job: jobId,
          step: step.name ?? "(unnamed step)",
          wants: [...wanted].sort(),
          available: [...available].filter(isDbName).sort(),
          viaWrapper,
        });
      }
    }
  }
}

const hits = findings.filter((f) => !ALLOWED.has(f.file));

if (asJson) {
  console.log(JSON.stringify({ checked, hits, excused: findings.length - hits.length }, null, 2));
} else {
  console.log(`audit-ci-skips: ${checked.steps} test steps, ${checked.files} named suites examined.`);
  if (hits.length === 0) {
    console.log("Every suite CI names has a connection string it can use, so none of them skips silently.");
  } else {
    console.log("");
    console.log(`${hits.length} suite(s) are NAMED BY CI AND WILL NOT RUN -- they skip, and node exits 0:`);
    console.log("");
    for (const h of hits) {
      console.log(`  ${h.file}`);
      console.log(`      in job "${h.job}", step "${h.step}"${h.viaWrapper ? " (via run-ci-batch, which will fail it)" : ""}`);
      if (h.undeterminable) {
        console.log("      its gate reads process.env dynamically, so this tool cannot say which name it needs.");
        console.log("      Give it a direct `process.env.NAME` read, or add it to ALLOWED with the reason.");
      } else {
        console.log(`      reads ${h.wants.join(" or ")}; that step has ${h.available.length ? h.available.join(", ") : "no database URL at all"}`);
      }
    }
    console.log("");
    console.log("Supply one of the names each suite reads in that job or step. If a suite genuinely cannot run");
    console.log("in CI, add it to ALLOWED in this script WITH the reason and what would change it -- which is");
    console.log("the 'or is listed with the reason it does not' half of done-condition 1.");
  }
}

process.exitCode = ci && hits.length > 0 ? 1 : 0;
