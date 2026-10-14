import test from "node:test";
import assert from "node:assert/strict";
import { resolveDbSettings } from "./db-config";

test("defaults: bounded connection timeout, no statement timeout, bounded auth lookup", () => {
  const s = resolveDbSettings({});
  assert.deepEqual({ ...s }, { connectionTimeoutMillis: 15_000, statementTimeoutMs: 0, authLookupTimeoutMs: 8_000, warnings: [] });
});

test("overrides within range are honoured", () => {
  const s = resolveDbSettings({ DB_CONNECT_TIMEOUT_MS: "5000", DB_STATEMENT_TIMEOUT_MS: "30000", AUTH_LOOKUP_TIMEOUT_MS: "2500" });
  assert.equal(s.connectionTimeoutMillis, 5000);
  assert.equal(s.statementTimeoutMs, 30000);
  assert.equal(s.authLookupTimeoutMs, 2500);
  assert.deepEqual(s.warnings, []);
});

test("invalid values never disable a protection: default is used and a warning names the variable (not a value that could be a secret)", () => {
  for (const bad of ["0", "-1", "abc", "1.5", "999", "999999999", " ", "1e4", "Infinity"]) {
    const s = resolveDbSettings({ DB_CONNECT_TIMEOUT_MS: bad });
    assert.equal(s.connectionTimeoutMillis, 15_000, `DB_CONNECT_TIMEOUT_MS=${JSON.stringify(bad)}`);
    if (bad.trim() !== "") assert.match(s.warnings.join("\n"), /DB_CONNECT_TIMEOUT_MS/);
  }
  assert.equal(resolveDbSettings({ AUTH_LOOKUP_TIMEOUT_MS: "0" }).authLookupTimeoutMs, 8_000, "0 must not switch the auth bound off");
});

test("statement timeout: 0 is the explicit 'off'; out-of-range falls back to off", () => {
  assert.equal(resolveDbSettings({ DB_STATEMENT_TIMEOUT_MS: "0" }).statementTimeoutMs, 0);
  assert.equal(resolveDbSettings({ DB_STATEMENT_TIMEOUT_MS: "10" }).statementTimeoutMs, 0);
  assert.equal(resolveDbSettings({ DB_STATEMENT_TIMEOUT_MS: "10" }).warnings.length, 1);
});

test("configuration never reads or reports DATABASE_URL", () => {
  const s = resolveDbSettings({ DATABASE_URL: "postgres://user:hunter2@db.example/neon", DB_CONNECT_TIMEOUT_MS: "x" });
  assert.ok(!JSON.stringify(s).includes("hunter2"));
});
