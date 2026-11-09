/**
 * Sample marketplace listings.
 *
 * server/seed.ts creates twelve demo products (ids "prod-1".."prod-12") owned by the demo accounts "user-1".."user-7".
 * They stay visible so a new marketplace shows what listings look like, but they are not real offers: they are labelled
 * "Sample listing" in the UI and checkout and payment refuse them.
 *
 * The marker is the seeded id pair (product id AND seller id), never the title. Real products get UUIDs and real
 * sellers get UUIDs, so a real listing can never match.
 */

export const SAMPLE_PRODUCT_IDS: ReadonlySet<string> = new Set(
  Array.from({ length: 12 }, (_, i) => `prod-${i + 1}`),
);

export const SAMPLE_SELLER_IDS: ReadonlySet<string> = new Set(
  Array.from({ length: 7 }, (_, i) => `user-${i + 1}`),
);

export const SAMPLE_LISTING_CODE = "SAMPLE_LISTING";

export const SAMPLE_LISTING_MESSAGE =
  "This is a sample listing showcasing ChefSire's Marketplace. It isn't available for purchase.";

export function isSampleProduct(product: { id?: unknown; sellerId?: unknown } | null | undefined): boolean {
  if (!product) return false;
  return SAMPLE_PRODUCT_IDS.has(String(product.id ?? "")) && SAMPLE_SELLER_IDS.has(String(product.sellerId ?? ""));
}
