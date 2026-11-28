/**
 * The silent-skip checker, tested against fixtures rather than against the repository.
 *
 * A gate with no tests of its own is exactly what this campaign keeps finding, so this one gets them. Both
 * directions matter equally: a checker that flags everything and a checker that flags nothing fail the same
 * way, and the second is how the first version of this script cleared the case Codex found.
 *
 * Fixtures are written to a temporary directory, never into the repository, so the repo-wide audits do not
 * pick them up as real suites.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";

const SCRIPT = "server/scripts/audit-ci-skips.mjs";
const URL_LITERAL = "postgres://u:p@127.0.0.1:5432/x_test";

/** A suite that gates on `gate` and, optionally, ASSIGNS another env name — the shape that fooled the audit. */
function suite({ gate, assigns }: { gate: string; assigns?: string }) {
  return [
    `import test from "node:test";`,
    `const RAW = process.env.${gate};`,
    `if (!RAW) {`,
    `  test("skipped: ${gate} not set", { skip: true }, () => {});`,
    `} else {`,
    assigns ? `  process.env.${assigns} = RAW;` : "",
    `  test("the real one", () => {});`,
    `}`,
  ].filter(Boolean).join("\n");
}

function run(
  files: Record<string, string>,
  stepEnv: Record<string, string>,
  jobEnv: Record<string, string> = {},
  /** Modules written beside the suites but NOT named by the workflow step -- imported gates live here. */
  modules: Record<string, string> = {},
  /**
   * Anything else the fixture needs on disk before the audit runs: a node_modules package, a tsconfig, a
   * barrel chain. It receives the fixture ROOT, with `suites/` already created inside it.
   *
   * The fixture root is a fresh temporary directory with no tsconfig and no node_modules above it, so an
   * unresolvable specifier really is unresolvable -- which is what makes the undeterminable tests mean
   * something rather than depend on this repository's own layout.
   */
  prepare: (root: string) => void = () => {},
) {
  const dir = mkdtempSync(join(tmpdir(), "ci-skips-"));
  try {
    mkdirSync(join(dir, "suites"), { recursive: true });
    prepare(dir);
    for (const [name, body] of Object.entries(modules)) writeFileSync(join(dir, "suites", name), body);
    const named: string[] = [];
    for (const [name, body] of Object.entries(files)) {
      const abs = join(dir, "suites", name);
      writeFileSync(abs, body);
      named.push(relative(process.cwd(), abs));
    }
    const yaml = [
      "name: fixture",
      "jobs:",
      "  fixture-job:",
      ...(Object.keys(jobEnv).length ? ["    env:", ...Object.entries(jobEnv).map(([k, v]) => `      ${k}: ${v}`)] : []),
      "    steps:",
      "      - name: the step",
      ...(Object.keys(stepEnv).length ? ["        env:", ...Object.entries(stepEnv).map(([k, v]) => `          ${k}: ${v}`)] : []),
      `        run: node --import tsx --test ${named.join(" ")}`,
    ].join("\n");
    const wf = join(dir, "workflow.yml");
    writeFileSync(wf, yaml);
    try {
      const out = execFileSync(process.execPath, [SCRIPT, "--json", "--ci", wf], { encoding: "utf8" });
      return { exit: 0, ...JSON.parse(out) };
    } catch (error: any) {
      return { exit: error.status ?? 1, ...JSON.parse(String(error.stdout || "{}")) };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a suite whose gate variable is absent is reported, and --ci fails", () => {
  const r = run({ "a.test.ts": suite({ gate: "TEST_DATABASE_URL" }) }, { CS_TEST_PG_URL: URL_LITERAL });
  assert.equal(r.hits.length, 1, "the suite is named by CI and cannot run");
  assert.deepEqual(r.hits[0].wants, ["TEST_DATABASE_URL"]);
  assert.equal(r.exit, 1, "--ci must fail, or the gate is decoration");
});

test("a suite whose gate variable is present is not reported", () => {
  const r = run({ "a.test.ts": suite({ gate: "TEST_DATABASE_URL" }) }, { TEST_DATABASE_URL: URL_LITERAL });
  assert.deepEqual(r.hits, [], "a checker that flags a satisfied suite is as useless as one that flags nothing");
  assert.equal(r.exit, 0);
});

test("the variable may come from the job rather than the step", () => {
  const r = run({ "a.test.ts": suite({ gate: "TEST_DATABASE_URL" }) }, {}, { TEST_DATABASE_URL: URL_LITERAL });
  assert.deepEqual(r.hits, []);
});

test("Codex on #1541: an ASSIGNED env name does not satisfy the gate", () => {
  // The suite gates on TEST_DATABASE_URL and assigns DATABASE_URL. Supplying only the assigned name leaves it
  // skipping, and the first version of this script reported clean.
  const body = suite({ gate: "TEST_DATABASE_URL", assigns: "DATABASE_URL" });
  const r = run({ "a.test.ts": body }, { DATABASE_URL: URL_LITERAL });
  assert.equal(r.hits.length, 1, "an assignment is not an input");
  assert.deepEqual(r.hits[0].wants, ["TEST_DATABASE_URL"], "only the name it READS counts");
  assert.equal(r.exit, 1);
});

test("a name that appears only in a comment is not a gate", () => {
  // The version before this one matched bare text and flagged a suite that skips on ffmpeg and merely
  // mentions CS_TEST_PG_URL in a comment.
  const body = [
    `import test from "node:test";`,
    `// skips when ffmpeg is missing, the same way the PostgreSQL suites skip without CS_TEST_PG_URL`,
    `const hasFfmpeg = false;`,
    `if (!hasFfmpeg) { test("skipped: ffmpeg", { skip: true }, () => {}); } else { test("real", () => {}); }`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, {});
  assert.deepEqual(r.hits, [], "a comment is not a gate");
  assert.equal(r.exit, 0);
});

test("a test merely NAMED '...is skipped' is not a gate", () => {
  // This flagged wedding-square-renewal-scan.test.ts, which has no gate, always runs its 7 tests, and simply
  // contains a test named "unchanged invoice is skipped...". Reading a test title as control flow is the regex
  // mistake one layer in.
  const body = [
    `import test from "node:test";`,
    `const keys = ["SQUARE_ENV"];`,
    `const saved = keys.map((k) => process.env[k]);`,
    `const url = process.env.TEST_DATABASE_URL;`,
    `test("unchanged invoice is skipped, never paid twice", () => { if (!saved) throw new Error(String(url)); });`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, {});
  assert.doesNotMatch(body, /skip\s*:|\.skip\s*\(/, "the fixture must contain no skip MECHANISM");
  assert.match(body, /is skipped/, "only the word, in a title");
  assert.deepEqual(r.hits, [], "a title is not a gate");
  assert.equal(r.exit, 0);
});

test("a gate read dynamically is reported as undeterminable, not quietly cleared", () => {
  // Destructuring process.env makes the gate invisible to this tool. Silently clearing it would put the suite
  // back in the silent-green class, so it is reported with a different message instead.
  const body = [
    `import test from "node:test";`,
    `const { TEST_DATABASE_URL: raw } = process.env;`,
    `if (!raw) { test("skipped: no database", { skip: true }, () => {}); } else { test("real", () => {}); }`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, { CS_TEST_PG_URL: URL_LITERAL });
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].undeterminable, true, "it must say it cannot tell, rather than pass or guess");
  assert.equal(r.exit, 1);
});

