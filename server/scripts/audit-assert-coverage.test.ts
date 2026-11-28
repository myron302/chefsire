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

type Run = {
  hits: { file: string; title: string }[];
  viaCallback: { file: string; title: string }[];
  unrecognised: string[];
  status: number;
};

/** Run the auditor over one fixture source and return what it decided. */
function audit(source: string, { ci = false, ext = "ts" }: { ci?: boolean; ext?: string } = {}): Run {
  const dir = mkdtempSync(join(tmpdir(), "assert-coverage-fixture-"));
  try {
    writeFileSync(join(dir, `fixture.test.${ext}`), source);
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
    const parsed = JSON.parse(stdout) as {
      hits: { file: string; title: string }[];
      viaCallback: { file: string; title: string }[];
      unrecognised: string[];
    };
    return { hits: parsed.hits, viaCallback: parsed.viaCallback ?? [], unrecognised: parsed.unrecognised, status };
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

/* ---- Codex's second round, on the fixed version: three more holes, all reproduced first ---- */

test("a parameter shadowing a helper name stops the search, so the block reads as empty", () => {
  // Node runs this and passes while asserting nothing -- confirmed with a probe. The `verify()` inside `run`
  // is the PARAMETER, whose value comes from the call site, and the first fix walked past it to the unrelated
  // outer `verify`, which asserts. "Not declared here" and "bound here to something I cannot follow" had to
  // stop being the same answer.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    function verify() { assert.fail("unused"); }
    function run(verify: () => void) { verify(); }
    test("empty through a shadowing parameter", () => run(() => {}));
  `);
  assert.deepEqual(titles(r), ["empty through a shadowing parameter"]);
});

test("a destructured parameter shadows just as a plain one does", () => {
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    const verify = () => { assert.fail("unused"); };
    function run({ verify }: { verify: () => void }) { verify(); }
    test("empty through a destructured parameter", () => run({ verify: () => {} }));
  `);
  assert.deepEqual(titles(r), ["empty through a destructured parameter"]);
});

test("a binding that is not a literal function shadows the outer helper of the same name", () => {
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    function verify() { assert.fail("unused"); }
    const make = () => () => {};
    test("empty through a non-literal binding", () => {
      const verify = make();
      verify();
    });
  `);
  assert.deepEqual(titles(r), ["empty through a non-literal binding"]);
});

test("a helper still resolves when nothing shadows it", () => {
  // The other direction of the same change: stopping at bindings must not stop at every call.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    function verify() { assert.equal(1, 1); }
    function run(fn: () => void) { fn(); verify(); }
    test("asserts through an unshadowed helper", () => run(() => {}));
  `);
  assert.deepEqual(titles(r), []);
});

test("a spread after a literal skip makes the skip conditional, so the block is audited", () => {
  // Node runs this and reports `ok`, not `# SKIP` -- confirmed. A later spread wins, so a check that looked
  // for a literal `skip: true` anywhere in the object excused a block that executes.
  const r = audit(`
    import test from "node:test";
    const options = { skip: false };
    test("empty, and the spread turns the skip off", { skip: true, ...options }, () => {});
  `);
  assert.deepEqual(titles(r), ["empty, and the spread turns the skip off"]);
});

test("a spread BEFORE a literal skip cannot override it, so that block is still excluded", () => {
  const r = audit(`
    import test from "node:test";
    const options = { skip: false };
    test("off for good", { ...options, skip: true }, () => {});
  `);
  assert.deepEqual(titles(r), [], "the later literal wins, so this one really is skipped");
});

test("JavaScript suites are discovered, not silently passed over", () => {
  // The extension filter matched only ts/tsx/mts, so three suites the workflow executes -- two .mjs and one
  // .cjs -- were never opened, and removing every assertion from one left the gate green. They were kept out
  // of the unrecognised report too, so the tool could not even tell on itself about them.
  for (const ext of ["mjs", "cjs", "js"]) {
    const r = audit(`
      import test from "node:test";
      test("empty ${ext} suite", () => {});
    `, { ext });
    assert.deepEqual(titles(r), [`empty ${ext} suite`], `a .${ext} suite must be scanned`);
  }
});

