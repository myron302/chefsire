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
  | "column_type_change" | "not_null_dropped" | "default_dropped" | "default_changed" | "default_added" | "default_unverified"
  | "drop_constraint_unpaired" | "drop_index_unpaired"
  | "rls_disabled" | "rls_no_force" | "policy_dropped" | "policy_altered" | "policy_created"
  | "trigger_disabled" | "trigger_dropped"
  | "protected_object_dropped"
  | "unrecognized_statement";

export type PlanFinding = { kind: PlanFindingKind; statement: string };

/**
 * Protections that the enforcement migrations install and a post-push script used to "restore" AFTER the push had committed. A push may never
 * remove one: the window between commit and restoration is a window without a financial protection, and it never closes if the process dies.
 * (`constraintFactKey` form.) More are supplied from the enforcement DDL itself (`PlanCatalogFacts.protectedConstraints`); this is the minimum.
 */
export const ALWAYS_PROTECTED_CONSTRAINTS: readonly string[] = [JSON.stringify(["public", "payouts", "payouts_completed_transfer_check"])];

/** Findings that no acknowledgement token can lift: the plan must not run at all. */
export const NON_ACKNOWLEDGEABLE_KINDS: readonly PlanFindingKind[] = ["protected_object_dropped"];
export const hardRefusals = (findings: readonly PlanFinding[]) => findings.filter((item) => NON_ACKNOWLEDGEABLE_KINDS.includes(item.kind));

/** The constraint a `ALTER TABLE ... DROP CONSTRAINT x` statement drops, or null when the statement is anything else. */
export function droppedConstraint(statement: string): { schema: string; table: string; name: string } | null {
  const analysis = analyzeStatement(statement);
  return analysis.type === "drop_constraint" ? { schema: analysis.schema, table: analysis.table, name: analysis.name } : null;
}

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

/**
 * `lit` says HOW a string literal was written, because that decides what it means: `escape` = `E'...'` (backslash escapes are processed),
 * `std` = an ordinary `'...'` (backslashes are literal when standard_conforming_strings is on, escapes when off), `dollar` = `$tag$...$tag$` (never
 * processes anything). `v` is the text between the delimiters with only the delimiter-level doubling (`''`) undone.
 */
export type Token = { k: "word" | "qid" | "str" | "num" | "p"; v: string; s: number; e: number; lit?: "std" | "escape" | "dollar" };

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
      tokens.push({ k: "str", v: value, s, e: i, lit: escapes ? "escape" : "std" });
      continue;
    }
    if (c === "$") {
      const tag = /^\$[A-Za-z_\u0080-￿]*\$/.exec(sql.slice(i))?.[0];
      if (tag) {
        const close = sql.indexOf(tag, i + tag.length);
        if (close === -1) fail("an unterminated dollar-quoted string");
        i = close + tag.length;
        tokens.push({ k: "str", v: sql.slice(s + tag.length, close), s, e: i, lit: "dollar" });
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

/** How the target database reads ordinary string literals. `undefined` = unknown, which is treated as "cannot prove" wherever it matters. */
export type CanonicalOptions = { standardConformingStrings?: boolean };

/** PostgreSQL's reserved and type/function-reserved words: a quoted identifier with one of these names is NOT the keyword and must stay quoted. */
const RESERVED = new Set(("all analyse analyze and any array as asc asymmetric authorization binary both case cast check collate collation column concurrently constraint create cross " +
  "current_catalog current_date current_role current_schema current_time current_timestamp current_user default deferrable desc distinct do else end except false fetch for foreign " +
  "freeze from full grant group having ilike in initially inner intersect into is isnull join lateral leading left like limit localtime localtimestamp natural not notnull null offset " +
  "on only or order outer overlaps placing primary references returning right select session_user similar some symmetric system_user table tablesample then to trailing true union " +
  "unique user using variadic verbose when where window with").split(" "));

/** The characters PostgreSQL operators are made of: two of them written without a gap are ONE operator (`<=`), with a gap they are not. */
const OPERATOR_CHARACTERS = "+-*/<>=~!@#%^&|`?:";

/**
 * The value a string literal denotes, or null when it cannot be established. Escape strings (`E'...'`) are decoded with PostgreSQL's rules, so
 * `E'\n'` (a newline) and `'\n'` (backslash, n) are different, while `E'\\n'` and `'\n'` (both backslash, n) are the same. An ordinary literal
 * containing a backslash means different things depending on standard_conforming_strings, so it is only comparable when that setting is known.
 */
function literalValue(token: Token, options: CanonicalOptions): string | null {
  if (token.lit === "dollar") return token.v;
  if (token.lit === "escape" || (token.lit === "std" && options.standardConformingStrings === false)) return decodeEscapes(token.v);
  if (token.v.includes("\\") && options.standardConformingStrings !== true) return null; // unknown setting: cannot prove what this means
  return token.v;
}

/**
 * PostgreSQL's backslash escapes inside E'...' (and inside ordinary literals when standard_conforming_strings is off). Null on anything invalid.
 *
 * Byte escapes (`\xHH`, `\ooo`) denote BYTES that PostgreSQL then reads in the database's encoding: in a UTF-8 database `E'\xC3\xA9'` is the single
 * character U+00E9, not the two characters U+00C3 U+00A9 that `'Ã©'` is. Only bytes below 0x80 mean the same thing in every ASCII-compatible
 * encoding, so only those are decoded; a byte escape of 0x80 or above makes the literal unprovable (and so the expression is reviewed) rather than
 * guessing an encoding. `\u`/`\U` name code points directly and need no encoding.
 */
function decodeEscapes(raw: string): string | null {
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i];
    if (c !== "\\") { out += c; continue; }
    i += 1;
    const n = raw[i];
    if (n === undefined) return null;
    const simple: Record<string, string> = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
    if (n in simple) { out += simple[n]; continue; }
    if (/[0-7]/.test(n)) {
      let digits = n;
      while (digits.length < 3 && /[0-7]/.test(raw[i + 1] ?? "")) { i += 1; digits += raw[i]; }
      const code = parseInt(digits, 8);
      if (code === 0 || code > 127) return null; // see below: only ASCII bytes have a meaning independent of the database encoding
      out += String.fromCharCode(code);
      continue;
    }
    if (n === "x") {
      let digits = "";
      while (digits.length < 2 && /[0-9a-fA-F]/.test(raw[i + 1] ?? "")) { i += 1; digits += raw[i]; }
      const code = parseInt(digits, 16);
      if (digits === "" || code === 0 || code > 127) return null;
      out += String.fromCharCode(code);
      continue;
    }
    if (n === "u" || n === "U") {
      const width = n === "u" ? 4 : 8;
      const digits = raw.slice(i + 1, i + 1 + width);
      if (!new RegExp(`^[0-9a-fA-F]{${width}}$`).test(digits)) return null;
      const code = parseInt(digits, 16);
      if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return null;
      out += String.fromCodePoint(code);
      i += width;
      continue;
    }
    out += n; // any other backslashed character is that character (including \\ and \')
  }
  return out;
}

