import { z } from "zod";

export const CATERING_INQUIRY_DEFAULT_PAGE_SIZE = 20;
export const CATERING_INQUIRY_MAX_PAGE_SIZE = 50;
export const cateringInquiryPageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(CATERING_INQUIRY_MAX_PAGE_SIZE).default(CATERING_INQUIRY_DEFAULT_PAGE_SIZE),
});

export function cateringInquiryPageMetadata(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export function canViewProviderInquiryPage(viewerId: string, providerId: string): boolean {
  return viewerId === providerId;
}