/* ---- Codex's third round: three more, every one a thing the tool could not see ---- */

test("a method that merely shares a name with an assertion is not one", () => {
  // `String.prototype.match` is not `assert.match`. Node runs this and it asserts nothing. A real suite,
  // sample-post-counts.postgres.test.ts, calls `seed.match(...)` for setup, so deleting its actual assertion
  // would have left the block reading as covered.
  const r = audit(`
    import test from "node:test";
    test("empty, but match looks like an assertion", () => {
      "anything".match(/missing/);
    });
  `);
  assert.deepEqual(titles(r), ["empty, but match looks like an assertion"]);
});

test("a matcher chained onto an assertion API still counts", () => {
  // The other direction of the receiver change: tightening must not reject expect-style chains.
  //
  // My first version of this fixture asserted that `(globalThis as any).assert(1)` counts, and it does not.
  // That was a WRONG EXPECTATION rather than a defect: the receiver of that call is `globalThis`, and the
  // whole point of the change is that the receiver decides. Recorded here rather than quietly deleted,
  // because a reader will otherwise wonder whether the rule is too strict. It is strict in the safe
  // direction -- an unrecognised receiver makes a block read as empty, which is a question in the report.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    declare const expect: (v: unknown) => { toBe: (v: unknown) => void; not: { toBe: (v: unknown) => void } };
    test("expect chain", () => { expect(1).toBe(1); });
    test("longer expect chain", () => { expect(1).not.toBe(2); });
    test("bare assert call", () => { assert(1); });
  `);
  assert.deepEqual(titles(r), []);
});

test("a computed key that cannot be read voids the skip decision", () => {
  // `{ skip: true, [key]: false }` with a computed key: Node runs it, and a later property wins.
  const r = audit(`
    import test from "node:test";
    const key = ["skip"].join("");
    test("empty, and a computed key turns the skip off", { skip: true, [key]: false }, () => {});
  `);
  assert.deepEqual(titles(r), ["empty, and a computed key turns the skip off"]);
});

test("a computed key that IS readable is read, not treated as unknown", () => {
  const r = audit(`
    import test from "node:test";
    test("off for good", { ["skip"]: true }, () => {});
  `);
  assert.deepEqual(titles(r), [], "a string-literal computed key is as good as a plain one");
});

test("an assertion in a helper that nothing calls does not count", () => {
  // The worst of the five in this file: deleting a helper's INVOCATION did not trip the gate as long as the
  // definition stayed inside the test body.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    test("empty, with an assertion in a helper nothing calls", () => {
      function unused() { assert.fail("never called"); }
    });
  `);
  assert.deepEqual(titles(r), ["empty, with an assertion in a helper nothing calls"]);
});

test("a callback handed straight to a call is still followed", () => {
  // The over-correction direction. Refusing to look inside any function would reject most of this repository:
  // forEach callbacks, assert.rejects bodies and promise executors all run.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    test("asserts inside a forEach callback", () => {
      [1, 2].forEach((n) => { assert.ok(n > 0); });
    });
    test("asserts inside an assert.rejects body", async () => {
      await assert.rejects(async () => { throw new Error("x"); });
    });
    test("asserts inside a promise executor", async () => {
      await new Promise<void>((resolve) => { assert.ok(true); resolve(); });
    });
    test("asserts through a named helper it does call", () => {
      const verify = () => { assert.equal(1, 1); };
      verify();
    });
  `);
  assert.deepEqual(titles(r), [], "every one of these runs its callback");
});

/* ---- Codex's fourth round: calling a property of a helper, and registering a callback ---- */

test("calling a property of a helper is not calling the helper", () => {
  // `verify.bind(null)` and `verify.toString()` run no assertion. Splitting the callee at the first dot
  // treated both as invocations, so replacing a real call with either silently bypassed the gate.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    function verify() { assert.fail("not invoked"); }
    test("only binds the helper", () => { verify.bind(null); });
    test("only stringifies the helper", () => { verify.toString(); });
    test("actually calls it", () => { verify(); });
  `);
  assert.deepEqual(titles(r), ["only binds the helper", "only stringifies the helper"]);
});

