/**
 * Decimal-string-aware validation for PostgreSQL `numeric(precision, scale)` columns.
 *
 * WHY THIS EXISTS. A validator that normalizes a decimal by routing it through a JavaScript number
 * changes the value:
 *
 *     Number("1.005").toFixed(2)        === "1.00"      PostgreSQL: 1.01
 *     Number("-1.005").toFixed(2)       === "-1.00"     PostgreSQL: -1.01
 *     Number("2.675").toFixed(2)        === "2.67"      PostgreSQL: 2.68
 *     Number("999999.995").toFixed(2)   === "999999.99" PostgreSQL: numeric field overflow
 *
 * because a binary double cannot hold those decimals exactly, and `toFixed` rounds the binary
 * approximation rather than the decimal the client sent. The last line is the worst of them: it
 * silently turns a genuine overflow into a truncated value.
 *
 * `POST /grocery-list` has always passed its price straight to drizzle, and the client sends and
 * receives these columns as decimal STRINGS (`estimatedPrice?: string` in
 * `client/src/components/meal-planner/advanced/types.ts`, read back with `Number(...)` for display),
 * so PostgreSQL's own `numeric(p, s)` is the established rounding and storage boundary. This module
 * keeps it that way: it decides whether a value is ACCEPTABLE, and leaves the arithmetic to Postgres.
 *
 * WHAT IT DOES. `normalizePgNumeric` validates syntax, models the rounding Postgres would perform
 * using string and integer arithmetic only -- never a float -- and rejects a value that would
 * overflow the column AFTER that rounding. On success it hands back the value UNCHANGED for the
 * database to round itself. So `"1.005"` is stored by Postgres as `1.01`, and `"999999.994"` is
 * accepted (Postgres rounds it to `999999.99`) while `"999999.995"` is a validation error instead of
 * a 500 from the driver.
 *
 * NUMBERS VERSUS STRINGS. A decimal string carries exact decimal semantics and is passed through
 * verbatim. A JSON number has already lost them before this code runs -- some clients do send one,
 * e.g. `NutritionMealPlanner.tsx` posts `estimatedPrice: ... || 0` -- so it is converted with
 * `String(value)`, which is the shortest decimal that round-trips that double. That neither invents
 * precision the number no longer has nor discards any it still does; it is simply the number's own
 * decimal spelling. What this module never does is push a decimal STRING through that conversion.
 *
 * THE GROUND TRUTH. Every rule below was measured against PostgreSQL 16.13, not taken from memory:
 * rounding is half away from zero (`0.005 -> 0.01`, `-0.005 -> -0.01`, `0.004 -> 0.00`), a rounded
 * zero loses its sign (`-0.004 -> 0.00`), range is checked after rounding, and the accepted input
 * syntax includes a leading sign, a bare leading or trailing point (`.5`, `1.`), leading and
 * trailing zeros, surrounding whitespace and exponent notation (`1e2`, `1.5e1`, `1E-3`).
 *
 * TWO DELIBERATE NARROWINGS, both documented rather than silent:
 *   - `NaN` is a legal `numeric` value in Postgres, and `'NaN'::numeric(8, 2)` stores NaN. It is
 *     rejected here: no client sends it, and it poisons the aggregate readers that sum these very
 *     columns (`calculateSavingsReport` does `Number(item.actualPrice || 0)`, which would make an
 *     entire report NaN). `Infinity` is rejected by `numeric(p, s)` by Postgres itself.
 *   - Postgres 16 also accepts non-decimal integer literals such as `0x10` (16). Those are not
 *     decimal representations and no client emits them, so they are treated as malformed.
 */

/** A syntactically valid decimal, as Postgres spells one. Exponent notation included. */
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export type PgNumericResult =
  | {
      ok: true;
      /** The value to hand drizzle: unchanged for a string, the number's own spelling otherwise. */
      value: string;
      /** What Postgres would store, modeled without floats. Used for the range check, and for tests. */
      rounded: string;
    }
  | { ok: false; reason: "syntax" | "range" };

/** Adds one to a string of decimal digits, growing it on carry. "999" -> "1000". */
function incrementDigits(digits: string): string {
  const out = digits.split("");
  for (let i = out.length - 1; i >= 0; i -= 1) {
    if (out[i] === "9") {
      out[i] = "0";
      continue;
    }
    out[i] = String(Number(out[i]) + 1);
    return out.join("");
  }
  return `1${out.join("")}`;
}

