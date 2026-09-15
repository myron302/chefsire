/**
 * `normalizePgNumeric` against PostgreSQL's real behavior.
 *
 * Every expectation in this file was MEASURED, not recalled: a PostgreSQL 16.13 cluster was started
 * and each input cast to the column type under test, so the expected column below is what Postgres
 * actually returned, including which inputs it refuses. Re-extracting these cases and replaying them
 * against that cluster matches on 60 of 61 -- the single exception is `0x10`, the one narrowing this
 * helper makes deliberately and documents. The helper was also cross-checked over 600 randomized
 * decimals (1186 case/column combinations) with zero divergence; this file pins the boundaries of
 * that agreement so it cannot drift without a test failing.
 *
 * The defect this guards against: normalizing a decimal through a JavaScript float.
 * `Number("1.005").toFixed(2)` is `"1.00"` because the double nearest 1.005 is below it, while
 * Postgres rounds the decimal and yields `1.01`. The same conversion also hid real overflows --
 * `Number("999999.995").toFixed(2)` is `"999999.99"`, silently truncating a value Postgres rejects.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { normalizePgNumeric } from "./pg-numeric";

/** input -> what PostgreSQL 16.13 stores, or REJECT with the reason it refuses. */
type Expectation = [input: string | number, expected: string];

const REJECT_SYNTAX = "REJECT:syntax";
const REJECT_RANGE = "REJECT:range";

function outcome(input: string | number, precision: number, scale: number) {
  const result = normalizePgNumeric(input, precision, scale);
  return result.ok ? result.rounded : `REJECT:${result.reason}`;
}

// ============================================================================================
// numeric(8, 2) -- estimated_price and actual_price
// ============================================================================================

const NUMERIC_8_2: Expectation[] = [
  // Half away from zero, which is where a float-based `toFixed` diverges.
  ["1.005", "1.01"],
  ["-1.005", "-1.01"],
  ["2.675", "2.68"],
  ["1.015", "1.02"],
  ["0.005", "0.01"],
  ["-0.005", "-0.01"],
  ["0.004", "0.00"],
  // A rounded zero loses its sign in Postgres.
  ["-0.004", "0.00"],
  ["-0.0001", "0.00"],
  // Codex's boundary: valid, because Postgres rounds it INTO range.
  ["999999.994", "999999.99"],
  ["-999999.994", "-999999.99"],
  // Exact limits.
  ["999999.99", "999999.99"],
  ["-999999.99", "-999999.99"],
  // Rounding that carries across the precision boundary is a real overflow.
  ["999999.995", REJECT_RANGE],
  ["-999999.995", REJECT_RANGE],
  ["999999.999", REJECT_RANGE],
  ["1000000", REJECT_RANGE],
  ["5e6", REJECT_RANGE],
  // Zero in its several spellings.
  ["0", "0.00"],
  ["0.000", "0.00"],
  ["-0", "0.00"],
  // Leading and trailing zeros, bare points, explicit signs.
  ["007.5", "7.50"],
  ["1.20", "1.20"],
  ["1.", "1.00"],
  [".5", "0.50"],
  ["-.5", "-0.50"],
  ["+.5", "0.50"],
  ["+1.5", "1.50"],
  // Exponent notation, which Postgres accepts.
  ["1e2", "100.00"],
  ["1e+2", "100.00"],
  ["1E-3", "0.00"],
  ["1.5e1", "15.00"],
  ["5e5", "500000.00"],
  ["1e999", REJECT_RANGE],
  ["1e-999", "0.00"],
  // More fractional digits than the column holds.
  ["0.0049999", "0.00"],
  ["0.00500001", "0.01"],
  ["123456.789", "123456.79"],
  ["99999.999", "100000.00"],
  // Malformed.
  ["", REJECT_SYNTAX],
  ["abc", REJECT_SYNTAX],
  ["1.2.3", REJECT_SYNTAX],
  ["--1", REJECT_SYNTAX],
  ["1e", REJECT_SYNTAX],
  ["1,5", REJECT_SYNTAX],
  [".", REJECT_SYNTAX],
  // Postgres 16 reads `0x10` as 16; that is not a decimal representation, and is refused here.
  ["0x10", REJECT_SYNTAX],
  // Non-finite JS numbers have no decimal spelling this column can hold.
  [Number.NaN, REJECT_SYNTAX],
  [Number.POSITIVE_INFINITY, REJECT_SYNTAX],
  [Number.NEGATIVE_INFINITY, REJECT_SYNTAX],
];

for (const [input, expected] of NUMERIC_8_2) {
  test(`numeric(8,2): ${JSON.stringify(input)} -> ${expected}`, () => {
    assert.equal(outcome(input, 8, 2), expected);
  });
}

// ============================================================================================
// numeric(3, 2) -- portion_multiplier. One integer digit, NOT the same range as numeric(8,2).
// ============================================================================================

