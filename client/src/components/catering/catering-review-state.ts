export type ViewerReview = { id: string; rating: number; title: string | null; body: string };

export const cateringReviewViewerKey = (viewerId?: string) => viewerId ? `user:${viewerId}` : "anonymous";
export const cateringReviewQueryKey = (providerId: string, viewerKey: string, sort: string, page: number) => ["catering", "reviews", providerId, viewerKey, sort, page] as const;
export const cateringReviewQueryFreshness = {
  staleTime: 45_000,
  refetchOnMount: true,
  refetchOnWindowFocus: false,
} as const;

export function customerReviewAction(input: { authLoading: boolean; viewerId?: string; providerId: string; viewerReview: ViewerReview | null | undefined }) {
  if (input.authLoading || !input.viewerId || input.viewerId === input.providerId || input.viewerReview === undefined) return "none" as const;
  return input.viewerReview ? "manage" as const : "create" as const;
}

export function pageAfterReviewDeletion(page: number, reviewsOnPage: number): number {
  return page > 1 && reviewsOnPage <= 1 ? page - 1 : page;
}

export function clearResponseDraft(drafts: Record<string, string>, reviewId: string): Record<string, string> {
  if (!(reviewId in drafts)) return drafts;
  const next = { ...drafts };
  delete next[reviewId];
  return next;
}

export function responseEditorValue(drafts: Record<string, string>, reviewId: string, persistedBody?: string | null): string {
  return drafts[reviewId] ?? persistedBody ?? "";
}
