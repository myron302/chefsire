import type { PantryFormData, PantryItem } from "./types";

type ScannedPantryInput = {
  name: string;
  category: string;
  quantity: string;
  unit: string;
  brand: string;
  imageUrl: string;
};

export async function addScannedPantryItem(input: ScannedPantryInput) {
  return fetch("/api/pantry/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name: input.name,
      category: input.category || null,
      quantity: input.quantity,
      unit: input.unit,
      notes: input.brand ? `Brand: ${input.brand}` : null,
      imageUrl: input.imageUrl || null,
    }),
  });
}

export async function fetchAllergenWarnings() {
  const res = await fetch("/api/allergies/pantry/check", {
    credentials: "include",
  });
  if (!res.ok) return { warnings: [] };
  return res.json();
}

export async function fetchPantryHousehold() {
  const res = await fetch("/api/pantry/household", { credentials: "include" });
  if (!res.ok) return { household: null };
  return res.json();
}

export async function fetchExpiringPantryItems(days: number) {
  const res = await fetch(`/api/pantry/expiring-soon?days=${days}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch expiring items");
  return res.json();
}

export async function deletePantryItem(itemId: string) {
  const res = await fetch(`/api/pantry/items/${itemId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete item");
  return res.json();
}

export async function updatePantryItem(data: Partial<PantryItem> & { id: string }) {
  const res = await fetch(`/api/pantry/pantry/${data.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name: data.name,
      category: data.category,
      quantity: data.quantity,
      unit: data.unit,
      location: data.location,
      expirationDate: data.expirationDate,
      notes: data.notes,
      isRunningLow: data.isRunningLow,
      householdId: data.householdId,
    }),
  });
  if (!res.ok) throw new Error("Failed to update item");
  return res.json();
}

export function buildGroceryListPayloadFromPantryItem(item: PantryItem) {
  return {
    ingredientName: item.name,
    quantity: item.quantity || "1",
    unit: item.unit || "",
    category: item.category || "Other",
    notes: item.notes,
  };
}

export function buildGroceryListPayloadFromForm(data: PantryFormData) {
  return {
    ingredientName: data.name,
    quantity: data.quantity || "1",
    unit: data.unit || "",
    category: data.category || "Other",
    notes: data.notes,
    isRunningLow: data.isRunningLow,
  };
}

export async function addItemsToGroceryList(items: PantryItem[]) {
  const promises = items.map((item) =>
    fetch("/api/meal-planner/grocery-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(buildGroceryListPayloadFromPantryItem(item)),
    }),
  );

  const results = await Promise.all(promises);
  const failedResults = results.filter((r) => !r.ok);

  if (failedResults.length > 0) {
    throw new Error(`Failed to add ${failedResults.length} item(s) to shopping list`);
  }

  return results;
}

export async function addPantryItem(data: PantryFormData) {
  const cleanedData = {
    ...data,
    expirationDate: data.expirationDate ? new Date(data.expirationDate).toISOString() : undefined,
  };

  const res = await fetch("/api/pantry/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(cleanedData),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || "Failed to add item");
  }

  return res.json();
}

export async function addFormItemToGroceryList(data: PantryFormData) {
  return fetch("/api/meal-planner/grocery-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(buildGroceryListPayloadFromForm(data)),
  });
}
