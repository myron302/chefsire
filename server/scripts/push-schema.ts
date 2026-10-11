import "../lib/load-env";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { createHash } from "node:crypto";
import {
  catalogLookupsNeeded,
  classifyPushPlan,
  constraintFactKey,
  dropSequenceTarget,
  indexFactKey,
  isDisposableTestDatabase,
  parsePushPlan,
  planAcknowledgementToken,
  type PlanCatalogFacts,
  type PlanFinding,
} from "../lib/schema-push-plan";

if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required for schema synchronization");

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const databaseUrl = process.env.DATABASE_URL!.trim();
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
  // Review the plan BEFORE any pre-push script runs: those scripts backfill and normalize data, so a refused push must not have run them.
  await reviewBeforePrePushScripts();

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
  //  5. The catalog is fingerprinted before planning and again inside the transaction (under an advisory lock); drift in between aborts the push.
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

async function dryRunPlan(): Promise<string[]> {
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
  try {
    return parsePushPlan(output);
  } catch (error) {
    console.error(`Schema push refused: ${(error as Error).message} Nothing was applied.`);
    process.exit(1);
  }
}

type ReviewedPlan = { toApply: string[]; findings: PlanFinding[]; token: string };

/** Reads the live definition of every constraint/index the plan drops, so a replacement can be compared with what it replaces. */
async function readCatalogFacts(client: pg.Client, statements: string[]): Promise<PlanCatalogFacts> {
  const needed = catalogLookupsNeeded(statements);
  const facts: PlanCatalogFacts = { constraints: {}, indexes: {} };
  for (const { schema, table, name } of needed.constraints) {
    const { rows } = await client.query(
      `SELECT pg_get_constraintdef(c.oid) AS definition
         FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = $1 AND t.relname = $2 AND c.conname = $3`,
      [schema, table, name],
    );
    if (rows.length === 1) facts.constraints[constraintFactKey(schema, table, name)] = rows[0].definition;
  }
  for (const { schema, name } of needed.indexes) {
    const { rows } = await client.query(
      `SELECT pg_get_indexdef(i.indexrelid) AS definition
         FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid JOIN pg_namespace n ON n.oid = ic.relnamespace
        WHERE n.nspname = $1 AND ic.relname = $2`,
      [schema, name],
    );
    if (rows.length === 1) facts.indexes[indexFactKey(schema, name)] = rows[0].definition;
  }
  return facts;
}

async function currentDatabase(client: pg.Client): Promise<string> {
  return (await client.query("SELECT current_database() AS name")).rows[0].name;
}

async function reviewPlan(client: pg.Client, statements: string[]): Promise<ReviewedPlan> {
  // A sequence owned by (or the default of) a column can never be dropped while that column exists, so drizzle's attempt to drop the
  // sequence of an UNDECLARED table is both unwanted and certain to fail. Such statements are skipped and reported, never executed.
  const toApply: string[] = [];
  for (const statement of statements) {
    const target = dropSequenceTarget(statement);
    if (target && target.schema === "public" && (await sequenceIsInUse(client, target.name))) {
      console.warn(`Schema push: leaving sequence "${target.name}" alone (still used by a table column that this schema does not declare).`);
      continue;
    }
    toApply.push(statement);
  }
  const findings = classifyPushPlan(toApply, await readCatalogFacts(client, toApply));
  return { toApply, findings, token: planAcknowledgementToken(findings, await currentDatabase(client)) };
}

function isAcknowledged(plan: ReviewedPlan): boolean {
  if (plan.findings.length === 0 || isDisposableTestDatabase(databaseUrl)) return true; // throw-away loopback "test" databases acknowledge implicitly
  const accepted = process.argv.find((arg) => arg.startsWith("--accept-plan="))?.slice("--accept-plan=".length);
  if (accepted === plan.token) {
    console.warn(`Schema push: applying ${plan.findings.length} reviewed statement(s) that need review (plan ${plan.token}).`);
    return true;
  }
  return false;
}

