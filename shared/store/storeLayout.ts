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
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
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
  // Craft.js always serializes a ROOT node
  if ("ROOT" in obj) return true;
  // Fallback: majority of values look like Craft nodes { type, nodes } / { isCanvas }
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

// ── Public normalizer ──────────────────────────────────────────────────────────

/**
 * Upgrade any stored layout value to the canonical v2 shape.
 * Safe to call with any value coming from the database.
 */
export function normalizeStoreLayout(raw: unknown): StoreLayoutConfigV2 {
  // null / undefined / primitive / array → empty v2
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 2, customization: {} };
  }

  const obj = raw as Record<string, unknown>;

  // Already v2 — return defensively ensuring customization is an object
  if (obj.version === 2) {
    return {
      version: 2,
      customization:
        obj.customization !== null &&
        typeof obj.customization === "object" &&
        !Array.isArray(obj.customization)
          ? (obj.customization as StoreLayoutCustomizationConfig)
          : {},
      ...(obj.builder !== undefined ? { builder: obj.builder as StoreBuilderLayoutConfig } : {}),
    };
  }

  // Legacy Craft.js node map → put under builder, no customization data
  if (looksLikeCraftNodeMap(obj)) {
    return { version: 2, customization: {}, builder: obj as StoreBuilderLayoutConfig };
  }

  // Legacy flat customization object → put under customization
  return { version: 2, customization: obj as StoreLayoutCustomizationConfig };
}
