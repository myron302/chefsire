/**
 * The silent-skip auditor, in both directions.
 *
 * `audit-silent-skips.mjs` fails CI when a workflow step names a suite that will skip itself because the
 * connection string it reads is not in that step's environment. It exists because done-condition 1 was
 * recorded as met twice on a filename comparison -- every suite named in the workflow, no step naming a
 * missing file -- and Codex found the third direction that neither check could see. Thirty suites in one job
 * read TEST_DATABASE_URL, their steps supplied only CS_TEST_PG_URL, and all thirty skipped and exited 0.
 * Five hundred and thirty-seven tests had never run anywhere; with the variable supplied they all pass.
 *
 * A gate that reports everything and a gate that reports nothing are the same failure, so both are asserted
 * here: each shape the repository uses to gate a suite, and each way a step legitimately satisfies it.
 *
 * Fixtures are whole temporary repositories -- a workflow and the suites it names -- and the script runs over
 * them as a subprocess with that directory as its working directory, which is how it finds the workflow. They
 * are NOT committed: a committed fixture suite would be collected by the real test runner.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const SCRIPT = join(process.cwd(), "server/scripts/audit-silent-skips.mjs");

type Finding = { job: string; step: string; file: string; missing: string[] };
type Run = { findings: Finding[]; pairsChecked: number; status: number };

/**
 * Build a throwaway repository: `suites` maps a path to its source, `workflow` is the YAML.
 */
