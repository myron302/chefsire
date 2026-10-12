/**
 * The database half of the schema-push guard: the catalog fingerprint and the atomic application of an ALREADY REVIEWED plan.
 * Takes any `pg`-style client (`query(text, values?)`), so it can be exercised against a disposable database without drizzle-kit.
 */
import { createHash } from "node:crypto";
import { buildServerIdentity, dropSequenceTarget, enumAdditionCount, enumAdditionHazards, ServerIdentityError, type ServerIdentity } from "./schema-push-plan";

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

/**
 * Reads the identity of the server this client is connected to (see {@link buildServerIdentity}). Never throws a permission error: when the
 * cluster system identifier is not readable it says so (`strong: false`) instead. Ambiguous answers throw {@link ServerIdentityError}.
 */
export async function readServerIdentity(client: QueryClient, target: string): Promise<ServerIdentity> {
  const database = (await client.query("SELECT d.oid::text AS oid, d.datname AS name FROM pg_database d WHERE d.datname = current_database()")).rows;
  if (database.length !== 1) throw new ServerIdentityError("The current database could not be identified unambiguously.");
  // Check the privilege first: a failed statement would abort an open transaction.
  const readable = (await client.query("SELECT has_function_privilege(current_user, 'pg_control_system()', 'EXECUTE') AS ok")).rows;
  let systemIdentifier: string | null = null;
  if (readable.length === 1 && readable[0].ok === true) {
    const system = (await client.query("SELECT system_identifier::text AS id FROM pg_control_system()")).rows;
    if (system.length !== 1) throw new ServerIdentityError("The server's system identifier is ambiguous.");
    systemIdentifier = system[0].id;
  }
  return buildServerIdentity({ systemIdentifier, databaseOid: database[0].oid, databaseName: database[0].name, target });
}

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
export async function applyReviewedPlan(
  client: QueryClient,
  statements: readonly string[],
  plannedFingerprint: string,
  /** The server identity the plan was reviewed on, and how to read the identity of the connection that will apply it. */
  identity?: { planned: string; target: string },
): Promise<void> {
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
    // Unqualified names in the reviewed statements resolve through search_path. Pin it, so a role-named schema ("$user") or a role-level setting
    // cannot make the same text act on different objects than the ones that were reviewed.
    await client.query("SET LOCAL search_path TO public");
    // Serialize concurrent pushes, then prove the database is still exactly what was reviewed.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('chefsire:schema-push'))");
    if ((await catalogFingerprint(client)) !== plannedFingerprint) {
      throw new DriftError();
    }
    // The connection that applies must be the server that was reviewed (a failover, a re-pointed alias or a different endpoint would not be).
    if (identity && (await readServerIdentity(client, identity.target)).id !== identity.planned) throw new IdentityChangedError();
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
      : error instanceof IdentityChangedError
      ? "The server identity changed between review and apply (a different server or database answered); nothing was applied. Re-run to review a fresh plan."
      : `${(error as Error).message}`;
    throw new SchemaPushApplyError(reason, outcome, { cause: error });
  }
}

class DriftError extends Error {
  constructor() {
    super("catalog fingerprint changed");
  }
}

class IdentityChangedError extends Error {
  constructor() {
    super("server identity changed");
  }
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Sequences that belong to tables
 * ------------------------------------------------------------------------------------------------------------- */

export type SequenceProtection = { exists: boolean; protected: boolean; reasons: string[] };

/**
 * Whether a sequence must not be dropped because something still needs it. `pg_depend` records the relationships in DIFFERENT directions:
 *  - SERIAL / BIGSERIAL: the sequence is OWNED BY the column -- a row with objid = the sequence, refobjid = the table, deptype 'a' -- and the
 *    column's DEFAULT (a `pg_attrdef` row) refers to the sequence (refobjid = the sequence).
 *  - GENERATED ... AS IDENTITY: the sequence is internal to the column -- objid = the sequence, refobjid = the table, deptype 'i' -- and there
 *    is NO default expression at all, so a check that only looks at things referring TO the sequence misses it.
 * Anything that refers to the sequence (a default, a view, another dependency) also protects it. Matching is by schema AND name. A sequence with
 * none of these is unrelated and is not protected. Leaving a sequence in place is never destructive; dropping one that a table needs is.
 */
export async function sequenceProtection(client: QueryClient, schema: string, name: string): Promise<SequenceProtection> {
  const { rows } = await client.query(
    `SELECT
       EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = s.oid AND d.refclassid = 'pg_class'::regclass AND d.deptype = 'a') AS owned,
       EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = s.oid AND d.refclassid = 'pg_class'::regclass AND d.deptype = 'i') AS identity,
       EXISTS (SELECT 1 FROM pg_depend d WHERE d.refclassid = 'pg_class'::regclass AND d.refobjid = s.oid) AS referenced
     FROM pg_class s JOIN pg_namespace n ON n.oid = s.relnamespace
    WHERE s.relkind = 'S' AND n.nspname = $1 AND s.relname = $2`,
    [schema, name],
  );
  if (rows.length === 0) return { exists: false, protected: false, reasons: [] };
  if (rows.length !== 1) throw new Error("The sequence could not be identified unambiguously."); // fail closed
  const reasons = [rows[0].owned === true && "owned by a table column", rows[0].identity === true && "identity sequence of a table column", rows[0].referenced === true && "referenced by a default or another object"].filter(Boolean) as string[];
  for (const value of [rows[0].owned, rows[0].identity, rows[0].referenced]) if (typeof value !== "boolean") throw new Error("Sequence dependencies could not be inspected completely."); // fail closed
  return { exists: true, protected: reasons.length > 0, reasons };
}

/**
 * Removes `DROP SEQUENCE` statements for sequences a table still needs from the plan BEFORE it is classified, hashed into an approval token and
 * executed, so the token names the plan that actually runs and nothing is ever reported as dropped that was kept. Other `DROP SEQUENCE`
 * statements (an unrelated sequence, an unreadable form, a missing sequence) stay in the plan and are reviewed like any other drop. Any failure
 * to inspect propagates: the push stops rather than guessing.
 */
export async function excludeProtectedSequences(client: QueryClient, statements: readonly string[]) {
  const toApply: string[] = [];
  const skipped: { statement: string; schema: string; name: string; reasons: string[] }[] = [];
  for (const statement of statements) {
    const target = dropSequenceTarget(statement);
    if (target) {
      const protection = await sequenceProtection(client, target.schema, target.name);
      if (protection.protected) { skipped.push({ statement, schema: target.schema, name: target.name, reasons: protection.reasons }); continue; }
    }
    toApply.push(statement);
  }
  return { toApply, skipped };
}
