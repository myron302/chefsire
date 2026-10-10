import "../lib/load-env";
import { spawnSync } from "node:child_process";
import pg from "pg";
import {
  classifyPushPlan,
  isDisposableTestDatabase,
  parsePushPlan,
  planAcknowledgementToken,
  type PlanFinding,
} from "../lib/schema-push-plan";

if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required for schema synchronization");

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const DATABASE_URL = process.env.DATABASE_URL!.trim();
const run = (args: string[]) => {
  const result = spawnSync(npm, args, {
    stdio: "inherit",
    // Every phase inherits this process's already-selected DATABASE_URL. Do not
    // invoke dotenv again or allow a child to choose a different env file.
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

async function main() {
  // Run only the payout preflight/invariants before Drizzle. On a fresh database
  // the payout tables are both absent and --allow-missing lets Drizzle bootstrap
  // them. We deliberately do not replay unrelated historical migrations here.
  run(["exec", "--", "tsx", "server/scripts/enforce-payout-integrity.ts", "--allow-missing"]);
  run(["exec", "--", "tsx", "server/scripts/enforce-marketplace-revenue-integrity.ts", "--allow-missing"]);
  // Depends on seller_revenue_status above. Must run before Drizzle adds
  // inventory_status itself: Drizzle's NOT NULL DEFAULT would otherwise stamp
  // every existing order 'legacy_unverified' before this evidence-based
  // backfill ever runs, stranding already-attempted captures (see P1-05).
  run(["exec", "--", "tsx", "server/scripts/enforce-marketplace-checkout-atomicity.ts", "--allow-missing"]);
  // Must precede Drizzle: existing rows may still carry the obsolete explicit
  // `completed` value, which would violate the immediately validated schema
  // CHECK as soon as Drizzle adds acquisition_type with its default.
  run(["exec", "--", "tsx", "server/scripts/enforce-meal-plan-payment-integrity.ts", "--allow-missing"]);

  // SCHEMA PUSH SAFETY (see docs/schema-push-safety.md). `drizzle-kit push` is never allowed to apply its own plan:
  //  1. drizzle.config.ts `tablesFilter` already hides every table the schema does not declare, so no undeclared table can be dropped or altered.
  //  2. The plan is first printed with `--strict` and a closed stdin, a mode in which drizzle-kit applies NOTHING.
  //  3. Destructive or protection-removing statements (drops of tables, columns, enums, sequences, views, schemas, unmatched constraints and
  //     indexes, truncates, deletes, column type changes) stop the push unless the operator passes `--accept-plan=<token>` naming exactly that plan.
  //  4. What remains is applied in ONE transaction, so a failure leaves the database exactly as it was (drizzle-kit applies statement by statement).
  await guardedPush();

  // Drizzle 0.30 cannot represent CHECK ... NOT VALID and may drop the database-
  // only constraint as drift. Reapply the exact production migration after every
  // push, independently of the one-time migration ledger.
  run(["exec", "--", "tsx", "server/scripts/enforce-payout-integrity.ts"]);
  run(["exec", "--", "tsx", "server/scripts/enforce-marketplace-revenue-integrity.ts"]);
  run(["exec", "--", "tsx", "server/scripts/enforce-marketplace-checkout-atomicity.ts"]);
  // Reassert the database invariant in case a Drizzle version treats CHECK
  // constraints as drift, matching the payout/marketplace defense-in-depth path.
  run(["exec", "--", "tsx", "server/scripts/enforce-meal-plan-payment-integrity.ts"]);
  // A finalized Square plaintext-token enforcement (a CHECK Drizzle cannot represent, and must not install early) is restored from
  // its durable marker after every push, and the push FAILS if it cannot be. A no-op on a database that is not finalized.
  run(["exec", "--", "tsx", "server/scripts/enforce-square-plaintext-finalization.ts"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function guardedPush() {
  const dryRun = spawnSync(npm, ["exec", "--", "drizzle-kit", "push", "--strict", "--verbose"], {
    env: process.env,
    input: "", // closed stdin: drizzle-kit's --strict approval prompt can never be answered, so this run applies nothing
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  });
  const output = `${dryRun.stdout ?? ""}\n${dryRun.stderr ?? ""}`;
  if (dryRun.status !== 0) {
    console.error("Schema push plan could not be produced; nothing was applied.");
    console.error(output.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "").split("\n").slice(-30).join("\n"));
    process.exit(1);
  }
  let statements: string[];
  try {
    statements = parsePushPlan(output);
  } catch (error) {
    console.error(`Schema push refused: ${(error as Error).message} Nothing was applied.`);
    process.exit(1);
  }
  if (statements.length === 0) {
    console.log("Schema push: no changes detected.");
    return;
  }

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    // A sequence owned by (or the default of) a column can never be dropped while that column exists, so drizzle's attempt to drop the
    // sequence of an UNDECLARED table is both unwanted and certain to fail. Such statements are skipped and reported, never executed.
    const toApply: string[] = [];
    for (const statement of statements) {
      const sequence = /^DROP SEQUENCE (?:"[^"]+"\.)?"([^"]+)"/i.exec(statement.replace(/\s+/g, " "))?.[1];
      if (sequence && (await sequenceIsInUse(client, sequence))) {
        console.warn(`Schema push: leaving sequence "${sequence}" alone (still used by a table column that this schema does not declare).`);
        continue;
      }
      toApply.push(statement);
    }

    const findings = classifyPushPlan(toApply);
    if (findings.length > 0) reviewOrExit(findings);

    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout = '30s'");
      for (const statement of toApply) await client.query(statement);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("Schema push failed and was rolled back; the database is unchanged.");
      throw error;
    }
    console.log(`Schema push: ${toApply.length} statement(s) applied in one transaction.`);
  } finally {
    await client.end();
  }
}

async function sequenceIsInUse(client: pg.Client, name: string): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1
       FROM pg_class sequence
       JOIN pg_depend dependency ON dependency.refobjid = sequence.oid
      WHERE sequence.relkind = 'S' AND sequence.relnamespace = 'public'::regnamespace AND sequence.relname = $1
        AND (dependency.deptype IN ('a', 'i') OR dependency.classid = 'pg_attrdef'::regclass)
      LIMIT 1`,
    [name],
  );
  return rows.length > 0;
}

function reviewOrExit(findings: PlanFinding[]) {
  const token = planAcknowledgementToken(findings);
  if (isDisposableTestDatabase(DATABASE_URL)) return; // throw-away loopback "test" databases acknowledge implicitly
  const accepted = process.argv.find((arg) => arg.startsWith("--accept-plan="))?.slice("--accept-plan=".length);
  if (accepted === token) {
    console.warn(`Schema push: applying ${findings.length} reviewed destructive/protection-removing statement(s) (plan ${token}).`);
    return;
  }
  console.error("Schema push REFUSED. The plan contains statements that can destroy data or remove protections:");
  for (const finding of findings) console.error(`  [${finding.kind}] ${finding.statement}`);
  console.error(`\nNothing was applied. Review them. If every one is intended, re-run with --accept-plan=${token}`);
  if (process.argv.includes("--force")) console.error("(--force no longer bypasses this review; the token is specific to this exact plan.)");
  process.exit(1);
}
