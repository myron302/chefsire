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

router.post("/instacart-links", (req, res) => {
  const items = (Array.isArray(req.body) ? req.body : []) as ShoppingItem[];
  const links = items.map((i) => {
    const q = encodeURIComponent([i.brand, i.name].filter(Boolean).join(" "));
    return { name: i.name, url: `https://www.instacart.com/store/search?v=2&q=${q}` };
  });
  res.json(links);
});

router.post("/text", (req, res) => {
  const items = (Array.isArray(req.body) ? req.body : []) as ShoppingItem[];
  const lines = items.map(
    (i) => `- ${i.name} — ${i.quantity} ${i.unit}${i.brand ? ` (${i.brand})` : ""}`
  );
  res.type("text/plain").send(lines.join("\n"));
});

router.post("/csv", (req, res) => {
  const items = (Array.isArray(req.body) ? req.body : []) as ShoppingItem[];
  const header = ["name", "quantity", "unit", "category", "brand", "upc"].join(",");
  const rows = items.map((i) =>
    [i.name, i.quantity, i.unit, i.category, i.brand, i.upc]
      .map((s) => `"${String(s || "").replaceAll('"', '""')}"`)
      .join(",")
  );
  res.setHeader("Content-Disposition", "attachment; filename=shopping-list.csv");
  res.type("text/csv").send([header, ...rows].join("\n"));
});

export default router;