test("Codex on #1541: a gate IMPORTED from a local module is followed", () => {
  // 53 suites in this repository gate on `import { PG_URL } from "../test-support/authz-pg-harness"`, where
  // the harness exports process.env.CS_TEST_PG_URL. Such a suite has no local process.env read at all, and the
  // version before this cleared every one of them.
  const harness = `export const PG_URL = process.env.CS_TEST_PG_URL;\n`;
  const body = [
    `import test from "node:test";`,
    `import { PG_URL } from "./harness";`,
    `if (!PG_URL) { test("skipped: requires CS_TEST_PG_URL", { skip: true }, () => {}); } else { test("real", () => {}); }`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, { TEST_DATABASE_URL: URL_LITERAL }, {}, { "harness.ts": harness });
  assert.doesNotMatch(body, /process\.env/, "the suite itself must not read process.env, or this proves nothing");
  assert.equal(r.hits.length, 1, "the imported gate must be followed");
  assert.deepEqual(r.hits[0].wants, ["CS_TEST_PG_URL"]);
  assert.equal(r.exit, 1);
});

test("an imported gate that IS satisfied is not reported", () => {
  const harness = `export const PG_URL = process.env.CS_TEST_PG_URL;\n`;
  const body = [
    `import test from "node:test";`,
    `import { PG_URL } from "./harness";`,
    `if (!PG_URL) { test("skipped", { skip: true }, () => {}); } else { test("real", () => {}); }`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, { CS_TEST_PG_URL: URL_LITERAL }, {}, { "harness.ts": harness });
  assert.deepEqual(r.hits, [], "following imports must not turn every harness user into a hit");
  assert.equal(r.exit, 0);
});