/**
 * Rounds a decimal, given as sign and digit strings, to `scale` fractional digits, half away from
 * zero -- the rule Postgres applies. Returns the integer and fractional digit strings it becomes.
 */
function roundToScale(intDigits: string, fracDigits: string, scale: number) {
  if (fracDigits.length <= scale) {
    return { intDigits, fracDigits: fracDigits.padEnd(scale, "0") };
  }

  const kept = fracDigits.slice(0, scale);
  const roundUp = fracDigits.charCodeAt(scale) >= 53; // '5'
  let combined = intDigits + kept;
  if (roundUp) combined = incrementDigits(combined);

  return {
    intDigits: (scale === 0 ? combined : combined.slice(0, combined.length - scale)) || "0",
    fracDigits: scale === 0 ? "" : combined.slice(combined.length - scale),
  };
}

/** Significant integer digit count: leading zeros do not count, and zero itself needs none. */
function integerDigitCount(intDigits: string) {
  const stripped = intDigits.replace(/^0+/, "");
  return stripped.length;
}

/**
 * Validates a value against `numeric(precision, scale)`.
 *
 * `precision - scale` is how many integer digits the column holds, so that is what the range check
 * tests -- against the ROUNDED value, because that is what Postgres stores.
 */
export function normalizePgNumeric(
  input: string | number,
  precision: number,
  scale: number
): PgNumericResult {
  let text: string;
  if (typeof input === "number") {
    // NaN and +/-Infinity have no decimal spelling this column can hold.
    if (!Number.isFinite(input)) return { ok: false, reason: "syntax" };
    text = String(input);
  } else {
    text = input.trim();
  }

  if (!DECIMAL_PATTERN.test(text)) return { ok: false, reason: "syntax" };

  const [mantissa, exponentText] = text.split(/[eE]/);
  const negative = mantissa.startsWith("-");
  const unsigned = mantissa.replace(/^[+-]/, "");
  const [rawInt = "", rawFrac = ""] = unsigned.split(".");
  const exponent = exponentText ? Number(exponentText) : 0;

  // A zero mantissa is zero at any exponent, and short-circuiting it keeps the shifting below from
  // having to reason about a value with no significant digits.
  if (!/[1-9]/.test(rawInt + rawFrac)) {
    return { ok: true, value: text, rounded: `0.${"0".repeat(scale)}` };
  }

  // An exponent can be arbitrarily large in the input, so decide the extreme cases before building
  // any digit string -- otherwise `1e1000000000` would allocate a gigabyte to reach the same answer.
  const significantIntDigits = integerDigitCount(rawInt);
  const magnitudeDigits = significantIntDigits + exponent;
  if (magnitudeDigits > precision - scale) return { ok: false, reason: "range" };
  if (magnitudeDigits < -(scale + 1)) {
    // Smaller than half of the last representable digit, so it rounds to zero.
    return { ok: true, value: text, rounded: `0.${"0".repeat(scale)}` };
  }

  // Shift the decimal point by the exponent, in digits rather than arithmetic.
  let intDigits = rawInt;
  let fracDigits = rawFrac;
  if (exponent > 0) {
    fracDigits = fracDigits.padEnd(exponent, "0");
    intDigits += fracDigits.slice(0, exponent);
    fracDigits = fracDigits.slice(exponent);
  } else if (exponent < 0) {
    const shift = -exponent;
    intDigits = intDigits.padStart(shift, "0");
    fracDigits = intDigits.slice(intDigits.length - shift) + fracDigits;
    intDigits = intDigits.slice(0, intDigits.length - shift) || "0";
  }

  const rounded = roundToScale(intDigits || "0", fracDigits, scale);
  if (integerDigitCount(rounded.intDigits) > precision - scale) {
    return { ok: false, reason: "range" };
  }

  const isZero = !/[1-9]/.test(rounded.intDigits + rounded.fracDigits);
  const sign = negative && !isZero ? "-" : "";
  const whole = rounded.intDigits.replace(/^0+(?=\d)/, "");
  const canonical = scale === 0 ? `${sign}${whole}` : `${sign}${whole}.${rounded.fracDigits}`;

  return { ok: true, value: text, rounded: canonical };
}
