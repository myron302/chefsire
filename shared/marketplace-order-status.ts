/**
 * How a Marketplace order's fulfillment status is described to people.
 *
 * The stored statuses are shared by every delivery method ("delivered" is the final state for a pickup order too),
 * so the words depend on how the order is being fulfilled: a pickup order is "picked up", never "delivered" or
 * "shipped".
 */

export type OrderDeliveryMethod = "shipped" | "pickup" | "in_store" | "digital" | string | null | undefined;

const isPickup = (method: OrderDeliveryMethod) => method === "pickup" || method === "in_store";

/** Only shipped orders can be marked shipped. */
export function canMarkShipped(method: OrderDeliveryMethod): boolean {
  return method === "shipped";
}

/** Short label for order lists ("Order: <label>"). */
export function orderStatusLabel(status: string | null | undefined, method: OrderDeliveryMethod): string {
  switch (status ?? "pending") {
    case "pending":
    case "paid":
      return "Waiting for the seller";
    case "processing":
      return isPickup(method) ? "Being prepared for pickup" : "Being prepared";
    case "shipped":
      return "Shipped";
    case "delivered":
      return isPickup(method) ? "Picked up" : method === "digital" ? "Completed" : "Delivered";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    default:
      return String(status);
  }
}

/** Sentence for the buyer's notification: `Your order for ${item} ${orderStatusSentence(...)}`. */
export function orderStatusSentence(status: string, method: OrderDeliveryMethod): string {
  switch (status) {
    case "processing":
      return isPickup(method) ? "is being prepared for pickup" : "is being prepared";
    case "shipped":
      return "has shipped";
    case "delivered":
      return isPickup(method) ? "has been picked up" : method === "digital" ? "is complete" : "has been delivered";
    case "cancelled":
      return "was cancelled";
    case "refunded":
      return "was refunded";
    default:
      return `is now ${status}`;
  }
}
