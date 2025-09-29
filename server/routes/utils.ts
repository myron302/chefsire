import { Router } from "express";

// Node 18+ has global fetch; if you're on Node 16, install and import 'node-fetch'
const utils = Router();

/**
 * Simple category mapping to keep server in sync with client.
 */
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

/**
 * GET /api/lookup/:barcode
 * Looks up a product in OpenFoodFacts and returns a normalized pantry candidate.
 */
utils.get("/lookup/:barcode", async (req, res) => {
  const { barcode } = req.params;
  if (!barcode) return res.status(400).json({ error: "Missing barcode" });

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode
    )}.json`;

    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: "OFF upstream error" });

    const data = (await r.json()) as any;
    if (!data || data.status !== 1 || !data.product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const p = data.product;
    const name = p.product_name || p.brands || "Unknown product";
    const category = offTagsToCategory(p.categories_tags);

    return res.json({
      name,
      category,
      quantity: 1,
      unit: "piece",
      brand: p.brands || undefined,
      upc: barcode,
    });
  } catch (err) {
    console.error("lookup error", err);
    return res.status(500).json({ error: "Lookup failed" });
  }
});

/**
 * POST /api/export/text
 * Body: { items: [{ name, quantity?, unit? }] }
 * Returns: text/plain attachment
 */
utils.post("/export/text", async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const lines = items.map((i: any) => `- ${i.name}${i.quantity ? ` x${i.quantity}` : ""}${i.unit ? ` ${i.unit}` : ""}`);
  const txt = `Shopping List\n\n${lines.join("\n")}\n`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="shopping-list.txt"');
  res.status(200).send(txt);
});

/**
 * POST /api/export/csv
 * Body: { items: [{ name, quantity?, unit? }] }
 * Returns: text/csv attachment
 */
utils.post("/export/csv", async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const header = ["name", "quantity", "unit"];
  const rows = items.map((i: any) => [
    (i.name ?? "").toString().replace(/"/g, '""'),
    (i.quantity ?? "").toString(),
    (i.unit ?? "").toString().replace(/"/g, '""'),
  ]);
  const csv =
    header.join(",") +
    "\n" +
    rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n") +
    "\n";

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="shopping-list.csv"');
  res.status(200).send(csv);
});

/**
 * POST /api/export/instacart-links
 * Body: { items: [{ name }] }
 * Returns: ["https://www.instacart.com/store/search?q=milk", ...]
 *
 * (This just gives you quick search URLs. If you later join the official API/Partner program,
 * you can swap this for deep links.)
 */
utils.post("/export/instacart-links", async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const links = items
    .map((i: any) => (i?.name ? `https://www.instacart.com/store/search?q=${encodeURIComponent(i.name)}` : null))
    .filter(Boolean);
  res.json(links);
});

export default utils;
