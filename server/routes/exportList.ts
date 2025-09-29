import { Router } from "express";

type ShoppingItem = {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  checked?: boolean;
  brand?: string;
  upc?: string;
};

const router = Router();

/**
 * POST /api/export/instacart-links
 * Body: ShoppingItem[]
 * Returns: array of search URLs you can open in new tabs
 */
router.post("/instacart-links", (req, res) => {
  const items = (Array.isArray(req.body) ? req.body : []) as ShoppingItem[];

  // Basic search URL (unsupported official API): tweak retailer param as desired
  const links = items
    .filter((i) => i.name)
    .map((i) => {
      const q = encodeURIComponent([i.brand, i.name].filter(Boolean).join(" "));
      // A generic search page; users pick exact product:
      const url = `https://www.instacart.com/store/search?v=2&q=${q}`;
      return { name: i.name, url };
    });

  res.json(links);
});

/**
 * POST /api/export/text
 * Body: ShoppingItem[]
 * Returns: plain text list
 */
router.post("/text", (req, res) => {
  const items = (Array.isArray(req.body) ? req.body : []) as ShoppingItem[];
  const lines = items.map(
    (i) =>
      `- ${i.name} — ${i.quantity} ${i.unit || ""}${i.brand ? ` (${i.brand})` : ""}`.trim()
  );
  res.type("text/plain").send(lines.join("\n"));
});

/**
 * POST /api/export/csv
 * Body: ShoppingItem[]
 * Returns: CSV download
 */
router.post("/csv", (req, res) => {
  const items = (Array.isArray(req.body) ? req.body : []) as ShoppingItem[];
  const header = ["name", "quantity", "unit", "category", "brand", "upc"].join(",");
  const rows = items.map((i) =>
    [
      i.name ?? "",
      i.quantity ?? "",
      i.unit ?? "",
      i.category ?? "",
      i.brand ?? "",
      i.upc ?? "",
    ]
      .map((s) => String(s).replaceAll('"', '""'))
      .map((s) => `"${s}"`)
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  res.setHeader("Content-Disposition", "attachment; filename=shopping-list.csv");
  res.type("text/csv").send(csv);
});

export default router;
