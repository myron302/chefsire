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
 * Usage: node server/scripts/audit-ci-skips.mjs [--ci] [--json]
 */
import { readFileSync, existsSync } from "node:fs";
import { parse } from "yaml";

const args = process.argv.slice(2);
const ci = args.includes("--ci");
const asJson = args.includes("--json");
const WORKFLOWS = [".github/workflows/pr-validation.yml"];

/**
 * The connection-string names these suites gate on; any one being present is enough for most.
 *
 * Matched only as `process.env.NAME`, never as a bare mention. The first version matched the bare name and
 * reported video-transcode.ffmpeg.test.ts, which skips when FFMPEG is missing and merely mentions
 * CS_TEST_PG_URL in a comment explaining that it skips "the same way the PostgreSQL suites skip". A checker
 * that cries wolf about a comment teaches people to ignore it.
 */
const DB_NAMES = ["TEST_DATABASE_URL", "DATABASE_URL", "CS_TEST_PG_URL", "CATERING_TEST_PG_URL", "WEDDING_SQUARE_TEST_DATABASE_URL", "ADMIN_TEST_PG_URL"];
const DB_READ = new RegExp(`process\\.env\\.(${DB_NAMES.join("|")})\\b`, "g");
const isDbName = (name) => DB_NAMES.includes(name);

/**
 * Suites allowed to be named by CI and skip anyway, each with the reason and what would change it.
 * This is the "or is listed below with the reason it does not" half of done-condition 1, made executable.
 */
const ALLOWED = new Map([
  // ["server/foo.postgres.test.ts", "needs a second cluster; would run if CI started one"],
]);

function envNames(obj) {
  return obj && typeof obj === "object" ? Object.keys(obj) : [];
}

const findings = [];
const checked = { steps: 0, files: 0 };

for (const wf of WORKFLOWS) {
  if (!existsSync(wf)) continue;
  const doc = parse(readFileSync(wf, "utf8"));
  const topEnv = envNames(doc.env);
  for (const [jobId, job] of Object.entries(doc.jobs ?? {})) {
    const jobEnv = envNames(job.env);
    for (const step of job.steps ?? []) {
      const run = typeof step.run === "string" ? step.run : "";
      if (!/node .*--test|run-ci-batch\.mjs/.test(run)) continue;
      const available = new Set([...topEnv, ...jobEnv, ...envNames(step.env)]);
      const viaWrapper = run.includes("run-ci-batch.mjs");
      const files = [...run.matchAll(/\S+\.test\.(?:ts|tsx|mts)/g)].map((m) => m[0]);
      if (files.length === 0) continue;
      checked.steps += 1;
      for (const file of files) {
        if (!existsSync(file)) continue;
        checked.files += 1;
        const text = readFileSync(file, "utf8");
        // Only suites that can skip at all are candidates.
        if (!/skip/.test(text)) continue;
        const wanted = new Set([...text.matchAll(DB_READ)].map((m) => m[1]));
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
      console.log(`      reads ${h.wants.join(" or ")}; that step has ${h.available.length ? h.available.join(", ") : "no database URL at all"}`);
    }
    console.log("");
    console.log("Supply one of the names each suite reads in that job or step. If a suite genuinely cannot run");
    console.log("in CI, add it to ALLOWED in this script WITH the reason and what would change it -- which is");
    console.log("the 'or is listed with the reason it does not' half of done-condition 1.");
  }
}

process.exitCode = ci && hits.length > 0 ? 1 : 0;
