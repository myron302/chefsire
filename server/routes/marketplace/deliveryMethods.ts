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
    deliveryData.shippingEnabled = deliveryMethods.includes("shipped");
    deliveryData.localPickupEnabled = deliveryMethods.includes("pickup");
    deliveryData.inStoreOnly =
      deliveryMethods.includes("in_store") &&
      !deliveryMethods.includes("shipped") &&
      !deliveryMethods.includes("pickup");
    deliveryData.isDigital = deliveryMethods.includes("digital_download");
  }

  return deliveryData;
}
