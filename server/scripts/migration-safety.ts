import { createHash } from "node:crypto";
import { splitPostgresStatements } from "./postgres-sql-scan";

/**
 * Fail-closed destructive-SQL validation for the routine migration command (`npm run db:migrate`).
 *
 * The validator never executes SQL. It tokenises each statement (comments removed, string literals and quoted
 * identifiers neutralised, dollar-quoted DO/function bodies analysed recursively as code, including string
 * literals inside them because those can be EXECUTE'd) and then classifies the remaining code. Anything it
 * cannot tokenise (unterminated comment/string) is rejected. See docs/stability-phase-3b-migration-safety.md.
 */

export type DestructiveFinding = {
  operation: string;
  /** 1-based index of the top-level statement the operation was found in. */
  statement: number;
  excerpt: string;
};

export class DestructiveMigrationError extends Error {
  constructor(readonly ledgerKey: string, readonly findings: DestructiveFinding[]) {
    super(
      `Migration ${ledgerKey} contains destructive SQL and was NOT executed: ` +
        findings.map((f) => `${f.operation} (statement ${f.statement}: ${f.excerpt})`).join("; ") +
        ". Routine migrations must be non-destructive. Move intentional data-removal SQL to " +
        "server/migration-quarantine/ and apply it only through the explicitly authorized procedure in " +
        "docs/stability-phase-3b-migration-safety.md."
    );
    this.name = "DestructiveMigrationError";
  }
}

export function sha256(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

/**
 * Historical migrations that legitimately contain a flagged construct and were reviewed in Phase 3B. Pinned to
 * the exact file content: editing the file (or adding a new file) re-arms the guard. Every entry is a one-time
 * historical change that is already recorded in production's ledger or is a reviewed, bounded cleanup; none is a
 * general bypass, and there is no environment variable or flag that adds to this list.
 */
export const REVIEWED_HISTORICAL_DESTRUCTIVE: Readonly<Record<string, { sha256: string; reason: string }>> = {
  "server:20260928_square_oauth_hardening.sql": {
    sha256: "37df13978ed253ee21f1b01d6a9b04bd56e6cd84a8f0a2220110a92914b91099",
    reason:
      "Empties the short-lived square_oauth_transactions table (unusable pre-binding attempts) and drops its " +
      "transient superseded_at column. Never touches payment_methods or stored seller credentials.",
  },
};

type Cleaned = { code: string; bodies: string[]; literals: string[] };

/** Remove comments, neutralise quoted text, and lift dollar-quoted bodies out of a single SQL string. */
function clean(sql: string): Cleaned {
  let code = "";
  const bodies: string[] = [];
  const literals: string[] = [];
  let i = 0;
  while (i < sql.length) {
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      code += " ";
    } else if (sql.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql.startsWith("/*", i)) { depth++; i += 2; }
        else if (sql.startsWith("*/", i)) { depth--; i += 2; }
        else i++;
      }
      if (depth > 0) throw new Error("unterminated block comment");
      code += " ";
    } else if (sql[i] === "'") {
      const escape = /[eE]/.test(sql[i - 1] ?? "") && !/[A-Za-z0-9_$]/.test(sql[i - 2] ?? "");
      let j = i + 1;
      let text = "";
      let closed = false;
      while (j < sql.length) {
        if (escape && sql[j] === "\\") { text += sql.slice(j, j + 2); j += 2; }
        else if (sql[j] === "'" && sql[j + 1] === "'") { text += "'"; j += 2; }
        else if (sql[j] === "'") { closed = true; j++; break; }
        else text += sql[j++];
      }
      if (!closed) throw new Error("unterminated string literal");
      literals.push(text);
      code += " '' ";
      i = j;
    } else if (sql[i] === '"') {
      let j = i + 1;
      let closed = false;
      while (j < sql.length) {
        if (sql[j] === '"' && sql[j + 1] === '"') j += 2;
        else if (sql[j] === '"') { closed = true; j++; break; }
        else j++;
      }
      if (!closed) throw new Error("unterminated quoted identifier");
      code += " QIDENT ";
      i = j;
    } else if (sql[i] === "$") {
      const tag = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
      if (tag && !/[A-Za-z0-9_]/.test(sql[i - 1] ?? "")) {
        const end = sql.indexOf(tag, i + tag.length);
        if (end === -1) throw new Error("unterminated dollar-quoted body");
        bodies.push(sql.slice(i + tag.length, end));
        code += " BODY ";
        i = end + tag.length;
      } else {
        code += sql[i++];
      }
    } else {
      code += sql[i++];
    }
  }
  return { code, bodies, literals };
}

