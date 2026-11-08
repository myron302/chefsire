import type { SyntheticEvent } from "react";

export const PRODUCT_PLACEHOLDER = "/placeholder-product.svg";

/**
 * onError handler that swaps a broken image (for example a missing /uploads file) for a placeholder.
 * Source-aware: it decides from the image's CURRENT src, so an <img> React reuses for a different (also broken)
 * image falls back again, and it never re-swaps when the placeholder itself fails, so it can't loop.
 */
export function fallbackTo(placeholder: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (isPlaceholderSrc(img.getAttribute("src"), placeholder)) return;
    img.src = placeholder;
  };
}

export function isPlaceholderSrc(src: string | null, placeholder: string): boolean {
  if (!src) return false;
  try {
    return new URL(src, "http://local.invalid").pathname === placeholder;
  } catch {
    return src === placeholder;
  }
}

export const onProductImageError = fallbackTo(PRODUCT_PLACEHOLDER);

export const MEDIA_PLACEHOLDER = "/placeholder.svg";
export const onMediaImageError = fallbackTo(MEDIA_PLACEHOLDER);
