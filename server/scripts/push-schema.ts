import "../lib/load-env";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { applyReviewedPlan, catalogFingerprint, excludeProtectedSequences, readServerIdentity, SchemaPushApplyError, ENUM_GUIDANCE } from "../lib/schema-push-apply";
import {
  catalogLookupsNeeded,
  columnFactKey,
  connectionTarget,
  classifyPushPlan,
  enumAdditionHazards,
  interpretDryRun,
  constraintFactKey,
  indexFactKey,
  isDisposableTestDatabase,
  isPlanAcknowledged,
  planAcknowledgementToken,
  type PlanCatalogFacts,
  type ServerIdentity,
  weakIdentityBlocksApproval,
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
  // Only STDOUT is the plan (verified against the installed drizzle-kit); stderr (e.g. npm warnings) is diagnostics and never parsed.
  const outcome = interpretDryRun({ status: dryRun.status, signal: dryRun.signal, error: dryRun.error, stdout: dryRun.stdout, stderr: dryRun.stderr });
  if (!outcome.ok) {
    if (outcome.kind === "process_failed") console.error(`Schema push plan could not be produced: ${outcome.message} Nothing was applied.`);
    else console.error(`Schema push refused: the plan output could not be understood (${outcome.message}) Nothing was applied.`);
    if (outcome.diagnostics) console.error(outcome.diagnostics);
    process.exit(1);
  }
  return outcome.statements;
}

type ReviewedPlan = { toApply: string[]; findings: PlanFinding[]; token: string; identity: ServerIdentity | null };

/** Reads the live definition of every constraint/index the plan drops, so a replacement can be compared with what it replaces. */
async function readCatalogFacts(client: pg.Client, statements: string[]): Promise<PlanCatalogFacts> {
  const needed = catalogLookupsNeeded(statements);
  const facts: PlanCatalogFacts = { constraints: {}, indexes: {}, defaults: {} };
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
  for (const { schema, table, column, expression } of needed.defaults) {
    const { rows } = await client.query(
      `SELECT format_type(a.atttypid, a.atttypmod) AS type, pg_get_expr(d.adbin, d.adrelid) AS current_default
         FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = $1 AND c.relname = $2 AND a.attname = $3 AND a.attnum > 0 AND NOT a.attisdropped`,
      [schema, table, column],
    );
    if (rows.length !== 1) continue; // unknown column: left uninspected, so the change is reviewed
    facts.defaults![columnFactKey(schema, table, column)] = { current: rows[0].current_default ?? null, proposed: await renderDefault(client, rows[0].type, expression) };
  }
  return facts;
}

/**
 * Has PostgreSQL itself parse a proposed default against the column's type and render it back, so that old and new defaults are compared in
 * PostgreSQL's own spelling (drizzle writes `now() + interval '24 hours'`, the catalog stores `(now() + '24:00:00'::interval)`). Done on a
 * throw-away temp table inside a rolled-back transaction with a short timeout; nothing is evaluated and nothing persists. null = not renderable.
 */
async function renderDefault(client: pg.Client, type: string, expression: string): Promise<string | null> {
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query(`CREATE TEMP TABLE chefsire_default_probe (c ${type}) ON COMMIT DROP`);
    await client.query(`ALTER TABLE pg_temp.chefsire_default_probe ALTER COLUMN c SET DEFAULT ${expression}`);
    const { rows } = await client.query(
      `SELECT pg_get_expr(d.adbin, d.adrelid) AS rendered FROM pg_attrdef d WHERE d.adrelid = 'pg_temp.chefsire_default_probe'::regclass`);
    return rows.length === 1 ? rows[0].rendered : null;
  } catch {
    return null;
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
  }
}