function audit(workflow: string, suites: Record<string, string>, { ci = false } = {}): Run {
  const dir = mkdtempSync(join(tmpdir(), "silent-skip-fixture-"));
  try {
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    writeFileSync(join(dir, ".github/workflows/pr.yml"), workflow);
    for (const [path, source] of Object.entries(suites)) {
      mkdirSync(join(dir, dirname(path)), { recursive: true });
      writeFileSync(join(dir, path), source);
    }
    const args = [SCRIPT, "--json"];
    if (ci) args.push("--ci");
    let status = 0;
    let stdout = "";
    try {
      stdout = execFileSync(process.execPath, args, { cwd: dir, encoding: "utf8" });
    } catch (err) {
      const e = err as { status?: number; stdout?: string };
      status = e.status ?? -1;
      stdout = e.stdout ?? "";
    }
    const parsed = JSON.parse(stdout) as { findings: Finding[]; pairsChecked: number };
    return { findings: parsed.findings, pairsChecked: parsed.pairsChecked, status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The shape thirty suites in this repository use: a conditional producing `test` or `test.skip`. */
const CONDITIONAL_ALIAS = `
  import test from "node:test";
  import assert from "node:assert/strict";
  const pgTest = process.env.TEST_DATABASE_URL ? test : test.skip;
  pgTest("needs a database", () => { assert.ok(true); });
`;

/** The other shape: a branch that registers a skipping placeholder instead of the real tests. */
const PLACEHOLDER_BRANCH = `
  import test from "node:test";
  import assert from "node:assert/strict";
  if (!process.env.TEST_DATABASE_URL) {
    test("suite skipped: TEST_DATABASE_URL not set", { skip: true }, () => {});
  } else {
    test("the real thing", () => { assert.ok(true); });
  }
`;

/** The same, one binding removed -- which is why the gate resolves local variables. */
const INDIRECT_BINDING = `
  import test from "node:test";
  import assert from "node:assert/strict";
  const RAW = process.env.TEST_DATABASE_URL;
  if (!RAW) {
    test("suite skipped", { skip: true }, () => {});
  } else {
    test("the real thing", () => { assert.ok(RAW); });
  }
`;

const wf = (stepEnv: string, jobEnv = "", file = "server/x.postgres.test.ts") => `
name: pr
jobs:
  the-job:
    runs-on: ubuntu-latest
${jobEnv ? `    env:\n${jobEnv}` : ""}
    steps:
      - name: The step
${stepEnv ? `        env:\n${stepEnv}` : ""}
        run: node --import tsx --test ${file}
`;

const SUPPLIES = "          TEST_DATABASE_URL: postgres://x\n";
const SUPPLIES_WRONG = "          CS_TEST_PG_URL: postgres://x\n";

test("a step that supplies the variable the suite reads is not reported", () => {
  const r = audit(wf(SUPPLIES), { "server/x.postgres.test.ts": CONDITIONAL_ALIAS });
  assert.deepEqual(r.findings, []);
  assert.equal(r.pairsChecked, 1, "the pair must actually have been examined");
});

test("a step supplying only the wrong variable is reported", () => {
  const r = audit(wf(SUPPLIES_WRONG), { "server/x.postgres.test.ts": CONDITIONAL_ALIAS });
  assert.equal(r.findings.length, 1);
  assert.deepEqual(r.findings[0].missing, ["TEST_DATABASE_URL"]);
  assert.equal(r.findings[0].file, "server/x.postgres.test.ts");
});

test("the skipping-placeholder shape is recognised", () => {
  const bad = audit(wf(SUPPLIES_WRONG), { "server/x.postgres.test.ts": PLACEHOLDER_BRANCH });
  assert.deepEqual(bad.findings.map((f) => f.missing), [["TEST_DATABASE_URL"]]);
  const good = audit(wf(SUPPLIES), { "server/x.postgres.test.ts": PLACEHOLDER_BRANCH });
  assert.deepEqual(good.findings, []);
});

test("a gate reached through a local binding is recognised", () => {
  const bad = audit(wf(SUPPLIES_WRONG), { "server/x.postgres.test.ts": INDIRECT_BINDING });
  assert.deepEqual(bad.findings.map((f) => f.missing), [["TEST_DATABASE_URL"]]);
  const good = audit(wf(SUPPLIES), { "server/x.postgres.test.ts": INDIRECT_BINDING });
  assert.deepEqual(good.findings, []);
});

test("a variable supplied at job scope satisfies a step that supplies nothing itself", () => {
  const r = audit(wf("", "      TEST_DATABASE_URL: postgres://x\n"), {
    "server/x.postgres.test.ts": CONDITIONAL_ALIAS,
  });
  assert.deepEqual(r.findings, [], "job-level env is inherited by every step in the job");
});

test("a suite that gates on nothing is never reported", () => {
  const r = audit(wf(""), {
    "server/x.postgres.test.ts": `
      import test from "node:test";
      import assert from "node:assert/strict";
      test("plain", () => { assert.ok(true); });
    `,
  });
  assert.deepEqual(r.findings, []);
  assert.equal(r.pairsChecked, 1);
});

test("an environment name that appears only inside a string is not read as a gate", () => {
  // This started as a weaker test that merely MENTIONED a variable name in a string and asserted no finding.
  // It passed against a regular-expression implementation too, so it proved nothing -- the exact vacuous
  // assertion this campaign exists to stop. The difference is only observable when the string is part of an
  // expression a gate actually depends on, which is what this fixture does: the gate reads CS_TEST_PG_URL and
  // falls back to a message that names TEST_DATABASE_URL. Reading the text would find both names and report a
  // variable the suite never consults. Parsing finds one, because a string's contents are not nodes.
  const r = audit(wf(SUPPLIES_WRONG), {
    "server/x.postgres.test.ts": `
      import test from "node:test";
      import assert from "node:assert/strict";
      const url = process.env.CS_TEST_PG_URL ?? "unset -- see process.env.TEST_DATABASE_URL in the docs";
      const pgTest = url.startsWith("postgres") ? test : test.skip;
      pgTest("needs a database", () => { assert.ok(url); });
    `,
  });
  assert.deepEqual(
    r.findings,
    [],
    "CS_TEST_PG_URL is supplied and TEST_DATABASE_URL is only named inside a string, so nothing is missing",
  );
});

test("a step naming a file that does not exist is left to the other check, and does not crash this one", () => {
  const r = audit(wf(SUPPLIES_WRONG, "", "server/not-here.postgres.test.ts"), {});
  assert.deepEqual(r.findings, []);
  assert.equal(r.pairsChecked, 0);
});

test("--ci exits non-zero on a finding and zero without one", () => {
  const bad = audit(wf(SUPPLIES_WRONG), { "server/x.postgres.test.ts": CONDITIONAL_ALIAS }, { ci: true });
  assert.equal(bad.status, 1, "a step that runs nothing must fail the build");
  const good = audit(wf(SUPPLIES), { "server/x.postgres.test.ts": CONDITIONAL_ALIAS }, { ci: true });
  assert.equal(good.status, 0);
});
