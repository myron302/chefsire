// client/src/lib/shoppingExport.ts
export type ShoppingItem = {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  checked?: boolean;
  brand?: string;
  upc?: string;
};

// Accept BOTH shapes: array OR { items: [...] }
function toDualShapeBody(items: ShoppingItem[] | { items: ShoppingItem[] }) {
  return Array.isArray(items) ? items : items.items;
}

/** Returns [{ name, url }] */
export async function exportInstacartLinks(
  items: ShoppingItem[] | { items: ShoppingItem[] }
) {
  const body = toDualShapeBody(items);
  const res = await fetch("/api/export/instacart-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to generate Instacart links");
  return (await res.json()) as { name: string; url: string }[];
}

/** Returns plain text string (you can copy to clipboard or show a modal) */
export async function exportText(items: ShoppingItem[] | { items: ShoppingItem[] }) {
  const body = toDualShapeBody(items);
  const res = await fetch("/api/export/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to generate text list");
  return await res.text();
}

/** Triggers a download of shopping-list.csv */
export async function exportCSV(
  items: ShoppingItem[] | { items: ShoppingItem[] },
  filename = "shopping-list.csv"
) {
  const body = toDualShapeBody(items);
  const res = await fetch("/api/export/csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to generate CSV");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
