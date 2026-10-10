/**
 * Review of a `drizzle-kit push` plan BEFORE anything is applied.
 *
 * `drizzle-kit push` treats the Drizzle schema as the whole truth of the database. Left alone it plans `DROP TABLE ... CASCADE` for every
 * table it does not declare, applies its statements one by one with no transaction, and only asks for confirmation when it can see data
 * that would be lost (an empty table, an enum or a sequence is dropped without a word). This module is the pure half of the guard around it:
 * it parses the plan `drizzle-kit push --strict --verbose` prints when stdin is closed (nothing is applied in that mode), classifies each
 * statement, and produces the acknowledgement token an operator must pass to let a destructive plan through. No I/O, no database.
 *
 * Complemented by `tablesFilter` in drizzle.config.ts (derived from the schema), which hides every undeclared table from the plan entirely.
 */
import { createHash } from "node:crypto";

export type PlanFindingKind =
  | "drop_table" | "drop_column" | "drop_type" | "drop_schema" | "drop_view" | "drop_sequence" | "truncate" | "delete_rows"
  | "column_type_change" | "drop_constraint_unpaired" | "drop_index_unpaired";

export type PlanFinding = { kind: PlanFindingKind; statement: string };

/** Constraints that a post-push enforcement script reasserts after every push (see server/scripts/push-schema.ts), so their drift-drop is expected. */
export const CONSTRAINTS_REASSERTED_AFTER_PUSH: readonly string[] = ["payouts_completed_transfer_check"];

const PLAN_START = /You are about to execute current statements:/;
const PLAN_END = /(No, abort|Yes, I want to execute all statements)\s*$/;
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;
const KNOWN_START = /^(CREATE|ALTER|DROP|COMMENT|TRUNCATE|DELETE|INSERT|UPDATE|SET|GRANT|REVOKE)\b/i;

export class SchemaPlanParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaPlanParseError";
  }
}

/** Splits SQL text into statements at top-level semicolons, honouring quotes, dollar quoting and parentheses. */
export function splitSqlStatements(text: string): string[] {
  const statements: string[] = [];
  let current = "";
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let dollar: string | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (dollar) {
      if (text.startsWith(dollar, i)) { current += dollar; i += dollar.length - 1; dollar = null; } else current += char;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) {
        if (text[i + 1] === quote) { current += text[i + 1]; i += 1; } else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') { quote = char; current += char; continue; }
    if (char === "$") {
      const tag = /^\$[A-Za-z_]*\$/.exec(text.slice(i))?.[0];
      if (tag) { dollar = tag; current += tag; i += tag.length - 1; continue; }
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === ";" && depth <= 0) {
      const statement = current.trim();
      if (statement) statements.push(`${statement};`);
      current = "";
      depth = 0;
      continue;
    }
    current += char;
  }
  if (quote || dollar || depth > 0) throw new SchemaPlanParseError("The push plan ended inside a quoted string or parenthesis.");
  if (current.trim()) throw new SchemaPlanParseError("The push plan ended with an unterminated statement.");
  return statements;
}

/**
 * The statements `drizzle-kit push --strict --verbose` printed. Returns [] only when drizzle itself said there is nothing to do. Anything else
 * it cannot positively recognise is an error: an unreadable plan must never be treated as an empty one.
 */
export function parsePushPlan(output: string): string[] {
  const clean = output.replace(ANSI, "");
  const lines = clean.split(/\r?\n/);
  const start = lines.findIndex((line) => PLAN_START.test(line));
  if (start === -1) {
    if (/No changes detected/i.test(clean)) return [];
    throw new SchemaPlanParseError("drizzle-kit printed neither a plan nor 'No changes detected'.");
  }
  const body: string[] = [];
  let ended = false;
  for (const line of lines.slice(start + 1)) {
    if (PLAN_END.test(line)) { ended = true; break; }
    body.push(line);
  }
  if (!ended) throw new SchemaPlanParseError("The push plan was not followed by drizzle-kit's approval prompt; it may be truncated.");
  const statements = splitSqlStatements(body.join("\n"));
  for (const statement of statements) {
    if (!KNOWN_START.test(statement)) throw new SchemaPlanParseError("The push plan contains a line that is not an SQL statement.");
  }
  return statements;
}

