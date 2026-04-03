type PantryLikeItem = {
  id: unknown;
  name: unknown;
  category: unknown;
  quantity: unknown;
  unit: unknown;
};

export function isHouseholdManagerRole(role: unknown) {
  return role === "owner" || role === "admin";
}

export function getUserDisplayName(user: { username?: unknown; email?: unknown }) {
  return user.username || user.email;
}

function normalizeItemName(name: unknown) {
  return String(name ?? "").toLowerCase().trim();
}

function serializeSyncItem(item: PantryLikeItem) {
  return {
    id: String(item.id),
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
  };
}

export function partitionPersonalItemsForHouseholdSync(
  personalItems: PantryLikeItem[],
  householdItems: PantryLikeItem[]
) {
  const duplicates: Array<{ existing: ReturnType<typeof serializeSyncItem>; incoming: ReturnType<typeof serializeSyncItem> }> = [];
  const itemsToMove: unknown[] = [];

  for (const item of personalItems) {
    const existing = householdItems.find((householdItem) => {
      return normalizeItemName(householdItem.name) === normalizeItemName(item.name);
    });

    if (existing) {
      duplicates.push({
        existing: serializeSyncItem(existing),
        incoming: serializeSyncItem(item),
      });
      continue;
    }

    itemsToMove.push(item.id);
  }

  return {
    duplicates,
    itemsToMove,
  };
}
