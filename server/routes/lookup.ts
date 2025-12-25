import { Router } from "express";
import fetch from "node-fetch";

type PantryCandidate = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  brand?: string;
  upc?: string;
  /**
   * URL of the product image returned by OpenFoodFacts.  Not all
   * products include an image; if unavailable this field will be
   * undefined.  Consumers can use this to display a thumbnail or icon
   * alongside scanned items.
   */
  imageUrl?: string;
};

const router = Router();

const cache = new Map<string, { data: PantryCandidate | null; expiry: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;

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

router.get("/:barcode", async (req, res) => {
  const { barcode } = req.params;
  if (!barcode) return res.status(400).json({ error: "barcode required" });

  const now = Date.now();
  const hit = cache.get(barcode);
  if (hit && hit.expiry > now) return res.json(hit.data);

  try {
    // Request only the fields we need from OpenFoodFacts.  Using the
    // `fields` query parameter reduces response size and makes parsing
    // explicit.  See https://world.openfoodfacts.org/data for details.
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,image_url,quantity,categories_tags`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("lookup failed");
    const data = await r.json();

    let candidate: PantryCandidate | null = null;

    if (data?.status === 1 && data?.product) {
      const p = data.product;
      // Prefer product_name, fallback to brand name or generic placeholder
      const name: string = p.product_name || p.brands || "Unknown product";
      const category: string = offTagsToCategory(p.categories_tags);
      // Parse the quantity string returned by OFF (e.g. "500 g" or "1 kg").
      // If no quantity is provided, default to 1 piece.  OFF's quantity
      // field may include decimals, commas or units; this parser extracts
      // the numeric part and unit.
      let quantityNum = 1;
      let unit = "piece";
      if (typeof p.quantity === "string" && p.quantity.trim() !== "") {
        // Replace commas with dots for decimal parsing and split into parts
        const qty = p.quantity.replace(/,/g, ".").trim();
        const match = qty.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
        if (match) {
          quantityNum = parseFloat(match[1]);
          if (!isNaN(quantityNum) && match[2]) {
            unit = match[2].toLowerCase();
          }
        }
      }

      candidate = {
        name,
        category,
        quantity: quantityNum,
        unit,
        brand: p.brands || undefined,
        upc: barcode,
        imageUrl: p.image_url || undefined,
      };
    }

    cache.set(barcode, { data: candidate, expiry: now + TTL_MS });
    res.json(candidate);
  } catch (error) {
    cache.set(barcode, { data: null, expiry: now + 5 * 60 * 1000 });
    res.json(null);
  }
});

export default router;
