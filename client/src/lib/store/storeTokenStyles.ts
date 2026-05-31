import type React from "react";
import { BUTTON_SHAPE_RADIUS, CORNER_RADIUS, FONT_PAIRINGS } from "@shared/store/storeLayout";
import type { StoreThemeTokens } from "@shared/store/storeLayout";

/**
 * Convert a fully resolved StoreThemeTokens set into a React inline-style
 * object containing all --store-* CSS custom properties.
 */
export function tokensToStyleVars(tokens: StoreThemeTokens): React.CSSProperties {
  const pairing = FONT_PAIRINGS[tokens.fontPairing] ?? FONT_PAIRINGS.inter;
  return {
    "--store-primary": tokens.primary,
    "--store-secondary": tokens.secondary,
    "--store-accent": tokens.accent,
    "--store-surface": tokens.surface,
    "--store-text": tokens.text,
    "--store-font-heading": pairing.heading,
    "--store-font-body": pairing.body,
    "--store-button-radius": BUTTON_SHAPE_RADIUS[tokens.buttonShape] ?? "8px",
    "--store-radius": CORNER_RADIUS[tokens.cornerRadius] ?? "8px",
  } as React.CSSProperties;
}
