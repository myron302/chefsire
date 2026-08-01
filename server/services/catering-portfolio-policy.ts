export function ownsPortfolioItem(viewerId: string, item: { providerId: string }): boolean {
  return viewerId === item.providerId;
}

export function hasExactPortfolioSet(existingIds: string[], requestedIds: string[]): boolean {
  return existingIds.length === requestedIds.length && existingIds.every((id) => requestedIds.includes(id));
}

export function canAddPortfolioItem(currentCount: number, limit: number): boolean {
  return Number.isInteger(currentCount) && currentCount >= 0 && currentCount < limit;
}
