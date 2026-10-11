/**
 * Review of a `drizzle-kit push` plan BEFORE anything is applied.
 *
 * `drizzle-kit push` treats the Drizzle schema as the whole truth of the database. Left alone it plans `DROP TABLE ... CASCADE` for every
 * table it does not declare, applies its statements one by one with no transaction, and only asks for confirmation when it can see data
 * that would be lost. This module is the pure half of the guard around it: it parses the plan `drizzle-kit push --strict --verbose` prints
 * when stdin is closed (nothing is applied in that mode), classifies each statement, and produces the acknowledgement token an operator
 * must pass to let a dangerous plan through. No I/O, no database.
 *
 * FAIL CLOSED. Classification is an ALLOWLIST over a real tokenizer, not a list of known-bad patterns: only statement shapes that are
 * positively recognised as additive (or as an in-place, protection-preserving change) pass silently. Everything else -- including every
 * statement this module does not understand -- is a finding that needs explicit review. A statement can therefore never slip through
 * because its spelling (quoting, schema qualification, case, IF EXISTS, ONLY, spacing) was not anticipated.
 *
 * Complemented by `tablesFilter` in drizzle.config.ts (derived from the schema), which hides every undeclared table from the plan entirely.
 */
import { createHash } from "node:crypto";

export type PlanFindingKind =
  | "drop_table" | "drop_column" | "drop_type" | "drop_schema" | "drop_view" | "drop_sequence" | "drop_other" | "truncate" | "delete_rows"
  | "column_type_change" | "not_null_dropped" | "default_dropped"
  | "drop_constraint_unpaired" | "drop_index_unpaired"
  | "rls_disabled" | "rls_no_force" | "policy_dropped" | "policy_altered" | "policy_created"
  | "trigger_disabled" | "trigger_dropped"
  | "unrecognized_statement";

export type PlanFinding = { kind: PlanFindingKind; statement: string };

/** Constraints that a post-push enforcement script reasserts after every push (see server/scripts/push-schema.ts): `schema.table.constraint`. */
export const CONSTRAINTS_REASSERTED_AFTER_PUSH: readonly string[] = ["public.payouts.payouts_completed_transfer_check"];

export class SchemaPlanParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaPlanParseError";
  }
}

/* ------------------------------------------------------------------------------------------------------------- *
 * PostgreSQL identifiers
 * ------------------------------------------------------------------------------------------------------------- */

const NAMEDATALEN_BYTES = 63;

/**
 * The identifier PostgreSQL actually stores: truncated to 63 BYTES of UTF-8, never in the middle of a character (as `pg_mbcliplen` does).
 * Drizzle compares the untruncated name, which is exactly why an unchanged long-named constraint is planned as drop + re-add.
 */
