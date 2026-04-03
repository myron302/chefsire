export type ScannedPantryItemPayload = {
  name: string;
  category: string;
  quantity: string;
  unit: string;
  brand: string;
  imageUrl: string;
};

export function parseScannedPantryItemFromSearch(search: string): ScannedPantryItemPayload | null {
  const params = new URLSearchParams(search);
  const barcode = params.get("barcode");
  const name = params.get("name");

  if (!barcode || !name) {
    return null;
  }

  return {
    name,
    category: params.get("category") || "",
    quantity: params.get("quantity") || "1",
    unit: params.get("unit") || "piece",
    brand: params.get("brand") || "",
    imageUrl: params.get("imageUrl") || "",
  };
}

export function getInitialPantryTab(search: string): "inventory" | "tools" {
  const tab = new URLSearchParams(search).get("tab");
  return tab === "tools" ? "tools" : "inventory";
}

export function buildPantryTabUrl(pathname: string, search: string, tab: string): string {
  const params = new URLSearchParams(search);

  if (tab === "tools") {
    params.set("tab", "tools");
  } else {
    params.delete("tab");
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
