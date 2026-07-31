import test from "node:test";
import assert from "node:assert/strict";
import { cateringPortfolioFieldsSchema, cateringPortfolioReorderSchema } from "./catering-portfolio";

test("portfolio fields validate categories and normalize form values", () => {
  const value = cateringPortfolioFieldsSchema.parse({ title: " Wedding ", description: "", category: "Weddings", sortOrder: "3" });
  assert.deepEqual(value, { title: "Wedding", description: undefined, category: "Weddings", sortOrder: 3 });
  assert.equal(cateringPortfolioFieldsSchema.safeParse({ title: "x", category: "Invented", sortOrder: 0 }).success, false);
});
test("reorder rejects duplicate and malformed IDs", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(cateringPortfolioReorderSchema.safeParse({ itemIds: [id, id] }).success, false);
  assert.equal(cateringPortfolioReorderSchema.safeParse({ itemIds: ["bad"] }).success, false);
});