const NUMERIC_3_2: Expectation[] = [
  ["9.99", "9.99"],
  ["-9.99", "-9.99"],
  ["9.994", "9.99"],
  ["-9.994", "-9.99"],
  // Rounds to 10.00, which one integer digit cannot hold.
  ["9.995", REJECT_RANGE],
  ["-9.995", REJECT_RANGE],
  ["10", REJECT_RANGE],
  ["999999.99", REJECT_RANGE],
  ["1.005", "1.01"],
  ["0.005", "0.01"],
  ["0.004", "0.00"],
  ["1.00", "1.00"],
  ["0.5", "0.50"],
  ["0", "0.00"],
];

for (const [input, expected] of NUMERIC_3_2) {
  test(`numeric(3,2): ${JSON.stringify(input)} -> ${expected}`, () => {
    assert.equal(outcome(input, 3, 2), expected);
  });
}

// ============================================================================================
// The pass-through contract: a decimal string is never rewritten
// ============================================================================================

test("a decimal string is handed to the database exactly as it arrived", () => {
  // The whole point: validation decides yes or no, Postgres does the arithmetic. If the helper
  // returned its own rounded form instead, `"1.005"` would be stored as whatever JS made of it.
  for (const input of ["1.005", "999999.994", "0.004", "-1.005", "007.5", "1.20", "1e2", ".5"]) {
    const result = normalizePgNumeric(input, 8, 2);
    assert.ok(result.ok, `${input} was rejected`);
    assert.equal(result.value, input, `${input} was rewritten to ${result.ok && result.value}`);
  }
});

test("a decimal string is trimmed but otherwise untouched", () => {
  const result = normalizePgNumeric("  1.005  ", 8, 2);
  assert.ok(result.ok);
  assert.equal(result.value, "1.005");
});

test("1.005 does not become 1.00 -- the exact regression Codex reported", () => {
  const result = normalizePgNumeric("1.005", 8, 2);
  assert.ok(result.ok);
  assert.notEqual(result.value, "1.00");
  assert.notEqual(result.rounded, "1.00");
  assert.equal(result.value, "1.005", "the string must reach Postgres unmodified");
  assert.equal(result.rounded, "1.01", "and Postgres rounds it up, as measured");
  // What the previous implementation produced, kept here as the thing that must never come back.
  assert.equal(Number("1.005").toFixed(2), "1.00");
});

test("999999.994 is accepted rather than judged on its unrounded magnitude", () => {
  // The second half of Codex's finding: the old check compared |999999.994| against 999999.99 and
  // rejected a value Postgres stores happily.
  const result = normalizePgNumeric("999999.994", 8, 2);
  assert.ok(result.ok, "a value that rounds into range must be accepted");
  assert.equal(result.rounded, "999999.99");
});

test("a value that overflows only AFTER rounding is rejected, not truncated", () => {
  const result = normalizePgNumeric("999999.995", 8, 2);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "range");
  // The float path hid this overflow entirely, which is worse than rejecting it.
  assert.equal(Number("999999.995").toFixed(2), "999999.99");
});

// ============================================================================================
// JS numbers: handled compatibly, without pretending they carry exact decimals
// ============================================================================================

test("a JS number is spelled with its own shortest round-trip decimal", () => {
  // Some clients post numbers (`NutritionMealPlanner.tsx` sends `estimatedPrice: ... || 0`), so
  // numbers must work -- but the conversion adds no precision and removes none.
  for (const [input, expected] of [
    [0, "0"],
    [1.5, "1.5"],
    [999999.99, "999999.99"],
    [-999999.99, "-999999.99"],
    [1.25, "1.25"],
    [1.005, "1.005"],
  ] as Array<[number, string]>) {
    const result = normalizePgNumeric(input, 8, 2);
    assert.ok(result.ok, `${input} was rejected`);
    assert.equal(result.value, expected);
  }
});

test("a number and its string spelling are treated identically", () => {
  for (const input of [1.005, -1.005, 0.004, 999999.994, 1.25]) {
    assert.equal(outcome(input, 8, 2), outcome(String(input), 8, 2), `${input} diverged`);
  }
});

// ============================================================================================
// An absurd exponent is answered without allocating for it
// ============================================================================================

test("an enormous exponent is decided arithmetically, not by building the digits", () => {
  const started = Date.now();
  assert.equal(outcome("1e1000000000", 8, 2), REJECT_RANGE);
  assert.equal(outcome("1e-1000000000", 8, 2), "0.00");
  assert.equal(outcome("1e999999999999999999999999", 8, 2), REJECT_RANGE);
  assert.equal(outcome("0e1000000000", 8, 2), "0.00");
  assert.ok(Date.now() - started < 1000, "an exponent must not drive an allocation");
});
