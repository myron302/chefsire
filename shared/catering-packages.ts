import { z } from "zod";

export const CATERING_PACKAGE_CATEGORIES = [
  "Wedding Reception", "Cocktail Hour", "Corporate Catering", "Private Chef",
  "Holiday Events", "BBQ", "Brunch", "Breakfast", "Lunch", "Dinner",
  "Dessert Table", "Appetizers", "Buffet", "Family Style", "Plated Service", "Other",
] as const;

export const CATERING_PRICING_MODELS = ["per_person", "flat_rate", "hourly", "custom"] as const;

const tags = z.array(z.string().trim().min(1).max(80)).max(30)
  .transform((items) => [...new Set(items)]);
const optionalText = z.string().trim().max(100).nullable().optional()
  .transform((value) => value || null);

/** Fields providers edit in the package metadata form. Media has dedicated endpoints. */
export const cateringPackageMetadataSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(4000),
  category: z.enum(CATERING_PACKAGE_CATEGORIES),
  pricingModel: z.enum(CATERING_PRICING_MODELS),
  startingPrice: z.coerce.number().finite().min(0).max(10_000_000),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("USD"),
  minimumGuests: z.coerce.number().int().min(1).max(100000),
  maximumGuests: z.coerce.number().int().min(1).max(100000).nullable().optional(),
  preparationStyle: optionalText,
  serviceStyle: optionalText,
  cuisines: tags.default([]),
  dietaryAccommodations: tags.default([]),
  includedServices: tags.default([]),
  optionalAddOns: tags.default([]),
  estimatedDuration: z.coerce.number().int().min(15).max(10080).nullable().optional(),
  active: z.boolean().default(false),
  featured: z.boolean().default(false),
});

const mediaSchema = z.object({
  coverImage: z.string().trim().max(2048).nullable().optional(),
  galleryImages: z.array(z.string().max(2048)).max(20).default([]),
});

const validateGuestRange = (
  value: { minimumGuests?: number; maximumGuests?: number | null },
  context: z.RefinementCtx,
) => {
  if (value.minimumGuests !== undefined && value.maximumGuests != null && value.maximumGuests < value.minimumGuests) {
    context.addIssue({ code: "custom", path: ["maximumGuests"], message: "Maximum guests must be at least the minimum" });
  }
};

/** Canonical complete-state validator, used for creates and merged PATCH candidates. */
export const cateringPackageInputSchema = cateringPackageMetadataSchema
  .merge(mediaSchema)
  .superRefine(validateGuestRange);

/** PATCH accepts metadata only; complete-state validation happens after merging with storage. */
export const cateringPackagePatchSchema = cateringPackageMetadataSchema.partial().strict();

export const cateringPackageReorderSchema = z.object({
  packageIds: z.array(z.string().uuid()).max(200)
    .refine((ids) => new Set(ids).size === ids.length, "Package IDs must be unique"),
});

export type CateringPackageInput = z.infer<typeof cateringPackageInputSchema>;
export type CateringPackageMetadata = z.infer<typeof cateringPackageMetadataSchema>;
export type CateringPackagePatch = z.infer<typeof cateringPackagePatchSchema>;
export interface CateringPackage extends CateringPackageInput {
  id: string;
  providerId: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function packageMetadataPayload(value: unknown): CateringPackageMetadata {
  return cateringPackageMetadataSchema.parse(value);
}

export function validateMergedPackage(
  existing: CateringPackageInput,
  patch: CateringPackagePatch,
): CateringPackageInput {
  return cateringPackageInputSchema.parse({ ...existing, ...patch });
}

/** Canonical customer-facing price copy for package cards and details. */
export function formatCateringPackagePrice(
  value: Pick<CateringPackageInput, "currency" | "pricingModel" | "startingPrice">,
  locales?: Intl.LocalesArgument,
): string {
  if (value.pricingModel === "custom") return "Custom pricing";
  const amount = new Intl.NumberFormat(locales, {
    style: "currency",
    currency: value.currency,
  }).format(value.startingPrice);
  const suffix = value.pricingModel === "per_person"
    ? "/person"
    : value.pricingModel === "hourly"
      ? "/hour"
      : "";
  return `From ${amount}${suffix}`;
}

/** Multiple featured packages are supported; display order and creation time break ties publicly. */
export function orderPublicPackages<T extends { featured: boolean; displayOrder: number }>(packages: T[]) {
  return [...packages].sort((a, b) => Number(b.featured) - Number(a.featured) || a.displayOrder - b.displayOrder);
}

export function hasExactPackageSet(existing: string[], submitted: string[]) {
  return existing.length === submitted.length
    && new Set(existing).size === existing.length
    && new Set(submitted).size === submitted.length
    && existing.every((id) => submitted.includes(id));
}
