import type { SyntheticEvent } from "react";

export const PRODUCT_PLACEHOLDER = "/placeholder-product.svg";

/**
 * onError handler that swaps a broken image (for example a missing /uploads file) for a placeholder.
 * Swaps only once, so a missing placeholder can never cause an error loop.
 */
export function fallbackTo(placeholder: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "1";
    img.src = placeholder;
  };
}

export const onProductImageError = fallbackTo(PRODUCT_PLACEHOLDER);
