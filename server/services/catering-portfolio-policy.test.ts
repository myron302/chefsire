import test from "node:test";
import assert from "node:assert/strict";
import { canAddPortfolioItem, hasExactPortfolioSet, ownsPortfolioItem } from "./catering-portfolio-policy";

test("portfolio ownership requires the authenticated provider", () => {
  assert.equal(ownsPortfolioItem("owner", { providerId: "owner" }), true);
  assert.equal(ownsPortfolioItem("attacker", { providerId: "owner" }), false);
});
test("portfolio item 100 is allowed and item 101 is rejected", () => {
  assert.equal(canAddPortfolioItem(99, 100), true);
  assert.equal(canAddPortfolioItem(100, 100), false);
});
test("reordering requires every owned item exactly once", () => {
  assert.equal(hasExactPortfolioSet(["a", "b"], ["b", "a"]), true);
  assert.equal(hasExactPortfolioSet(["a", "b"], ["a"]), false);
  assert.equal(hasExactPortfolioSet(["a", "b"], ["a", "a"]), false);
});
