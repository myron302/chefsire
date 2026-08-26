export type ViewerReview = { id: string; rating: number; title: string | null; body: string };

export function customerReviewAction(input: { authLoading: boolean; viewerId?: string; providerId: string; viewerReview: ViewerReview | null | undefined }) {
  if (input.authLoading || !input.viewerId || input.viewerId === input.providerId || input.viewerReview === undefined) return "none" as const;
  return input.viewerReview ? "manage" as const : "create" as const;
}

export function pageAfterReviewDeletion(page: number, reviewsOnPage: number): number {
  return page > 1 && reviewsOnPage <= 1 ? page - 1 : page;
}
