/**
 * A throw-away database for tests that create or drop tables (Stability Phase 2C).
 *
 * Several PostgreSQL-backed suites share one TEST_DATABASE_URL database and some depend on tables an earlier file left behind. A suite that
 * DROPs/recreates `users` there changes what the next file sees. These suites therefore work in their own database, created from the
 * (already loopback-guarded) test URL and dropped afterwards. The name keeps the "test" marker the guard requires.
 */
import pg from "pg";
import { randomBytes } from "node:crypto";
import { parseLocalTestDatabaseUrl } from "./local-test-database";

export async function createScratchDatabase(raw: string, label: string): Promise<{ url: string; drop(): Promise<void> }> {
  const base = parseLocalTestDatabaseUrl(raw);
  const name = `${base.database}_${label}_test_${randomBytes(3).toString("hex")}`.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const admin = new pg.Pool({ ...base, max: 1 });
  await admin.query(`CREATE DATABASE "${name}"`);
  const auth = base.user ? `${encodeURIComponent(base.user)}${base.password ? `:${encodeURIComponent(base.password)}` : ""}@` : "";
  const url = `postgres://${auth}${base.host}:${base.port}/${name}`;
  parseLocalTestDatabaseUrl(url); // the derived URL passes the same guard
  return {
    url,
    async drop() {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => {});
      await admin.end().catch(() => {});
    },
  };
}
