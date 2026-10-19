import { createHash } from "node:crypto";
import { splitPostgresStatements } from "./postgres-sql-scan";
import { asciiLower, asciiUpper, tokenize, type Token } from "./sql-tokens";

/**
 * Fail-closed destructive-SQL validation for the routine migration command (`npm run db:migrate`).
 *
 * TRUST MODEL. The validator never executes or evaluates SQL. It lexes exactly the statements the executor will send
 * (`splitPostgresStatements`), then checks tokens structurally. It only accepts what it can PROVE is outside its
 * deny rules; constructs whose effect depends on runtime values are rejected rather than evaluated:
 *   - dynamic SQL: PL/pgSQL `EXECUTE`, `CALL`, `COPY`, `PREPARE`d `EXECUTE`, functions that run SQL text
 *     (query_to_xml, dblink, ...), DO/function bodies in any language other than plpgsql/sql or written as E''/U&''
 *     strings (not decoded);
 *   - any top-level statement kind outside a fixed allowlist;
 *   - any DROP other than a small set of reversible object kinds, any `DROP … CASCADE`;
 *   - TRUNCATE; a DELETE whose OWN where-clause is missing, trivially true, or that cannot be parsed.
 * DO and CREATE FUNCTION/PROCEDURE bodies are lexed and analysed recursively as code. The lexer and the executor's
 * splitter are cross-checked: if they disagree about statement boundaries the file is rejected.
 * Not detected (documented): destructive effects of calling routines that already exist in the database, lossy
 * `ALTER COLUMN … TYPE … USING`, UPDATE without WHERE, `DELETE … WHERE <always-true expression>`.
 * See docs/stability-phase-3b-migration-safety.md.
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

const TOP_LEVEL_ALLOWED = new Set([
  "CREATE", "ALTER", "INSERT", "UPDATE", "DELETE", "WITH", "SELECT", "VALUES", "TABLE", "COMMENT", "GRANT", "REVOKE",
  "SET", "RESET", "DO", "DROP", "TRUNCATE", "ANALYZE", "REINDEX", "REFRESH", "LOCK", "NOTIFY", "BEGIN", "COMMIT",
  "END", "SAVEPOINT", "RELEASE", "ROLLBACK",
]);
/** DROP targets that only remove definitions, never row data (and are not cascaded). */
const DROP_ALLOWED = new Set(["INDEX", "TRIGGER", "POLICY", "RULE", "VIEW", "FUNCTION", "PROCEDURE", "TYPE", "DOMAIN", "CONSTRAINT", "DEFAULT", "NOT"]);
/** Inside ALTER TABLE only these DROP subcommands are definition-only; anything else is a column drop. */
const ALTER_TABLE_DROP_ALLOWED = new Set(["CONSTRAINT", "DEFAULT", "NOT"]);
/** Procedural languages whose bodies the guard can lex and analyse. Everything else is rejected. */
const FUNCTION_LANGUAGES = new Set(["plpgsql", "sql"]);
/** Functions that execute SQL text supplied as an argument. */
const DYNAMIC_SQL_FUNCTIONS = new Set([
  "query_to_xml", "query_to_xml_and_xmlschema", "query_to_xmlschema", "cursor_to_xml", "cursor_to_xmlschema",
  "dblink", "dblink_exec", "dblink_send_query", "dblink_connect", "pg_execute",
]);
/** Session settings that change how the SAME bytes lex (string escapes, multibyte decoding). Never legitimate here. */
const LEXING_SETTINGS = ["standard_conforming_strings", "client_encoding"];
/**
 * Configuration is a single policy: routine migrations may not change session configuration, because any such change
 * can alter how LATER text is parsed (string escapes, encoding, search_path-based name resolution) and so invalidate
 * everything this guard concluded about it. The only exceptions are three timeouts that cannot affect parsing.
 */
