/**
 * Split PostgreSQL source only at top-level semicolons. In particular, semicolons in comments,
 * quoted strings/identifiers and dollar-quoted function or DO bodies are not terminators.
 */
export function scanPostgresSql(sql: string): { statements: string[]; topLevelSql: string } {
  const statements: string[] = [];
  const topLevel = Array.from({ length: sql.length }, () => " ");
  let start = 0;
  let i = 0;
  let singleQuoted = false;
  let escapeSingleQuoted = false;
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
      if (escapeSingleQuoted && sql[i] === "\\") i += Math.min(2, sql.length - i);
      else if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
      else if (sql[i++] === "'") {
        singleQuoted = false;
        escapeSingleQuoted = false;
      }
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
      // PostgreSQL E/e strings give backslash special meaning. The prefix must be a standalone
      // token; an identifier ending in e does not turn the following string into an escape string.
      escapeSingleQuoted = /[eE]/.test(sql[i - 1] ?? "") &&
        !/[A-Za-z0-9_$]/.test(sql[i - 2] ?? "");
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
      topLevel[i] = sql[i];
      const statement = sql.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = ++i;
    } else {
      topLevel[i] = sql[i];
      i++;
    }
  }

  const trailing = sql.slice(start).trim();
  if (trailing) statements.push(trailing);
  return { statements, topLevelSql: topLevel.join("") };
}

export function splitPostgresStatements(sql: string): string[] {
  return scanPostgresSql(sql).statements;
}
