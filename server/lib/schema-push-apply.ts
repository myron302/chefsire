/**
 * The database half of the schema-push guard: the catalog fingerprint and the atomic application of an ALREADY REVIEWED plan.
 * Takes any `pg`-style client (`query(text, values?)`), so it can be exercised against a disposable database without drizzle-kit.
 */
import { createHash } from "node:crypto";
import { enumAdditionCount, enumAdditionHazards } from "./schema-push-plan";

export type QueryClient = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> };

/**
 * What is known about the database after a failed application.
 *  - `nothing_applied`: refused before any statement ran; no transaction was opened.
 *  - `rolled_back`: a transaction was opened and the server confirmed it ended without committing; the database is unchanged.
 *  - `state_unknown`: the connection failed or the rollback itself failed; whether the transaction committed is NOT known. Inspect the
 *    database before re-running anything. This is never reported as a rollback.
 */
export type ApplyOutcome = "nothing_applied" | "rolled_back" | "state_unknown";

export class SchemaPushApplyError extends Error {
  constructor(message: string, readonly outcome: ApplyOutcome, options?: { cause?: unknown }) {
    super(message, options as ErrorOptions);
    this.name = "SchemaPushApplyError";
  }
}

export const ENUM_GUIDANCE =
  "PostgreSQL cannot use an enum value in the transaction that adds it, and this guard never splits a reviewed plan into several transactions " +
  "(a later phase could fail with an earlier one already committed). Apply the addition on its own first, e.g. " +
  "`psql \"$DATABASE_URL\" -c \"ALTER TYPE \\\"<type>\\\" ADD VALUE IF NOT EXISTS '<value>'\"` (it commits immediately), then re-run the push: " +
  "the next plan no longer contains the addition and can be reviewed and applied normally.";

/** A hash of everything the guard exists to protect: relations, columns, constraints, indexes, RLS flags and policies, triggers, enums, sequences. */
export async function catalogFingerprint(client: QueryClient): Promise<string> {
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

/**
 * Applies a reviewed plan in ONE transaction, under an advisory lock, after proving the catalog is still what was planned against.
 * Throws {@link SchemaPushApplyError} on every failure, and its `outcome` says exactly what is known about the database.
 */
export async function applyReviewedPlan(client: QueryClient, statements: readonly string[], plannedFingerprint: string): Promise<void> {
  const hazards = enumAdditionHazards(statements);
  if (hazards.length > 0) {
    const detail = hazards.map((hazard) => `  ${hazard.statement}\n    is followed by: ${hazard.dependents.join("\n                    ")}`).join("\n");
    throw new SchemaPushApplyError(`The plan adds an enum value and then uses (or may use) it in the same plan:\n${detail}\n${ENUM_GUIDANCE}`, "nothing_applied");
  }
  if (enumAdditionCount(statements) > 0) {
    const version = Number((await client.query("SHOW server_version_num")).rows[0].server_version_num);
    if (!(version >= 120000)) {
      throw new SchemaPushApplyError(`ALTER TYPE ... ADD VALUE cannot run inside a transaction block before PostgreSQL 12 (this server is ${version}). ${ENUM_GUIDANCE}`, "nothing_applied");
    }
  }

  await client.query("BEGIN");
  let committing = false;
  try {
    await client.query("SET LOCAL lock_timeout = '30s'");
    // Serialize concurrent pushes, then prove the database is still exactly what was reviewed.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('chefsire:schema-push'))");
    if ((await catalogFingerprint(client)) !== plannedFingerprint) {
      throw new DriftError();
    }
    for (const statement of statements) await client.query(statement);
    committing = true;
    await client.query("COMMIT");
  } catch (error) {
    let rolledBack = false;
    try { await client.query("ROLLBACK"); rolledBack = true; } catch { /* the server may already have ended the transaction; see below */ }
    // A failed COMMIT that the SERVER answered (it carries a SQLSTATE) ended the transaction without committing. A failure with no server
    // answer (dropped connection) may or may not have committed: that is unknown, and is reported as such.
    const serverAnswered = typeof (error as { code?: unknown }).code === "string";
    const known = !committing || serverAnswered;
    const outcome: ApplyOutcome = rolledBack && known ? "rolled_back" : "state_unknown";
    const reason = error instanceof DriftError
      ? "The database schema changed between planning and applying the push; re-run to review a fresh plan."
      : `${(error as Error).message}`;
    throw new SchemaPushApplyError(reason, outcome, { cause: error });
  }
}

class DriftError extends Error {
  constructor() {
    super("catalog fingerprint changed");
  }
}
