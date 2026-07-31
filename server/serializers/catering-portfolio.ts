import type { CateringPortfolioItem } from "@shared/catering-portfolio";

type PortfolioRow = Omit<CateringPortfolioItem, "createdAt" | "category"> & { createdAt: Date; category: string };

export function serializeCateringPortfolioItem(row: PortfolioRow): CateringPortfolioItem {
  return {
    id: row.id,
    providerId: row.providerId,
    image: row.image,
    title: row.title,
    description: row.description,
    category: row.category as CateringPortfolioItem["category"],
    createdAt: row.createdAt.toISOString(),
    sortOrder: row.sortOrder,
  };
}