test("a callback a same-file helper calls by position is followed", () => {
  // The commonest shape here: a helper that sets up, calls what it was given, and tears down. This is a
  // resolved invocation, so it must NOT be reported -- and the parameter position matters, which the second
  // block checks: `ignoresIt` never calls `before`, so an assertion only there is not reached.
  //
  // My first version of this test expected the second block to be a HARD hit, and it is soft. That is the
  // design and not a defect, but the design is weaker here than it could be: an assertion is reachable by
  // SOME route, so the two-pass split files it as soft -- even though in this case the tool positively knows
  // the parameter is never called, which is stronger evidence than "an API I cannot resolve". Distinguishing
  // those would mean tracking WHY the strict pass failed. Recorded rather than hidden, because a reader
  // comparing this test against the header will otherwise think one of them is wrong.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    function withKeys(key: string, unused: undefined, fn: () => void) { fn(); }
    function ignoresIt(before: () => void, fn: () => void) { fn(); }
    test("asserts inside a helper-invoked callback", () => {
      withKeys("k", undefined, () => { assert.ok(true); });
    });
    test("asserts only in the argument the helper never calls", () => {
      ignoresIt(() => { assert.fail("never called"); }, () => {});
    });
  `);
  assert.deepEqual(titles(r), [], "the helper-invoked callback is followed, so neither is a hard hit");
  assert.deepEqual(
    r.viaCallback.map((h) => h.title),
    ["asserts only in the argument the helper never calls"],
    "the argument the helper never calls is reported in the soft category",
  );
});

test("a callback merely registered is reported apart, and does not fail the gate", () => {
  // Codex is right that registering is not calling, and the strict rule that closes it reports 276 blocks on
  // this repository -- most of them legitimate, because the callback goes through a value no parser can
  // follow. A 276-hit gate gets skimmed, and then its real hits get skimmed too. So this is reported in its
  // own category and --ci stays clean. The header explains the trade in full.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    import { EventEmitter } from "node:events";
    test("the listener is never called", () => {
      const emitter = new EventEmitter();
      emitter.on("never-emitted", () => { assert.fail("not invoked"); });
    });
  `, { ci: true });
  assert.deepEqual(titles(r), [], "not a hit: an assertion is reachable by some route");
  assert.deepEqual(
    r.viaCallback.map((h) => h.title),
    ["the listener is never called"],
    "but it is reported as reachable only through a callback this tool cannot resolve",
  );
  assert.equal(r.status, 0, "the soft category must not fail the build");
});

test("a block that reaches no assertion by any route still fails the gate", () => {
  const r = audit(`
    import test from "node:test";
    test("empty", () => {});
  `, { ci: true });
  assert.deepEqual(titles(r), ["empty"]);
  assert.deepEqual(r.viaCallback, []);
  assert.equal(r.status, 1);
});

/* ---- Codex's fifth round: binding an assertion, and a callback passed by name ---- */

