/**
 * Startup fail-closed tests for P1-08.
 *
 * `server/lib/jwt-config.test.ts` proves the configuration *resolver* refuses unsafe production
 * input. This file proves the *process* does: the boot gate is loaded in a real child process with
 * a controlled environment, and the exit code is the assertion. A production ChefSire with no
 * usable JWT secret must die at startup rather than serve traffic with a guessable one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEV_ONLY_FALLBACK_JWT_SECRET, MIN_PRODUCTION_SECRET_LENGTH } from "../lib/jwt-config";

const here = path.dirname(fileURLToPath(import.meta.url));
const bootModule = path.join(here, "verify-auth-config.ts");
const repoRoot = path.resolve(here, "..", "..");

const REAL_SECRET = "s0zT1Qv7rKpN4bX9wLmE2hJdY6uAcF8gRtVnZqWs";

/**
 * An empty working directory for the child processes, created inside the repository (under the
 * gitignored `.cache/`) so Node still resolves `tsx` and `node_modules` by walking up, while
 * `<cwd>/.env` — one of the loader's supported sources — is guaranteed absent. Without this a
 * developer's repository-root `.env` would decide the outcome of these cases.
 */
function makeEmptyCwd(prefix: string): string {
  const cacheDir = path.join(repoRoot, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  return fs.mkdtempSync(path.join(cacheDir, prefix));
}

const emptyCwd = makeEmptyCwd("auth-boot-");
test.after(() => fs.rmSync(emptyCwd, { recursive: true, force: true }));

/**
 * Boot the gate in a child process with exactly the environment given (plus PATH, so node runs).
 * The parent's JWT_SECRET/SESSION_SECRET/NODE_ENV never leak in, so the cases stay hermetic.
 *
 * `DATABASE_URL` is supplied deliberately: it closes the loader's `server/.env` gate, so these
 * cases cannot be coloured by a developer's real `server/.env`, nor by the temporary one that
 * `env-load-order.test.ts` writes while the suite runs in parallel. The file sources have their
 * own tests over there; here the process environment is the whole subject.
 */
function boot(env: Record<string, string>) {
  const result = spawnSync(process.execPath, ["--import", "tsx", bootModule], {
    cwd: emptyCwd,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      DATABASE_URL: "postgres://chefsire.invalid/db",
      ...env,
    },
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

test("production with no JWT secret refuses to start", () => {
  const result = boot({ NODE_ENV: "production" });
  assert.equal(result.status, 1);
  assert.match(result.output, /JWT_SECRET is required in production/);
});

test("production with a blank JWT secret refuses to start", () => {
  assert.equal(boot({ NODE_ENV: "production", JWT_SECRET: "" }).status, 1);
});

test("production with a whitespace-only JWT secret refuses to start", () => {
  assert.equal(boot({ NODE_ENV: "production", JWT_SECRET: "    " }).status, 1);
});

test("production with the publicly known fallback refuses to start", () => {
  const result = boot({ NODE_ENV: "production", JWT_SECRET: DEV_ONLY_FALLBACK_JWT_SECRET });
  assert.equal(result.status, 1);
  assert.match(result.output, /JWT_SECRET is required in production/);
});

test("production with a too-short secret refuses to start", () => {
  const short = "x".repeat(MIN_PRODUCTION_SECRET_LENGTH - 1);
  assert.equal(boot({ NODE_ENV: "production", JWT_SECRET: short }).status, 1);
});

test("a startup failure never prints the configured secret", () => {
  const leaky = "leak-me-please-abcdefghijklmnop";
  const result = boot({ NODE_ENV: "production", JWT_SECRET: leaky });
  assert.equal(result.status, 1);
  assert.ok(!result.output.includes(leaky), "startup output must not contain the configured secret");
});

test("production with a real configured secret starts", () => {
  const result = boot({ NODE_ENV: "production", JWT_SECRET: REAL_SECRET });
  assert.equal(result.status, 0);
  assert.ok(!result.output.includes(REAL_SECRET), "startup output must not contain the configured secret");
});

test("an unlabelled runtime is held to the same standard as production", () => {
  assert.equal(boot({}).status, 1);
  assert.equal(boot({ NODE_ENV: "" }).status, 1);
  assert.equal(boot({ NODE_ENV: "staging" }).status, 1);
  assert.equal(boot({ JWT_SECRET: REAL_SECRET }).status, 0);
});

test("development and test start without a configured secret", () => {
  assert.equal(boot({ NODE_ENV: "development" }).status, 0);
  assert.equal(boot({ NODE_ENV: "test" }).status, 0);
});
