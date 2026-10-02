import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { meetsMinimumMatch, normalizeRecipeSuggestions } from "./recipe-matches-model";

// The app builds JSX with Vite's automatic runtime; tsx's classic transform needs `React` in scope. Test-only shim.
(globalThis as { React?: typeof React }).React = React;
const { RecipeMatchCard } = await import("./RecipeMatchCard");

/**
 * The payload below has exactly the shape `storage.getRecipesFromPantryItems` returns through
 * `GET /api/pantry/users/me/pantry/recipe-suggestions` (the recipes row spread, plus scoring): `title` not `name`,
 * `matchScore` on a 0-100 scale, a NUMERIC `ingredientMatches`, `missingIngredients` as names, no `matchingIngredients`.
 * The server suite (user-scoped-private-reads.test.ts) feeds the real endpoint response through the same normalizer.
 */
const apiSuggestion = {
  id: "recipe-1",
  postId: "post-1",
  title: "Garlic Pasta",
  imageUrl: "https://img.example/pasta.jpg",
  ingredients: ["pasta", "garlic", "olive oil", "parmesan"],
  instructions: ["boil"],
  cookTime: 25,
  servings: 2,
  difficulty: "easy",
  post: { id: "post-1", user: { id: "u2", username: "chef" } },
  matchScore: 75,
  ingredientMatches: 3,
  totalIngredients: 4,
  missingIngredients: ["parmesan"],
  missingCount: 1,
  canMake: false,
};
const payload = { suggestions: [apiSuggestion], options: {}, total: 1 };
const render = (recipe: ReturnType<typeof normalizeRecipeSuggestions>[number]) => renderToStaticMarkup(createElement(Router, { ssrPath: "/pantry/recipe-matches" }, createElement(RecipeMatchCard, { recipe })));

test("a non-empty API response normalizes and renders without crashing", () => {
  const [recipe] = normalizeRecipeSuggestions(payload);
  assert.ok(recipe);
  assert.doesNotThrow(() => render(recipe));
});

test("the title comes from `title`", () => {
  const [recipe] = normalizeRecipeSuggestions(payload);
  assert.equal(recipe.title, "Garlic Pasta");
  const html = render(recipe);
  assert.match(html, />Garlic Pasta</);
  assert.match(html, /alt="Garlic Pasta"/);
});

test("the ingredient count is the endpoint's numeric count and the names shown are real recipe ingredients", () => {
  const [recipe] = normalizeRecipeSuggestions(payload);
  assert.equal(recipe.matchingCount, 3);
  assert.equal(recipe.totalIngredients, 4);
  assert.match(render(recipe), />3 of 4 ingredients</);
  // Derived from the recipe's own ingredients minus the missing ones -- nothing invented.
  assert.deepEqual(recipe.matchingIngredients, ["pasta", "garlic", "olive oil"]);
  assert.equal(recipe.matchingIngredients.length, apiSuggestion.ingredientMatches);
  const html = render(recipe);
  for (const name of recipe.matchingIngredients) assert.ok(html.includes(`>${name}<`));
});

test("a 0-100 score is shown as is: 75 renders 75%, never 7500%", () => {
  const [recipe] = normalizeRecipeSuggestions(payload);
  assert.equal(recipe.matchPercent, 75);
  const html = render(recipe);
  assert.match(html, />75% Match</);
  assert.doesNotMatch(html, /7500/);
  assert.match(html, /Good Match/);
  assert.match(html, /translateX\(-25%\)/); // Progress at 75 -> indicator offset by 25%
});

test("the score boundaries and out-of-range values are clamped on the endpoint's own scale", () => {
  const pct = (matchScore: unknown) => normalizeRecipeSuggestions({ suggestions: [{ ...apiSuggestion, matchScore }] })[0].matchPercent;
  assert.equal(pct(100), 100);
  assert.equal(pct(0), 0);
  assert.equal(pct(66.6667), 67);
  assert.equal(pct(250), 100);
  assert.equal(pct(-5), 0);
  assert.equal(pct("high"), 0);
});

test("missing ingredients: names are listed, and a complete match shows no 'You need' block", () => {
  const [recipe] = normalizeRecipeSuggestions(payload);
  assert.deepEqual(recipe.missingIngredients, ["parmesan"]);
  const html = render(recipe);
  assert.match(html, /You need:/);
  assert.match(html, />parmesan</);

  const [complete] = normalizeRecipeSuggestions({
    suggestions: [{ ...apiSuggestion, matchScore: 100, ingredientMatches: 4, missingIngredients: [], missingCount: 0, canMake: true }],
  });
  assert.equal(complete.matchingIngredients.length, 4);
  assert.deepEqual(complete.missingIngredients, []);
  assert.doesNotMatch(render(complete), /You need:/);
});

test("the recipe link uses the recipe id, and image / cook time / difficulty come from the endpoint's fields", () => {
  const [recipe] = normalizeRecipeSuggestions(payload);
  assert.equal(recipe.id, "recipe-1");
  const html = render(recipe);
  assert.match(html, /href="\/recipe\/recipe-1"/);
  assert.match(html, /src="https:\/\/img\.example\/pasta\.jpg"/);
  assert.match(html, />25 min</);
  assert.match(html, />easy</);
});

test("a recipe without an image shows the badge in the header and still renders", () => {
  const [recipe] = normalizeRecipeSuggestions({ suggestions: [{ ...apiSuggestion, imageUrl: null }] });
  assert.equal(recipe.imageUrl, undefined);
  assert.match(render(recipe), />75% Match</);
});

test("malformed entries are skipped instead of crashing the page", () => {
  assert.deepEqual(normalizeRecipeSuggestions(undefined), []);
  assert.deepEqual(normalizeRecipeSuggestions({ suggestions: "nope" }), []);
  const out = normalizeRecipeSuggestions({ suggestions: [null, 7, {}, { id: "" }, { id: "ok", title: "T" }] });
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].matchPercent, out[0].matchingCount, out[0].totalIngredients, out[0].missingIngredients], [0, 0, 0, []]);
  assert.doesNotThrow(() => render(out[0]));
});

test("the minimum-match select compares fractions to percentages", () => {
  const [recipe] = normalizeRecipeSuggestions(payload); // 75%
  assert.equal(meetsMinimumMatch(recipe, "0.5"), true);
  assert.equal(meetsMinimumMatch(recipe, "0.7"), true);
  assert.equal(meetsMinimumMatch(recipe, "0.9"), false);
  assert.equal(meetsMinimumMatch(recipe, "0.3"), true);
});
