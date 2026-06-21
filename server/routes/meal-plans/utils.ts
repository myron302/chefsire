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

function recentnessBoost(createdAt: unknown): number {
  const createdMs = new Date(String(createdAt || 0)).getTime();
  if (!Number.isFinite(createdMs) || createdMs <= 0) return 0;
  const ageDays = Math.max(0, (Date.now() - createdMs) / 86400000);
  return Math.max(0, Math.round(30 - Math.min(ageDays, 30)));
}

function planTrendingScore(plan: any): number {
  const likes = Number(plan.likeCount || 0);
  const saves = Number(plan.saveCount || 0);
  const comments = Number(plan.commentCount || 0);
  const purchases = Number(plan.blueprint?.salesCount || 0);
  return likes * 3 + saves * 4 + comments * 2 + purchases * 6 + recentnessBoost(plan.blueprint?.createdAt);
}

export function sortBrowsePlans(plans: any[], sort: unknown): any[] {
  plans.forEach((plan) => {
    plan.recentnessBoost = recentnessBoost(plan.blueprint?.createdAt);
    plan.trendingScore = planTrendingScore(plan);
  });

  if (sort === "followed-creators") {
    return plans.sort((a, b) => Number(b.viewerIsFollowingCreator) - Number(a.viewerIsFollowingCreator) || planTrendingScore(b) - planTrendingScore(a));
  }

  if (sort === "most-liked") return plans.sort((a, b) => Number(b.likeCount || 0) - Number(a.likeCount || 0) || planTrendingScore(b) - planTrendingScore(a));
  if (sort === "most-saved") return plans.sort((a, b) => Number(b.saveCount || 0) - Number(a.saveCount || 0) || planTrendingScore(b) - planTrendingScore(a));
  if (sort === "most-commented") return plans.sort((a, b) => Number(b.commentCount || 0) - Number(a.commentCount || 0) || planTrendingScore(b) - planTrendingScore(a));
  if (sort === "most-reviewed") return plans.sort((a, b) => Number(b.reviewCount || 0) - Number(a.reviewCount || 0) || planTrendingScore(b) - planTrendingScore(a));
  if (sort === "most-purchased") return plans.sort((a, b) => Number(b.blueprint?.salesCount || 0) - Number(a.blueprint?.salesCount || 0) || planTrendingScore(b) - planTrendingScore(a));
  if (sort === "top-rated" || sort === "rating") return plans.sort((a, b) => Number(b.avgRating || 0) - Number(a.avgRating || 0) || Number(b.reviewCount || 0) - Number(a.reviewCount || 0));
  if (sort === "trending") return plans.sort((a, b) => planTrendingScore(b) - planTrendingScore(a));
  if (sort === "price-asc") {
    return plans.sort((a, b) => a.blueprint.priceInCents - b.blueprint.priceInCents);
  }

  if (sort === "price-desc") {
    return plans.sort((a, b) => b.blueprint.priceInCents - a.blueprint.priceInCents);
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
