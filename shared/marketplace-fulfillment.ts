/**
 * The single authoritative rule for whether a marketplace product is digital.
 * Both the checkout order route (server) and the checkout UI (client) import
 * this so a digital product can never be priced with shipping on one side and
 * without it on the other.
 */
export function isDigitalMarketplaceProduct(product: {
  isDigital?: boolean | null;
  productCategory?: string | null;
}): boolean {
  return Boolean(product.isDigital) || ["digital", "cookbook", "course"].includes(product.productCategory ?? "");
}

/**
 * Shipping is only ever payable for a physical product being shipped. A
 * digital product is never charged shipping, regardless of what fulfillment
 * method a client-side form happens to have selected.
 */
export function resolveMarketplaceShippingCost(product: {
  isDigital?: boolean | null;
  productCategory?: string | null;
  shippingCost?: string | number | null;
}, fulfillmentMethod: "shipping" | "local_pickup"): number {
  if (isDigitalMarketplaceProduct(product)) return 0;
  if (fulfillmentMethod !== "shipping" || !product.shippingCost) return 0;
  const cost = typeof product.shippingCost === "number" ? product.shippingCost : parseFloat(product.shippingCost);
  return Number.isFinite(cost) ? cost : 0;
}
