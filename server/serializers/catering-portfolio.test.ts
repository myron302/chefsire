import test from "node:test";
import assert from "node:assert/strict";
import { serializeCateringPortfolioItem } from "./catering-portfolio";

test("portfolio serializer exposes only public fields and converts dates", () => {
  const item = serializeCateringPortfolioItem({ id: "item", providerId: "provider", image: "/uploads/photo.webp", title: "Dinner", description: null, category: "Fine Dining", createdAt: new Date("2026-01-02T00:00:00Z"), sortOrder: 2 });
  assert.deepEqual(Object.keys(item), ["id", "providerId", "image", "title", "description", "category", "createdAt", "sortOrder"]);
  assert.equal(item.createdAt, "2026-01-02T00:00:00.000Z");
});
