export function parsePriceDollarsToCents(value: unknown): number | null {
  if (!value) return null;

  const parsed = parseInt(value as string, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed * 100;
}

export function filterBrowsePlans(
  plans: any[],
  filters: {
    category?: unknown;
    difficulty?: unknown;
    minPriceCents?: number | null;
    maxPriceCents?: number | null;
    search?: unknown;
  }
): any[] {
  const { category, difficulty, minPriceCents, maxPriceCents, search } = filters;

  let filtered = plans;

  if (category && category !== "all") {
    filtered = filtered.filter((p) => p.blueprint.category === category);
  }

  if (difficulty && difficulty !== "all") {
    filtered = filtered.filter((p) => p.blueprint.difficulty === difficulty);
  }

  if (minPriceCents !== null && minPriceCents !== undefined) {
    filtered = filtered.filter((p) => p.blueprint.priceInCents >= minPriceCents);
  }

  if (maxPriceCents !== null && maxPriceCents !== undefined) {
    filtered = filtered.filter((p) => p.blueprint.priceInCents <= maxPriceCents);
  }

  if (search) {
    const searchLower = (search as string).toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.blueprint.title.toLowerCase().includes(searchLower) ||
        p.blueprint.description?.toLowerCase().includes(searchLower)
    );
  }

  return filtered;
}

export function sortBrowsePlans(plans: any[], sort: unknown): any[] {
  if (sort === "price-asc") {
    return plans.sort((a, b) => a.blueprint.priceInCents - b.blueprint.priceInCents);
  }

  if (sort === "price-desc") {
    return plans.sort((a, b) => b.blueprint.priceInCents - a.blueprint.priceInCents);
  }

  if (sort === "rating") {
    return plans.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
  }

  return plans.sort(
    (a, b) =>
      new Date(b.blueprint.createdAt).getTime() - new Date(a.blueprint.createdAt).getTime()
  );
}

export function normalizeRatingStats(stats: any): { avgRating: number; totalReviews: number } {
  return {
    avgRating: stats?.avgRating || 0,
    totalReviews: stats?.totalReviews || 0,
  };
}

export function normalizeAnalyticsTotals(totals: any): {
  totalSales: number;
  totalRevenueCents: number;
} {
  return {
    totalSales: totals?.totalSales || 0,
    totalRevenueCents: totals?.totalRevenue || 0,
  };
}

export function buildSimulatedTransactionId(now = Date.now(), randomValue = Math.random()): string {
  return `sim_${now}_${randomValue.toString(36).substring(7)}`;
}

export function toIsoDateString(date = new Date()): string {
  return date.toISOString().split("T")[0];
}
