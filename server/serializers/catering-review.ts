import type { PublicCateringReview } from "@shared/catering-reviews";

type Row = { id: string; rating: number; title: string | null; body: string; verifiedEvent: boolean; providerResponse: string | null; respondedAt: Date | null; createdAt: Date; updatedAt: Date; reviewerDisplayName: string; reviewerAvatar: string | null };
export function serializePublicCateringReview(row: Row): PublicCateringReview {
  return { id: row.id, rating: row.rating, title: row.title, body: row.body, verifiedEvent: row.verifiedEvent, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), reviewer: { displayName: row.reviewerDisplayName, avatar: row.reviewerAvatar }, providerResponse: row.providerResponse && row.respondedAt ? { body: row.providerResponse, respondedAt: row.respondedAt.toISOString() } : null };
}

type ViewerReviewRow = { id: string; rating: number; title: string | null; body: string };
export function serializeViewerCateringReview(row: ViewerReviewRow | null | undefined): ViewerReviewRow | null {
  return row ? { id: row.id, rating: row.rating, title: row.title, body: row.body } : null;
}
