#!/usr/bin/env node
/**
 * Runs a batch of test files and fails when any test was skipped.
 *
 * Why this exists: every suite in the restored CI batches that can skip, skips for exactly one reason -- the
 * database connection string it reads was not in the environment. When that happens the suite registers a single
 * skipped placeholder, the runner exits 0, and the job turns green while asserting nothing. Three catering HTTP
 * suites did exactly that on #1522 and the PR merged before anyone noticed.
 *
 * A skipped test in these batches is therefore never a deliberate exclusion. It is a missing variable. So this
 * wrapper treats it as a failure and names the suites involved, instead of letting the batch pass quietly.
 *
 * Usage: node server/scripts/run-ci-batch.mjs <test file> [...]
 */
import { spawn } from "node:child_process";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("run-ci-batch: no test files given");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["--import", "tsx", "--test", "--test-concurrency=1", ...files],
  { stdio: ["inherit", "pipe", "inherit"] },
);

let output = "";
child.stdout.on("data", (chunk) => {
  const text = String(chunk);
  output += text;
  process.stdout.write(text);
});

/**
 * What failed, printed LAST, because last is the only place anyone can read.
 *
 * A job's log is fetched as a tail, and these jobs end with the postgres service container dumping its own log
 * -- hundreds of lines of constraint violations that the constraint tests caused on purpose. The actual
 * `not ok` line sits thousands of lines above that and is unreachable without downloading the whole log. On
 * 2026-11-28 batch 7 of 17 failed once, passed on a sibling PR at the same base eight minutes later, and could
 * not be named at all for that reason: five local reruns could not reproduce it, and the one record of which
 * test it was could not be read.
 *
 * A flake nobody can name is a flake nobody fixes, and that is the same damage as a suite asserting nothing.
 * So the names go at the very end of the job log, after everything else, where a 40-line tail still has them.
 */
function summariseFailures(tap) {
  const lines = tap.split("\n");
  const failures = [];
  for (let i = 0; i < lines.length; i += 1) {
    const failed = /^not ok (\d+) - (.+)$/.exec(lines[i]);
    if (!failed) continue;
    // Node's TAP puts a YAML block under each failure; `location` names the file and line.
    let location = "";
    for (let j = i + 1; j < Math.min(i + 25, lines.length); j += 1) {
      if (/^not ok |^ok /.test(lines[j])) break;
      const found = /^\s*location:\s*'?([^'\n]+)'?\s*$/.exec(lines[j]);
      if (found) { location = found[1]; break; }
    }
    failures.push({ name: failed[2], location });
  }
  return failures;
}

child.on("close", (code, signal) => {
  if (signal) {
    console.error(`run-ci-batch: runner terminated by ${signal}`);
    process.exit(1);
  }

  if (code !== 0) {
    const failures = summariseFailures(output);
    console.error("");
    console.error("================ run-ci-batch: FAILED TESTS IN THIS BATCH ================");
    if (failures.length === 0) {
      // Exit code without a `not ok` line: a crash, an unhandled rejection, or a suite that died on import.
      console.error("The runner exited non-zero but printed no `not ok` line. That usually means a suite failed");
      console.error("to load, or the process died outside a test. The batch was:");
      for (const file of files) console.error(`  - ${file}`);
    } else {
      for (const failure of failures) {
        console.error(`  FAILED: ${failure.name}`);
        if (failure.location) console.error(`          at ${failure.location}`);
      }
    }
    console.error("=========================================================================");
    process.exit(code ?? 1);
  }

  // Node's runner prints "# skipped N" in the summary, not "# skip N".
  const skipped = Number(/^# skipped (\d+)$/m.exec(output)?.[1] ?? 0);
  const passed = Number(/^# pass (\d+)$/m.exec(output)?.[1] ?? 0);

  if (skipped > 0) {
    // Name the suites so the fix is obvious: the skip reason is printed by each suite above this line.
    const names = [...output.matchAll(/^# Subtest: (.+)$/gm)].map((m) => m[1]);
    console.error("");
    console.error(`run-ci-batch: ${skipped} test(s) were SKIPPED, so this batch proved less than it appears to.`);
    console.error("In these batches a skip means a database connection string was missing from the job");
    console.error("environment, not a deliberate exclusion. Set the name the suite reads, then re-run.");
    console.error(`Suites in this batch: ${names.join(", ")}`);
    process.exit(1);
  }

  if (passed === 0) {
    console.error("");
    console.error("run-ci-batch: the batch reported zero passing tests. Nothing was exercised.");
    process.exit(1);
  }

  process.exit(0);
});
