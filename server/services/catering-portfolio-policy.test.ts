import test from "node:test";
import assert from "node:assert/strict";
import { hasExactPortfolioSet, ownsPortfolioItem } from "./catering-portfolio-policy";

test("portfolio ownership requires the authenticated provider", () => {
  assert.equal(ownsPortfolioItem("owner", { providerId: "owner" }), true);
  assert.equal(ownsPortfolioItem("attacker", { providerId: "owner" }), false);
});
test("reordering requires every owned item exactly once", () => {
  assert.equal(hasExactPortfolioSet(["a", "b"], ["b", "a"]), true);
  assert.equal(hasExactPortfolioSet(["a", "b"], ["a"]), false);
  assert.equal(hasExactPortfolioSet(["a", "b"], ["a", "a"]), false);
});
