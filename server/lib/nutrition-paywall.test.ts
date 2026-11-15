/**
 * The Nutrition paywall must not offer what it cannot deliver.
 *
 * It used to show two buttons side by side: "Start 30-Day Free Trial", which works, and
 * "Learn More", which had no onClick and nowhere to go -- the card above already lists every
 * feature and the price, and there is no nutrition detail page in the router. A dead button dressed
 * as a choice.
 *
 * It also offered the trial unconditionally, including to an account that had already used its one
 * cardless trial, who would click and receive a 409. Same failure as the paid plan buttons: a
 * control that cannot succeed reads as broken rather than as spent.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const planner = readFileSync(new URL("../../client/src/components/NutritionMealPlanner.tsx", import.meta.url), "utf8");

test("the dead Learn More button is gone", () => {
  assert.doesNotMatch(planner, /Learn More\s*<\/Button>/,
    "a button with no handler and no destination must not be rendered");
});

test("the trial is offered only when the account still has one", () => {
  // A definite false hides the offer and says why.
  assert.match(planner, /trialEligible === false \? \(/);
  assert.match(planner, /Free trial already used/);
  assert.match(planner, /Paid Premium isn't open yet/,
    "and it says plainly that nothing is payable, consistent with the paid plan buttons");

  // Unknown still offers it: the server refuses a second trial with a clear message, and failing
  // closed here would deny an eligible member their one trial.
  assert.match(planner, /useState<boolean \| null>\(null\)/);
  assert.match(planner, /typeof eligible === "boolean" \? eligible : null/,
    "a non-boolean answer is unknown, not false");
});

test("the eligibility lookup cannot break the planner", () => {
  const start = planner.indexOf('const response = await fetch("/api/nutrition/subscription"');
  assert.ok(start > 0, "the planner asks the server about the trial");
  const around = planner.slice(Math.max(0, start - 400), start + 400);
  assert.match(around, /try \{/);
  assert.match(around, /\} catch \{/, "a presentational lookup must not abort the data load");
});
