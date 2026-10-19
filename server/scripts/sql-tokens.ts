/**
 * PostgreSQL-faithful lexer used by the migration safety guard. It produces tokens only; it never interprets
 * them. Comments are dropped; string literals, quoted identifiers and dollar-quoted bodies each become ONE token,
 * so nothing inside them can be mistaken for SQL keywords. Anything that cannot be lexed (unterminated comment,
 * string, identifier or dollar quote) throws, and the guard treats that as a rejection.
 */
export type Token = {
  kind: "word" | "qident" | "string" | "number" | "punct";
  /** Words are upper-cased; every other kind keeps its source text. */
  text: string;
  /** string/qident: the unquoted content (for dollar quotes, the body). */
  value: string;
  /** string tokens only: how the literal was written. Escape (E'') and unicode (U&'') are not decoded. */
  flavor?: "plain" | "escape" | "unicode" | "dollar";
};

const WORD_START = /[A-Za-z_\u0080-￿]/;
const WORD_CHAR = /[A-Za-z0-9_$\u0080-￿]/;

export function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  const n = sql.length;
  let i = 0;

  const readQuoted = (start: number, quote: string, backslash: boolean) => {
    let j = start + 1;
    let value = "";
    while (j < n) {
      if (backslash && sql[j] === "\\") { value += sql.slice(j, j + 2); j += 2; }
      else if (sql[j] === quote && sql[j + 1] === quote) { value += quote; j += 2; }
      else if (sql[j] === quote) return { value, end: j + 1 };
      else value += sql[j++];
    }
    throw new Error(quote === "'" ? "unterminated string literal" : "unterminated quoted identifier");
  };

  while (i < n) {
    const c = sql[i];
    if (/\s/.test(c)) {
      i++;
    } else if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? n : end + 1;
    } else if (sql.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql.startsWith("/*", i)) { depth++; i += 2; }
        else if (sql.startsWith("*/", i)) { depth--; i += 2; }
        else i++;
      }
      if (depth > 0) throw new Error("unterminated block comment");
    } else if (c === "'") {
      const { value, end } = readQuoted(i, "'", false);
      tokens.push({ kind: "string", text: sql.slice(i, end), value, flavor: "plain" });
      i = end;
    } else if (c === '"') {
      const { value, end } = readQuoted(i, '"', false);
      tokens.push({ kind: "qident", text: sql.slice(i, end), value });
      i = end;
    } else if (c === "$") {
      const tag = sql.slice(i).match(/^\$(?:[A-Za-z_\u0080-￿][A-Za-z0-9_\u0080-￿]*)?\$/)?.[0];
      if (tag) {
        const close = sql.indexOf(tag, i + tag.length);
        if (close === -1) throw new Error("unterminated dollar-quoted body");
        tokens.push({ kind: "string", text: sql.slice(i, close + tag.length), value: sql.slice(i + tag.length, close), flavor: "dollar" });
        i = close + tag.length;
      } else {
        tokens.push({ kind: "punct", text: "$", value: "$" });
        i++;
      }
    } else if (WORD_START.test(c)) {
      let j = i + 1;
      while (j < n && WORD_CHAR.test(sql[j])) j++;
      const word = sql.slice(i, j).toUpperCase();
      if (sql[j] === "'" && (word === "E" || word === "B" || word === "X" || word === "N")) {
        const { value, end } = readQuoted(j, "'", word === "E");
        tokens.push({ kind: "string", text: sql.slice(i, end), value, flavor: word === "E" ? "escape" : "plain" });
        i = end;
      } else if (word === "U" && sql[j] === "&" && sql[j + 1] === "'") {
        const { value, end } = readQuoted(j + 1, "'", false);
        tokens.push({ kind: "string", text: sql.slice(i, end), value, flavor: "unicode" });
        i = end;
      } else if (word === "U" && sql[j] === "&" && sql[j + 1] === '"') {
        const { value, end } = readQuoted(j + 1, '"', false);
        tokens.push({ kind: "qident", text: sql.slice(i, end), value });
        i = end;
      } else {
        tokens.push({ kind: "word", text: word, value: sql.slice(i, j) });
        i = j;
      }
    } else if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < n && /[0-9A-Za-z_.]/.test(sql[j])) j++;
      tokens.push({ kind: "number", text: sql.slice(i, j), value: sql.slice(i, j) });
      i = j;
    } else {
      tokens.push({ kind: "punct", text: c, value: c });
      i++;
    }
  }
  return tokens;
}