const CONFIG_SAFE_SETTINGS = new Set(["LOCK_TIMEOUT", "STATEMENT_TIMEOUT", "IDLE_IN_TRANSACTION_SESSION_TIMEOUT"]);
/** Any mention (qualified, quoted or not) is rejected: the function takes a COMPUTED name, pg_settings is writable. */
const CONFIG_OBJECTS = new Set(["set_config", "pg_settings", "pg_show_all_settings"]);
/** ALTER targets whose SET/RESET clauses persist configuration (and ALTER ROLE/USER also changes credentials). */
const CONFIG_ALTER_TARGETS = new Set(["DATABASE", "ROLE", "USER", "GROUP", "SYSTEM"]);
/** Words after which a PL/pgSQL statement can begin, so a SET/RESET there is a configuration command. */
const STATEMENT_LEAD_WORDS = new Set(["THEN", "ELSE", "LOOP", "BEGIN", "ATOMIC"]);
const MAX_BODY_DEPTH = 3;

type Add = (operation: string) => void;

function word(t: Token | undefined): string | undefined {
  return t?.kind === "word" ? t.text : undefined;
}

/** Paren depth of each token (a ')' carries the depth AFTER it closes). */
function depths(piece: Token[]): number[] {
  let d = 0;
  return piece.map((t) => {
    if (t.text === "(" && t.kind === "punct") return d++;
    if (t.text === ")" && t.kind === "punct") return --d;
    return d;
  });
}

/** Validate ONE DELETE command: its own WHERE (same paren depth, before any RETURNING) must exist and not be trivial. */
function checkDelete(piece: Token[], at: number, depth: number[], add: Add): void {
  const prev = word(piece[at - 1]);
  const next = piece[at + 1];
  if (word(next) !== "FROM") {
    // Not a DELETE command: DELETE as an event/privilege/action keyword. Only well-known shapes are accepted.
    const benign =
      prev !== "THEN" &&
      next !== undefined &&
      (["ON", "OR", "CASCADE", "SET", "NO", "RESTRICT", "TO"].includes(word(next) ?? "") ||
        next.text === "," || next.text === ")" ||
        (word(next) === "USING" && prev === "FOR"));
    if (!benign) add("UNSUPPORTED DELETE FORM");
    return;
  }
  const d0 = depth[at];
  let end = at + 1;
  while (end < piece.length && depth[end] >= d0) end++;
  let where = -1;
  let returning = -1;
  for (let k = at + 2; k < end; k++) {
    if (depth[k] !== d0) continue;
    if (word(piece[k]) === "WHERE" && where === -1) where = k;
    if (word(piece[k]) === "RETURNING" && returning === -1) returning = k;
  }
  if (where === -1 || (returning !== -1 && returning < where)) return void add("DELETE without WHERE");
  const predicate = piece.slice(where + 1, returning === -1 ? end : returning).map((t) => t.text);
  const joined = predicate.join(" ");
  const trivial =
    predicate.length === 0 ||
    /^\(* *(TRUE|NOT FALSE) *\)*$/.test(joined) ||
    (predicate.length === 3 && predicate[1] === "=" && predicate[0] === predicate[2] && /^[0-9]/.test(predicate[0]));
  if (trivial) add("DELETE with trivially true WHERE");
}

function bodyOf(t: Token | undefined, add: Add, what: string): string | null {
  if (t?.kind !== "string") return null;
  if (t.flavor === "escape" || t.flavor === "unicode") {
    add(`UNSUPPORTED ${what} BODY (E''/U&'' strings are not decoded)`);
    return null;
  }
  return t.value;
}

/**
 * `CREATE [OR REPLACE] [CONSTRAINT|EVENT] TRIGGER …` — the statement itself, not any CREATE that merely has the
 * word TRIGGER somewhere nearby (a column named "trigger" must not unlock trigger-only syntax).
 */
function startsCreateTrigger(piece: Token[]): boolean {
  const start = piece.findIndex((t, k) => word(t) === "CREATE" && (k === 0 || STATEMENT_LEAD_WORDS.has(word(piece[k - 1]) ?? "")));
  if (start === -1) return false;
  let k = start + 1;
  if (word(piece[k]) === "OR" && word(piece[k + 1]) === "REPLACE") k += 2;
  if (word(piece[k]) === "CONSTRAINT" || word(piece[k]) === "EVENT") k++;
  return word(piece[k]) === "TRIGGER";
}

