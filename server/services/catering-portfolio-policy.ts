export function ownsPortfolioItem(viewerId: string, item: { providerId: string }): boolean {
  return viewerId === item.providerId;
}

export function hasExactPortfolioSet(existingIds: string[], requestedIds: string[]): boolean {
  return existingIds.length === requestedIds.length && existingIds.every((id) => requestedIds.includes(id));
}
