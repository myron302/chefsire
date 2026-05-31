/**
 * All 16 store theme presets and the resolver function.
 * Pure data — no React imports.
 */

import type { StoreThemeTokens } from "./storeLayout";

export const STORE_THEME_PRESETS: Record<string, StoreThemeTokens> = {
  // ── 4 originals (colors preserved from before Step 3) ──────────────────────
  modern: {
    primary: "#FF6B35",
    secondary: "#2C3E50",
    accent: "#F7F7F7",
    surface: "#FFFFFF",
    text: "#1A1A1A",
    fontPairing: "inter",
    buttonShape: "rounded",
    cornerRadius: "soft",
  },
  elegant: {
    primary: "#B8860B",
    secondary: "#4A4A4A",
    accent: "#F5F5DC",
    surface: "#FFFFFF",
    text: "#1A1A1A",
    fontPairing: "editorial",
    buttonShape: "sharp",
    cornerRadius: "sharp",
  },
  vibrant: {
    primary: "#FF1744",
    secondary: "#00BCD4",
    accent: "#FFEB3B",
    surface: "#FFFFFF",
    text: "#1A1A1A",
    fontPairing: "bold-display",
    buttonShape: "pill",
    cornerRadius: "round",
  },
  rustic: {
    primary: "#8B4513",
    secondary: "#556B2F",
    accent: "#DEB887",
    surface: "#FAF6EE",
    text: "#2E1F0F",
    fontPairing: "warm-serif",
    buttonShape: "rounded",
    cornerRadius: "soft",
  },

  // ── 12 curated food-niche presets ──────────────────────────────────────────
  "farmers-market": {
    primary: "#E07A2A",
    secondary: "#4A7C3A",
    accent: "#F5E6CC",
    surface: "#FFFCF7",
    text: "#2A1F12",
    fontPairing: "warm-serif",
    buttonShape: "rounded",
    cornerRadius: "soft",
  },
  "artisan-bakery": {
    primary: "#B27A4E",
    secondary: "#5B4636",
    accent: "#F2E4D0",
    surface: "#FBF6EE",
    text: "#2B1F14",
    fontPairing: "soft-modern",
    buttonShape: "rounded",
    cornerRadius: "round",
  },
  "dark-bistro": {
    primary: "#C9A961",
    secondary: "#5C0E12",
    accent: "#1A1A1A",
    surface: "#0F0F0F",
    text: "#F5EFE0",
    fontPairing: "editorial",
    buttonShape: "sharp",
    cornerRadius: "sharp",
  },
  "bright-meal-prep": {
    primary: "#00C853",
    secondary: "#263238",
    accent: "#FF5252",
    surface: "#FFFFFF",
    text: "#1A1A1A",
    fontPairing: "inter",
    buttonShape: "pill",
    cornerRadius: "soft",
  },
  "spice-heritage": {
    primary: "#D49531",
    secondary: "#1B4D4D",
    accent: "#3A2618",
    surface: "#FBF4E6",
    text: "#2B1810",
    fontPairing: "refined-serif",
    buttonShape: "rounded",
    cornerRadius: "soft",
  },
  "coastal-catch": {
    primary: "#1B5A77",
    secondary: "#E67E50",
    accent: "#E8DCC4",
    surface: "#FAF7F0",
    text: "#1A2E3A",
    fontPairing: "bold-display",
    buttonShape: "sharp",
    cornerRadius: "soft",
  },
  "sweet-confections": {
    primary: "#E89BBC",
    secondary: "#6B3F4F",
    accent: "#E6B85F",
    surface: "#FFFAF6",
    text: "#3A1F26",
    fontPairing: "soft-modern",
    buttonShape: "pill",
    cornerRadius: "round",
  },
  "smoke-fire": {
    primary: "#C73E1D",
    secondary: "#2B2B2B",
    accent: "#E8C547",
    surface: "#1A1410",
    text: "#F2E4D0",
    fontPairing: "bold-display",
    buttonShape: "sharp",
    cornerRadius: "sharp",
  },
  "garden-fresh": {
    primary: "#6FA85F",
    secondary: "#2F4A30",
    accent: "#E8B872",
    surface: "#F8F5EC",
    text: "#1F2E1F",
    fontPairing: "warm-serif",
    buttonShape: "rounded",
    cornerRadius: "round",
  },
  "heritage-italian": {
    primary: "#A51E1E",
    secondary: "#1F4D33",
    accent: "#E8D5A5",
    surface: "#FBF6EC",
    text: "#2A1A18",
    fontPairing: "editorial",
    buttonShape: "rounded",
    cornerRadius: "soft",
  },
  "street-eats": {
    primary: "#FFC107",
    secondary: "#D32F2F",
    accent: "#212121",
    surface: "#FFFFFF",
    text: "#212121",
    fontPairing: "bold-display",
    buttonShape: "sharp",
    cornerRadius: "sharp",
  },
  "modern-minimal": {
    primary: "#1A1A1A",
    secondary: "#6B6B6B",
    accent: "#D4A574",
    surface: "#FFFFFF",
    text: "#0D0D0D",
    fontPairing: "inter",
    buttonShape: "sharp",
    cornerRadius: "sharp",
  },
};

// Display-ordered list: 4 originals first, then 12 curated in spec order
export const STORE_THEME_LIST: { id: string; name: string }[] = [
  { id: "modern", name: "Modern" },
  { id: "elegant", name: "Elegant" },
  { id: "vibrant", name: "Vibrant" },
  { id: "rustic", name: "Rustic" },
  { id: "farmers-market", name: "Farmers Market" },
  { id: "artisan-bakery", name: "Artisan Bakery" },
  { id: "dark-bistro", name: "Dark Bistro" },
  { id: "bright-meal-prep", name: "Bright Meal-Prep" },
  { id: "spice-heritage", name: "Spice & Heritage" },
  { id: "coastal-catch", name: "Coastal Catch" },
  { id: "sweet-confections", name: "Sweet Confections" },
  { id: "smoke-fire", name: "Smoke & Fire" },
  { id: "garden-fresh", name: "Garden Fresh" },
  { id: "heritage-italian", name: "Heritage Italian" },
  { id: "street-eats", name: "Street Eats" },
  { id: "modern-minimal", name: "Modern Minimal" },
];

/**
 * Returns a fully resolved token set by applying overrides on top of the
 * chosen preset. Falls back to the `modern` preset for unknown themeIds.
 */
export function resolveThemeTokens(
  themeId: string | null | undefined,
  overrides?: Partial<StoreThemeTokens>,
): StoreThemeTokens {
  const base = STORE_THEME_PRESETS[themeId ?? "modern"] ?? STORE_THEME_PRESETS.modern;
  if (!overrides || Object.keys(overrides).length === 0) return base;
  return { ...base, ...overrides } as StoreThemeTokens;
}
