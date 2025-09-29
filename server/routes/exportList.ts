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

// --- helpers ---------------------------------------------------------------
function coerceItems(body: any): ShoppingItem[] {
  // Support BOTH shapes:
  // 1) Array: [ {..}, {..} ]
  // 2) Object: { items: [ {..}, {..} ] }
  const raw = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];

  return raw
    .filter((i: any) => i && typeof i.name === "string" && i.name.trim())
    .map((i: any) => ({
      name: String(i.name).trim(),
      quantity: Number.isFinite(Number(i.quantity)) ? Number(i.quantity) : 1,
      unit: String(i.unit || "").trim() || "ea",
      category: i.category ? String(i.category) : undefined,
      checked: Boolean(i.checked),
      brand: i.brand ? String(i.brand) : undefined,
      upc: i.upc ? String(i.upc) : undefined,
    }));
}

function csvEscape(s: unknown) {
  return `"${String(s ?? "").replaceAll(`"`, `""`)}"`;
}

// --- routes ----------------------------------------------------------------

/**
 * POST /api/export/instacart-links
 * body: ShoppingItem[]  OR  { items: ShoppingItem[] }
 * returns: [{ name, url }]
 */
router.post("/instacart-links", (req, res) => {
  const items = coerceItems(req.body);
  if (!items.length) return res.status(400).json({ error: "No items provided" });

  const links = items.map((i) => {
    const q = encodeURIComponent([i.brand, i.name].filter(Boolean).join(" "));
    return { name: i.name, url: `https://www.instacart.com/store/search?v=2&q=${q}` };
  });

  res.json(links);
});

/**
 * POST /api/export/text
 * body: ShoppingItem[]  OR  { items: ShoppingItem[] }
 * returns: text/plain attachment
 */
router.post("/text", (req, res) => {
  const items = coerceItems(req.body);
  if (!items.length) return res.status(400).send("No items provided");

  const lines = items.map((i) => {
    const qty = Number.isFinite(i.quantity) ? i.quantity : 1;
    const unit = i.unit || "ea";
    const brand = i.brand ? ` (${i.brand})` : "";
    return `- ${i.name} — ${qty} ${unit}${brand}`;
  });

  res.setHeader("Content-Disposition", 'attachment; filename="shopping-list.txt"');
  res.type("text/plain").send(lines.join("\n"));
});

/**
 * POST /api/export/csv
 * body: ShoppingItem[]  OR  { items: ShoppingItem[] }
 * returns: text/csv attachment
 */
router.post("/csv", (req, res) => {
  const items = coerceItems(req.body);
  if (!items.length) return res.status(400).send("No items provided");

  const header = ["name", "quantity", "unit", "category", "brand", "upc"].join(",");
  const rows = items.map((i) =>
    [i.name, i.quantity, i.unit, i.category, i.brand, i.upc].map(csvEscape).join(",")
  );

  res.setHeader("Content-Disposition", 'attachment; filename="shopping-list.csv"');
  res.type("text/csv").send([header, ...rows].join("\n"));
});

export default router;