async function reviewPlan(client: pg.Client, statements: string[], catalog: string): Promise<ReviewedPlan> {
  // Not a matter of acknowledgement: such a plan cannot be applied atomically at all, so it is refused up front with guidance.
  if (enumAdditionHazards(statements).length > 0) {
    console.error("Schema push REFUSED: the plan adds an enum value and then uses it in the same plan.");
    for (const hazard of enumAdditionHazards(statements)) console.error(`  ${hazard.statement}\n    followed by: ${hazard.dependents.join("\n                 ")}`);
    console.error(`\nNothing was applied. ${ENUM_GUIDANCE}`);
    process.exit(1);
  }
  // A sequence a table still needs (SERIAL/BIGSERIAL ownership or default, GENERATED AS IDENTITY) is never dropped: drizzle-kit wants to drop the
  // sequences of tables it does not declare. They are removed from the plan here, before classification, hashing and execution.
  const { toApply, skipped } = await excludeProtectedSequences(client, statements);
  for (const item of skipped) console.warn(`Schema push: leaving sequence "${item.schema}"."${item.name}" in place (${item.reasons.join("; ")}).`);
  // The token commits to the plan that will actually run (after the sequence exclusions above), not just to what was flagged.
  const facts = await readCatalogFacts(client, toApply);
  const findings = classifyPushPlan(toApply, facts);
  // The approval is scoped to the SERVER (cluster identifier when readable, database OID and name, connection target), not just a database name.
  // Only a plan that needs approval needs an identity; a routine plan is never blocked by an identity that cannot be established.
  // Disposable test databases acknowledge implicitly and need no identity either.
  if (findings.length === 0 || isDisposableTestDatabase(databaseUrl)) return { toApply, findings, identity: null, token: "" };
  const identity = await readServerIdentity(client, connectionTarget(databaseUrl));
  return { toApply, findings, identity, token: planAcknowledgementToken(toApply, identity.id, facts, catalog) };
}

function isAcknowledged(plan: ReviewedPlan): boolean {
  // throw-away loopback "test" databases acknowledge implicitly; everything else needs exactly this plan's token
  if (plan.identity && weakIdentityBlocksApproval({ findings: plan.findings, identity: plan.identity, argv: process.argv, disposable: isDisposableTestDatabase(databaseUrl) })) {
    console.error("Schema push REFUSED: the plan needs approval, but this connection cannot read the PostgreSQL cluster identifier (pg_control_system() is not permitted),");
    console.error("so an approval could not be proven to belong to THIS server. Nothing was applied. Either run as a role that may read it, or, after confirming the target");
    console.error("by other means, pass --accept-unverified-server-identity together with --accept-plan=<token> (the token is still scoped to the connection target and database).");
    process.exit(1);
  }
  const ok = isPlanAcknowledged({ findings: plan.findings, token: plan.token, argv: process.argv, disposable: isDisposableTestDatabase(databaseUrl) });
  if (ok && plan.findings.length > 0) console.warn(`Schema push: applying ${plan.findings.length} reviewed statement(s) that need review (plan ${plan.token}).`);
  return ok;
}

function refuse(plan: ReviewedPlan, note: string): never {
  console.error("Schema push REFUSED. The plan contains statements that can destroy data, remove protections or that were not recognised:");
  for (const item of plan.findings) console.error(`  [${item.kind}] ${item.statement}`);
  console.error(`\n${note}\nReview them. If every one is intended, re-run with --accept-plan=${plan.token}`);
  if (process.argv.includes("--force")) console.error("(--force no longer bypasses this review; the token is specific to this exact plan and database.)");
  process.exit(1);
}

async function reviewBeforePrePushScripts() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const catalog = await catalogFingerprint(client);
    const statements = await dryRunPlan();
    if (statements.length === 0) return;
    const plan = await reviewPlan(client, statements, catalog);
    if (!isAcknowledged(plan)) refuse(plan, "Nothing was applied and no pre-push script has run.");
  } finally {
    await client.end();
  }
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
    const plan = await reviewPlan(client, statements, planned);
    if (!isAcknowledged(plan)) refuse(plan, "Nothing was applied by the schema push (pre-push scripts had already run; they are idempotent).");

    try {
      await applyReviewedPlan(client, plan.toApply, planned, plan.identity ? { planned: plan.identity.id, target: connectionTarget(databaseUrl) } : undefined);
    } catch (error) {
      if (error instanceof SchemaPushApplyError) {
        if (error.outcome === "nothing_applied") console.error("Schema push refused; nothing was applied.");
        else if (error.outcome === "rolled_back") console.error("Schema push failed and was rolled back; the database is unchanged.");
        else console.error("Schema push FAILED and its outcome is UNKNOWN (the connection or the rollback failed). The transaction may or may not have committed: inspect the database before re-running anything.");
      }
      throw error;
    }
    console.log(`Schema push: ${plan.toApply.length} statement(s) applied in one transaction.`);
  } finally {
    await client.end();
  }
}
