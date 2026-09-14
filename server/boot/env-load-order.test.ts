/**
 * Boot-order regression tests for Security Repair 1B.
 *
 * The regression these lock down (Codex, against 16732e1): `server/index.ts` validated the JWT
 * configuration *before* ChefSire's shared environment loader had run, so a Plesk deployment whose
 * `JWT_SECRET` legitimately lives in `server/.env` would refuse to start. The fix is ordering, not
 * a weaker check — so these tests assert both halves: a valid secret in the supported file must
 * pass, and an absent or unsafe one must still fail closed.
 *
 * Every case runs in a real child process through the real modules (`lib/load-env` →
 * `boot/verify-auth-config` → `lib/jwt-config`), with an environment the test controls completely.
 * No secret is ever printed: the probe compares in-process and reports only a boolean.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEV_ONLY_FALLBACK_JWT_SECRET } from "../lib/jwt-config";
import { SERVER_ENV_PATH } from "../lib/load-env";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const probe = path.join(repoRoot, "server", "test-support", "report-auth-config.ts");

const FILE_SECRET = "F1leS3cretFromServerDotEnv_9kQzR4xLmB7wTnVe";
const PROCESS_SECRET = "Pr0cessS3cretFromTheePlatform_4hGyU8dNcW2sXaQr";

/* ------------------------------------------------ server/.env, borrowed and put back */

/**
 * `server/.env` is a real path in a developer's checkout, so these tests borrow it rather than
 * assume it is free: whatever is there is read first and written back afterwards, including if
 * the process dies partway through. The file is gitignored, so nothing can leak into a commit.
 */
let savedServerEnv: Buffer | null = null;
let borrowed = false;

function restoreServerEnv() {
  if (!borrowed) return;
  borrowed = false;
  if (savedServerEnv === null) fs.rmSync(SERVER_ENV_PATH, { force: true });
  else fs.writeFileSync(SERVER_ENV_PATH, savedServerEnv);
  savedServerEnv = null;
}

function writeServerEnv(contents: string) {
  if (!borrowed) {
    savedServerEnv = fs.existsSync(SERVER_ENV_PATH) ? fs.readFileSync(SERVER_ENV_PATH) : null;
    borrowed = true;
    process.once("exit", restoreServerEnv);
  }
  fs.writeFileSync(SERVER_ENV_PATH, contents);
}

test.after(restoreServerEnv);

/* ------------------------------------------------------------------- the probe */

type ProbeResult = {
  status: number | null;
  output: string;
  config: {
    mode: string;
    source: string;
    usingDevelopmentFallback: boolean;
    algorithm: string;
    expiresIn: string;
    matchesExpected: boolean | null;
    secretLength: number;
  } | null;
};

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

// These cases are about `server/.env`, which the loader resolves from its own module path.
const emptyCwd = makeEmptyCwd("env-order-");
test.after(() => fs.rmSync(emptyCwd, { recursive: true, force: true }));

