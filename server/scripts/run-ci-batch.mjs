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

child.on("close", (code, signal) => {
  if (signal) {
    console.error(`run-ci-batch: runner terminated by ${signal}`);
    process.exit(1);
  }

  // Node's runner prints "# skipped N" in the summary, not "# skip N".
  const skipped = Number(/^# skipped (\d+)$/m.exec(output)?.[1] ?? 0);
  const passed = Number(/^# pass (\d+)$/m.exec(output)?.[1] ?? 0);

  if (code !== 0) process.exit(code ?? 1);

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