/** A canonical, comparable form of one token, or null when its meaning cannot be established. Quoted identifiers keep case and special characters. */
function tokenText(token: Token, options: CanonicalOptions): string | null {
  switch (token.k) {
    case "str": { const value = literalValue(token, options); return value === null ? null : `s${JSON.stringify(value)}`; }
    case "qid": return /^[a-z_][a-z0-9_$]*$/.test(token.v) && !RESERVED.has(token.v) ? token.v : `"${token.v.replace(/"/g, '""')}"`; // "foo" IS foo
    default: return token.v;
  }
}

/** A name list `a, b` inside parentheses (as a JSON array, so a name containing a comma cannot pose as two), or null when it is anything else. */
function columnList(inner: Token[] | null): string | null {
  if (!inner || inner.length === 0) return null;
  const names: string[] = [];
  let expectName = true;
  for (const token of inner) {
    if (expectName) { if (token.k !== "word" && token.k !== "qid") return null; names.push(token.v); expectName = false; }
    else { if (token.k !== "p" || token.v !== ",") return null; expectName = true; }
  }
  return expectName ? null : JSON.stringify(names);
}

/**
 * Token text with only the redundant ASC removed, so drizzle's and PostgreSQL's spellings of one expression agree. Schema qualifiers are NEVER
 * dropped: `public.lower(x)` and `lower(x)` can be different functions (an unqualified name resolves through pg_catalog first, then search_path),
 * and the same goes for qualified operators (`OPERATOR(schema.+)`), casts (`::schema.type`) and collations. PostgreSQL renders a name qualified
 * exactly when the unqualified spelling would not resolve to the same object, so a qualifier difference is a real difference. Keeps what
 * the SQL means: string literals by VALUE (and how they were written), quoted identifiers exactly, operators as one operator, and never joins
 * tokens in a way that could read as something else. Null when any part cannot be established, so it can never be "equal" to anything.
 */
