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

function run(files: Record<string, string>, stepEnv: Record<string, string>, jobEnv: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ci-skips-"));
  try {
    mkdirSync(join(dir, "suites"), { recursive: true });
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