test("the alias form `test.skip` as a VALUE counts as a skip mechanism", () => {
  // `const postgresTest = adminUrl ? test : test.skip;` is the dominant postgres pattern here, and `.skip` is
  // never called at that point. Requiring a following "(" missed schema-push-apply and schema-push-protected,
  // which skip 23 and 7 tests without TEST_DATABASE_URL, so the audit said 6 where the truth was 8.
  const body = [
    `import test from "node:test";`,
    `const url = process.env.TEST_DATABASE_URL;`,
    `const pgTest = url ? test : test.skip;`,
    `pgTest("the real one", () => {});`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, { CS_TEST_PG_URL: URL_LITERAL });
  assert.doesNotMatch(body, /\.skip\s*\(/, "the fixture must use .skip as a value, not a call");
  assert.equal(r.hits.length, 1, "the alias form is a skip mechanism");
  assert.deepEqual(r.hits[0].wants, ["TEST_DATABASE_URL"]);
  assert.equal(r.exit, 1);
});

test("a LOCAL gate is not satisfied by a name the suite merely imports", () => {
  // Unioning local and imported reads was unsound and live: 35 skippable suites here have a local gate plus an
  // imported DATABASE_URL their gate does not use, so supplying DATABASE_URL cleared suites whose real gate was
  // absent. Judged on local reads when there are any.
  const harness = `process.env.DATABASE_URL ||= "x";\nexport const unrelated = process.env.DATABASE_URL;\n`;
  const body = [
    `import test from "node:test";`,
    `import { unrelated } from "./harness";`,
    `const url = process.env.TEST_DATABASE_URL;`,
    `if (!url) { test("skipped: no TEST_DATABASE_URL", { skip: true }, () => {}); } else { test("real", () => { void unrelated; }); }`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, { DATABASE_URL: URL_LITERAL }, {}, { "harness.ts": harness });
  assert.equal(r.hits.length, 1, "the imported DATABASE_URL must not clear a TEST_DATABASE_URL gate");
  assert.deepEqual(r.hits[0].wants, ["TEST_DATABASE_URL"]);
  assert.equal(r.exit, 1);
});

test("Codex on #1541: an unrelated read reached THROUGH the gate module does not satisfy it", () => {
  // marketplace-sample-listings gates on CS_TEST_PG_URL via `export const PG_URL = process.env.CS_TEST_PG_URL`
  // in authz-pg-harness -- but that harness imports auth-test-env, which imports load-env, whose line 53 reads
  // process.env.DATABASE_URL inside an `if`. Taking every transitive read made the suite "need" DATABASE_URL,
  // so a step supplying only that name cleared it while it skipped. An imported read counts only when it
  // initialises something EXPORTED.
  // An exported CONST whose initialiser is a function: the read sits inside the function body, so the walk up
  // from it reaches an exported VariableStatement. Without the function/block guard this would count as an
  // export initialiser and leak DATABASE_URL -- which is exactly what the mutation check needs to be able to
  // show. (A plain `export function` would not: the walk finds no VariableStatement either way, so that
  // fixture passed the mutation for the wrong reason.)
  const plumbing = [
    `export const load = () => {`,
    `  if (!process.env.DATABASE_URL) { return "fallback"; }`,
    `  return process.env.DATABASE_URL;`,
    `};`,
  ].join("\n");
  const harness = [
    `import { load } from "./plumbing";`,
    `void load;`,
    `export const PG_URL = process.env.CS_TEST_PG_URL;`,
  ].join("\n");
  const body = [
    `import test from "node:test";`,
    `import { PG_URL } from "./harness";`,
    `if (!PG_URL) { test("skipped: requires CS_TEST_PG_URL", { skip: true }, () => {}); } else { test("real", () => {}); }`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, { DATABASE_URL: URL_LITERAL }, {}, { "harness.ts": harness, "plumbing.ts": plumbing });
  assert.equal(r.hits.length, 1, "DATABASE_URL is plumbing two hops away, not this suite's gate");
  assert.deepEqual(r.hits[0].wants, ["CS_TEST_PG_URL"], "only the EXPORTED read is a gate");
  assert.equal(r.exit, 1);
});

test("a suite that READS a database URL but cannot skip is never reported", () => {
  // This fixture must read a DB name, or the test passes for the wrong reason. The first version did not, so
  // removing the can-this-skip guard from the script changed nothing and the mutation went uncaught -- a test
  // asserting something vacuous, in the suite for a tool built to find exactly that.
  const body = [
    `import test from "node:test";`,
    `const url = process.env.TEST_DATABASE_URL ?? "fallback";`,
    `test("always runs, whatever the environment says", () => { if (!url) throw new Error("x"); });`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, {});
  assert.match(body, /process\.env\.TEST_DATABASE_URL/, "the fixture must read a gate name for this to mean anything");
  assert.doesNotMatch(body, /skip/, "and must contain no skip, so only the skip guard can exclude it");
  assert.deepEqual(r.hits, [], "no skip means it always runs, so it is not a silent-skip candidate");
  assert.equal(r.exit, 0);
});

test("Codex on #1541: a key present with an EMPTY value does not satisfy the gate", () => {
  // `Object.keys` marked the name available whatever it was set to, and a suite reading `""` skips exactly as
  // it does with the name unset. The fourth false clean in this file, and the first that needed no suite
  // trickery at all -- just a workflow line.
  const r = run({ "a.test.ts": suite({ gate: "TEST_DATABASE_URL" }) }, { TEST_DATABASE_URL: '""' });
  assert.equal(r.hits.length, 1, "an empty value is not a connection string");
  assert.deepEqual(r.hits[0].wants, ["TEST_DATABASE_URL"]);
  assert.deepEqual(r.hits[0].available, [], "and it must not be listed as available either");
  assert.equal(r.exit, 1);
});

test("Codex on #1541: an empty STEP value overrides a populated job value", () => {
  // The union could not express this at all: the job supplies a real URL, the step blanks it, and GitHub runs
  // the step with the blank. Precedence, not union, is what makes this visible.
  const r = run(
    { "a.test.ts": suite({ gate: "TEST_DATABASE_URL" }) },
    { TEST_DATABASE_URL: '""' },
    { TEST_DATABASE_URL: URL_LITERAL },
  );
  assert.equal(r.hits.length, 1, "the step's empty value wins, so the suite skips");
  assert.deepEqual(r.hits[0].wants, ["TEST_DATABASE_URL"]);
  assert.equal(r.exit, 1);
});

test("and precedence runs the other way too: a populated step value overrides an empty job value", () => {
  // The other direction, because a gate that flags everything empty-adjacent is the noise failure. Here the
  // step genuinely supplies the URL and the suite genuinely runs.
  const r = run(
    { "a.test.ts": suite({ gate: "TEST_DATABASE_URL" }) },
    { TEST_DATABASE_URL: URL_LITERAL },
    { TEST_DATABASE_URL: '""' },
  );
  assert.deepEqual(r.hits, [], "the step's real URL wins, so the suite runs");
  assert.equal(r.exit, 0);
});

test("the `NAME:` form with nothing after it is empty too", () => {
  // Actions passes a null-valued key as the empty string, so it has to be treated the same way. This is the
  // shape a hand-edited workflow produces by accident.
  const r = run({ "a.test.ts": suite({ gate: "TEST_DATABASE_URL" }) }, { TEST_DATABASE_URL: "" });
  assert.equal(r.hits.length, 1, "a key with no value is not a connection string");
  assert.equal(r.exit, 1);
});

/* ---------------------------------------------------------------------------------------------------------
 * UNKNOWN IS NEVER SAFE.
 *
 * Codex's last four findings on #1541 were one bug seen four ways: when this script could not resolve
 * something it returned no gate names, and no gate names was read as "safe". Each fixture below is a suite
 * that really does produce 0 passes, 1 skip and exit 0, and each one the script cleared silently.
 * ------------------------------------------------------------------------------------------------------- */

/** A suite with no process.env read of its own, gated entirely on an imported binding. */
const importedGateSuite = (spec: string) => [
  `import test from "node:test";`,
  `import { PG_URL } from "${spec}";`,
  `if (!PG_URL) { test("skipped: requires CS_TEST_PG_URL", { skip: true }, () => {}); } else { test("real", () => {}); }`,
].join("\n");

test("Codex on #1541: a gate behind a BARE PACKAGE specifier is not cleared", () => {
  // The leading-dot test discarded every non-relative specifier with no trace, so a gate published as a
  // package was invisible and the suite was reported safe. It is reported as undeterminable rather than
  // named, because reasoning about a published package's exports is a different job from resolving this
  // repository's own modules -- but it is reported.
  const body = importedGateSuite("fake-harness");
  const r = run({ "a.test.ts": body }, { TEST_DATABASE_URL: URL_LITERAL }, {}, {}, (root) => {
    mkdirSync(join(root, "node_modules", "fake-harness"), { recursive: true });
    writeFileSync(join(root, "node_modules", "fake-harness", "package.json"), JSON.stringify({ name: "fake-harness", main: "index.js" }));
    writeFileSync(join(root, "node_modules", "fake-harness", "index.js"), `export const PG_URL = process.env.CS_TEST_PG_URL;\n`);
  });
  assert.doesNotMatch(body, /process\.env/, "the suite must have no local read, or this proves nothing");
  assert.equal(r.hits.length, 1, "a gate in a package is still a gate");
  assert.equal(r.hits[0].undeterminable, true);
  assert.equal(r.exit, 1);
});

test("an installed package that reads no database name anywhere is cleared on EVIDENCE, not assumption", () => {
  // The noise direction, and the reason the rule above is affordable: 13 external packages are reachable from
  // the suites in this repository and none of them reads a database name in code. If every bare specifier
  // were undeterminable instead, the gate would fail on every suite that imports express.
  const r = run({ "a.test.ts": [
    `import test from "node:test";`,
    `import { thing } from "harmless-pkg";`,
    `const url = process.env.TEST_DATABASE_URL;`,
    `if (!url) { test("skipped", { skip: true }, () => {}); } else { test("real", () => { void thing; }); }`,
  ].join("\n") }, { TEST_DATABASE_URL: URL_LITERAL }, {}, {}, (root) => {
    mkdirSync(join(root, "node_modules", "harmless-pkg"), { recursive: true });
    writeFileSync(join(root, "node_modules", "harmless-pkg", "package.json"), JSON.stringify({ name: "harmless-pkg", main: "index.js" }));
    writeFileSync(join(root, "node_modules", "harmless-pkg", "index.js"), `export const thing = process.env.NODE_ENV;\n`);
  });
  assert.deepEqual(r.hits, [], "a package that cannot be a connection-string gate must not make a suite undeterminable");
  assert.equal(r.exit, 0);
});

test("a database name in a package's MARKDOWN is not a read", () => {
  // @neondatabase/serverless shows `process.env.DATABASE_URL` in its README a dozen times and reads it
  // nowhere in code. Scanning documentation would have made every suite importing it undeterminable -- the
  // same mistake as the version of this script that cried wolf about a comment, one directory out.
  const r = run({ "a.test.ts": [
    `import test from "node:test";`,
    `import { thing } from "documented-pkg";`,
    `const url = process.env.TEST_DATABASE_URL;`,
    `if (!url) { test("skipped", { skip: true }, () => {}); } else { test("real", () => { void thing; }); }`,
  ].join("\n") }, { TEST_DATABASE_URL: URL_LITERAL }, {}, {}, (root) => {
    mkdirSync(join(root, "node_modules", "documented-pkg"), { recursive: true });
    writeFileSync(join(root, "node_modules", "documented-pkg", "package.json"), JSON.stringify({ name: "documented-pkg", main: "index.js" }));
    writeFileSync(join(root, "node_modules", "documented-pkg", "index.js"), `export const thing = 1;\n`);
    writeFileSync(join(root, "node_modules", "documented-pkg", "README.md"), `const sql = neon(process.env.DATABASE_URL);\n`);
  });
  assert.deepEqual(r.hits, [], "documentation is not code");
  assert.equal(r.exit, 0);
});

test("a package that is NOT INSTALLED cannot be judged, so it is reported", () => {
  // Without the package there is nothing to read. Clearing it would mean the gate's answer depended on
  // whether npm ci had run, which is the worst possible property for a gate to have.
  const r = run({ "a.test.ts": importedGateSuite("absent-pkg") }, { TEST_DATABASE_URL: URL_LITERAL });
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].undeterminable, true);
  assert.match(String(r.hits[0].unresolved), /absent-pkg \(not installed\)/);
  assert.equal(r.exit, 1);
});