function normalizedTokens(tokens: Token[], options: CanonicalOptions): string | null {
  if (tokens.length === 0) return null;
  let out = "";
  let previous: Token | undefined;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.k === "p" && token.v === ".") {
      // A qualifier dot joins two names (`schema.function`, `(composite).field`); a dangling or misplaced one is not an expression we understand.
      const before = tokens[index - 1];
      const after = tokens[index + 1];
      const joinsNames = before !== undefined && after !== undefined && (before.k === "word" || before.k === "qid" || (before.k === "p" && (before.v === ")" || before.v === "]")))
        && (after.k === "word" || after.k === "qid" || (after.k === "p" && (after.v === "*" || OPERATOR_CHARACTERS.includes(after.v)))); // `OPERATOR(schema.+)`
      if (!joinsNames) return null;
    }
    if (token.k === "word" && token.v === "asc") continue;
    const text = tokenText(token, options);
    if (text === null) return null;
    const glued = previous && previous.k === "p" && token.k === "p" && previous.e === token.s && OPERATOR_CHARACTERS.includes(previous.v) && OPERATOR_CHARACTERS.includes(token.v);
    out += previous ? (glued ? text : ` ${text}`) : text;
    previous = token;
  }
  return out;
}

const REFERENTIAL_ACTIONS = ["no action", "restrict", "cascade", "set null", "set default"];

/**
 * A canonical, comparable form of a table constraint body (the part after `ADD CONSTRAINT name`, or `pg_get_constraintdef` output), or null
 * when this module cannot positively understand it. Two constraints are interchangeable only if their canonical forms are equal. CHECK
 * expressions are compared as normalized token text, which PostgreSQL's own re-rendering rarely reproduces: that is deliberate, an
 * unprovable CHECK replacement is reviewed.
 */
