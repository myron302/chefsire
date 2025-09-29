import { Router } from "express";
import fetch from "node-fetch";

type PantryCandidate = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  brand?: string;
  upc?: string;
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
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("lookup failed");
    const data = await r.json();

    let candidate: PantryCandidate | null = null;

    if (data?.status === 1 && data?.product) {
      const p = data.product;
      const name = p.product_name || p.brands || "Unknown product";
      const category = offTagsToCategory(p.categories_tags);

      candidate = {
        name,
        category,
        quantity: 1,
        unit: "piece",
        brand: p.brands,
        upc: barcode,
      };
    }

    cache.set(barcode, { data: candidate, expiry: now + TTL_MS });
    res.json(candidate);
  } catch (e) {
    cache.set(barcode, { data: null, expiry: now + 5 * 60 * 1000 });
    res.json(null);
  }
});

export default router;