test("Codex on #1541: a gate behind a tsconfig PATH ALIAS is resolved and named", () => {
  // Discarded by the same leading-dot test as the bare specifier. Resolving it rather than merely reporting
  // it matters: `@shared/*` is reachable from four suites here, and reporting those as undeterminable would
  // be four false alarms on a green repository.
  const r = run({ "a.test.ts": importedGateSuite("@fx/harness") }, { TEST_DATABASE_URL: URL_LITERAL }, {}, {}, (root) => {
    mkdirSync(join(root, "support"), { recursive: true });
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@fx/*": ["./support/*"] } } }));
    writeFileSync(join(root, "support", "harness.ts"), `export const PG_URL = process.env.CS_TEST_PG_URL;\n`);
  });
  assert.equal(r.hits.length, 1);
  assert.deepEqual(r.hits[0].wants, ["CS_TEST_PG_URL"], "resolved, not merely flagged");
  assert.equal(r.exit, 1);
});

test("an alias declared in an EXTENDED tsconfig is followed, and a satisfied alias gate is not reported", () => {
  // This is the repository's own shape: server/tsconfig.json is nearer to every server suite than the root
  // one and declares no paths of its own -- it extends the root. Stopping at the nearest tsconfig turned four
  // real, satisfied suites into undeterminable hits.
  const r = run({ "a.test.ts": importedGateSuite("@fx/harness") }, { CS_TEST_PG_URL: URL_LITERAL }, {}, {}, (root) => {
    mkdirSync(join(root, "support"), { recursive: true });
    writeFileSync(join(root, "tsconfig.base.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@fx/*": ["./support/*"] } } }));
    // The suites live in suites/, and THIS is the tsconfig nearest to them: it has no paths, only an extends.
    writeFileSync(join(root, "suites", "tsconfig.json"), JSON.stringify({ extends: "../tsconfig.base.json" }));
    writeFileSync(join(root, "support", "harness.ts"), `export const PG_URL = process.env.CS_TEST_PG_URL;\n`);
  });
  assert.deepEqual(r.hits, [], "the alias resolves through extends, and its gate is supplied");
  assert.equal(r.exit, 0);
});

test("Codex on #1541: a barrel chain FOUR imports deep is followed", () => {
  // The depth bound was 3, picked without evidence, and at the cutoff this returned empty sets with
  // opaque: false -- so a longer chain was not merely unresolved, it was cleared.
  const r = run({ "a.test.ts": importedGateSuite("./barrel1") }, { TEST_DATABASE_URL: URL_LITERAL }, {}, {
    "barrel1.ts": `export { PG_URL } from "./barrel2";\n`,
    "barrel2.ts": `export { PG_URL } from "./barrel3";\n`,
    "barrel3.ts": `export { PG_URL } from "./harness";\n`,
    "harness.ts": `export const PG_URL = process.env.CS_TEST_PG_URL;\n`,
  });
  assert.equal(r.hits.length, 1, "four hops is still four hops from a gate");
  assert.deepEqual(r.hits[0].wants, ["CS_TEST_PG_URL"]);
  assert.equal(r.exit, 1);
});

test("an import CYCLE terminates instead of recurring forever", () => {
  // Removing the depth bound means cycle detection is the only thing that stops the walk. A suite whose
  // harness imports a module that imports the harness back must still report its gate.
  const r = run({ "a.test.ts": importedGateSuite("./harness") }, { TEST_DATABASE_URL: URL_LITERAL }, {}, {
    "harness.ts": `import { other } from "./other";\nvoid other;\nexport const PG_URL = process.env.CS_TEST_PG_URL;\n`,
    "other.ts": `import { PG_URL } from "./harness";\nexport const other = PG_URL;\n`,
  });
  assert.equal(r.hits.length, 1);
  assert.deepEqual(r.hits[0].wants, ["CS_TEST_PG_URL"]);
  assert.equal(r.exit, 1);
});

test("Codex on #1541: a binding exported by a SEPARATE export declaration is a gate", () => {
  // `const PG_URL = process.env.CS_TEST_PG_URL; export { PG_URL };` exports the binding, but its
  // VariableStatement carries no export modifier, so requiring the modifier dropped the read and cleared the
  // suite. `export { X as Y }` names the local binding in propertyName, which is the one that matters.
  const r = run({ "a.test.ts": importedGateSuite("./harness") }, { TEST_DATABASE_URL: URL_LITERAL }, {}, {
    "harness.ts": `const RAW = process.env.CS_TEST_PG_URL;\nexport { RAW as PG_URL };\n`,
  });
  assert.equal(r.hits.length, 1);
  assert.deepEqual(r.hits[0].wants, ["CS_TEST_PG_URL"]);
  assert.equal(r.exit, 1);
});

test("Codex on #1541: `process.env[\"NAME\"]` is the same read as `process.env.NAME`", () => {
  // The only one of the four that was a plain omission rather than unknown-is-safe reasoning: the dot
  // visitor did not see a literal bracket access, and the undeterminable fallback explicitly excluded one,
  // so both the wanted set and opaque stayed empty.
  const body = [
    `import test from "node:test";`,
    `const raw = process.env["CS_TEST_PG_URL"];`,
    `if (!raw) { test("skipped", { skip: true }, () => {}); } else { test("real", () => {}); }`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, { TEST_DATABASE_URL: URL_LITERAL });
  assert.doesNotMatch(body, /process\.env\.[A-Z]/, "the fixture must use bracket notation only");
  assert.equal(r.hits.length, 1);
  assert.deepEqual(r.hits[0].wants, ["CS_TEST_PG_URL"], "named, not merely flagged");
  assert.equal(r.exit, 1);
});

test("an ASSIGNMENT through bracket notation is not a read either", () => {
  // The dot-notation rule, applied to the branch Codex asked for. Without it the fix would reintroduce the
  // very first false clean: a suite that gates on one name and assigns another looking satisfied by the
  // assigned one.
  const body = [
    `import test from "node:test";`,
    `const raw = process.env.TEST_DATABASE_URL;`,
    `if (!raw) { test("skipped", { skip: true }, () => {}); } else { process.env["DATABASE_URL"] = raw; test("real", () => {}); }`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, { DATABASE_URL: URL_LITERAL });
  assert.match(body, /process\.env\["DATABASE_URL"\] =/, "the fixture must assign through brackets");
  assert.equal(r.hits.length, 1);
  assert.deepEqual(r.hits[0].wants, ["TEST_DATABASE_URL"], "the assigned name is not an input");
  assert.equal(r.exit, 1);
});

test("an UNRESOLVABLE relative import makes a suite undeterminable", () => {
  // The general case of the rule, with nothing exotic about it: a specifier that points at no file on disk.
  const r = run({ "a.test.ts": importedGateSuite("./missing-harness") }, { TEST_DATABASE_URL: URL_LITERAL });
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].undeterminable, true);
  assert.match(String(r.hits[0].unresolved), /\.\/missing-harness/);
  assert.equal(r.exit, 1);
});

test("an unknown does not clear a suite whose visible gate IS satisfied", () => {
  // The decision rule itself, and the half that was wrong. A suite was only undeterminable when it had NO
  // read at all, so an unresolvable import sitting beside a satisfied read was waved through -- which is how
  // all three resolution findings could clear a suite rather than merely under-report it.
  const body = [
    `import test from "node:test";`,
    `import { extra } from "./missing-harness";`,
    `const url = process.env.TEST_DATABASE_URL;`,
    `if (!url || !extra) { test("skipped", { skip: true }, () => {}); } else { test("real", () => {}); }`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, { TEST_DATABASE_URL: URL_LITERAL });
  assert.equal(r.hits.length, 1, "a satisfied read does not license ignoring the part it cannot see");
  assert.equal(r.hits[0].undeterminable, true);
  assert.deepEqual(r.hits[0].wants, ["TEST_DATABASE_URL"], "and it says what it COULD see");
  assert.equal(r.exit, 1);
});

/* ---------------------------------------------------------------------------------------------------------
 * COMPUTED KEYS. Calling a resolvable thing unknown is how a gate becomes noise: treating every
 * `process.env[k]` as unknowable made 33 real, satisfied Square suites undeterminable in one stroke.
 * ------------------------------------------------------------------------------------------------------- */

test("a computed key from an imported string CONSTANT is resolved, not feared", () => {
  // `process.env[SECRET_BOX_KEY_ENV]` is the save/restore shape in 30 Square suites, and the name it holds is
  // an encryption key, not a database. Reporting those would be 30 false alarms.
  const r = run({ "a.test.ts": [
    `import test from "node:test";`,
    `import { KEY_ENV } from "./names";`,
    `const url = process.env.TEST_DATABASE_URL;`,
    `process.env[KEY_ENV] = "x";`,
    `if (!url) { test("skipped", { skip: true }, () => {}); } else { test("real", () => {}); }`,
  ].join("\n") }, { TEST_DATABASE_URL: URL_LITERAL }, {}, { "names.ts": `export const KEY_ENV = "SOME_ENCRYPTION_KEY";\n` });
  assert.deepEqual(r.hits, [], "a knowable key that is not a database name changes nothing");
  assert.equal(r.exit, 0);
});

test("and a computed key that resolves TO a database name is collected as a read", () => {
  // The same mechanism in the direction that matters: if the constant names the gate, the gate is named.
  const r = run({ "a.test.ts": [
    `import test from "node:test";`,
    `import { DB_ENV } from "./names";`,
    `const url = process.env[DB_ENV];`,
    `if (!url) { test("skipped", { skip: true }, () => {}); } else { test("real", () => {}); }`,
  ].join("\n") }, { CS_TEST_PG_URL: URL_LITERAL }, {}, { "names.ts": `export const DB_ENV = "TEST_DATABASE_URL";\n` });
  assert.equal(r.hits.length, 1);
  assert.deepEqual(r.hits[0].wants, ["TEST_DATABASE_URL"], "resolved through the constant, and named");
  assert.equal(r.exit, 1);
});

test("a callback parameter over an `as const` array of literals is resolved", () => {
  // `const keys = [...] as const; const old = keys.map((k) => process.env[k]);` -- nine Wedding Square suites.
  // The `as const` wrapper is an AsExpression, which the first version of the array reader did not see
  // through, so these stayed undeterminable after the constant case was handled.
  const r = run({ "a.test.ts": [
    `import test from "node:test";`,
    `const keys = ["SQUARE_ENV", "SQUARE_LOCATION_ID"] as const;`,
    `const saved = keys.map((k) => process.env[k]);`,
    `const url = process.env.WEDDING_SQUARE_TEST_DATABASE_URL;`,
    `if (!url) { test("skipped", { skip: true }, () => { void saved; }); } else { test("real", () => {}); }`,
  ].join("\n") }, { WEDDING_SQUARE_TEST_DATABASE_URL: URL_LITERAL });
  assert.deepEqual(r.hits, [], "the keys are right there in the file");
  assert.equal(r.exit, 0);
});

test("a helper that takes the NAME as a string is followed to its call sites", () => {
  // Two things at once. The noise half: `withoutConfig(variable, fn)` driven by a for-of over literals is the
  // catering shape, and it is knowable. The sound half: this closes a blind spot Codex raised on this PR and
  // nobody had closed -- a gate read through a helper called with "TEST_DATABASE_URL" is now a read OF
  // TEST_DATABASE_URL rather than a miss.
  const r = run({ "a.test.ts": [
    `import test from "node:test";`,
    `function readEnv(name: string) { return process.env[name]; }`,
    `const url = readEnv("TEST_DATABASE_URL");`,
    `for (const other of ["SQUARE_ENV", "SQUARE_LOCATION_ID"]) { void readEnv(other); }`,
    `if (!url) { test("skipped", { skip: true }, () => {}); } else { test("real", () => {}); }`,
  ].join("\n") }, { CS_TEST_PG_URL: URL_LITERAL });
  assert.equal(r.hits.length, 1, "the gate is read through the helper");
  assert.deepEqual(r.hits[0].wants, ["TEST_DATABASE_URL"], "and the helper's literal argument names it");
  assert.equal(r.exit, 1);
});

test("ONE unknowable call site poisons the whole parameter", () => {
  // If any caller passes something this tool cannot evaluate, the parameter is unknowable and the suite is
  // reported. Otherwise the computed-key resolution above would be a new way to clear a suite quietly, which
  // is the whole bug this change exists to remove.
  //
  // The fixture needs BOTH a knowable and an unknowable call site, and that is not a stylistic choice. My
  // first version had only the dynamic one, so the collected set came out empty and the empty-set branch
  // excluded it anyway: removing the `unknown` flag from the script changed nothing and the mutation went
  // uncaught. A test passing for the wrong reason, in the suite for a tool built to find exactly that --
  // the third time that trap has been hit on this branch. With a knowable site present, dropping the flag
  // resolves the key to "SQUARE_ENV", finds no database name, and clears a suite that skips.
  const body = [
    `import test from "node:test";`,
    `function readEnv(name: string) { return process.env[name]; }`,
    `void readEnv("SQUARE_ENV");`,
    `const chosen = String(Math.random());`,
    `const url = readEnv(chosen);`,
    `if (!url) { test("skipped", { skip: true }, () => {}); } else { test("real", () => {}); }`,
  ].join("\n");
  const r = run({ "a.test.ts": body }, { TEST_DATABASE_URL: URL_LITERAL });
  assert.match(body, /readEnv\("SQUARE_ENV"\)/, "one call site must be knowable, or the flag is not what is tested");
  assert.match(body, /readEnv\(chosen\)/, "and one must not be");
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].undeterminable, true, "unknowable means reported, not cleared");
  assert.equal(r.exit, 1);
});