export function canonicalConstraint(tokens: Token[] | string, options: CanonicalOptions = {}): string | null {
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
    let match = "simple";
    type Action = { action: string; columns: string | null };
    let onDelete: Action = { action: "no action", columns: null };
    let onUpdate: Action = { action: "no action", columns: null };
    for (;;) {
      if (cursor.eat("match")) { const kind = cursor.name(); if (!kind) return null; match = kind; continue; }
      if (cursor.isWord("on") && (cursor.isWord("delete", 1) || cursor.isWord("update", 1))) {
        const isDelete = cursor.isWord("delete", 1);
        cursor.i += 2;
        const action = REFERENTIAL_ACTIONS.find((candidate) => cursor.eat(...candidate.split(" ")));
        if (!action) return null;
        let actionColumns: string | null = null;
        // PostgreSQL 15+: SET NULL / SET DEFAULT may name the subset of referencing columns they apply to.
        if ((action === "set null" || action === "set default") && cursor.isPunct("(")) {
          actionColumns = columnList(cursor.group());
          if (!actionColumns) return null;
        }
        if (isDelete) onDelete = { action, columns: actionColumns }; else onUpdate = { action, columns: actionColumns };
        continue;
      }
      break;
    }
    // The effective column set of a SET NULL / SET DEFAULT action: no list means ALL referencing columns, and a list is a set (order is
    // irrelevant, repeats are invalid). Listing every referencing column is therefore the same behaviour as listing none.
    const referencing: string[] = JSON.parse(columns);
    const effective = (action: Action): string | null => {
      if (action.action !== "set null" && action.action !== "set default") return action.action;
      const listed: string[] = JSON.parse(action.columns ?? columns);
      if (new Set(listed).size !== listed.length) return null;
      const sortedListed = [...listed].sort();
      const sortedAll = [...referencing].sort();
      const all = sortedListed.length === sortedAll.length && sortedListed.every((name, index) => name === sortedAll[index]);
      return `${action.action}(${all ? "*" : JSON.stringify(sortedListed)})`;
    };
    const deleteBehaviour = effective(onDelete);
    const updateBehaviour = effective(onUpdate);
    if (deleteBehaviour === null || updateBehaviour === null) return null;
    head = `foreign_key|${columns}|${JSON.stringify([target.schema, target.name])}(${targetColumns})|match:${match}|delete:${deleteBehaviour}|update:${updateBehaviour}`;
  } else if (cursor.eat("check")) {
    const expression = cursor.group();
    if (!expression) return null;
    const text = normalizedTokens(expression, options);
    if (text === null) return null;
    head = `check|${text}`;
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
export function parseIndexStatement(statement: string, options: CanonicalOptions = {}): IndexShape | null {
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
  const canonical = canonicalIndexBody(cursor, unique, table, options);
  return { unique, name, schema: table.schema, table: table.name, canonical };
}

function canonicalIndexBody(cursor: Cursor, unique: boolean, table: { schema: string; name: string }, options: CanonicalOptions): string | null {
  const method = cursor.eat("using") ? cursor.name() : "btree";
  if (!method) return null;
  const elements = cursor.group();
  if (!elements || elements.length === 0) return null;
  const columns = normalizedTokens(elements, options);
  if (columns === null) return null;
  const parts = [`unique:${unique}`, `table:${JSON.stringify([table.schema, table.name])}`, `method:${method}`, `columns:${columns}`];
  while (!cursor.done) {
    if (cursor.eat("include")) { const inner = cursor.group(); const text = inner && normalizedTokens(inner, options); if (!text) return null; parts.push(`include:${text}`); }
    else if (cursor.eat("with")) { const inner = cursor.group(); const text = inner && normalizedTokens(inner, options); if (!text) return null; parts.push(`with:${text}`); }
    else if (cursor.eat("tablespace")) { if (cursor.name() === null) return null; parts.push("tablespace"); }
    else if (cursor.eat("where")) { const predicate = cursor.rest(); const text = predicate.length > 0 ? normalizedTokens(predicate, options) : null; if (!text) return null; parts.push(`where:${text}`); }
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
  | { type: "drop_index"; schema: string; name: string }
  | { type: "set_default"; schema: string; table: string; column: string; expression: string };

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

function analyzeAlterTable(cursor: Cursor, source: string, options: CanonicalOptions): Analysis {
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
      return { type: "add_constraint", schema: table.schema, table: table.name, name: pgIdentifier(name), canonical: canonicalConstraint(cursor.rest(), options) };
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
    const column = cursor.name();
    if (column === null) return unrecognized;
    if (cursor.eat("set", "not", "null")) return safe;
    if (cursor.eat("set", "default")) {
      // A default can carry security state (status, tier, role, payment state), so a change of it is judged against the live catalog.
      const expression = cursor.rest();
      if (expression.length === 0) return unrecognized;
      return { type: "set_default", schema: table.schema, table: table.name, column, expression: source.slice(expression[0].s, expression[expression.length - 1].e) };
    }
    if (cursor.eat("drop", "default")) return cursor.done ? finding("default_dropped") : unrecognized; // defaults can carry security state (status, tier, role)
    if (cursor.eat("drop", "not", "null")) return finding("not_null_dropped");
    if (cursor.eat("set", "data", "type") || cursor.eat("type")) return finding("column_type_change");
    return unrecognized;
  }
  return unrecognized;
}

function analyzeStatement(statement: string, options: CanonicalOptions = {}): Analysis {
  const tokens = tokenize(statement);
  while (tokens.length > 0 && tokens[tokens.length - 1].k === "p" && tokens[tokens.length - 1].v === ";") tokens.pop();
  if (tokens.some((token) => token.k === "p" && token.v === ";")) return unrecognized; // more than one statement in one string
  const cursor = new Cursor(tokens);

  if (cursor.eat("alter")) {
    if (cursor.eat("table")) return analyzeAlterTable(cursor, statement, options);
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
      const parsed = parseIndexStatement(statement, options);
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
  /** `columnFactKey(...)` -> what the catalog says about the column's default (see {@link ColumnDefaultFacts}). Absent key: not inspected. */
  defaults?: Record<string, ColumnDefaultFacts>;
  /** `constraintFactKey(...)` / `indexFactKey(...)` of protections installed by the enforcement migrations (see schema-push-protected.ts). Dropping one is refused outright. */
  protectedConstraints?: string[];
  protectedIndexes?: string[];
  /** The target database's `standard_conforming_strings` (how ordinary `'...'` literals treat backslashes). Absent: unknown, which makes such literals unprovable. */
  standardConformingStrings?: boolean;
};

/**
 * `current`: the column's present default rendered by PostgreSQL (`pg_get_expr`), null when it has none. `proposed`: the statement's new default
 * rendered by PostgreSQL the same way (it parses the expression against the column's type), so equal text means the same default; null when
 * PostgreSQL could not render it. A key that is missing altogether means the column was not found or the inspection failed.
 */
export type ColumnDefaultFacts = { current: string | null; proposed: string | null };

// JSON keys: a name containing a dot cannot pose as a different schema/table/object.
export const constraintFactKey = (schema: string, table: string, name: string) => JSON.stringify([schema, table, name]);
export const indexFactKey = (schema: string, name: string) => JSON.stringify([schema, name]);
export const columnFactKey = (schema: string, table: string, column: string) => JSON.stringify([schema, table, column]);

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
  const defaults: { schema: string; table: string; column: string; expression: string }[] = [];
  for (const statement of statements) {
    const analysis = analyzeStatement(statement);
    if (analysis.type === "set_default") defaults.push({ schema: analysis.schema, table: analysis.table, column: analysis.column, expression: analysis.expression });
    if (analysis.type === "drop_constraint") constraints.push({ schema: analysis.schema, table: analysis.table, name: analysis.name });
    if (analysis.type === "drop_index") indexes.push({ schema: analysis.schema, name: analysis.name });
  }
  return { constraints, indexes, defaults };
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
  const canonicalOptions: CanonicalOptions = { standardConformingStrings: facts.standardConformingStrings };
  const protectedConstraints = new Set([...ALWAYS_PROTECTED_CONSTRAINTS, ...(facts.protectedConstraints ?? [])]);
  const protectedIndexes = new Set(facts.protectedIndexes ?? []);
  const analyses = statements.map((statement) => ({ statement: norm(statement), analysis: analyzeStatement(statement, canonicalOptions) }));
  const addedConstraints = analyses.flatMap(({ analysis }) => (analysis.type === "add_constraint" ? [analysis] : []));
  const createdIndexes = analyses.flatMap(({ analysis }) => (analysis.type === "create_index" ? [analysis] : []));
  const usedAdds = new Set<unknown>();
  const findings: PlanFinding[] = [];
  const add = (kind: PlanFindingKind, statement: string) => findings.push({ kind, statement });

  for (const { statement, analysis } of analyses) {
    if (analysis.type === "finding") { add(analysis.kind, statement); continue; }
    if (analysis.type === "drop_constraint") {
      const key = constraintFactKey(analysis.schema, analysis.table, analysis.name);
      const candidates = addedConstraints.filter((added) => added.schema === analysis.schema && added.table === analysis.table && added.name === analysis.name);
      const live = facts.constraints[key];
      const before = live === undefined ? null : canonicalConstraint(live, canonicalOptions);
      const [only] = candidates;
      if (candidates.length === 1 && !usedAdds.has(only) && before !== null && before === only.canonical) usedAdds.add(only);
      else add(protectedConstraints.has(key) ? "protected_object_dropped" : "drop_constraint_unpaired", statement);
      continue;
    }
    if (analysis.type === "set_default") {
      // Policy: only RE-APPLYING the identical default (PostgreSQL renders old and new the same) is silent. Replacing a default, adding one
      // where none existed (inserts that used to fail or get NULL would start succeeding with a value), and any case the catalog cannot
      // settle are all reviewed.
      const known = facts.defaults?.[columnFactKey(analysis.schema, analysis.table, analysis.column)];
      if (!known || known.proposed === null) add("default_unverified", statement);
      else if (known.current === null) add("default_added", statement);
      else if (known.current !== known.proposed) add("default_changed", statement);
      continue;
    }
    if (analysis.type === "drop_index") {
      const live = facts.indexes[indexFactKey(analysis.schema, analysis.name)];
      const before = live === undefined ? null : parseIndexStatement(live, canonicalOptions);
      const candidates = createdIndexes.filter((created) => created.schema === analysis.schema && created.name === analysis.name);
      const [only] = candidates;
      if (before && before.canonical !== null && before.schema === analysis.schema && candidates.length === 1 && !usedAdds.has(only)
        && only.table === before.table && before.canonical === only.canonical) usedAdds.add(only);
      else add(protectedIndexes.has(indexFactKey(analysis.schema, analysis.name)) ? "protected_object_dropped" : "drop_index_unpaired", statement);
    }
  }
  return findings;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * The dry-run process
 * ------------------------------------------------------------------------------------------------------------- */

export type DryRunProcessResult = {
  status: number | null;
  signal?: string | null;
  error?: Error;
  stdout?: string | null;
  stderr?: string | null;
};

export type DryRunOutcome =
  | { ok: true; statements: string[]; diagnostics: string }
  /** drizzle-kit (or npm) did not run to a clean finish: non-zero exit, killed, timed out, or could not start. */
  | { ok: false; kind: "process_failed"; message: string; diagnostics: string }
  /** The process exited cleanly but what it printed is not a plan this guard can read. */
  | { ok: false; kind: "plan_unreadable"; message: string; diagnostics: string };

const tail = (text: string, lines: number) => text.replace(ANSI, "").split(/\r?\n/).filter((line) => line.trim() !== "").slice(-lines).join("\n");

/**
 * Turns the dry-run process result into a plan. Verified against the installed drizzle-kit: the plan and its approval prompt are written to
 * STDOUT in full, and stderr carries only incidental output (for example npm warnings). Only stdout is parsed, so a warning can neither
 * corrupt a valid plan nor be mistaken for part of one; stderr is kept for diagnostics. A process that did not exit 0 is a failure whatever it
 * printed, and an exit 0 whose stdout is not a recognisable plan (including a missing or truncated approval prompt) is unreadable -- neither is
 * ever treated as an empty plan.
 */
export function interpretDryRun(result: DryRunProcessResult): DryRunOutcome {
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const diagnostics = [tail(stderr, 30), tail(stdout, 30)].filter(Boolean).join("\n--- stdout ---\n");
  if (result.error) return { ok: false, kind: "process_failed", message: `drizzle-kit could not be run to completion (${result.error.message}).`, diagnostics };
  if (result.signal) return { ok: false, kind: "process_failed", message: `drizzle-kit was terminated by ${result.signal} (timeout or kill); its output may be incomplete.`, diagnostics };
  if (result.status !== 0) return { ok: false, kind: "process_failed", message: `drizzle-kit exited with status ${result.status ?? "unknown"}.`, diagnostics };
  try {
    return { ok: true, statements: parsePushPlan(stdout), diagnostics: tail(stderr, 30) };
  } catch (error) {
    return { ok: false, kind: "plan_unreadable", message: (error as Error).message, diagnostics };
  }
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Enum value additions
 * ------------------------------------------------------------------------------------------------------------- */

export type EnumHazard = {
  /** The `ALTER TYPE ... ADD VALUE` statement. */
  statement: string;
  type: string;
  /** Later statements that mention the type or the new value (or, for an unreadable addition, every later statement). */
  dependents: string[];
};

/** The `ALTER TYPE ... ADD VALUE` statements of a plan, with what each adds. `value` is null when the statement is not in a shape we can read. */
function enumAdditionsIn(statements: readonly string[]) {
  const out: { index: number; type: string; value: string | null }[] = [];
  statements.forEach((statement, index) => {
    const cursor = new Cursor(tokenize(statement).filter((token) => !(token.k === "p" && token.v === ";")));
    if (!cursor.eat("alter", "type")) return;
    const type = cursor.qname();
    if (!type || !cursor.eat("add", "value")) return;
    cursor.eat("if", "not", "exists");
    const literal = cursor.peek();
    out.push({ index, type: type.name, value: literal?.k === "str" ? literal.v : null });
  });
  return out;
}

/** How many enum values a plan adds. */
export const enumAdditionCount = (statements: readonly string[]) => enumAdditionsIn(statements).length;

/**
 * PostgreSQL does not let a transaction USE an enum value it added ("unsafe use of new enum value"; the value only exists for other
 * statements once the addition has committed). A plan applied atomically therefore cannot contain an addition followed by anything that
 * depends on it. Dependence is judged conservatively by NAME: any later statement that mentions the enum type, or the new value as a literal,
 * is a dependent; an addition whose value cannot be read treats every later statement as a dependent. Such a plan must not be applied (and
 * must not be silently split into several transactions: a later phase could then fail with the earlier one already committed).
 */
export function enumAdditionHazards(statements: readonly string[]): EnumHazard[] {
  const hazards: EnumHazard[] = [];
  for (const addition of enumAdditionsIn(statements)) {
    const later = statements.slice(addition.index + 1);
    const dependents = later.filter((statement) => {
      if (addition.value === null) return true;
      return tokenize(statement).some((token) =>
        ((token.k === "word" || token.k === "qid") && token.v === addition.type) || (token.k === "str" && token.v === addition.value));
    });
    if (dependents.length > 0) hazards.push({ statement: norm(statements[addition.index]), type: addition.type, dependents: dependents.map(norm) });
  }
  return hazards;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Server identity
 * ------------------------------------------------------------------------------------------------------------- */

/** The target server could not be identified reliably (missing or ambiguous identity). Carries no secret. */
export class ServerIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerIdentityError";
  }
}

/**
 * Where the connection ACTUALLY goes, WITHOUT credentials, query parameters or database name: `host:port`, or `socket:<dir>:port` for a local
 * socket. It is one ingredient of the server identity, never the whole of it (a hostname is not proof of identity).
 *
 * "Actually" is decided the way the installed driver decides it: node-postgres' `pg-connection-string` lets the query string override the
 * authority (`?host=`, `?port=`), an empty host falls back to the PGHOST environment variable, and a missing port to PGPORT. Rather than
 * mirror every override, this REJECTS (throws) any URL whose destination it cannot prove from the URL alone:
 *  - `hostaddr`, a repeated or comma-separated (multi-host) `host`/`port`;
 *  - a `host` override that is not an absolute socket directory, or any `host` override next to an authority host;
 *  - a `port` override outside a socket connection, or next to an authority port;
 *  - an empty authority host with no socket directory (the driver would read PGHOST from the environment);
 *  - an unreadable URL or port.
 * Accepted forms: `postgres://host[:port]/db`, `postgres://[::1]:port/db`, `postgres:///db?host=/socket/dir[&port=N]` and an
 * URL-encoded socket directory as the authority. A missing port is `PGPORT` when set, else 5432 (as the driver does). Errors never echo the URL.
 */
export function connectionTarget(databaseUrl: string, env: NodeJS.ProcessEnv = process.env): string {
  const refuse = (why: string): never => { throw new ServerIdentityError(`The database URL ${why}, so the target server cannot be identified.`); };
  let url: URL;
  try { url = new URL(databaseUrl); } catch { return refuse("could not be read"); }
  if (!/^postgres(ql)?:$/.test(url.protocol)) return refuse("is not a PostgreSQL URL");
  const params = url.searchParams;
  if (params.has("hostaddr")) return refuse("sets hostaddr, which overrides the host");
  const queryHosts = params.getAll("host");
  const queryPorts = params.getAll("port");
  if (queryHosts.length > 1 || queryPorts.length > 1) return refuse("repeats host or port");
  let authorityHost: string;
  try { authorityHost = decodeURIComponent(url.hostname).replace(/^\[|\]$/g, "").toLowerCase(); } catch { return refuse("has an unreadable host"); }
  const queryHost = queryHosts[0];
  const queryPort = queryPorts[0];
  if (authorityHost.includes(",") || (queryHost ?? "").includes(",") || (queryPort ?? "").includes(",")) return refuse("lists several hosts");

  let socketDirectory: string | null = null;
  if (queryHost !== undefined) {
    if (!queryHost.startsWith("/")) return refuse("overrides the host in its query string");
    if (authorityHost !== "") return refuse("names a host both in its authority and in its query string");
    socketDirectory = queryHost;
  } else if (authorityHost.startsWith("/")) {
    socketDirectory = authorityHost;
  } else if (authorityHost === "") {
    return refuse("has no host (the driver would take it from the environment)");
  }

  if (queryPort !== undefined && (socketDirectory === null || url.port !== "")) return refuse("overrides the port in its query string");
  const port = queryPort ?? (url.port !== "" ? url.port : (env.PGPORT?.trim() || "5432"));
  if (!/^[0-9]{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) return refuse("has an invalid port");
  return socketDirectory !== null ? `socket:${socketDirectory}:${port}` : `${authorityHost}:${port}`;
}

/**
 * Whether an approval that needs a server identity is blocked because the identity is only weak (the cluster identifier could not be read) and the
 * separate explicit flag was not given. Plans with nothing to approve, and disposable test databases, never need it.
 */
export function weakIdentityBlocksApproval(input: { findings: readonly PlanFinding[]; identity: ServerIdentity; argv: readonly string[]; disposable: boolean }): boolean {
  if (input.findings.length === 0 || input.disposable || input.identity.strong) return false;
  return !input.argv.includes("--accept-unverified-server-identity");
}

export type ServerIdentity = {
  /** Opaque, stable string that goes into the approval token. Contains no credentials. */
  id: string;
  /** True when the cluster's own `system_identifier` was read; false when only the weaker database/target facts are available. */
  strong: boolean;
};

/**
 * The identity an approval is scoped to: the cluster `system_identifier` (when readable), the database OID and name, and the connection target.
 * Each is checked for shape: anything missing or ambiguous throws, so an approval can never be scoped to a blank or colliding identity.
 *
 * Limits, stated plainly: `system_identifier` needs EXECUTE on `pg_control_system()` (superuser by default; it is often unavailable on managed
 * services), and on copy-on-write branching services (Neon) a branch inherits its parent's identifier and OIDs, so it identifies the lineage,
 * not the endpoint. That is why the connection target is part of the identity, and why an identity without `system_identifier` is `strong:
 * false` and needs a separate explicit flag instead of being silently accepted.
 */
export function buildServerIdentity(input: { systemIdentifier: string | null; databaseOid: string; databaseName: string; target: string }): ServerIdentity {
  if (input.systemIdentifier !== null && !/^[0-9]{5,}$/.test(input.systemIdentifier)) throw new ServerIdentityError("The server reported an unreadable system identifier.");
  if (!/^[0-9]+$/.test(input.databaseOid)) throw new ServerIdentityError("The server reported an unreadable database OID.");
  if (!input.databaseName) throw new ServerIdentityError("The server reported no database name.");
  if (!input.target) throw new ServerIdentityError("The connection target is unknown.");
  const id = JSON.stringify({ v: 1, system: input.systemIdentifier, databaseOid: input.databaseOid, database: input.databaseName, target: input.target });
  return { id, strong: input.systemIdentifier !== null };
}

/** A statement in a canonical spelling: its tokens exactly as written (quoted identifiers and string literals untouched), single-space separated. */
export function canonicalStatement(statement: string): string {
  return tokenize(statement).map((token) => statement.slice(token.s, token.e)).join(" ");
}

/**
 * The approval token for one reviewed plan on one server and database (`scope` is the {@link ServerIdentity} id, not a bare database name,
 * so the same database name, catalog and plan on a different server yields a different token). It commits to EVERYTHING that will run: the complete executable plan -- every
 * statement, safe or dangerous, in execution order, after protected sequences were excluded -- plus the database name and the live
 * definitions of the constraints and indexes the plan drops, plus the fingerprint of the whole protected catalog (RLS flags, policies,
 * triggers, columns, constraints, indexes: state that is not in the SQL text but is what the operator actually reviewed). Changing any
 * statement, its order, the database, a dropped object's definition or the catalog it was reviewed against changes the token, so an approval
 * can never be reused for a different replacement, an added or reordered statement, another database, or a changed protection.
 *
 * Serialized as JSON (strings are escaped and arrays are delimited), so statement boundaries cannot be forged by statement text. Statements
 * are whitespace-normalised by token (literals and quoted identifiers keep every character); their order is significant, except among adjacent
 * statements of the same kind (see {@link tokenPlanOrder}).
 */
/**
 * The shape of a statement, ignoring every name: statements with the same key are the same KIND of operation (drop a constraint, add a foreign
 * key, add a column, ...). Used only to recognise runs of interchangeable statements; `SET NOT NULL` and `DROP NOT NULL` are different keys.
 */
function runKey(statement: string): string {
  const tokens = tokenize(statement).filter((token) => !(token.k === "p" && token.v === ";"));
  const cursor = new Cursor(tokens);
  const word = () => (cursor.peek()?.k === "word" ? cursor.peek()!.v : "");
  const take = (count: number) => { const out: string[] = []; for (let n = 0; n < count; n += 1) { out.push(word()); cursor.i += 1; } return out.join(" "); };
  if (cursor.eat("alter", "table")) {
    cursor.eat("if", "exists"); cursor.eat("only"); cursor.qname();
    if (cursor.eat("add")) {
      if (cursor.eat("constraint")) { cursor.name(); return `alter-table add constraint ${take(2)}`; }
      return "alter-table add";
    }
    if (cursor.eat("alter")) { cursor.eat("column"); cursor.name(); return `alter-table alter ${take(2)}`; }
    return `alter-table ${take(3)}`;
  }
  return take(2);
}

/**
 * The plan in the order the token commits to. drizzle-kit emits independent statements of one kind (dozens of `DROP CONSTRAINT`, `ADD CONSTRAINT
 * ... FOREIGN KEY`, ...) in the physical order of PostgreSQL's catalog rows, which shifts with unrelated DDL, so the SAME plan can come back with
 * those statements permuted and a token over the literal order would flip for no reason. Adjacent statements of the same kind are therefore
 * sorted; the sequence of kinds, every statement, and the position of every differently-kinded statement still matter.
 */
export function tokenPlanOrder(statements: readonly string[]): string[] {
  const out: string[] = [];
  let run: string[] = [];
  let runKeyOf: string | null = null;
  const flush = () => { out.push(...run.sort()); run = []; };
  for (const statement of statements) {
    const key = runKey(statement);
    if (runKeyOf !== null && key !== runKeyOf) flush();
    runKeyOf = key;
    run.push(canonicalStatement(statement));
  }
  flush();
  return out;
}

export function planAcknowledgementToken(
  statements: readonly string[], scope: string, facts: PlanCatalogFacts = { constraints: {}, indexes: {} }, catalogFingerprint = "",
): string {
  const sorted = (record: Record<string, string>) => Object.keys(record).sort().map((key) => [key, record[key]]);
  const canonical = JSON.stringify({
    version: 2,
    database: scope,
    plan: tokenPlanOrder(statements),
    droppedConstraints: sorted(facts.constraints),
    droppedIndexes: sorted(facts.indexes),
    catalog: catalogFingerprint,
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

/**
 * Whether the command line acknowledges THIS plan. Fail closed: a plan with no findings needs nothing; otherwise (unless the database is a
 * disposable test database) there must be exactly one `--accept-plan=<token>` and it must equal the current token. A missing, empty,
 * malformed, repeated or stale token -- and `--force`, which is not a token -- never acknowledges anything.
 */
export function isPlanAcknowledged(input: { findings: readonly PlanFinding[]; token: string; argv: readonly string[]; disposable: boolean }): boolean {
  if (input.findings.length === 0 || input.disposable) return true;
  const supplied = input.argv.filter((arg) => arg.startsWith("--accept-plan=")).map((arg) => arg.slice("--accept-plan=".length));
  return supplied.length === 1 && /^[0-9a-f]{32}$/.test(supplied[0]) && supplied[0] === input.token;
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
