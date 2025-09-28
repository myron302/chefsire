// client/src/lib/openFoodFacts.ts
export type OFFProduct = {
  code?: string;
  product?: {
    product_name?: string;
    brands?: string;
    categories_tags?: string[];
    nutriments?: Record<string, number>;
    quantity?: string;
  };
  status?: number;
  status_verbose?: string;
};

export type PantryCandidate = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  // optional extras you might save later:
  brand?: string;
  upc?: string;
};

const CATEGORY_MAP: Record<string, string> = {
  // crude mapping from OFF categories → your pantry categories
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
    // try prefix matches (e.g., "en:vegetables-based-foods")
    const prefix = Object.keys(CATEGORY_MAP).find((k) => tag.startsWith(k));
    if (prefix) return CATEGORY_MAP[prefix];
  }
  return "pantry"; // safe default bucket
}

export async function fetchOpenFoodFactsByBarcode(
  barcode: string
): Promise<PantryCandidate | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode
  )}.json`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as OFFProduct;
  if (!data || data.status !== 1 || !data.product) return null;

  const name =
    data.product.product_name ||
    data.product.brands ||
    "Unknown product";

  const category = offTagsToCategory(data.product.categories_tags);
  // Very rough default: “1 piece”. You can improve with data.product.quantity if you like.
  return {
    name,
    category,
    quantity: 1,
    unit: "piece",
    brand: data.product.brands,
    upc: barcode,
  };
}