export function pgIdentifier(name: string): string {
  if (Buffer.byteLength(name, "utf8") <= NAMEDATALEN_BYTES) return name;
  let out = "";
  let bytes = 0;
  for (const char of name) {
    const size = Buffer.byteLength(char, "utf8");
    if (bytes + size > NAMEDATALEN_BYTES) break;
    out += char;
    bytes += size;
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Tokenizer
 * ------------------------------------------------------------------------------------------------------------- */

export type Token = { k: "word" | "qid" | "str" | "num" | "p"; v: string; s: number; e: number };

/** Letters (any non-ASCII character counts as one, as PostgreSQL treats high-bit bytes) and underscore start or continue an unquoted word. */
const isWordStart = (char: string) => /[A-Za-z_]/.test(char) || char.charCodeAt(0) > 127;
const foldAscii = (value: string) => value.replace(/[A-Z]/g, (char) => char.toLowerCase());

/**
 * Tokenizes PostgreSQL text. Unquoted words are folded to lower case (ASCII only, as PostgreSQL does); quoted identifiers keep their exact
 * spelling. Comments are refused outright: a comment could hide a statement boundary, and drizzle-kit never emits one.
 */
function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  const n = sql.length;
  let i = 0;
  const fail = (what: string): never => { throw new SchemaPlanParseError(`The push plan contains ${what}.`); };
  while (i < n) {
    const c = sql[i];
    if (/\s/.test(c)) { i += 1; continue; }
    if ((c === "-" && sql[i + 1] === "-") || (c === "/" && sql[i + 1] === "*")) fail("an SQL comment");
    const s = i;
    if (c === '"') {
      let value = "";
      i += 1;
      for (;;) {
        if (i >= n) fail("an unterminated quoted identifier");
        if (sql[i] === '"') { if (sql[i + 1] === '"') { value += '"'; i += 2; continue; } i += 1; break; }
        value += sql[i]; i += 1;
      }
      if (value.length === 0) fail("an empty quoted identifier");
      tokens.push({ k: "qid", v: value, s, e: i });
      continue;
    }
    if (c === "'" || ((c === "E" || c === "e") && sql[i + 1] === "'")) {
      const escapes = c !== "'";
      i += escapes ? 2 : 1;
      let value = "";
      for (;;) {
        if (i >= n) fail("an unterminated string literal");
        if (escapes && sql[i] === "\\") { value += sql.slice(i, i + 2); i += 2; continue; }
        if (sql[i] === "'") { if (sql[i + 1] === "'") { value += "'"; i += 2; continue; } i += 1; break; }
        value += sql[i]; i += 1;
      }
      tokens.push({ k: "str", v: value, s, e: i });
      continue;
    }
    if (c === "$") {
      const tag = /^\$[A-Za-z_\u0080-￿]*\$/.exec(sql.slice(i))?.[0];
      if (tag) {
        const close = sql.indexOf(tag, i + tag.length);
        if (close === -1) fail("an unterminated dollar-quoted string");
        i = close + tag.length;
        tokens.push({ k: "str", v: sql.slice(s + tag.length, close), s, e: i });
        continue;
      }
    }
    if (isWordStart(c)) {
      i += 1;
      while (i < n && (isWordStart(sql[i]) || /[0-9$]/.test(sql[i]))) i += 1;
      tokens.push({ k: "word", v: foldAscii(sql.slice(s, i)), s, e: i });
      continue;
    }
    const num = /^[0-9][0-9.]*(?:[eE][+-]?[0-9]+)?/.exec(sql.slice(i))?.[0];
    if (num) { i += num.length; tokens.push({ k: "num", v: num, s, e: i }); continue; }
    if (c === ":" && sql[i + 1] === ":") { i += 2; tokens.push({ k: "p", v: "::", s, e: i }); continue; }
    i += 1;
    tokens.push({ k: "p", v: c, s, e: i });
  }
  return tokens;
}

/** Splits SQL text into statements at top-level semicolons (outside quotes, dollar quoting and parentheses). */
export function splitSqlStatements(text: string): string[] {
  const tokens = tokenize(text);
  const statements: string[] = [];
  let depth = 0;
  let start = 0;
  let lastEnd = 0;
  for (const token of tokens) {
    if (token.k === "p" && token.v === "(") depth += 1;
    else if (token.k === "p" && token.v === ")") depth -= 1;
    else if (token.k === "p" && token.v === ";" && depth <= 0) {
      const statement = text.slice(start, token.e).trim();
      if (statement !== ";") statements.push(statement);
      start = token.e;
      depth = 0;
    }
    lastEnd = token.e;
  }
  if (depth > 0) throw new SchemaPlanParseError("The push plan ended inside a parenthesis.");
  if (text.slice(start, Math.max(lastEnd, start)).trim()) throw new SchemaPlanParseError("The push plan ended with an unterminated statement.");
  return statements;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Plan text
 * ------------------------------------------------------------------------------------------------------------- */

const PLAN_START = /You are about to execute current statements:/;
const PLAN_END = /(No, abort|Yes, I want to execute all statements)\s*$/;
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

/**
 * The statements `drizzle-kit push --strict --verbose` printed. Returns [] only when drizzle itself said there is nothing to do. Anything else
 * it cannot positively recognise is an error: an unreadable plan must never be treated as an empty one. The plan ends at the LAST approval
 * prompt line, so a database object whose name imitates the prompt cannot cut the plan short.
 */
export function parsePushPlan(output: string): string[] {
  const clean = output.replace(ANSI, "");
  const lines = clean.split(/\r?\n/);
  const start = lines.findIndex((line) => PLAN_START.test(line));
  if (start === -1) {
    if (/No changes detected/i.test(clean)) return [];
    throw new SchemaPlanParseError("drizzle-kit printed neither a plan nor 'No changes detected'.");
  }
  // The prompt is the contiguous block of approval lines at the very end of the output; the plan is everything before that block.
  let end = lines.length;
  while (end > start + 1 && lines[end - 1].trim() === "") end -= 1;
  const blockBottom = end;
  while (end > start + 1 && PLAN_END.test(lines[end - 1])) end -= 1;
  if (end === blockBottom) throw new SchemaPlanParseError("The push plan was not followed by drizzle-kit's approval prompt; it may be truncated.");
  return splitSqlStatements(lines.slice(start + 1, end).join("\n"));
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Statement analysis (allowlist)
 * ------------------------------------------------------------------------------------------------------------- */

class Cursor {
  i = 0;
  constructor(readonly t: Token[]) {}
  get done() { return this.i >= this.t.length; }
  peek(offset = 0): Token | undefined { return this.t[this.i + offset]; }
  isWord(word: string, offset = 0) { const token = this.peek(offset); return token?.k === "word" && token.v === word; }
  isPunct(value: string, offset = 0) { const token = this.peek(offset); return token?.k === "p" && token.v === value; }
  /** Consumes the given unquoted words in order, or nothing. */
  eat(...words: string[]): boolean {
    if (!words.every((word, offset) => this.isWord(word, offset))) return false;
    this.i += words.length;
    return true;
  }
  /** A name: unquoted words fold to lower case, quoted identifiers keep their spelling. */
  name(): string | null {
    const token = this.peek();
    if (!token || (token.k !== "word" && token.k !== "qid")) return null;
    this.i += 1;
    return token.v;
  }
  /** `name` or `schema.name`; an unqualified name is in `public`. Three-part names are refused. */
  qname(): { schema: string; name: string } | null {
    const first = this.name();
    if (first === null) return null;
    if (!this.isPunct(".")) return { schema: "public", name: first };
    this.i += 1;
    const second = this.name();
    if (second === null || this.isPunct(".")) return null;
    return { schema: first, name: second };
  }
  /** Tokens of a balanced parenthesised group, consuming the parentheses. */
  group(): Token[] | null {
    if (!this.isPunct("(")) return null;
    let depth = 0;
    const start = this.i + 1;
    for (let index = this.i; index < this.t.length; index += 1) {
      const token = this.t[index];
      if (token.k === "p" && token.v === "(") depth += 1;
      if (token.k === "p" && token.v === ")") {
        depth -= 1;
        if (depth === 0) { const inner = this.t.slice(start, index); this.i = index + 1; return inner; }
      }
    }
    return null;
  }
  rest(): Token[] { const out = this.t.slice(this.i); this.i = this.t.length; return out; }
}

const tokenText = (token: Token) => (token.k === "str" ? `'${token.v}'` : token.v);

/** A name list `a, b` inside parentheses, or null when it is anything else. */
function columnList(inner: Token[] | null): string | null {
  if (!inner || inner.length === 0) return null;
  const names: string[] = [];
  let expectName = true;
  for (const token of inner) {
    if (expectName) { if (token.k !== "word" && token.k !== "qid") return null; names.push(token.v); expectName = false; }
    else { if (token.k !== "p" || token.v !== ",") return null; expectName = true; }
  }
  return expectName ? null : names.join(",");
}

/** Token text with the default-schema prefix and redundant ASC removed, so drizzle's and PostgreSQL's spellings of one expression agree. */
function normalizedTokens(tokens: Token[]): string {
  const out: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.k === "word" && token.v === "public" && tokens[index + 1]?.k === "p" && tokens[index + 1].v === ".") { index += 1; continue; }
    if (token.k === "word" && token.v === "asc") continue;
    out.push(tokenText(token));
  }
  return out.join(" ");
}

const REFERENTIAL_ACTIONS = ["no action", "restrict", "cascade", "set null", "set default"];

/**
 * A canonical, comparable form of a table constraint body (the part after `ADD CONSTRAINT name`, or `pg_get_constraintdef` output), or null
 * when this module cannot positively understand it. Two constraints are interchangeable only if their canonical forms are equal. CHECK
 * expressions are compared as normalized token text, which PostgreSQL's own re-rendering rarely reproduces: that is deliberate, an
 * unprovable CHECK replacement is reviewed.
 */
export function canonicalConstraint(tokens: Token[] | string): string | null {
  const cursor = new Cursor(typeof tokens === "string" ? tokenize(tokens) : tokens);
  let head: string;
  if (cursor.eat("primary", "key")) {
    const columns = columnList(cursor.group());
    if (!columns) return null;
    head = `primary_key|${columns}`;
  } else if (cursor.eat("unique")) {
    const nulls = cursor.eat("nulls", "not", "distinct") ? "nulls_not_distinct" : (cursor.eat("nulls", "distinct"), "nulls_distinct");
    const columns = columnList(cursor.group());
    if (!columns) return null;
    head = `unique|${columns}|${nulls}`;
  } else if (cursor.eat("foreign", "key")) {
    const columns = columnList(cursor.group());
    if (!columns || !cursor.eat("references")) return null;
    const target = cursor.qname();
    if (!target) return null;
    let targetColumns = "";
    if (cursor.isPunct("(")) { const list = columnList(cursor.group()); if (!list) return null; targetColumns = list; }
    let match = "simple"; let onDelete = "no action"; let onUpdate = "no action";
    for (;;) {
      if (cursor.eat("match")) { const kind = cursor.name(); if (!kind) return null; match = kind; continue; }
      if (cursor.isWord("on") && (cursor.isWord("delete", 1) || cursor.isWord("update", 1))) {
        const isDelete = cursor.isWord("delete", 1);
        cursor.i += 2;
        const action = REFERENTIAL_ACTIONS.find((candidate) => cursor.eat(...candidate.split(" ")));
        if (!action) return null;
        if (action === "set null" || action === "set default") { if (cursor.isPunct("(") && !columnList(cursor.group())) return null; }
        if (isDelete) onDelete = action; else onUpdate = action;
        continue;
      }
      break;
    }
    head = `foreign_key|${columns}|${target.schema}.${target.name}(${targetColumns})|match:${match}|delete:${onDelete}|update:${onUpdate}`;
  } else if (cursor.eat("check")) {
    const expression = cursor.group();
    if (!expression) return null;
    head = `check|${normalizedTokens(expression)}`;
    if (cursor.eat("no", "inherit")) head += "|no_inherit";
  } else {
    return null;
  }
  let deferrable = "not deferrable"; let initially = "immediate"; let valid = "valid";
  while (!cursor.done) {
    if (cursor.eat("not", "deferrable")) deferrable = "not deferrable";
    else if (cursor.eat("deferrable")) deferrable = "deferrable";
    else if (cursor.eat("initially", "deferred")) initially = "deferred";
    else if (cursor.eat("initially", "immediate")) initially = "immediate";
    else if (cursor.eat("not", "valid")) valid = "not valid";
    else return null;
  }
  return `${head}|${deferrable}|${initially}|${valid}`;
}

type IndexShape = { unique: boolean; name: string; schema: string; table: string; canonical: string | null };

/** Parses `CREATE [UNIQUE] INDEX name ON [ONLY] table ...` (drizzle's text or `pg_get_indexdef`). Null when it is anything else. */
export function parseIndexStatement(statement: string): IndexShape | null {
  const cursor = new Cursor(tokenize(statement).filter((token) => !(token.k === "p" && token.v === ";")));
  if (!cursor.eat("create")) return null;
  const unique = cursor.eat("unique");
  if (!cursor.eat("index") || cursor.isWord("concurrently")) return null;
  cursor.eat("if", "not", "exists");
  const name = cursor.name();
  if (name === null || !cursor.eat("on")) return null;
  cursor.eat("only");
  const table = cursor.qname();
  if (!table) return null;
  const canonical = canonicalIndexBody(cursor, unique, table);
  return { unique, name, schema: table.schema, table: table.name, canonical };
}

function canonicalIndexBody(cursor: Cursor, unique: boolean, table: { schema: string; name: string }): string | null {
  const method = cursor.eat("using") ? cursor.name() : "btree";
  if (!method) return null;
  const elements = cursor.group();
  if (!elements || elements.length === 0) return null;
  const parts = [`unique:${unique}`, `table:${table.schema}.${table.name}`, `method:${method}`, `columns:${normalizedTokens(elements)}`];
  while (!cursor.done) {
    if (cursor.eat("include")) { const inner = cursor.group(); if (!inner) return null; parts.push(`include:${normalizedTokens(inner)}`); }
    else if (cursor.eat("with")) { const inner = cursor.group(); if (!inner) return null; parts.push(`with:${normalizedTokens(inner)}`); }
    else if (cursor.eat("tablespace")) { if (cursor.name() === null) return null; parts.push("tablespace"); }
    else if (cursor.eat("where")) { const predicate = cursor.rest(); if (predicate.length === 0) return null; parts.push(`where:${normalizedTokens(predicate)}`); }
    else return null;
  }
  return parts.join("|");
}

type Analysis =
  | { type: "safe" }
  | { type: "finding"; kind: PlanFindingKind }
  | { type: "add_constraint"; schema: string; table: string; name: string; canonical: string | null }
  | { type: "create_index"; schema: string; table: string; name: string; canonical: string | null }
  | { type: "drop_constraint"; schema: string; table: string; name: string }
  | { type: "drop_index"; schema: string; name: string };

const safe: Analysis = { type: "safe" };
const finding = (kind: PlanFindingKind): Analysis => ({ type: "finding", kind });
const unrecognized = finding("unrecognized_statement");

function hasTopLevelComma(tokens: Token[]): boolean {
  let depth = 0;
  for (const token of tokens) {
    if (token.k === "p" && token.v === "(") depth += 1;
    else if (token.k === "p" && token.v === ")") depth -= 1;
    else if (token.k === "p" && token.v === "," && depth === 0) return true;
  }
  return false;
}

function analyzeAlterTable(cursor: Cursor): Analysis {
  cursor.eat("if", "exists");
  cursor.eat("only");
  const table = cursor.qname();
  if (!table) return unrecognized;
  // One action per statement is all drizzle-kit emits. A compound ALTER could hide a destructive action behind an additive one.
  if (hasTopLevelComma(cursor.t.slice(cursor.i))) return unrecognized;

  if (cursor.eat("add")) {
    if (cursor.eat("constraint")) {
      const name = cursor.name();
      if (name === null) return unrecognized;
      return { type: "add_constraint", schema: table.schema, table: table.name, name: pgIdentifier(name), canonical: canonicalConstraint(cursor.rest()) };
    }
    return safe; // ADD [COLUMN] ... / ADD PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY ...: purely additive
  }
  if (cursor.eat("enable", "row", "level", "security") && cursor.done) return safe;
  if (cursor.eat("force", "row", "level", "security") && cursor.done) return safe;
  if (cursor.eat("disable", "row", "level", "security")) return finding("rls_disabled");
  if (cursor.eat("no", "force", "row", "level", "security")) return finding("rls_no_force");
  if (cursor.eat("disable")) return cursor.isWord("trigger") || cursor.isWord("rule") ? finding("trigger_disabled") : unrecognized;
  if (cursor.eat("drop")) {
    if (cursor.eat("constraint")) {
      cursor.eat("if", "exists");
      const name = cursor.name();
      if (name === null || !cursor.done) return finding("drop_constraint_unpaired"); // trailing CASCADE/RESTRICT or anything else: reviewed
      return { type: "drop_constraint", schema: table.schema, table: table.name, name: pgIdentifier(name) };
    }
    return finding("drop_column"); // `DROP [COLUMN] x` -- and anything else after DROP is at least as serious
  }
  if (cursor.eat("alter")) {
    cursor.eat("column");
    if (cursor.name() === null) return unrecognized;
    if (cursor.eat("set", "default") || cursor.eat("set", "not", "null")) return safe;
    if (cursor.eat("drop", "default")) return cursor.done ? finding("default_dropped") : unrecognized; // defaults can carry security state (status, tier, role)
    if (cursor.eat("drop", "not", "null")) return finding("not_null_dropped");
    if (cursor.eat("set", "data", "type") || cursor.eat("type")) return finding("column_type_change");
    return unrecognized;
  }
  return unrecognized;
}

function analyzeStatement(statement: string): Analysis {
  const tokens = tokenize(statement);
  while (tokens.length > 0 && tokens[tokens.length - 1].k === "p" && tokens[tokens.length - 1].v === ";") tokens.pop();
  if (tokens.some((token) => token.k === "p" && token.v === ";")) return unrecognized; // more than one statement in one string
  const cursor = new Cursor(tokens);

  if (cursor.eat("alter")) {
    if (cursor.eat("table")) return analyzeAlterTable(cursor);
    if (cursor.eat("policy")) return finding("policy_altered");
    if (cursor.eat("type") && cursor.qname() && cursor.eat("add", "value")) return safe;
    return unrecognized;
  }
  if (cursor.eat("create")) {
    if (cursor.eat("table")) {
      cursor.eat("if", "not", "exists");
      if (!cursor.qname() || !cursor.isPunct("(")) return unrecognized; // CREATE TABLE AS / LIKE / OF / PARTITION OF are not understood
      return cursor.group() && cursor.done ? safe : unrecognized;
    }
    if (cursor.isWord("unique") || cursor.isWord("index")) {
      const parsed = parseIndexStatement(statement);
      return parsed ? { type: "create_index", schema: parsed.schema, table: parsed.table, name: pgIdentifier(parsed.name), canonical: parsed.canonical } : unrecognized;
    }
    if (cursor.eat("sequence")) { cursor.eat("if", "not", "exists"); return cursor.qname() ? safe : unrecognized; }
    if (cursor.eat("type")) return cursor.qname() && cursor.eat("as", "enum") ? safe : unrecognized;
    if (cursor.eat("schema")) { cursor.eat("if", "not", "exists"); return cursor.name() !== null && cursor.done ? safe : unrecognized; }
    if (cursor.eat("policy")) return finding("policy_created");
    return unrecognized;
  }
  if (cursor.eat("drop")) {
    if (cursor.eat("table")) return finding("drop_table");
    if (cursor.eat("view") || cursor.eat("materialized", "view")) return finding("drop_view");
    if (cursor.eat("type")) return finding("drop_type");
    if (cursor.eat("schema")) return finding("drop_schema");
    if (cursor.eat("sequence")) return finding("drop_sequence");
    if (cursor.eat("policy")) return finding("policy_dropped");
    if (cursor.eat("trigger")) return finding("trigger_dropped");
    if (cursor.eat("index")) {
      if (cursor.isWord("concurrently")) return finding("drop_index_unpaired");
      cursor.eat("if", "exists");
      const target = cursor.qname();
      if (!target || !cursor.done) return finding("drop_index_unpaired"); // several indexes, CASCADE, ...: reviewed
      return { type: "drop_index", schema: target.schema, name: pgIdentifier(target.name) };
    }
    return finding("drop_other");
  }
  if (cursor.eat("truncate")) return finding("truncate");
  if (cursor.eat("delete")) return finding("delete_rows");
  return unrecognized;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Replacement matching and classification
 * ------------------------------------------------------------------------------------------------------------- */

/** What the live database says about the objects a plan drops, so a replacement can be compared with the thing it replaces. */
export type PlanCatalogFacts = {
  /** `constraintFactKey(...)` -> `pg_get_constraintdef(oid)` */
  constraints: Record<string, string>;
  /** `indexFactKey(...)` -> `pg_get_indexdef(oid)` */
  indexes: Record<string, string>;
};

export const constraintFactKey = (schema: string, table: string, name: string) => `${schema}.${table}.${name}`;
export const indexFactKey = (schema: string, name: string) => `${schema}.${name}`;

/** The (schema, name) of a `DROP SEQUENCE x` statement, or null when the statement is anything else. */
export function dropSequenceTarget(statement: string): { schema: string; name: string } | null {
  const cursor = new Cursor(tokenize(statement).filter((token) => !(token.k === "p" && token.v === ";")));
  if (!cursor.eat("drop", "sequence")) return null;
  cursor.eat("if", "exists");
  const target = cursor.qname();
  return target && cursor.done ? target : null;
}

/** The dropped constraints and indexes whose definitions the caller must read from the live database before classifying. */
export function catalogLookupsNeeded(statements: readonly string[]) {
  const constraints: { schema: string; table: string; name: string }[] = [];
  const indexes: { schema: string; name: string }[] = [];
  for (const statement of statements) {
    const analysis = analyzeStatement(statement);
    if (analysis.type === "drop_constraint") constraints.push({ schema: analysis.schema, table: analysis.table, name: analysis.name });
    if (analysis.type === "drop_index") indexes.push({ schema: analysis.schema, name: analysis.name });
  }
  return { constraints, indexes };
}

const norm = (statement: string) => statement.replace(/\s+/g, " ").trim();

/**
 * Classifies a plan. Everything returned is something an operator must have looked at; everything else is additive or in-place.
 *
 * A dropped constraint or index is excused ONLY when the same plan creates exactly one object with the same effective (63-byte) name on the
 * same table, AND the live definition of the dropped object is provably equivalent to the new one (same kind, columns, referenced table,
 * actions, uniqueness, method, predicate). Without a live definition, with an ambiguous pairing, or with a definition this module cannot
 * parse, the drop is reviewed. This preserves drizzle's identifier-truncation churn without letting a weaker or unrelated object stand in.
 */
export function classifyPushPlan(statements: readonly string[], facts: PlanCatalogFacts = { constraints: {}, indexes: {} }): PlanFinding[] {
  const analyses = statements.map((statement) => ({ statement: norm(statement), analysis: analyzeStatement(statement) }));
  const addedConstraints = analyses.flatMap(({ analysis }) => (analysis.type === "add_constraint" ? [analysis] : []));
  const createdIndexes = analyses.flatMap(({ analysis }) => (analysis.type === "create_index" ? [analysis] : []));
  const usedAdds = new Set<unknown>();
  const findings: PlanFinding[] = [];
  const add = (kind: PlanFindingKind, statement: string) => findings.push({ kind, statement });

  for (const { statement, analysis } of analyses) {
    if (analysis.type === "finding") { add(analysis.kind, statement); continue; }
    if (analysis.type === "drop_constraint") {
      if (CONSTRAINTS_REASSERTED_AFTER_PUSH.includes(constraintFactKey(analysis.schema, analysis.table, analysis.name))) continue;
      const candidates = addedConstraints.filter((added) => added.schema === analysis.schema && added.table === analysis.table && added.name === analysis.name);
      const live = facts.constraints[constraintFactKey(analysis.schema, analysis.table, analysis.name)];
      const before = live === undefined ? null : canonicalConstraint(live);
      const [only] = candidates;
      if (candidates.length === 1 && !usedAdds.has(only) && before !== null && before === only.canonical) usedAdds.add(only);
      else add("drop_constraint_unpaired", statement);
      continue;
    }
    if (analysis.type === "drop_index") {
      const live = facts.indexes[indexFactKey(analysis.schema, analysis.name)];
      const before = live === undefined ? null : parseIndexStatement(live);
      const candidates = createdIndexes.filter((created) => created.schema === analysis.schema && created.name === analysis.name);
      const [only] = candidates;
      if (before && before.canonical !== null && before.schema === analysis.schema && candidates.length === 1 && !usedAdds.has(only)
        && only.table === before.table && before.canonical === only.canonical) usedAdds.add(only);
      else add("drop_index_unpaired", statement);
    }
  }
  return findings;
}

/**
 * A token naming exactly this set of dangerous statements for exactly this database; an operator passes it back to acknowledge THIS plan
 * on THIS database and no other. `scope` is the database name.
 */
export function planAcknowledgementToken(findings: readonly PlanFinding[], scope = ""): string {
  const canonical = findings.map((item) => `${item.kind}\u0000${item.statement}`).sort().join("\u0001");
  return createHash("sha256").update(`${scope}\u0002${canonical}`).digest("hex").slice(0, 24);
}

/**
 * True for a database that exists only to be thrown away: a loopback host (or a local socket directory) AND a name in which "test" is a whole
 * word (`chefsire_test_1`, `test`, `app_test`; not `latest` or `contest`). On such a database a dangerous plan is acknowledged implicitly (the
 * existing harnesses run `push --force` there). Any `host`/`hostaddr` URL parameter that is not a local socket directory disqualifies it,
 * because libpq lets those override the URL's host.
 */
export function isDisposableTestDatabase(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const hostParam = url.searchParams.get("host");
    if (url.searchParams.has("hostaddr")) return false;
    if (hostParam !== null && !hostParam.startsWith("/")) return false;
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(host) || (host === "" && hostParam !== null);
    const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
    return loopback && /(^|[^a-z0-9])test([^a-z0-9]|$)/i.test(name);
  } catch {
    return false;
  }
}
