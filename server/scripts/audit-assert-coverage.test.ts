/**
 * The gate's own soundness, in both directions.
 *
 * `audit-assert-coverage.mjs` fails CI on any test block that reaches no assertion, which makes it a thing
 * other people's work depends on being right. Codex reviewed the first version of it on #1540 and found two
 * ways it was wrong, and both were real -- reproduced before being fixed:
 *
 *   1. Any options object carrying a `skip` property at all was excluded, whatever the value. So
 *      `test("x", { skip: false }, () => {})`, which Node RUNS, asserted nothing and passed the gate. The same
 *      went for `{ skip: !process.env.SOME_URL }`, the shape a dozen suites here use to skip without a
 *      database: outside CI they skip, and in CI they run, and the gate could not see them where it counted.
 *   2. Same-file helpers were collected into one name-keyed map, so the last declaration of a name won. An
 *      empty block passed because an unrelated block's same-named helper asserted, and a legitimate test
 *      reading through an outer helper was rejected because some later block declared an empty one.
 *
 * Each case below is a fixture written to a temporary directory -- NOT into the repository, where the
 * repository-wide scan would pick the fixtures up as real suites -- and the script is run over it as a
 * subprocess, the way CI runs it. A fixture that should be flagged and a fixture that should not are both
 * asserted, because a gate that flags everything and a gate that flags nothing fail in the same way.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SCRIPT = join(process.cwd(), "server/scripts/audit-assert-coverage.mjs");

type Run = { hits: { file: string; title: string }[]; unrecognised: string[]; status: number };

/** Run the auditor over one fixture source and return what it decided. */
function audit(source: string, { ci = false }: { ci?: boolean } = {}): Run {
  const dir = mkdtempSync(join(tmpdir(), "assert-coverage-fixture-"));
  try {
    writeFileSync(join(dir, "fixture.test.ts"), source);
    const args = [SCRIPT, "--json", dir];
    if (ci) args.push("--ci");
    let status = 0;
    let stdout = "";
    try {
      stdout = execFileSync(process.execPath, args, { cwd: process.cwd(), encoding: "utf8" });
    } catch (err) {
      const e = err as { status?: number; stdout?: string };
      status = e.status ?? -1;
      stdout = e.stdout ?? "";
    }
    const parsed = JSON.parse(stdout) as { hits: { file: string; title: string }[]; unrecognised: string[] };
    return { hits: parsed.hits, unrecognised: parsed.unrecognised, status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const titles = (r: Run) => r.hits.map((h) => h.title).sort();

test("a block asserting directly is not flagged", () => {
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    test("direct", () => { assert.equal(1, 1); });
  `);
  assert.deepEqual(titles(r), []);
});

test("a block with nothing in it is flagged", () => {
  const r = audit(`
    import test from "node:test";
    test("empty", () => {});
  `);
  assert.deepEqual(titles(r), ["empty"]);
});

test("an assertion reached through a same-file helper is not flagged", () => {
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    const arrowHelper = (n: number) => { assert.ok(n > 0); };
    function declaredHelper() { assert.equal(1, 1); }
    function oneMoreHop() { declaredHelper(); }
    test("via arrow", () => { arrowHelper(1); });
    test("via declaration", () => { declaredHelper(); });
    test("via two hops", () => { oneMoreHop(); });
    test("via rejects", async () => { await assert.rejects(async () => { throw new Error("x"); }); });
  `);
  assert.deepEqual(titles(r), []);
});

/* ---- Codex finding 1: only an unconditional skip may be excluded ---- */

test("skip: true and a string skip reason are excluded", () => {
  const r = audit(`
    import test from "node:test";
    test("off for good", { skip: true }, () => {});
    test("off with a reason", { skip: "no database here" }, () => {});
    test.skip("off by member call", () => {});
  `);
  assert.deepEqual(titles(r), []);
});

test("skip: false asserts nothing and Node runs it, so it is flagged", () => {
  const r = audit(`
    import test from "node:test";
    test("runs despite the skip property", { skip: false }, () => {});
  `);
  assert.deepEqual(
    titles(r),
    ["runs despite the skip property"],
    "the first version of the gate excluded any object with a skip property, whatever its value",
  );
});

test("a conditional skip is flagged, because in CI the condition is false and the block runs", () => {
  const r = audit(`
    import test from "node:test";
    const noDb = !process.env.SOME_TEST_URL;
    test("conditionally skipped", { skip: noDb }, () => {});
    test("shorthand skip", { skip: noDb }, () => {});
  `);
  assert.deepEqual(titles(r), ["conditionally skipped", "shorthand skip"]);
});

/* ---- Codex finding 2: helpers resolve to their lexical binding ---- */

test("an empty block is flagged even when an unrelated block has an asserting helper of the same name", () => {
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    test("empty through a shadowed name", () => {
      const verify = () => { /* nothing */ };
      verify();
    });
    test("unrelated, and its own verify does assert", () => {
      const verify = () => { assert.equal(1, 1); };
      verify();
    });
  `);
  assert.deepEqual(
    titles(r),
    ["empty through a shadowed name"],
    "a flat name-keyed helper map let the later declaration vouch for the earlier block",
  );
});

test("a block reading through an asserting outer helper is not flagged when a later block shadows the name", () => {
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    const verify = (n: number) => { assert.equal(n, n); };
    test("legitimately asserts through the outer helper", () => { verify(1); });
    test("declares an empty verify of its own and asserts directly", () => {
      const verify = () => { /* nothing */ };
      verify();
      assert.ok(true);
    });
  `);
  assert.deepEqual(
    titles(r),
    [],
    "the same flat map rejected a valid test because an unrelated inner declaration won the name",
  );
});

/* ---- Alias resolution, and the honest denominator ---- */

test("a block declared through a local alias of test is examined, not invisible", () => {
  const r = audit(`
    import test from "node:test";
    const url = process.env.SOME_TEST_URL;
    const postgresTest = url ? test : test.skip;
    postgresTest("empty, declared through an alias", () => {});
  `);
  assert.deepEqual(titles(r), ["empty, declared through an alias"]);
  assert.deepEqual(r.unrecognised, [], "the alias is resolved, so the file counts as examined");
});

test("a file whose test-declaring call is not recognised is reported rather than counted as clean", () => {
  const r = audit(`
    import { test } from "node:test";
    const wrapped = (...args: unknown[]) => (test as unknown as (...a: unknown[]) => void)(...args);
    wrapped("invisible to the detector", () => {});
  `);
  assert.deepEqual(titles(r), []);
  assert.equal(r.unrecognised.length, 1, "an unexamined file must not read as an examined one");
});

/* ---- The gate itself ---- */

test("--ci exits non-zero on a hit and zero without one", () => {
  const bad = audit(`
    import test from "node:test";
    test("empty", () => {});
  `, { ci: true });
  assert.equal(bad.status, 1, "a block that cannot fail must fail the build");

  const good = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    test("fine", () => { assert.ok(true); });
  `, { ci: true });
  assert.equal(good.status, 0);
});
