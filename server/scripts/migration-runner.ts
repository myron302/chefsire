export type MigrationClient = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

export type MigrationLogger = Pick<Console, "error">;

/**
 * Split PostgreSQL source only at top-level semicolons. In particular, semicolons in comments,
 * quoted strings/identifiers and dollar-quoted function or DO bodies are not terminators.
 */
export function splitPostgresStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let i = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  let lineComment = false;
  let blockCommentDepth = 0;
  let dollarTag: string | null = null;

  while (i < sql.length) {
    if (lineComment) {
      if (sql[i] === "\n") lineComment = false;
      i++;
      continue;
    }
    if (blockCommentDepth > 0) {
      if (sql.startsWith("/*", i)) {
        blockCommentDepth++;
        i += 2;
      } else if (sql.startsWith("*/", i)) {
        blockCommentDepth--;
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        i += dollarTag.length;
        dollarTag = null;
      } else {
        i++;
      }
      continue;
    }
    if (singleQuoted) {
      if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
      else if (sql[i++] === "'") singleQuoted = false;
      continue;
    }
    if (doubleQuoted) {
      if (sql[i] === '"' && sql[i + 1] === '"') i += 2;
      else if (sql[i++] === '"') doubleQuoted = false;
      continue;
    }

    if (sql.startsWith("--", i)) {
      lineComment = true;
      i += 2;
    } else if (sql.startsWith("/*", i)) {
      blockCommentDepth = 1;
      i += 2;
    } else if (sql[i] === "'") {
      singleQuoted = true;
      i++;
    } else if (sql[i] === '"') {
      doubleQuoted = true;
      i++;
    } else if (sql[i] === "$") {
      const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarTag = match[0];
        i += match[0].length;
      } else {
        i++;
      }
    } else if (sql[i] === ";") {
      const statement = sql.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = ++i;
    } else {
      i++;
    }
  }

  const trailing = sql.slice(start).trim();
  if (trailing) statements.push(trailing);
  return statements;
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
  const statements = splitPostgresStatements(sql);
  let position = 0;

  await client.query("BEGIN");
  try {
    for (let index = 0; index < statements.length; index++) {
      position = index + 1;
      await client.query(statements[index]);
    }
    position = statements.length + 1;
    await client.query(
      `insert into _app_migrations (filename) values ($1)
       on conflict (filename) do nothing`,
      [ledgerKey]
    );
    await client.query("COMMIT");
  } catch (error: any) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(`Migration rollback failed in ${ledgerKey}: ${safeMessage(rollbackError)}`);
    }
    const code = typeof error?.code === "string" ? error.code : "unknown";
    const context = position <= statements.length
      ? `statement ${position}/${statements.length}`
      : "migration ledger write";
    logger.error(`Migration failed in ${ledgerKey} at ${context} (SQLSTATE ${code}): ${safeMessage(error)}`);
    throw error;
  }
}
