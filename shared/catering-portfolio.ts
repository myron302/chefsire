import { z } from "zod";

export const CATERING_PORTFOLIO_CATEGORIES = [
  "Weddings", "Corporate", "Private Events", "Holiday Events", "BBQ",
  "Fine Dining", "Desserts", "Appetizers", "Buffets", "Signature Dishes", "Other",
] as const;

export const CATERING_PORTFOLIO_ITEM_LIMIT = 100;

const cateringPortfolioDescriptionSchema = z
  .union([z.string().max(1000), z.null()])
  .transform((value) => typeof value === "string" ? value.trim() || null : null)
  .optional();

export const cateringPortfolioFieldsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: cateringPortfolioDescriptionSchema,
  category: z.enum(CATERING_PORTFOLIO_CATEGORIES),
  sortOrder: z.coerce.number().int().min(0).max(100000),
});

export const cateringPortfolioReorderSchema = z.object({
  itemIds: z.array(z.string().uuid()).max(CATERING_PORTFOLIO_ITEM_LIMIT).refine((ids) => new Set(ids).size === ids.length, "Item IDs must be unique"),
});

export interface CateringPortfolioItem {
  id: string;
  providerId: string;
  image: string;
  title: string;
  description: string | null;
  category: typeof CATERING_PORTFOLIO_CATEGORIES[number];
  createdAt: string;
  sortOrder: number;
}