/** Boot the real gate in a child process with exactly this environment. */
function boot(env: Record<string, string>): ProbeResult {
  const result = spawnSync(process.execPath, ["--import", "tsx", probe], {
    cwd: emptyCwd,
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env },
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const line = (result.stdout ?? "").split("\n").find((l) => l.startsWith("AUTH_CONFIG "));
  return {
    status: result.status,
    output,
    config: line ? JSON.parse(line.slice("AUTH_CONFIG ".length)) : null,
  };
}

/* --------------------------------------- the regression: server/.env is loaded in time */

test("production starts with a valid JWT_SECRET supplied only through server/.env", () => {
  // The supported Plesk shape: the platform injects nothing, the file carries the configuration.
  writeServerEnv(`DATABASE_URL=postgres://chefsire.invalid/db\nJWT_SECRET=${FILE_SECRET}\n`);

  const result = boot({ NODE_ENV: "production", EXPECT_SECRET: FILE_SECRET });

  assert.equal(result.status, 0, `startup should succeed; got:\n${result.output}`);
  assert.equal(result.config?.source, "JWT_SECRET");
  assert.equal(result.config?.matchesExpected, true);
  assert.equal(result.config?.usingDevelopmentFallback, false);
  assert.ok(!result.output.includes(FILE_SECRET), "startup output must not contain the secret");
});

test("production starts with SESSION_SECRET supplied only through server/.env", () => {
  writeServerEnv(`DATABASE_URL=postgres://chefsire.invalid/db\nSESSION_SECRET=${FILE_SECRET}\n`);

  const result = boot({ NODE_ENV: "production", EXPECT_SECRET: FILE_SECRET });

  assert.equal(result.status, 0, result.output);
  assert.equal(result.config?.source, "SESSION_SECRET");
  assert.equal(result.config?.matchesExpected, true);
});

/* ------------------------------------------------------ fail-closed survives the fix */

test("production still refuses to start when no source supplies a secret", () => {
  writeServerEnv("DATABASE_URL=postgres://chefsire.invalid/db\n");

  const result = boot({ NODE_ENV: "production" });

  assert.equal(result.status, 1);
  assert.match(result.output, /JWT_SECRET is required in production/);
});

test("production still refuses a blank or whitespace-only secret from server/.env", () => {
  for (const value of ["", '"   "']) {
    writeServerEnv(`DATABASE_URL=postgres://chefsire.invalid/db\nJWT_SECRET=${value}\n`);
    assert.equal(boot({ NODE_ENV: "production" }).status, 1, `JWT_SECRET=${value} must fail`);
  }
});

test("production still refuses the known fallback, whichever source supplies it", () => {
  writeServerEnv(`DATABASE_URL=postgres://chefsire.invalid/db\nJWT_SECRET=${DEV_ONLY_FALLBACK_JWT_SECRET}\n`);
  assert.equal(boot({ NODE_ENV: "production" }).status, 1, "from server/.env");

  writeServerEnv("DATABASE_URL=postgres://chefsire.invalid/db\n");
  assert.equal(
    boot({ NODE_ENV: "production", JWT_SECRET: DEV_ONLY_FALLBACK_JWT_SECRET }).status,
    1,
    "from the process environment",
  );
});

test("a startup failure never prints the file's secret", () => {
  // Short enough to be rejected, so this exercises the *failure* message specifically.
  const leaky = "leak-me-from-the-file";
  writeServerEnv(`DATABASE_URL=postgres://chefsire.invalid/db\nJWT_SECRET=${leaky}\n`);

  const result = boot({ NODE_ENV: "production" });

  assert.equal(result.status, 1);
  assert.ok(!result.output.includes(leaky), "startup output must not contain the configured secret");
});

/* -------------------------------------------------------------------- precedence */

test("the process environment stays authoritative over server/.env", () => {
  writeServerEnv(`JWT_SECRET=${FILE_SECRET}\n`);

  const result = boot({
    NODE_ENV: "production",
    JWT_SECRET: PROCESS_SECRET,
    EXPECT_SECRET: PROCESS_SECRET,
  });

  assert.equal(result.status, 0, result.output);
  assert.equal(result.config?.matchesExpected, true, "the injected value must win, not the file's");
});

test("server/.env is consulted only when the platform injected no DATABASE_URL", () => {
  // The pre-existing gate in load-env.ts, preserved verbatim by this repair. With DATABASE_URL
  // already in the process environment the file is not read at all, so its JWT_SECRET is invisible.
  writeServerEnv(`JWT_SECRET=${FILE_SECRET}\n`);

  const gated = boot({ NODE_ENV: "production", DATABASE_URL: "postgres://injected.invalid/db" });
  assert.equal(gated.status, 1, "file not consulted, so production has no secret and fails closed");

  const open = boot({ NODE_ENV: "production", EXPECT_SECRET: FILE_SECRET });
  assert.equal(open.status, 0, open.output);
  assert.equal(open.config?.matchesExpected, true);
});

/* --------------------------------------------------- development must not cache a fallback */

test("development uses a secret configured in server/.env, not the deterministic fallback", () => {
  // The caching half of the Codex finding: if configuration were resolved before the loader ran,
  // development would memoise the built-in fallback and silently ignore the configured secret.
  writeServerEnv(`JWT_SECRET=${FILE_SECRET}\n`);

  const result = boot({ NODE_ENV: "development", EXPECT_SECRET: FILE_SECRET });

  assert.equal(result.status, 0, result.output);
  assert.equal(result.config?.matchesExpected, true);
  assert.equal(result.config?.usingDevelopmentFallback, false);
  assert.notEqual(result.config?.secretLength, DEV_ONLY_FALLBACK_JWT_SECRET.length);
});

test("development with no configured secret still gets the deterministic fallback", () => {
  writeServerEnv("");

  const result = boot({ NODE_ENV: "development", EXPECT_SECRET: DEV_ONLY_FALLBACK_JWT_SECRET });

  assert.equal(result.status, 0, result.output);
  assert.equal(result.config?.usingDevelopmentFallback, true);
  assert.equal(result.config?.matchesExpected, true);
});

test("test mode with no configured secret still gets the deterministic fallback", () => {
  writeServerEnv("");

  const result = boot({ NODE_ENV: "test", EXPECT_SECRET: DEV_ONLY_FALLBACK_JWT_SECRET });

  assert.equal(result.status, 0, result.output);
  assert.equal(result.config?.usingDevelopmentFallback, true);
});

/* ------------------------------------------------------------- unchanged token policy */

test("the boot path still yields HS256 and the existing seven-day lifetime", () => {
  writeServerEnv(`JWT_SECRET=${FILE_SECRET}\n`);

  const result = boot({ NODE_ENV: "production" });

  assert.equal(result.config?.algorithm, "HS256");
  assert.equal(result.config?.expiresIn, "7d");
});

/* ------------------------------------------------------ the entrypoint's own import order */

test("server/index.ts loads the environment and validates auth before constructing the app", () => {
  // ES module imports are evaluated in source order, so the entrypoint's import order *is* its
  // boot order. Asserting it here catches a re-ordering that the probe above cannot see, since
  // the probe exercises the gate rather than the entrypoint.
  const source = fs.readFileSync(path.join(repoRoot, "server", "index.ts"), "utf8");
  const importIndex = (specifier: string) => {
    const at = source.indexOf(`"${specifier}"`);
    assert.notEqual(at, -1, `server/index.ts must import ${specifier}`);
    return at;
  };

  const loader = importIndex("./lib/load-env");
  const gate = importIndex("./boot/verify-auth-config");
  const app = importIndex("./app");

  assert.ok(loader < gate, "the environment loader must be imported before the auth gate");
  assert.ok(gate < app, "the auth gate must be imported before the Express app");

  // And nothing may start a second, competing dotenv ahead of the shared loader.
  assert.ok(
    !source.includes('"dotenv/config"'),
    "server/index.ts must use the shared loader, not its own dotenv/config",
  );
});

test("no module in the server boot path starts its own dotenv ahead of the shared loader", () => {
  for (const relative of ["server/app.ts", "server/routes/substitutions.ts"]) {
    const source = fs.readFileSync(path.join(repoRoot, relative), "utf8");
    assert.ok(
      !source.includes('"dotenv/config"'),
      `${relative} must use the shared loader, not its own dotenv/config`,
    );
    assert.ok(source.includes("lib/load-env"), `${relative} must import the shared loader`);
  }
});
