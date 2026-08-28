import { z } from "zod";

const id = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, "Invalid ID");
const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

export const cateringReviewCreateSchema = z.object({
  providerId: id,
  inquiryId: id.nullish(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().transform((value) => value || undefined),
  body: trimmed(10, 4000),
}).strict();
export const cateringReviewEditSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().trim().max(120).nullable().optional(),
  body: trimmed(10, 4000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide a review change");
export const cateringReviewResponseSchema = z.object({ response: trimmed(2, 2000) }).strict();
export const cateringReviewQuerySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  verified: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  sort: z.enum(["newest", "oldest", "highest", "lowest"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CateringReviewCreate = z.infer<typeof cateringReviewCreateSchema>;
export type CateringReviewEdit = z.infer<typeof cateringReviewEditSchema>;
export type CateringReviewQuery = z.infer<typeof cateringReviewQuerySchema>;
export type CateringReviewAggregate = { averageRating: number | null; reviewCount: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> };
export type PublicCateringReview = { id: string; rating: number; title: string | null; body: string; verifiedEvent: boolean; createdAt: string; updatedAt: string; reviewer: { displayName: string; avatar: string | null }; providerResponse: { body: string; respondedAt: string } | null };

export function cateringReviewAggregate(rows: Array<{ rating: number; count: number }>): CateringReviewAggregate {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as CateringReviewAggregate["distribution"];
  let reviewCount = 0; let sum = 0;
  for (const row of rows) { if (row.rating < 1 || row.rating > 5 || !Number.isInteger(row.rating)) continue; distribution[row.rating as 1 | 2 | 3 | 4 | 5] += row.count; reviewCount += row.count; sum += row.rating * row.count; }
  return { averageRating: reviewCount ? Math.round((sum / reviewCount) * 10) / 10 : null, reviewCount, distribution };
}

// Inquiry state and elapsed dates never prove delivery; only explicit persisted completion does.
export function qualifiesAsVerifiedCateringEvent(booking: { status?: string | null; completedAt?: unknown } | null | undefined): boolean {
  return booking?.status === "completed" && Boolean(booking.completedAt);
}
