import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertNonDestructive, DestructiveMigrationError, sha256 } from "./migration-safety";
import { scanPostgresSql, splitPostgresStatements } from "./postgres-sql-scan";

export { splitPostgresStatements };

export type MigrationClient = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

export type MigrationLogger = Pick<Console, "error">;

function assertTransactionCompatible(ledgerKey: string, sql: string): void {
  const { topLevelSql } = scanPostgresSql(sql);
  if (/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i.test(topLevelSql)) {
    throw new Error(
      `Migration ${ledgerKey} uses CREATE INDEX CONCURRENTLY, which is incompatible with ` +
        "ChefSire's atomic transactional migration runner"
    );
  }
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Apply one ledger entry atomically. No SQLSTATE is treated as successful completion. */
export async function applyMigration(
  client: MigrationClient,
  ledgerKey: string,
  sql: string,
  logger: MigrationLogger = console
): Promise<void> {
  // ChefSire migrations must remain transaction-compatible. Reject known incompatible operations
  // before BEGIN rather than silently weakening atomic execution for an individual file.
  assertTransactionCompatible(ledgerKey, sql);
  // Fail closed on destructive SQL before BEGIN, so nothing is executed and no ledger row is written.
  assertNonDestructive(ledgerKey, sql);
  await runInTransaction(client, ledgerKey, sql, logger);
}

export type DestructiveAuthorization = {
  /** SHA-256 of the exact file content being authorized. */
  sha256: string;
  /** Must equal current_database() of the connection the SQL will run on. */
  databaseName: string;
};

/**
 * The ONLY path that executes destructive SQL. It is not reachable from `npm run db:migrate`; it is used solely by
 * server/scripts/run-destructive-migration.ts. The caller must name the exact content hash and the exact target
 * database. The ledger key uses a distinct "destructive:" prefix so it can never collide with a routine entry.
 */
export async function applyAuthorizedDestructiveMigration(
  client: MigrationClient & { query: (sql: string, params?: unknown[]) => Promise<any> },
  name: string,
  sql: string,
  authorization: DestructiveAuthorization,
  logger: MigrationLogger = console
): Promise<void> {
  if (sha256(sql) !== authorization.sha256) {
    throw new Error(`Authorization hash does not match the content of ${name}; nothing was executed.`);
  }
  const current = (await client.query("select current_database() as name")) as { rows: Array<{ name: string }> };
  if (current.rows[0]?.name !== authorization.databaseName) {
    throw new Error(
      `Authorization names database "${authorization.databaseName}" but the connection is to ` +
        `"${current.rows[0]?.name}"; nothing was executed.`
    );
  }
  const ledgerKey = `destructive:${name}`;
  const already = (await client.query("select 1 from _app_migrations where filename = $1", [ledgerKey])) as {
    rows: unknown[];
  };
  if (already.rows.length > 0) throw new Error(`${ledgerKey} was already applied; refusing to run it again.`);
  // Same atomic path as routine migrations, minus the destructive guard.
  await runInTransaction(client, ledgerKey, sql, logger);
}

async function runInTransaction(client: MigrationClient, ledgerKey: string, sql: string, logger: MigrationLogger) {
  assertTransactionCompatible(ledgerKey, sql);
  const statements = splitPostgresStatements(sql);
  let position = 0;
  await client.query("BEGIN");
  try {
    for (let index = 0; index < statements.length; index++) {
      position = index + 1;
      await client.query(statements[index]);
    }
    position = statements.length + 1;
    await client.query(`insert into _app_migrations (filename) values ($1) on conflict (filename) do nothing`, [ledgerKey]);
    await client.query("COMMIT");
  } catch (error: any) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(`Migration rollback failed in ${ledgerKey}: ${safeMessage(rollbackError)}`);
    }
    const code = typeof error?.code === "string" ? error.code : "unknown";
    const context = position <= statements.length ? `statement ${position}/${statements.length}` : "migration ledger write";
    logger.error(`Migration failed in ${ledgerKey} at ${context} (SQLSTATE ${code}): ${safeMessage(error)}`);
    throw error;
  }
}

export type MigrationSource = { dir: string; keyPrefix: string; priority: number };
export type DiscoveredMigration = { sourceDir: string; filename: string; ledgerKey: string; priority: number };
export type MigrationPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  connect: () => Promise<MigrationClient & { release: () => void }>;
};

/** Every *.sql file under the given directories, deduplicated by filename (lowest priority number wins), sorted. */
export async function discoverMigrations(sources: MigrationSource[]): Promise<DiscoveredMigration[]> {
  const byName = new Map<string, DiscoveredMigration>();
  for (const source of sources) {
    const files = await readdir(source.dir).catch(() => [] as string[]);
    for (const filename of files.filter((f) => f.endsWith(".sql")).sort()) {
      const next = { sourceDir: source.dir, filename, ledgerKey: `${source.keyPrefix}:${filename}`, priority: source.priority };
      const existing = byName.get(filename);
      if (!existing || next.priority < existing.priority) byName.set(filename, next);
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.filename.localeCompare(b.filename));
}

/**
 * Apply every unrecorded migration. All pending files are validated BEFORE any is executed, so one unsafe file
 * stops the whole run with nothing applied. Already-recorded files are never re-read or re-validated.
 */
export async function runPendingMigrations(
  db: MigrationPool,
  sources: MigrationSource[],
  logger: Pick<Console, "log" | "error"> = console
): Promise<{ applied: string[]; skipped: string[] }> {
  const all = await discoverMigrations(sources);
  const pending: Array<DiscoveredMigration & { sql: string }> = [];
  const skipped: string[] = [];
  for (const file of all) {
    const recorded = await db.query(`select filename from _app_migrations where filename = $1`, [file.ledgerKey]);
    if (recorded.rows.length > 0) {
      logger.log(`⏭️  Skipping already recorded: ${file.ledgerKey}`);
      skipped.push(file.ledgerKey);
    } else {
      pending.push({ ...file, sql: await readFile(join(file.sourceDir, file.filename), "utf-8") });
    }
  }

  const rejected = pending.flatMap((file) => {
    try {
      assertNonDestructive(file.ledgerKey, file.sql);
      return [];
    } catch (error) {
      if (error instanceof DestructiveMigrationError) return [error];
      throw error;
    }
  });
  if (rejected.length > 0) {
    for (const error of rejected) logger.error(`❌ ${error.message}`);
    throw new Error(
      `Refusing to run migrations: ${rejected.length} pending file(s) contain destructive SQL ` +
        `(${rejected.map((e) => e.ledgerKey).join(", ")}). No migration was executed.`
    );
  }

  const applied: string[] = [];
  for (const file of pending) {
    logger.log(`▶️  Running migration: ${file.ledgerKey}`);
    const client = await db.connect();
    try {
      await applyMigration(client, file.ledgerKey, file.sql, logger);
      applied.push(file.ledgerKey);
      logger.log(`✅ Completed: ${file.ledgerKey}\n`);
    } finally {
      client.release();
    }
  }
  return { applied, skipped };
}