function refuse(plan: ReviewedPlan, note: string): never {
  console.error("Schema push REFUSED. The plan contains statements that can destroy data, remove protections or that were not recognised:");
  for (const item of plan.findings) console.error(`  [${item.kind}] ${item.statement}`);
  console.error(`\n${note}\nReview them. If every one is intended, re-run with --accept-plan=${plan.token}`);
  if (process.argv.includes("--force")) console.error("(--force no longer bypasses this review; the token is specific to this exact plan and database.)");
  process.exit(1);
}

async function reviewBeforePrePushScripts() {
  const statements = await dryRunPlan();
  if (statements.length === 0) return;
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const plan = await reviewPlan(client, statements);
    if (!isAcknowledged(plan)) refuse(plan, "Nothing was applied and no pre-push script has run.");
  } finally {
    await client.end();
  }
}

/** A hash of everything the guard exists to protect: relations, columns, constraints, indexes, RLS flags and policies, triggers, enums, sequences. */
async function catalogFingerprint(client: pg.Client): Promise<string> {
  const { rows } = await client.query(`
    SELECT json_build_object(
      'relations', (SELECT coalesce(json_agg(x ORDER BY x), '[]') FROM (
        SELECT format('%s|%s|%s|%s|%s', c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relowner::regrole) AS x
          FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace) s),
      'columns', (SELECT coalesce(json_agg(x ORDER BY x), '[]') FROM (
        SELECT format('%s.%s|%s|%s|%s|%s', c.relname, a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), ''), a.attgenerated) AS x
          FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
         WHERE a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p') AND c.relnamespace = 'public'::regnamespace) s),
      'constraints', (SELECT coalesce(json_agg(x ORDER BY x), '[]') FROM (
        SELECT format('%s|%s|%s|%s', c.conrelid::regclass, c.conname, pg_get_constraintdef(c.oid), c.convalidated) AS x
          FROM pg_constraint c WHERE c.connamespace = 'public'::regnamespace) s),
      'indexes', (SELECT coalesce(json_agg(indexdef ORDER BY indexdef), '[]') FROM pg_indexes WHERE schemaname = 'public'),
      'policies', (SELECT coalesce(json_agg(x ORDER BY x), '[]') FROM (
        SELECT format('%s|%s|%s|%s|%s|%s|%s', p.polrelid::regclass, p.polname, p.polcmd, p.polpermissive, p.polroles::text, pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid)) AS x
          FROM pg_policy p) s),
      'triggers', (SELECT coalesce(json_agg(x ORDER BY x), '[]') FROM (
        SELECT format('%s|%s|%s', t.tgrelid::regclass, t.tgenabled, pg_get_triggerdef(t.oid)) AS x FROM pg_trigger t WHERE NOT t.tgisinternal) s),
      'enums', (SELECT coalesce(json_agg(x ORDER BY x), '[]') FROM (
        SELECT format('%s.%s', t.typname, e.enumlabel) AS x FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid) s),
      'sequences', (SELECT coalesce(json_agg(sequencename ORDER BY sequencename), '[]') FROM pg_sequences WHERE schemaname = 'public')
    )::text AS snapshot`);
  return createHash("sha256").update(rows[0].snapshot).digest("hex");
}

async function guardedPush() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const planned = await catalogFingerprint(client);
    const statements = await dryRunPlan();
    if (statements.length === 0) {
      console.log("Schema push: no changes detected.");
      return;
    }
    const plan = await reviewPlan(client, statements);
    if (!isAcknowledged(plan)) refuse(plan, "Nothing was applied by the schema push (pre-push scripts had already run; they are idempotent).");

    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout = '30s'");
      // Serialize concurrent pushes, then prove the database is still exactly what was reviewed.
      await client.query("SELECT pg_advisory_xact_lock(hashtext('chefsire:schema-push'))");
      if ((await catalogFingerprint(client)) !== planned) {
        throw new Error("The database schema changed between planning and applying the push. Nothing was applied; re-run to review a fresh plan.");
      }
      for (const statement of plan.toApply) await client.query(statement);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("Schema push failed and was rolled back; the database is unchanged.");
      throw error;
    }
    console.log(`Schema push: ${plan.toApply.length} statement(s) applied in one transaction.`);
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
