import assert from "node:assert/strict";
import test from "node:test";
import { serializePublicCateringReview } from "./catering-review";

test("public serializer allowlists identity and provider response", () => {
  const source = { id: "review", rating: 4, title: null, body: "Good service", verifiedEvent: false, providerResponse: "Thank you", respondedAt: new Date("2026-08-02T00:00:00Z"), createdAt: new Date("2026-08-01T00:00:00Z"), updatedAt: new Date("2026-08-02T00:00:00Z"), reviewerDisplayName: "Customer", reviewerAvatar: null, email: "private@example.com", inquiryMessage: "private" };
  const result = serializePublicCateringReview(source);
  assert.equal(result.reviewer.displayName, "Customer"); assert.equal(result.providerResponse?.body, "Thank you");
  assert.equal("email" in result, false); assert.equal("inquiryMessage" in result, false); assert.equal("reviewerId" in result, false);
});
test("response is omitted unless response and timestamp both exist", () => {
  const result = serializePublicCateringReview({ id: "review", rating: 4, title: null, body: "Good service", verifiedEvent: false, providerResponse: "orphan", respondedAt: null, createdAt: new Date(), updatedAt: new Date(), reviewerDisplayName: "Customer", reviewerAvatar: null });
  assert.equal(result.providerResponse, null);
});
