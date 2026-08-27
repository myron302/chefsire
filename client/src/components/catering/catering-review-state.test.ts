import assert from "node:assert/strict";
import test from "node:test";
import { cateringReviewLocalReset, cateringReviewQueryFreshness, cateringReviewQueryKey, cateringReviewViewerKey, clearResponseDraft, customerReviewAction, pageAfterReviewDeletion, responseEditorValue } from "./catering-review-state";

test("customer without a review may create after ownership resolves", () => {
  assert.equal(customerReviewAction({ authLoading: false, viewerId: "customer", providerId: "chef", viewerReview: null }), "create");
});
test("customer with an existing review manages it regardless of visible page", () => {
  assert.equal(customerReviewAction({ authLoading: false, viewerId: "customer", providerId: "chef", viewerReview: { id: "outside-page", rating: 4, title: null, body: "A persisted review" } }), "manage");
});
test("unresolved auth or ownership and provider self-view expose no customer action", () => {
  assert.equal(customerReviewAction({ authLoading: true, providerId: "chef", viewerReview: undefined }), "none");
  assert.equal(customerReviewAction({ authLoading: false, viewerId: "chef", providerId: "chef", viewerReview: null }), "none");
});
test("deleting the only result on a later page moves back one page", () => {
  assert.equal(pageAfterReviewDeletion(3, 1), 2);
  assert.equal(pageAfterReviewDeletion(1, 1), 1);
  assert.equal(pageAfterReviewDeletion(3, 2), 3);
});
test("review cache keys separate anonymous and authenticated accounts", () => {
  const anonymous = cateringReviewQueryKey("chef", cateringReviewViewerKey(), "newest", 1);
  const userA = cateringReviewQueryKey("chef", cateringReviewViewerKey("a"), "newest", 1);
  const userB = cateringReviewQueryKey("chef", cateringReviewViewerKey("b"), "newest", 1);
  assert.notDeepEqual(anonymous, userA);
  assert.notDeepEqual(userA, userB);
  assert.deepEqual(userA.slice(0, 3), ["catering", "reviews", "chef"]);
});
test("public catering reviews override infinite global freshness without polling", () => {
  assert.equal(Number.isFinite(cateringReviewQueryFreshness.staleTime), true);
  assert.equal(cateringReviewQueryFreshness.staleTime, 45_000);
  assert.equal(cateringReviewQueryFreshness.refetchOnMount, true);
  assert.equal(cateringReviewQueryFreshness.refetchOnWindowFocus, false);
  assert.equal("refetchInterval" in cateringReviewQueryFreshness, false);
});
test("provider transition reset closes forms, clears provider drafts, and returns to page one", () => {
  assert.deepEqual(cateringReviewLocalReset(), {
    mode: "closed",
    form: { rating: 0, title: "", body: "" },
    deleteOpen: false,
    responseDrafts: {},
    page: 1,
  });
});
test("provider and viewer remain independent query-key boundaries", () => {
  const providerA = cateringReviewQueryKey("provider-a", cateringReviewViewerKey("viewer"), "highest", 3);
  const providerB = cateringReviewQueryKey("provider-b", cateringReviewViewerKey("viewer"), "highest", cateringReviewLocalReset().page);
  const changedViewer = cateringReviewQueryKey("provider-a", cateringReviewViewerKey("other"), "highest", cateringReviewLocalReset().page);
  assert.notDeepEqual(providerA, providerB);
  assert.notDeepEqual(providerA, changedViewer);
  assert.equal(providerB.at(-1), 1);
});
test("logout and account changes recompute owner actions from the new viewer result", () => {
  const owned = { id: "a-review", rating: 5, title: null, body: "Owned by A" };
  assert.equal(customerReviewAction({ authLoading: false, viewerId: "a", providerId: "chef", viewerReview: owned }), "manage");
  assert.equal(customerReviewAction({ authLoading: false, providerId: "chef", viewerReview: null }), "none");
  assert.equal(customerReviewAction({ authLoading: false, viewerId: "b", providerId: "chef", viewerReview: null }), "create");
});
test("response deletion clears only its draft and cannot repopulate an empty editor", () => {
  const cleared = clearResponseDraft({ first: "deleted response", second: "unrelated draft" }, "first");
  assert.deepEqual(cleared, { second: "unrelated draft" });
  assert.equal(responseEditorValue(cleared, "first", null), "");
  assert.equal(responseEditorValue(cleared, "second", null), "unrelated draft");
});