const norm = (statement: string) => statement.replace(/\s+/g, " ").trim();
const PREFIX = 40;
const identifiers = (statement: string) => (statement.match(/"[^"]+"/g) ?? []).map((quoted) => quoted.slice(1, -1));

/** Classifies a plan. Everything returned is something an operator must have looked at; everything else is additive or in-place. */
export function classifyPushPlan(statements: readonly string[]): PlanFinding[] {
  const flat = statements.map(norm);
  const addedConstraints = flat.filter((s) => /^ALTER TABLE .* ADD CONSTRAINT /i.test(s)).map((s) => ({ table: identifiers(s)[0], name: identifiers(s)[1] ?? "" }));
  const createdIndexes = flat.filter((s) => /^CREATE (UNIQUE )?INDEX /i.test(s)).map((s) => identifiers(s)[0] ?? "");
  const findings: PlanFinding[] = [];
  const add = (kind: PlanFindingKind, statement: string) => findings.push({ kind, statement });

  for (const statement of flat) {
    if (/^DROP TABLE /i.test(statement)) add("drop_table", statement);
    else if (/^DROP (MATERIALIZED )?VIEW /i.test(statement)) add("drop_view", statement);
    else if (/^DROP TYPE /i.test(statement)) add("drop_type", statement);
    else if (/^DROP SCHEMA /i.test(statement)) add("drop_schema", statement);
    else if (/^DROP SEQUENCE /i.test(statement)) add("drop_sequence", statement);
    else if (/^TRUNCATE /i.test(statement)) add("truncate", statement);
    else if (/^DELETE FROM /i.test(statement)) add("delete_rows", statement);
    else if (/^ALTER TABLE .* DROP COLUMN /i.test(statement)) add("drop_column", statement);
    else if (/^ALTER TABLE .* ALTER COLUMN .* (SET DATA )?TYPE /i.test(statement)) add("column_type_change", statement);
    else if (/^ALTER TABLE .* DROP CONSTRAINT /i.test(statement)) {
      const [table, name] = identifiers(statement);
      if (CONSTRAINTS_REASSERTED_AFTER_PUSH.includes(name)) continue;
      // Drizzle compares identifiers untruncated while Postgres truncates them at 63 characters, so an unchanged constraint is dropped and added
      // back under its full name in the same plan. A drop with a same-table re-add of a similarly named constraint is that churn, not a removal.
      const paired = addedConstraints.some((added) => added.table === table && added.name.slice(0, PREFIX) === name.slice(0, PREFIX));
      if (!paired) add("drop_constraint_unpaired", statement);
    } else if (/^DROP INDEX /i.test(statement)) {
      const name = identifiers(statement)[0] ?? "";
      if (!createdIndexes.some((created) => created.slice(0, PREFIX) === name.slice(0, PREFIX))) add("drop_index_unpaired", statement);
    }
  }
  return findings;
}

/** A short token naming exactly this set of dangerous statements; an operator passes it back to acknowledge THIS plan and no other. */
export function planAcknowledgementToken(findings: readonly PlanFinding[]): string {
  const canonical = findings.map((finding) => `${finding.kind}:${finding.statement}`).sort().join("\n");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/**
 * True for a database that exists only to be thrown away: loopback host AND a name containing "test". Mirrors the guard the Postgres test
 * suites use. On such a database a destructive plan is acknowledged implicitly (the existing harnesses run `push --force` there).
 */
export function isDisposableTestDatabase(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const socketDirectory = url.searchParams.get("host") ?? "";
    const loopback = ["localhost", "127.0.0.1", "::1", ""].includes(host) && (host !== "" || socketDirectory.startsWith("/"));
    const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
    return loopback && /test/i.test(name);
  } catch {
    return false;
  }
}