test("binding an assertion is not making one, but .call still is", () => {
  // `assert.equal.bind(null, 1, 2)` is rooted at `assert`, so reducing the chain to its root counted it.
  // Node runs the block and asserts nothing. `call` and `apply` DO execute, so they must still count --
  // which is the half that stops this becoming "reject anything with a dot in it".
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    test("only binds an assertion", () => { assert.equal.bind(null, 1, 2); });
    test("only stringifies an assertion", () => { assert.equal.toString(); });
    test("calls one through .call", () => { assert.equal.call(null, 1, 1); });
    test("calls one through .apply", () => { assert.equal.apply(null, [1, 1]); });
  `);
  assert.deepEqual(titles(r), ["only binds an assertion", "only stringifies an assertion"]);
});

test("an asserting callback passed BY NAME at a position that runs is not a hit", () => {
  // The only one of the twelve findings that was a false POSITIVE, and so the only one that would have
  // broken someone's build: extracting an inline callback into a same-file helper made a passing test fail
  // the gate. The positional analysis knew argument zero runs; walking the identifier never reached its body.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    function run(cb: () => void) { cb(); }
    const verify = () => { assert.ok(true); };
    function silent() { /* nothing */ }
    test("valid: an asserting named callback at an invoked position", () => run(verify));
    test("empty: a named callback that asserts nothing", () => run(silent));
  `, { ci: true });
  assert.deepEqual(titles(r), ["empty: a named callback that asserts nothing"]);
  assert.equal(r.status, 1, "the empty one is still a hit");
});

test("a named asserting callback at a position the helper never calls does not count", () => {
  // The position has to matter here too, not just for inline arrows. Without this the resolver would clear a
  // block because SOME argument happens to name an asserting function, whether or not the helper calls it --
  // which is the round-three mistake (an assertion in a helper nothing calls) wearing an identifier.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    function ignoresIt(before: () => void, fn: () => void) { fn(); }
    const asserter = () => { assert.ok(true); };
    test("the asserting callback goes to the argument never called", () => {
      ignoresIt(asserter, () => {});
    });
  `);
  assert.deepEqual(titles(r), ["the asserting callback goes to the argument never called"]);
});

/* ---- Codex's sixth round: both of these were false positives that failed CI on correct code ---- */

test("a helper invoked through .call or .apply is reached, while bind and toString are not", () => {
  // Round five restricted helper resolution to bare identifiers so that `verify.bind(null)` would stop
  // counting -- and over-corrected into failing CI on two forms that genuinely run the helper.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    function verify() { assert.ok(true); }
    test("valid through .call", () => { verify.call(null); });
    test("valid through .apply", () => { verify.apply(null, []); });
    test("empty through .bind", () => { verify.bind(null); });
    test("empty through .toString", () => { verify.toString(); });
  `, { ci: true });
  assert.deepEqual(titles(r), ["empty through .bind", "empty through .toString"]);
  assert.equal(r.status, 1, "the two that never run the body are still hits");
});

test("a named callback handed to an API we cannot resolve is soft, not a build failure", () => {
  // `emitter.once("ready", verify); emitter.emit("ready")` runs the assertion. The gate failed CI on it while
  // the INLINE-listener version was correctly soft, so extracting an inline listener into a named one broke
  // the build. Ignorance about an API belongs in the soft category; it is not knowledge that nothing runs.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    import { EventEmitter } from "node:events";
    const verify = () => { assert.ok(true); };
    test("a named listener that is actually emitted", () => {
      const emitter = new EventEmitter();
      emitter.once("ready", verify);
      emitter.emit("ready");
    });
  `, { ci: true });
  assert.deepEqual(titles(r), [], "an unresolved API is ignorance, not a hard hit");
  assert.deepEqual(r.viaCallback.map((h) => h.title), ["a named listener that is actually emitted"]);
  assert.equal(r.status, 0);
});

test("a resolved helper that demonstrably ignores the argument is still a hard hit", () => {
  // The other side of the same change, and the line between the two: here the tool can READ that the
  // parameter is never called, so "nothing runs" is knowledge rather than ignorance, and it stays hard.
  const r = audit(`
    import test from "node:test";
    import assert from "node:assert/strict";
    function ignoresIt(before: () => void, fn: () => void) { fn(); }
    const asserter = () => { assert.ok(true); };
    test("the asserting callback goes to the argument never called", () => {
      ignoresIt(asserter, () => {});
    });
  `, { ci: true });
  assert.deepEqual(titles(r), ["the asserting callback goes to the argument never called"]);
  assert.equal(r.status, 1);
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
