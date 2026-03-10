export type ShoppingListItemInput = {
  name: string;
  quantity?: number | string;
  unit?: string;
  category?: string;
  note?: string;
  optional?: boolean;
};

type GroceryListResponse = {
  items?: Array<{ ingredientName?: string; unit?: string | null }>;
};

const PENDING_KEY = "pendingShoppingListItems";

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

function toKey(name: string, unit?: string) {
  return `${normalize(name)}::${normalize(unit ?? "")}`;
}

function normalizeQuantity(quantity: ShoppingListItemInput["quantity"]): string {
  if (typeof quantity === "number" && Number.isFinite(quantity)) return `${quantity}`;
  if (typeof quantity === "string" && quantity.trim()) return quantity.trim();
  return "1";
}

const OPTIONAL_SUFFIX_RE = /\s*\((optional[^)]*)\)\s*$/i;

export function normalizeShoppingListItem(item: ShoppingListItemInput): ShoppingListItemInput {
  const originalName = String(item.name ?? "").trim();
  const optionalInName = OPTIONAL_SUFFIX_RE.exec(originalName);
  const normalizedName = optionalInName
    ? originalName.replace(OPTIONAL_SUFFIX_RE, "").trim()
    : originalName;

  const hasOptionalNote = /\boptional\b/i.test(String(item.note ?? ""));
  const optional = Boolean(item.optional || optionalInName || hasOptionalNote);
  const note = item.note?.trim();

  return {
    ...item,
    name: normalizedName || originalName,
    optional,
    note: optional
      ? note
        ? /\boptional\b/i.test(note)
          ? note
          : `${note} (optional)`
        : "optional"
      : note,
  };
}

function parsePending(): ShoppingListItemInput[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    const parsed = raw ? (JSON.parse(raw) as ShoppingListItemInput[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePending(items: ShoppingListItemInput[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(items));
}

export async function addItemsToShoppingList(items: ShoppingListItemInput[]) {
  const cleaned = items
    .map((rawItem) => {
      const item = normalizeShoppingListItem(rawItem);

      return {
        name: item.name?.trim(),
        quantity: normalizeQuantity(item.quantity),
        unit: (item.unit ?? "").trim(),
        category: item.category ?? "Other",
        note: item.note,
        optional: item.optional,
      };
    })
    .filter((item) => Boolean(item.name));

  const dedupedMap = new Map<string, (typeof cleaned)[number]>();
  for (const item of cleaned) {
    dedupedMap.set(toKey(item.name!, item.unit), item);
  }
  const deduped = Array.from(dedupedMap.values());

  if (deduped.length === 0) return { addedCount: 0, skippedCount: 0 };

  let existingKeys = new Set<string>();
  try {
    const existingRes = await fetch("/api/meal-planner/grocery-list?purchased=false", { credentials: "include" });
    if (existingRes.ok) {
      const existingData = (await existingRes.json()) as GroceryListResponse;
      for (const item of existingData.items ?? []) {
        if (item.ingredientName) existingKeys.add(toKey(item.ingredientName, item.unit ?? ""));
      }
    }
  } catch {
    // Ignore and continue.
  }

  let addedCount = 0;
  const failed: ShoppingListItemInput[] = [];

  for (const item of deduped) {
    const key = toKey(item.name!, item.unit);
    if (existingKeys.has(key)) continue;

    try {
      const res = await fetch("/api/meal-planner/grocery-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ingredientName: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          notes: item.note,
        }),
      });

      if (!res.ok) throw new Error("failed");
      addedCount += 1;
      existingKeys.add(key);
    } catch {
      failed.push(item);
    }
  }

  if (failed.length > 0) {
    const pending = parsePending();
    const combined = [...pending, ...failed];
    const uniquePending = new Map<string, ShoppingListItemInput>();
    for (const item of combined) uniquePending.set(toKey(item.name, item.unit), item);
    savePending(Array.from(uniquePending.values()));
  }

  return {
    addedCount,
    skippedCount: deduped.length - addedCount,
  };
}
