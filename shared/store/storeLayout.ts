/**
 * Single source of truth for the `stores.layout` jsonb column shape.
 *
 * Version history:
 *   v1 (legacy) – flat StoreLayoutCustomizationConfig or a bare Craft.js node map
 *   v2           – { version: 2, customization: {...}, builder?: {...} }
 *
 * `normalizeStoreLayout` upgrades any legacy row to v2 on read.
 * No database migration is needed; the next save rewrites the row in v2 shape.
 */

export const STORE_LAYOUT_VERSION = 2 as const;

// ── Design token types ─────────────────────────────────────────────────────────

export type FontPairingId =
  | "inter"
  | "editorial"
  | "bold-display"
  | "warm-serif"
  | "soft-modern"
  | "refined-serif";

export type ButtonShape = "sharp" | "rounded" | "pill";
export type CornerRadius = "sharp" | "soft" | "round";

export type StoreThemeTokens = {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  text: string;
  fontPairing: FontPairingId;
  buttonShape: ButtonShape;
  cornerRadius: CornerRadius;
};

// ── Token resolution lookup tables ────────────────────────────────────────────

export const BUTTON_SHAPE_RADIUS: Record<ButtonShape, string> = {
  sharp: "0px",
  rounded: "8px",
  pill: "9999px",
};

export const CORNER_RADIUS: Record<CornerRadius, string> = {
  sharp: "0px",
  soft: "8px",
  round: "16px",
};

export const FONT_PAIRINGS: Record<FontPairingId, { heading: string; body: string }> = {
  inter: {
    heading: "Inter, sans-serif",
    body: "Inter, sans-serif",
  },
  editorial: {
    heading: "'Playfair Display', serif",
    body: "'Source Sans Pro', sans-serif",
  },
  "bold-display": {
    heading: "'Archivo Black', sans-serif",
    body: "Inter, sans-serif",
  },
  "warm-serif": {
    heading: "Lora, serif",
    body: "Lato, sans-serif",
  },
  "soft-modern": {
    heading: "Fraunces, serif",
    body: "Mulish, sans-serif",
  },
  "refined-serif": {
    heading: "'Cormorant Garamond', serif",
    body: "Mulish, sans-serif",
  },
};

// ── Inner types ────────────────────────────────────────────────────────────────

export type StoreLayoutCustomizationConfig = {
  logo?: string;
  bannerImage?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  showBanner?: boolean;
  aboutEnabled?: boolean;
  aboutTitle?: string;
  aboutContent?: string;
  announcementBar?: string;
  announcementEnabled?: boolean;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    email?: string;
    phone?: string;
  };
  contactInfo?: {
    address?: string;
    hours?: string;
  };
  layout?: {
    gridColumns?: number;
    productCardStyle?: "elevated" | "flat";
    spacing?: "compact" | "normal" | "relaxed";
  };
  /** @deprecated Use tokens instead. Kept for legacy read compatibility. */
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  tokens?: Partial<StoreThemeTokens>;
};

export type StoreBuilderNode = {
  type?: string;
  isCanvas?: boolean;
  props?: Record<string, unknown>;
  custom?: Record<string, unknown>;
  displayName?: string;
  parent?: string | null;
  nodes?: string[];
  linkedNodes?: Record<string, string>;
};

export type StoreBuilderLayoutConfig = Record<string, StoreBuilderNode>;

export type StoreLayoutConfigV2 = {
  version: 2;
  customization: StoreLayoutCustomizationConfig;
  builder?: StoreBuilderLayoutConfig;
};

// ── Craft.js node-map detection ────────────────────────────────────────────────

function looksLikeCraftNodeMap(obj: Record<string, unknown>): boolean {
  if ("ROOT" in obj) return true;
  const values = Object.values(obj);
  if (values.length === 0) return false;
  const craftLike = values.filter(
    (v) =>
      v !== null &&
      typeof v === "object" &&
      ("isCanvas" in (v as object) || "nodes" in (v as object) || "type" in (v as object)),
  );
  return craftLike.length / values.length >= 0.6;
}

// ── Legacy color → tokens backfill ────────────────────────────────────────────

function backfillTokensFromLegacyColors(
  customization: StoreLayoutCustomizationConfig,
): StoreLayoutCustomizationConfig {
  const { colors, tokens } = customization;
  if (!colors) return customization;

  const backfill: Partial<StoreThemeTokens> = {};
  if (colors.primary && !tokens?.primary) backfill.primary = colors.primary;
  if (colors.secondary && !tokens?.secondary) backfill.secondary = colors.secondary;
  if (colors.accent && !tokens?.accent) backfill.accent = colors.accent;

  if (Object.keys(backfill).length === 0) return customization;

  return {
    ...customization,
    tokens: { ...tokens, ...backfill },
  };
}

// ── Public normalizer ──────────────────────────────────────────────────────────

/**
 * Upgrade any stored layout value to the canonical v2 shape.
 * Safe to call with any value coming from the database.
 */
export function normalizeStoreLayout(raw: unknown): StoreLayoutConfigV2 {
  // Legacy string: old visual builder saved Craft.js state as a serialized JSON string
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return { version: 2, customization: {} };
    return { version: 2, customization: {}, builder: trimmed as unknown as StoreBuilderLayoutConfig };
  }

  // null / undefined / number / boolean / array → empty v2
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 2, customization: {} };
  }

  const obj = raw as Record<string, unknown>;

  // Already v2 — return defensively ensuring customization is an object
  if (obj.version === 2) {
    const rawCustomization =
      obj.customization !== null &&
      typeof obj.customization === "object" &&
      !Array.isArray(obj.customization)
        ? (obj.customization as StoreLayoutCustomizationConfig)
        : {};
    return {
      version: 2,
      customization: backfillTokensFromLegacyColors(rawCustomization),
      ...(obj.builder !== undefined ? { builder: obj.builder as StoreBuilderLayoutConfig } : {}),
    };
  }

  // Legacy Craft.js node map → put under builder, no customization data
  if (looksLikeCraftNodeMap(obj)) {
    return { version: 2, customization: {}, builder: obj as StoreBuilderLayoutConfig };
  }

  // Legacy flat customization object → put under customization, then backfill
  return {
    version: 2,
    customization: backfillTokensFromLegacyColors(obj as StoreLayoutCustomizationConfig),
  };
}
