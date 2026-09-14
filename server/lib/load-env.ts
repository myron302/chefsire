// server/lib/load-env.ts
/**
 * The authoritative environment loader for ChefSire's server.
 *
 * ChefSire legitimately accepts configuration from more than one place, and always has:
 *
 *   1. The process environment — whatever the platform injects (Plesk/Passenger, PM2, systemd,
 *      a shell). This always wins; nothing below can overwrite it.
 *   2. `<cwd>/.env` — the repository-root file. This is what `import "dotenv/config"` loaded at
 *      the top of `server/index.ts` and `server/app.ts`, and it is loaded here in its place so
 *      there is one loader rather than two competing ones.
 *   3. `server/.env` — the file the Plesk deployment uses (`/httpdocs/server/.env`), resolved
 *      relative to THIS module rather than the working directory, and consulted only when
 *      `DATABASE_URL` is still unset. That condition is the original "did the platform inject
 *      anything?" test and is preserved exactly: widening it would let a stale `server/.env`
 *      start supplying keys to deployments that do not expect it today.
 *
 * `dotenv.config()` runs with its default `override: false`, so a value already present in
 * `process.env` is never replaced, and an earlier file wins over a later one. That is the
 * pre-existing precedence and this module does not change it.
 *
 * Importing this module loads the environment. It is idempotent: repeat imports are a no-op
 * within a process (ES modules evaluate once), and `loadChefSireEnv()` guards against being
 * called again. Nothing here logs a value, a file's contents, or a secret.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** `<repo>/server/.env` — the Plesk deployment's file, located from this module, not from cwd. */
export const SERVER_ENV_PATH = path.resolve(__dirname, "../.env");

let loaded = false;

/**
 * Load every supported environment source, in precedence order. Safe to call more than once.
 * Must run before anything reads configuration — above all before the JWT configuration is
 * resolved, which is why `server/boot/verify-auth-config.ts` imports this module itself.
 */
export function loadChefSireEnv(): void {
  if (loaded) return;
  loaded = true;

  // (2) Repository-root `.env`, exactly as `import "dotenv/config"` did: cwd-relative, no override.
  try {
    require("dotenv").config();
  } catch {}

  // (3) `server/.env`, only when the platform injected nothing. Unchanged from the original gate.
  if (!process.env.DATABASE_URL) {
    try {
      require("dotenv").config({ path: SERVER_ENV_PATH });
    } catch {}
  }
}

loadChefSireEnv();
