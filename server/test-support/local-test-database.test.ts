import test from "node:test";
import assert from "node:assert/strict";
import { parseLocalTestDatabaseUrl } from "./local-test-database";

const accepted: Array<[string, { host: string; port: number; database: string }]> = [
  ["postgres://localhost/chefsire_test", { host: "localhost", port: 5432, database: "chefsire_test" }],
  ["postgres://127.0.0.1/chefsire_test", { host: "127.0.0.1", port: 5432, database: "chefsire_test" }],
  ["postgres://user:pass@localhost:5432/chefsire_test", { host: "localhost", port: 5432, database: "chefsire_test" }],
  ["postgres://user:pass@127.0.0.1:5432/chefsire_test", { host: "127.0.0.1", port: 5432, database: "chefsire_test" }],
  ["postgresql://user:pass@127.0.0.1:54329/test", { host: "127.0.0.1", port: 54329, database: "test" }],
  ["postgres://user:pass@[::1]:5432/chefsire_test", { host: "::1", port: 5432, database: "chefsire_test" }],
];
for (const [url, want] of accepted) {
  test(`accepts ${url}`, () => {
    const c = parseLocalTestDatabaseUrl(url);
    assert.equal(c.host, want.host);
    assert.equal(c.port, want.port);
    assert.equal(c.database, want.database);
  });
}

const rejected = [
  // remote / private / wildcard hosts
  "postgres://prod.example.com/chefsire_test",
  "postgres://neon.example.com/chefsire_test",
  "postgres://ep-cool-123.us-east-2.aws.neon.tech/neondb_test?sslmode=require",
  "postgres://u:p@ep-cool-123.us-east-2.aws.neon.tech/neondb",
  "postgres://10.0.0.5/chefsire_test",
  "postgres://192.168.1.10/chefsire_test",
  "postgres://0.0.0.0/chefsire_test",
  "postgres://[::]/chefsire_test",
  "postgres://127.0.0.2/chefsire_test",
  "postgres://localhost.example.com/chefsire_test",
  "postgres://127.0.0.1.example.com/chefsire_test",
  "postgres://localhost,prod.example.com/chefsire_test",
  // trusted-looking text outside the host field
  "postgres://localhost@prod.example.com/chefsire",
  "postgres://localhost@prod.example.com/chefsire_test",
  "postgres://user:localhost@prod.example.com/chefsire_test",
  "postgres://user:127.0.0.1@prod.example.com/chefsire_test",
  "postgres://prod.example.com/localhost",
  "postgres://prod.example.com/127.0.0.1_test",
  "postgres://prod.example.com/db?host=localhost",
  "postgres://prod.example.com/chefsire_test?host=localhost",
  "postgres://prod.example.com/tmp",
  "postgres://prod.example.com/chefsire_test?socket=/tmp",
  "postgres://prod.example.com/chefsire_test?host=/tmp",
  "postgres://prod.example.com/chefsire_test#localhost",
  "postgres://u%40localhost:p@prod.example.com/chefsire_test",
  // loopback host but a query string tries to redirect pg to somewhere else
  "postgres://localhost/chefsire_test?host=prod.example.com",
  "postgres://localhost/chefsire_test?hostaddr=203.0.113.9",
  "postgres://127.0.0.1/chefsire_test?host=/tmp",
  "postgres://localhost/chefsire_test?sslmode=require",
  // unix sockets / empty host (pg would fall back to PGHOST / default socket)
  "postgres:///chefsire_test",
  "postgres://%2Ftmp/chefsire_test",
  "postgres:///chefsire_test?host=/tmp",
  "postgres://:5432/chefsire_test",
  // database-name guard and shape
  "postgres://localhost/chefsire",
  "postgres://127.0.0.1/",
  "postgres://127.0.0.1",
  "postgres://127.0.0.1/a/b_test",
  // scheme / garbage
  "http://localhost/chefsire_test",
  "mysql://localhost/chefsire_test",
  "localhost/chefsire_test",
  "localhost",
  "",
  "not a url",
];
for (const url of rejected) {
  test(`rejects ${JSON.stringify(url)}`, () => {
    assert.throws(() => parseLocalTestDatabaseUrl(url), /refusing test database/);
  });
}

test("rejects undefined", () => assert.throws(() => parseLocalTestDatabaseUrl(undefined), /refusing test database/));

test("accepted config never carries a query/host override", () => {
  const c = parseLocalTestDatabaseUrl("postgres://user:p%40ss@127.0.0.1:5432/chefsire_test");
  assert.deepEqual(c, { host: "127.0.0.1", port: 5432, user: "user", password: "p@ss", database: "chefsire_test" });
});