/**
 * Locate a function/procedure definition header: `CREATE [OR REPLACE] FUNCTION|PROCEDURE name ( args )`.
 * Returns null for any other CREATE, "malformed" when it is a function statement the guard cannot parse, otherwise
 * the index of the closing parenthesis of the argument list. Everything BEFORE that index (parameter names,
 * types, defaults) is never consulted for clause decisions; they sit inside the parentheses.
 */
function functionHeader(piece: Token[], d: number[]): { close: number } | "malformed" | null {
  let k = 1;
  if (word(piece[k]) === "OR" && word(piece[k + 1]) === "REPLACE") k += 2;
  if (word(piece[k]) !== "FUNCTION" && word(piece[k]) !== "PROCEDURE") return null;
  k++;
  const isName = (t: Token | undefined) => t !== undefined && (t.kind === "word" || (t.kind === "qident" && t.flavor === "plain"));
  if (!isName(piece[k])) return "malformed";
  k++;
  while (piece[k]?.kind === "punct" && piece[k].text === "." && isName(piece[k + 1])) k += 2;
  if (piece[k]?.kind !== "punct" || piece[k].text !== "(") return "malformed";
  const close = piece.findIndex((t, i) => i > k && t.kind === "punct" && t.text === ")" && d[i] === d[k]);
  return close === -1 ? "malformed" : { close };
}

/** The operand of the (single) LANGUAGE clause, normalised the way PostgreSQL resolves it; undefined + finding if unusable. */
function languageOperand(piece: Token[], clauses: number[], add: Add): string | undefined {
  if (clauses.length === 0) return void add("UNSUPPORTED LANGUAGE (none declared)");
  if (clauses.length > 1) return void add("UNSUPPORTED LANGUAGE (declared more than once)");
  const operand = piece[clauses[0] + 1];
  if (operand?.kind === "word") return asciiLower(operand.value); // unquoted: folded like any identifier
  if ((operand?.kind === "qident" || operand?.kind === "string") && operand.flavor === "plain") return operand.value;
  return void add("UNSUPPORTED LANGUAGE (malformed clause)");
}

/**
 * Validate the clauses that follow the argument list of a function/procedure definition. Only tokens at the
 * statement's own parenthesis depth AFTER the argument list are clause candidates, so a parameter, type or
 * default expression that happens to be spelled `language` or `as` can never be mistaken for a clause. Because a
 * valid definition has exactly one LANGUAGE clause and exactly one AS definition, finding any other count means
 * either invalid SQL or a form the guard cannot attribute reliably — both are rejected.
 */
function analyseFunctionClauses(piece: Token[], d: number[], close: number, bodies: string[], add: Add): void {
  const level = d[close];
  const clauseWords = (name: string) =>
    piece.map((t, k) => k).filter((k) => k > close && d[k] === level && word(piece[k]) === name);

  if (clauseWords("ATOMIC").length > 0 || clauseWords("RETURN").length > 0) {
    add("UNSUPPORTED FUNCTION BODY (SQL-standard BEGIN ATOMIC / RETURN bodies are not supported)");
    return;
  }
  const language = languageOperand(piece, clauseWords("LANGUAGE"), add);
  if (language !== undefined && !FUNCTION_LANGUAGES.has(language)) add(`UNSUPPORTED LANGUAGE (${language})`);

  const asClauses = clauseWords("AS");
  if (asClauses.length !== 1) return void add("UNSUPPORTED FUNCTION BODY (expected exactly one AS definition)");
  const definition = piece[asClauses[0] + 1];
  const after = piece[asClauses[0] + 2];
  if (definition?.kind !== "string") return void add("UNSUPPORTED FUNCTION BODY (AS is not followed by a literal)");
  if (after?.kind === "string" || (after?.kind === "punct" && after.text === ",")) {
    return void add("UNSUPPORTED FUNCTION BODY (multiple literals)");
  }
  const body = bodyOf(definition, add, "FUNCTION");
  if (body !== null) bodies.push(body);
}