function classify(code: string): string[] {
  const text = code.replace(/\s+/g, " ").trim().toUpperCase();
  const ops: string[] = [];
  if (/\bDROP\s+TABLE\b/.test(text)) ops.push("DROP TABLE");
  if (/\bDROP\s+SCHEMA\b/.test(text)) ops.push("DROP SCHEMA");
  if (/\bDROP\s+DATABASE\b/.test(text)) ops.push("DROP DATABASE");
  if (/\bDROP\s+OWNED\b/.test(text)) ops.push("DROP OWNED");
  if (/\bTRUNCATE\b/.test(text)) ops.push("TRUNCATE");
  if (/\bDROP\b[^;]*\bCASCADE\b/.test(text)) ops.push("DROP ... CASCADE");
  if (/\bALTER\s+(?:FOREIGN\s+)?TABLE\b/.test(text)) {
    // ALTER TABLE ... DROP [COLUMN] name. Only these subcommands are non-destructive after DROP.
    if (/\bDROP\s+(?!CONSTRAINT\b|DEFAULT\b|NOT\s+NULL\b|IDENTITY\b|EXPRESSION\b)\S/.test(text)) {
      ops.push("DROP COLUMN");
    }
  }
  if (/\bDROP\s+COLUMN\b/.test(text) && !ops.includes("DROP COLUMN")) ops.push("DROP COLUMN");
  if (/\bDELETE\s+FROM\b/.test(text) && !/\bWHERE\b/.test(text)) ops.push("DELETE without WHERE");
  return ops;
}

/** Classify cleaned code, then recurse into dollar-quoted bodies and the string literals inside them. */
function analyse(sql: string, insideBody: boolean, found: Set<string>): void {
  const { code, bodies, literals } = clean(sql);
  // Outside a body, ';' has already been used to split. Inside a body the code holds several statements.
  for (const piece of insideBody ? code.split(";") : [code]) for (const op of classify(piece)) found.add(op);
  for (const body of bodies) analyse(body, true, found);
  // Literals inside DO/function bodies can be passed to EXECUTE, so they are scanned as SQL.
  if (insideBody) for (const literal of literals) analyse(literal, true, found);
}

export function findDestructiveOperations(sql: string): DestructiveFinding[] {
  const findings: DestructiveFinding[] = [];
  const statements = splitPostgresStatements(sql);
  statements.forEach((statement, index) => {
    const found = new Set<string>();
    try {
      analyse(statement, false, found);
    } catch (error) {
      found.add(`UNPARSEABLE SQL (${error instanceof Error ? error.message : String(error)})`);
    }
    const excerpt = statement.replace(/\s+/g, " ").slice(0, 80);
    for (const operation of found) findings.push({ operation, statement: index + 1, excerpt });
  });
  return findings;
}

/** True only for a historical file whose exact content was reviewed in Phase 3B. */
export function isReviewedHistorical(ledgerKey: string, sql: string): boolean {
  return REVIEWED_HISTORICAL_DESTRUCTIVE[ledgerKey]?.sha256 === sha256(sql);
}

/** Throws DestructiveMigrationError unless the SQL is non-destructive or a reviewed historical file. */
export function assertNonDestructive(ledgerKey: string, sql: string): void {
  if (isReviewedHistorical(ledgerKey, sql)) return;
  const findings = findDestructiveOperations(sql);
  if (findings.length > 0) throw new DestructiveMigrationError(ledgerKey, findings);
}
