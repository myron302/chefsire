/**
 * Shared scaffolding for the Phase 3C authorization suites: a REAL local PostgreSQL (CS_TEST_PG_URL, loopback-only
 * guard), the real routers, the real auth_version-aware requireAuth. Tables are built from the Drizzle schema so the
 * SQL the routes render is executed unchanged. Importing this module has side effects (it re-points `pool`).
 */
import "./auth-test-env";
import pg from "pg";
import { getTableColumns, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { parseLocalTestDatabaseUrl } from "./local-test-database";
import { testAuthHeader } from "./auth-test-env";

process.env.DATABASE_URL ||= "postgres://u:p@p3c-tests.invalid/none";
export const PG_URL = process.env.CS_TEST_PG_URL;

export async function connectLocalPg() {
  const local = new pg.Pool(parseLocalTestDatabaseUrl(PG_URL));
  const { pool } = await import("../db/index");
  (pool as any).connect = () => local.connect();
  (pool as any).query = (q: any, params?: any[]) => (typeof q === "string" ? local.query(q, params) : local.query(params ? { ...q, values: params } : q));
  return local;
}

const dialect = new PgDialect();
const TYPES: Record<string, string> = { PgInteger: "integer", PgBoolean: "boolean", PgTimestamp: "timestamp", PgJsonb: "jsonb", PgNumeric: "numeric", PgReal: "real", PgSerial: "serial" };

export function ddl(table: any, name: string, extra = "") {
  const cols = Object.values(getTableColumns(table)).map((c: any) => {
    const type = c.columnType === "PgArray" ? "text[]" : TYPES[c.columnType] ?? "text";
    let def = "";
    if (c.hasDefault && c.default !== undefined) {
      def = typeof c.default === "object" && c.default !== null && "queryChunks" in c.default
        ? ` DEFAULT ${dialect.sqlToQuery(c.default as SQL).sql}`
        : typeof c.default === "string" ? ` DEFAULT '${c.default.replace(/'/g, "''")}'` : ` DEFAULT ${c.default}`;
    }
    const notNull = c.notNull && !c.primary && !def ? " NOT NULL" : "";
    return `${c.name} ${type}${c.primary ? " PRIMARY KEY" : ""}${def}${notNull}`;
  });
  return `CREATE TABLE ${name} (${cols.join(",")}${extra})`;
}

export type Caller = string | null;
export function makeCaller(getBase: () => string, idOf: (who: string) => string) {
  return async function call(method: string, path: string, as: string | "anon" = "anon", body?: unknown) {
    const res = await fetch(getBase() + path, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(as === "anon" ? {} : testAuthHeader(idOf(as))) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
  };
}
