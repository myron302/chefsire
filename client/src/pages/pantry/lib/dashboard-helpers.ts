import { differenceInDays, isPast } from "date-fns";
import type { PantryItem } from "./types";

export type ExpiryStatus = {
  status: "none" | "expired" | "urgent" | "warning" | "soon" | "fresh";
  label: string;
  color: string;
};

export type PantryStats = {
  total: number;
  expiring: number;
  expired: number;
  runningLow: number;
};

export function getExpiryStatus(expirationDate: string | null): ExpiryStatus {
  if (!expirationDate) return { status: "none", label: "", color: "" };

  const expDate = new Date(expirationDate);
  const daysUntilExpiry = differenceInDays(expDate, new Date());

  if (isPast(expDate)) {
    return { status: "expired", label: "Expired", color: "bg-red-100 text-red-800" };
  }

  if (daysUntilExpiry <= 1) {
    return { status: "urgent", label: "Expires today", color: "bg-orange-100 text-orange-800" };
  }

  if (daysUntilExpiry <= 3) {
    return { status: "warning", label: `${daysUntilExpiry}d left`, color: "bg-yellow-100 text-yellow-800" };
  }

  if (daysUntilExpiry <= 7) {
    return { status: "soon", label: `${daysUntilExpiry}d left`, color: "bg-blue-100 text-blue-800" };
  }

  return { status: "fresh", label: `${daysUntilExpiry}d left`, color: "bg-green-100 text-green-800" };
}

export function filterPantryItems(
  items: PantryItem[],
  {
    searchQuery,
    filterCategory,
    filterLocation,
    filterExpiry,
  }: {
    searchQuery: string;
    filterCategory: string;
    filterLocation: string;
    filterExpiry: string;
  },
): PantryItem[] {
  return items.filter((item) => {
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    if (filterCategory !== "all" && item.category !== filterCategory) {
      return false;
    }

    if (filterLocation !== "all" && item.location !== filterLocation) {
      return false;
    }

    if (filterExpiry !== "all") {
      const expStatus = getExpiryStatus(item.expirationDate).status;
      if (filterExpiry === "expiring" && !["urgent", "warning", "soon"].includes(expStatus)) {
        return false;
      }
      if (filterExpiry === "fresh" && expStatus !== "fresh") {
        return false;
      }
      if (filterExpiry === "expired" && expStatus !== "expired") {
        return false;
      }
    }

    return true;
  });
}

export function derivePantryCategories(items: PantryItem[]): string[] {
  return Array.from(new Set(items.map((item) => item.category).filter(Boolean))) as string[];
}

export function derivePantryLocations(items: PantryItem[]): string[] {
  return Array.from(new Set(items.map((item) => item.location).filter(Boolean))) as string[];
}

export function derivePantryStats(items: PantryItem[], expiringItems: PantryItem[]): PantryStats {
  return {
    total: items.length,
    expiring: expiringItems.length,
    expired: items.filter((item) => getExpiryStatus(item.expirationDate).status === "expired").length,
    runningLow: items.filter((item) => item.isRunningLow).length,
  };
}
