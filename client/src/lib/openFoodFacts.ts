// client/src/lib/openFoodFacts.ts
export type OFFProduct = {
  code?: string;
  product?: {
    product_name?: string;
    brands?: string;
    categories_tags?: string[];
    nutriments?: Record<string, number>;
    quantity?: string; // e.g. "500 ml", "2 x 200 g", "12oz", "0.75 L"
  };
  status?: number; // 1 when found
  status_verbose?: string;
};

export type PantryCandidate = {
  name: string;
  category: string;
  quantity: number;
  unit: "piece" | "ml" | "g"; // we normalize to ml/g or piece
  // optional extras
  brand?: string;
  upc?: string;
};

const CATEGORY_MAP: Record<string, string> = {
  "en:fruits": "produce",
  "en:vegetables": "produce",
  "en:dairies": "dairy",
  "en:milk-and-yogurt": "dairy",
  "en:meats": "meat",
  "en:fish-and-seafood": "seafood",
  "en:cereals-and-potatoes": "grains",
  "en:spices": "spices",
  "en:beverages": "beverages",
  "en:frozen-foods": "frozen",
  "en:canned-foods": "canned",
};

function offTagsToCategory(tags?: string[]): string {
  if (!tags?.length) return "other";
  for (const tag of tags) {
    if (CATEGORY_MAP[tag]) return CATEGORY_MAP[tag];
    const prefix = Object.keys(CATEGORY_MAP).find((k) => tag.startsWith(k));
    if (prefix) return CATEGORY_MAP[prefix];
  }
  return "pantry";
}

/** Normalize known unit strings to a canonical token */
function normalizeUnit(raw: string): string {
  const u = raw.toLowerCase().replace(/\s+/g, "");
  if (u === "l" || u === "lt" || u === "liter" || u === "liters") return "l";
  if (u === "ml" || u === "milliliter" || u === "milliliters") return "ml";
  if (u === "kg" || u === "kilogram" || u === "kilograms") return "kg";
  if (u === "g" || u === "gram" || u === "grams") return "g";
  if (u === "oz" || u === "ounce" || u === "ounces") return "oz";
  if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") return "lb";
  if (u === "floz" || u === "fl.oz" || u === "fluidounce" || u === "fluidounces") return "floz";
  if (u === "ct" || u === "pcs" || u === "piece" || u === "pieces" || u === "count") return "piece";
  return u; // unknown
}

/**
 * Parse strings like:
 *  - "500 ml"
 *  - "750ml"
 *  - "0.75 L"
 *  - "2 x 200 g" / "2x200g"
 *  - "12 oz" (by weight → g)
 *  - "12 fl oz" (fluid ounce → ml)
 * Returns normalized { quantity, unit } where unit is "ml", "g" or "piece".
 */
function parseQuantity(qty?: string): { quantity: number; unit: "ml" | "g" | "piece" } | null {
  if (!qty) return null;
  const s = qty.trim();

  // Multipack like "2 x 200 g" or "12x355ml"
  const multiPack = s.match(/(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)\s*([a-zA-Z\. ]+)/i);
  if (multiPack) {
    const count = parseFloat(multiPack[1]);
    const eachNum = parseFloat(multiPack[2]);
    const rawUnit = normalizeUnit(multiPack[3] || "");
    return convertToNormalized(count * eachNum, rawUnit);
  }

  // Explicit "fl oz" (sometimes written with space)
  const flOz = s.match(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s*oz)/i);
  if (flOz) {
    const n = parseFloat(flOz[1]);
    return convertToNormalized(n, "floz");
  }

  // Simple "<num><unit>" with optional space: "500 ml", "750ml", "12oz", "1 kg", etc.
  const simple = s.match(/(\d+(?:\.\d+)?)(?:\s*)?([a-zA-Z\.]+)/);
  if (simple) {
    const n = parseFloat(simple[1]);
    const rawUnit = normalizeUnit(simple[2] || "");
    return convertToNormalized(n, rawUnit);
  }

  // If it’s clearly a count like "6 pack", "10 ct"
  const packCount = s.match(/(\d+)\s*(?:pack|ct|pcs|pieces|count)/i);
  if (packCount) {
    return { quantity: parseInt(packCount[1], 10), unit: "piece" };
  }

  return null;
}

function convertToNormalized(
  n: number,
  rawUnit: string
): { quantity: number; unit: "ml" | "g" | "piece" } | null {
  switch (normalizeUnit(rawUnit)) {
    case "ml":
      return { quantity: Math.round(n), unit: "ml" };
    case "l":
      return { quantity: Math.round(n * 1000), unit: "ml" };
    case "g":
      return { quantity: Math.round(n), unit: "g" };
    case "kg":
      return { quantity: Math.round(n * 1000), unit: "g" };
    case "oz": // assume weight ounce → grams
      return { quantity: Math.round(n * 28.3495), unit: "g" };
    case "lb":
      return { quantity: Math.round(n * 453.592), unit: "g" };
    case "floz": // US fluid ounce → ml
      return { quantity: Math.round(n * 29.5735), unit: "ml" };
    case "piece":
      return { quantity: Math.max(1, Math.round(n)), unit: "piece" };
    default:
      return null;
  }
}

export async function fetchOpenFoodFactsByBarcode(
  barcode: string
): Promise<PantryCandidate | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as OFFProduct;
  if (!data || data.status !== 1 || !data.product) return null;

  const { product } = data;

  const name =
    product.product_name ||
    product.brands ||
    "Unknown product";

  const category = offTagsToCategory(product.categories_tags);

  // Try to parse quantity string from OFF product
  const parsed = parseQuantity(product.quantity);

  // Fallbacks: 1 piece if we couldn't parse anything meaningful
  const quantity = parsed?.quantity ?? 1;
  const unit = parsed?.unit ?? "piece";

  return {
    name,
    category,
    quantity,
    unit,
    brand: product.brands,
    upc: barcode,
  };
}