/** DO [LANGUAGE x] 'code' [LANGUAGE x]: no parentheses exist, so every LANGUAGE word is a clause. */
function analyseDo(piece: Token[], bodies: string[], add: Add): void {
  const clauses = piece.map((t, k) => k).filter((k) => word(piece[k]) === "LANGUAGE");
  const language = clauses.length === 0 ? "plpgsql" : languageOperand(piece, clauses, add);
  if (language !== undefined && language !== "plpgsql") add(`UNSUPPORTED LANGUAGE (${language})`);
  // Every string except LANGUAGE's operand is a body candidate, and exactly one is accepted. Adjacent literals
  // ('a' <newline> 'b') are concatenated by PostgreSQL, so more than one candidate is ambiguous: rejected.
  const operandAt = clauses.length === 1 ? clauses[0] + 1 : -1;
  const candidates = piece.map((t, k) => k).filter((k) => piece[k].kind === "string" && k !== operandAt);
  if (candidates.length !== 1) return void add("UNSUPPORTED DO BODY (expected exactly one body literal)");
  const body = bodyOf(piece[candidates[0]], add, "DO");
  if (body !== null) bodies.push(body);
}

function analysePiece(piece: Token[], top: boolean, depth: number, add: Add): void {
  const first = word(piece[0]);
  if (top && (first === undefined || !TOP_LEVEL_ALLOWED.has(first))) {
    add(`UNSUPPORTED STATEMENT (${piece[0].text.slice(0, 20)})`);
    return;
  }
  const d = depths(piece);
  const alterTableAt = piece.findIndex(
    (t, k) => word(t) === "ALTER" && (word(piece[k + 1]) === "TABLE" || (word(piece[k + 1]) === "FOREIGN" && word(piece[k + 2]) === "TABLE"))
  );
  const isCreateTrigger = startsCreateTrigger(piece);
  const hasDrop = piece.some((t) => word(t) === "DROP");

  piece.forEach((t, k) => {
    const w = word(t);
    const prev = word(piece[k - 1]);
    const next = word(piece[k + 1]);
    // Identifiers: unicode-escaped identifiers (U&"…" [UESCAPE '…']) are never decoded, so they could spell any name
    // (including a prohibited function). They are rejected outright rather than treated as ordinary quoted names.
    if (t.kind === "qident" && t.flavor === "unicode") add("UNICODE-ESCAPED IDENTIFIER");
    if (w === "UESCAPE") add("UNICODE ESCAPE (UESCAPE)");
    if (
      (t.kind === "word" && DYNAMIC_SQL_FUNCTIONS.has(asciiLower(t.value))) ||
      (t.kind === "qident" && t.flavor === "plain" && DYNAMIC_SQL_FUNCTIONS.has(t.value))
    ) {
      add(`DYNAMIC SQL FUNCTION (${asciiLower(t.value)})`);
    }
    if (
      (t.kind === "word" && CONFIG_OBJECTS.has(asciiLower(t.value))) ||
      (t.kind === "qident" && t.flavor === "plain" && CONFIG_OBJECTS.has(t.value))
    ) {
      add(`CONFIGURATION CHANGE (${asciiLower(t.value)})`);
    }
    if ((w === "SET" || w === "RESET") && (k === 0 || STATEMENT_LEAD_WORDS.has(prev ?? ""))) {
      // A configuration command (a statement that STARTS with SET/RESET). UPDATE … SET, ON DELETE SET NULL,
      // ALTER … SET DEFAULT and friends never start a statement, so they are not affected.
      let j = k + 1;
      if (word(piece[j]) === "SESSION" || word(piece[j]) === "LOCAL") j++;
      const name = word(piece[j]);
      const assignment = piece[j + 1];
      const wellFormed = w === "RESET" ? assignment === undefined : word(assignment) === "TO" || assignment?.text === "=";
      if (!(name && CONFIG_SAFE_SETTINGS.has(name) && wellFormed)) add(`CONFIGURATION CHANGE (${w} ${name ?? "?"})`);
    }
    if (w === "ALTER" && CONFIG_ALTER_TARGETS.has(next ?? "")) add(`UNSUPPORTED ALTER (${next})`);
    if (t.kind !== "punct" && t.kind !== "number") {
      const text = asciiLower(t.kind === "word" || t.kind === "qident" || t.kind === "string" ? t.value : "");
      const setting = LEXING_SETTINGS.find((name) => text.includes(name));
      if (setting) add(`UNSUPPORTED SESSION SETTING (${setting})`);
    }
    if (w === "EXECUTE" && !(isCreateTrigger && (next === "FUNCTION" || next === "PROCEDURE"))) add("DYNAMIC SQL (EXECUTE)");
    if (w === "CALL") add("PROCEDURAL CALL");
    if (w === "COPY") add("COPY");
    if (w === "TRUNCATE" && !(isCreateTrigger && (prev === "AFTER" || prev === "BEFORE" || prev === "OR"))) add("TRUNCATE");
    if (w === "CASCADE" && hasDrop && prev !== "DELETE" && prev !== "UPDATE") add("DROP ... CASCADE");
    if (w === "DELETE") checkDelete(piece, k, d, add);
    if (w === "DROP") {
      const inAlterTable = alterTableAt !== -1 && k > alterTableAt;
      if (inAlterTable) {
        if (!ALTER_TABLE_DROP_ALLOWED.has(next ?? "")) add("DROP COLUMN");
      } else if (!DROP_ALLOWED.has(next ?? "")) {
        add(`DROP ${next ?? "?"}`);
      }
    }
  });

  // Procedural bodies are code: DO blocks and CREATE FUNCTION/PROCEDURE definitions are lexed and analysed too.
  // They are recognised wherever a STATEMENT begins (start of the piece, or after BEGIN/THEN/ELSE/LOOP inside a
  // procedural body), not only as the first token: PL/pgSQL can run `CREATE FUNCTION` and `DO` as plain statements.
  const bodies: string[] = [];
  piece.forEach((t, k) => {
    const startsStatement = k === 0 || STATEMENT_LEAD_WORDS.has(word(piece[k - 1]) ?? "");
    if (!startsStatement) return;
    if (word(t) === "DO") analyseDo(piece.slice(k), bodies, add);
    else if (word(t) === "CREATE") {
      const sub = piece.slice(k);
      const subDepth = depths(sub);
      const header = functionHeader(sub, subDepth);
      if (header === "malformed") add("UNSUPPORTED FUNCTION DEFINITION (header could not be parsed)");
      else if (header !== null) analyseFunctionClauses(sub, subDepth, header.close, bodies, add);
    }
  });
  for (const body of bodies) {
    if (depth >= MAX_BODY_DEPTH) add("UNSUPPORTED NESTING");
    else analyseSql(body, depth + 1, add);
  }
}

function countPieces(tokens: Token[]): number {
  let count = 0;
  let open = false;
  for (const t of tokens) {
    if (t.kind === "punct" && t.text === ";") open = false;
    else if (!open) { open = true; count++; }
  }
  return count;
}

function analyseSql(sql: string, depth: number, add: Add): void {
  const tokens = tokenize(sql);
  let piece: Token[] = [];
  const flush = () => {
    if (piece.length > 0) analysePiece(piece, depth === 0, depth, add);
    piece = [];
  };
  for (const t of tokens) {
    if (t.kind === "punct" && t.text === ";") flush();
    else piece.push(t);
  }
  flush();
}

export function findDestructiveOperations(sql: string): DestructiveFinding[] {
  const findings: DestructiveFinding[] = [];
  splitPostgresStatements(sql).forEach((statement, index) => {
    const found = new Set<string>();
    try {
      // Boundary cross-check: the executor sends this chunk as one query. If the lexer sees more than one statement
      // in it, PostgreSQL would run them all, so the splitter and the validator disagree: reject.
      if (countPieces(tokenize(statement)) > 1) found.add("PARSER DISAGREEMENT (multiple statements in one chunk)");
      analyseSql(statement, 0, (op) => found.add(op));
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
