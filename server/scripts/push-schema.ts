import "../lib/load-env";
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required for schema synchronization");

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (args: string[]) => {
  const result = spawnSync(npm, args, {
    stdio: "inherit",
    // Every phase inherits this process's already-selected DATABASE_URL. Do not
    // invoke dotenv again or allow a child to choose a different env file.
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

// Financial preflight and migrations must run before Drizzle can attempt the
// active-claim unique index. Duplicate claims therefore fail with the explicit
// audit-required migration error, before schema synchronization changes state.
run(["run", "db:migrate"]);
// Repeat the payout preflight independently of the ledger. This covers a
// database where a prior schema tool removed an invariant after the migration
// had already been recorded.
run(["exec", "--", "tsx", "server/scripts/enforce-payout-integrity.ts"]);

const pushArgs = ["exec", "--", "drizzle-kit", "push"];
if (process.argv.includes("--force")) pushArgs.push("--force");
run(pushArgs);

// Drizzle 0.30 cannot represent CHECK ... NOT VALID and may drop the database-
// only constraint as drift. Reapply the exact production migration after every
// push, independently of the one-time migration ledger.
run(["exec", "--", "tsx", "server/scripts/enforce-payout-integrity.ts"]);
