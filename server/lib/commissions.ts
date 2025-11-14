/**
 * COMMISSION & DELIVERY CONFIGURATION
 *
 * Handles commission rates based on subscription tier and delivery method
 * Supports: shipped, pickup, in-store, and digital delivery
 */

export enum DeliveryMethod {
  SHIPPED = 'shipped',
  PICKUP = 'pickup',
  IN_STORE = 'in_store',
  DIGITAL = 'digital'
}

export enum ProductCategory {
  PHYSICAL = 'physical',
  DIGITAL = 'digital',
  COOKBOOK = 'cookbook', // Digital cookbooks
  INGREDIENT = 'ingredient',
  TOOL = 'tool',
  COURSE = 'course' // Online cooking courses
}

export interface CommissionRate {
  tier: string;
  shippedRate: number;      // Commission on shipped sales
  pickupRate: number;        // Commission on pickup sales
  inStoreRate: number;       // Commission on in-store sales
  digitalRate: number;       // Commission on digital products
  maxProducts: number | null; // null = unlimited
}

export const COMMISSION_RATES: Record<string, CommissionRate> = {
  free: {
    tier: 'free',
    shippedRate: 0.15,      // 15% on shipped sales
    pickupRate: 0.00,       // 0% on pickup
    inStoreRate: 0.00,      // 0% on in-store
    digitalRate: 0.10,      // 10% on digital
    maxProducts: 25
  },
  starter: {
    tier: 'starter',
    shippedRate: 0.10,      // 10% on shipped sales
    pickupRate: 0.00,       // 0% on pickup
    inStoreRate: 0.00,      // 0% on in-store
    digitalRate: 0.05,      // 5% on digital
    maxProducts: 100
  },
  pro: {
    tier: 'pro',
    shippedRate: 0.05,      // 5% on shipped sales
    pickupRate: 0.00,       // 0% on pickup
    inStoreRate: 0.00,      // 0% on in-store
    digitalRate: 0.03,      // 3% on digital
    maxProducts: null       // unlimited
  },
  enterprise: {
    tier: 'enterprise',
    shippedRate: 0.02,      // 2% on shipped sales
    pickupRate: 0.00,       // 0% on pickup
    inStoreRate: 0.00,      // 0% on in-store
    digitalRate: 0.00,      // 0% on digital
    maxProducts: null       // unlimited
  }
};

/**
 * Calculate commission for a sale
 */
export function calculateCommission(
  subtotal: number,
  tier: string,
  deliveryMethod: DeliveryMethod,
  productCategory: ProductCategory = ProductCategory.PHYSICAL
): number {
  const rates = COMMISSION_RATES[tier] || COMMISSION_RATES.free;

  let rate = 0;

  // Digital products use digital rate regardless of delivery method
  if (productCategory === ProductCategory.DIGITAL ||
      productCategory === ProductCategory.COOKBOOK ||
      productCategory === ProductCategory.COURSE) {
    rate = rates.digitalRate;
  } else {
    // Physical products - use delivery method
    switch (deliveryMethod) {
      case DeliveryMethod.SHIPPED:
        rate = rates.shippedRate;
        break;
      case DeliveryMethod.PICKUP:
        rate = rates.pickupRate;
        break;
      case DeliveryMethod.IN_STORE:
        rate = rates.inStoreRate;
        break;
      case DeliveryMethod.DIGITAL:
        rate = rates.digitalRate;
        break;
      default:
        rate = rates.shippedRate; // default to shipped rate
    }
  }

  return Math.round(subtotal * rate * 100) / 100; // Round to 2 decimals
}

/**
 * Get seller payout after commission
 */
export function calculateSellerPayout(
  subtotal: number,
  tier: string,
  deliveryMethod: DeliveryMethod,
  productCategory: ProductCategory = ProductCategory.PHYSICAL
): { commission: number; payout: number } {
  const commission = calculateCommission(subtotal, tier, deliveryMethod, productCategory);
  const payout = Math.round((subtotal - commission) * 100) / 100;

  return { commission, payout };
}

/**
 * Check if seller can add more products based on tier limits
 */
export function canAddProduct(currentCount: number, tier: string): boolean {
  const rates = COMMISSION_RATES[tier] || COMMISSION_RATES.free;

  if (rates.maxProducts === null) {
    return true; // unlimited
  }

  return currentCount < rates.maxProducts;
}

/**
 * Get commission rate display for UI
 */
export function getCommissionRateDisplay(tier: string, deliveryMethod: DeliveryMethod): string {
  const rates = COMMISSION_RATES[tier] || COMMISSION_RATES.free;

  let rate = 0;
  switch (deliveryMethod) {
    case DeliveryMethod.SHIPPED:
      rate = rates.shippedRate;
      break;
    case DeliveryMethod.PICKUP:
      rate = rates.pickupRate;
      break;
    case DeliveryMethod.IN_STORE:
      rate = rates.inStoreRate;
      break;
    case DeliveryMethod.DIGITAL:
      rate = rates.digitalRate;
      break;
  }

  return `${(rate * 100).toFixed(0)}%`;
}
