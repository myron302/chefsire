/**
 * Schema coverage guard. Every table this repository creates must be either DECLARED in the Drizzle schema (managed by push) or listed in the
 * unmanaged registry (hidden from push by `tablesFilter`). A table that is neither would be silently dropped by an unfiltered push, and a
 * table in both would be a second source of truth.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { declaredTableNames } from "../../shared/schema-managed-tables";
import { UNMANAGED_TABLES } from "../../shared/schema-unmanaged-tables";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN_DIRS = ["server", "migrations", "scripts", "shared"];

function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(sql|ts|js)$/.test(entry) && !/\.test\.ts$/.test(entry) && !full.includes(`${path.sep}test-support${path.sep}`)) out.push(full);
  }
  return out;
}

function tablesCreatedByRepository(): Map<string, string> {
  const created = new Map<string, string>();
  const pattern = /CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi;
  for (const dir of SCAN_DIRS) {
    for (const file of files(path.join(ROOT, dir))) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(pattern)) if (!created.has(match[1].toLowerCase())) created.set(match[1].toLowerCase(), path.relative(ROOT, file));
    }
  }
  return created;
}

const declared = new Set(declaredTableNames());

test("the managed table list is derived from the schema and covers the financial and account tables", () => {
  assert.ok(declared.size > 100, `declared ${declared.size}`);
  for (const table of ["users", "orders", "payouts", "commissions", "catering_booking_payments", "catering_attempt_square_payments",
    "square_oauth_transactions", "square_merchant_revocations", "meal_plan_purchases", "drink_collection_purchases"]) {
    // Tables this repository declares for money, entitlement and account state must be managed (or the assertion names the gap).
    if (!declared.has(table)) assert.ok(UNMANAGED_TABLES[table], `${table} is neither declared nor registered`);
  }
  assert.ok(declared.has("users") && declared.has("orders") && declared.has("payouts"));
});

test("drizzle.config.ts restricts push to exactly the declared tables", async () => {
  process.env.DATABASE_URL ||= "postgres://unused@127.0.0.1:1/unused_test";
  const config = (await import("../../drizzle.config")).default as { tablesFilter?: string[]; schema?: string[] | string };
  assert.deepEqual([...(config.tablesFilter ?? [])].sort(), [...declared].sort());
  assert.ok(Array.isArray(config.tablesFilter) && config.tablesFilter.length > 0, "an empty filter would mean 'manage everything' to drizzle-kit");
});

test("no table is both declared and registered as unmanaged", () => {
  for (const name of Object.keys(UNMANAGED_TABLES)) assert.equal(declared.has(name), false, `${name} is declared; remove it from the unmanaged registry`);
});

test("every table the repository creates is declared or registered (no table can fall outside both)", () => {
  const stray = [...tablesCreatedByRepository()].filter(([name]) => !declared.has(name) && !UNMANAGED_TABLES[name]);
  assert.deepEqual(stray.map(([name, file]) => `${name} (${file})`), [], "declare it in the schema (with a parity test) or register it in shared/schema-unmanaged-tables.ts");
});

test("every registry entry still has a creator in the repository, or is explicitly external", () => {
  const created = tablesCreatedByRepository();
  const dead = Object.entries(UNMANAGED_TABLES).filter(([name, info]) => info.kind !== "external" && !created.has(name)).map(([name]) => name);
  assert.deepEqual(dead, [], "stale registry entries");
});

test("money, evidence and account tables are never silently registered as disposable", () => {
  for (const [name, info] of Object.entries(UNMANAGED_TABLES)) {
    if (/(payment|payout|commission|refund|ledger|purchase|order|invoice)/.test(name)) assert.fail(`${name}: financial tables must be declared, not unmanaged`);
    assert.ok(info.origin.length > 0);
  }
  assert.equal(UNMANAGED_TABLES.legacy_credential_invalidations.kind, "audit_evidence");
  assert.equal(UNMANAGED_TABLES._app_migrations.kind, "migration_ledger");
});
