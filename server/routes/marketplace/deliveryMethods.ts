const SHIPPING_METHODS = new Set(["shipped", "shipping"]);
const PICKUP_METHODS = new Set(["pickup", "local_pickup"]);
const DIGITAL_METHODS = new Set(["digital_download", "digital"]);

export function addDeliveryMethods(product: any) {
  const deliveryMethods: string[] = [];
  if (product.shippingEnabled) deliveryMethods.push("shipped");
  if (product.localPickupEnabled) deliveryMethods.push("pickup");
  if (product.inStoreOnly) deliveryMethods.push("in_store");
  if (product.isDigital) deliveryMethods.push("digital_download");
  return { ...product, deliveryMethods };
}

export function mapProductsWithDeliveryMethods(products: any[]) {
  return products.map(addDeliveryMethods);
}

export function parseDeliveryMethods(deliveryMethods?: string[]) {
  const deliveryData: any = {};

  if (deliveryMethods && deliveryMethods.length > 0) {
    const normalized = new Set(deliveryMethods.map((method) => method?.toLowerCase()));
    const hasShipping = Array.from(normalized).some((method) => SHIPPING_METHODS.has(method));
    const hasPickup = Array.from(normalized).some((method) => PICKUP_METHODS.has(method));
    const hasInStore = normalized.has("in_store");
    const hasDigital = Array.from(normalized).some((method) => DIGITAL_METHODS.has(method));

    deliveryData.shippingEnabled = hasShipping;
    deliveryData.localPickupEnabled = hasPickup;
    deliveryData.inStoreOnly =
      hasInStore &&
      !hasShipping &&
      !hasPickup;
    deliveryData.isDigital = hasDigital;
  }

  return deliveryData;
}
