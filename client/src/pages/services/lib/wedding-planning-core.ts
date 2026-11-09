import { Camera, ChefHat, Flower, Heart, MapPin, Music, Sparkles } from "lucide-react";

/**
 * A wedding vendor in the public directory (GET /api/wedding/vendor-listings/public). Two kinds:
 * - member listings: published vendors on ChefSire, who take quote requests;
 * - unclaimed listings: real businesses from open business data (Overture Maps) that haven't joined yet. They show
 *   public business info (phone, website) only, take no quote requests, and can be claimed by the owner.
 * There are no ratings or reviews; none are ever invented.
 */
export interface Vendor {
  id: number;
  type: string;
  name: string;
  priceRange: string | null;
  description: string | null;
  location: string | null;
  website: string | null;
  instagramHandle: string | null;
  yearsInBusiness: number | null;
  city: string | null;
  state: string | null;
  /** Public business phone, only for unclaimed listings. */
  phone: string | null;
  unclaimed: boolean;
}

export type PublishedVendorListing = {
  id: number | string;
  businessName: string;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  description?: string | null;
  website?: string | null;
  instagramHandle?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  yearsInBusiness?: number | null;
  phone?: string | null;
  unclaimed?: boolean | null;
};

const CATEGORY_KEYWORDS: Array<[string, RegExp]> = [
  ["caterer", /cater|food|chef|bak|cake|dessert/i],
  ["venue", /venue|ballroom|hall|barn|estate|hotel|garden/i],
  ["photographer", /photo|video|film/i],
  ["dj", /dj|music|band|entertain|sound/i],
  ["florist", /flor|flower|bloom/i],
  ["planner", /plan|coordinat|design|decor/i],
];

/** Maps a vendor's free-text category to one of the directory filter values ("other" when nothing matches). */
export function normalizeVendorCategory(raw: string | null | undefined): string {
  const value = (raw || "").trim();
  if (!value) return "other";
  const exact = value.toLowerCase();
  if (["caterer", "venue", "photographer", "dj", "florist", "planner"].includes(exact)) return exact;
  for (const [type, pattern] of CATEGORY_KEYWORDS) if (pattern.test(value)) return type;
  return "other";
}

function formatPriceRange(min: number | null | undefined, max: number | null | undefined): string | null {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const lo = typeof min === "number" && min > 0 ? min : null;
  const hi = typeof max === "number" && max > 0 ? max : null;
  if (lo && hi) return lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`;
  if (lo) return `From ${fmt(lo)}`;
  if (hi) return `Up to ${fmt(hi)}`;
  return null;
}

/** Only http(s) links are rendered; a bare domain ("www.example.com") is treated as https. */
export function safeWebsite(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const v = raw.trim();
  const withScheme = /^https?:\/\//i.test(v) ? v : /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(v) ? `https://${v}` : null;
  if (!withScheme) return null;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? withScheme : null;
  } catch {
    return null;
  }
}

/** US numbers as (203) 555-0100; anything else is shown as given. */
export function formatPhone(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : raw.trim();
}

/** tel: link target for a displayed phone, or null. */
export function phoneHref(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 7 ? `tel:${digits}` : null;
}

/**
 * Filters by the Location box. Accepts what people type or what Google autocomplete fills in
 * ("Hartford", "Hartford, CT", "Hartford, CT, USA", "CT"). Empty query: everything.
 */
export function filterVendorsByLocation(vendors: Vendor[], query: string): Vendor[] {
  const parts = (query || "").split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) return vendors;
  const first = parts[0];
  const stateOnly = /^[a-z]{2}$/.test(first) && parts.length === 1;
  if (stateOnly) return vendors.filter((v) => (v.state || "").toLowerCase() === first);
  return vendors.filter((v) => (v.city || "").toLowerCase() === first);
}

export function toVendor(listing: PublishedVendorListing): Vendor {
  const location = [listing.city, listing.state].filter(Boolean).join(", ") || null;
  const website = safeWebsite(listing.website);
  const unclaimed = listing.unclaimed === true;
  return {
    id: Number(listing.id),
    type: normalizeVendorCategory(listing.category),
    name: listing.businessName,
    priceRange: formatPriceRange(listing.minPrice, listing.maxPrice),
    description: listing.description ?? null,
    location,
    website,
    instagramHandle: listing.instagramHandle ? String(listing.instagramHandle).replace(/^@/, "") : null,
    yearsInBusiness: typeof listing.yearsInBusiness === "number" && listing.yearsInBusiness > 0 ? listing.yearsInBusiness : null,
    city: listing.city ?? null,
    state: listing.state ?? null,
    phone: unclaimed && typeof listing.phone === "string" && listing.phone.trim() ? listing.phone.trim() : null,
    unclaimed,
  };
}

export const VENDOR_CATEGORIES = [
  { value: "all", label: "All", icon: Sparkles },
  { value: "caterer", label: "Catering", icon: ChefHat },
  { value: "venue", label: "Venues", icon: MapPin },
  { value: "photographer", label: "Photo", icon: Camera },
  { value: "dj", label: "DJ & Music", icon: Music },
  { value: "florist", label: "Florist", icon: Flower },
  { value: "planner", label: "Planner", icon: Heart },
  { value: "other", label: "More", icon: Sparkles },
] as const;

export interface BudgetAllocation {
  key: "catering" | "venue" | "photography" | "music" | "flowers" | "other";
  category: string;
  percentage: number;
  icon: any;
}

export interface PlanningTask {
  id: string;
  label: string;
  completed: boolean;
  cost?: number;
  budgetKey?: BudgetAllocation["key"];
}

export interface PlanningInsightTip {
  id: string;
  title: string;
  detail: string;
}

export interface PlanningInsightAction {
  id: string;
  label: string;
  done: boolean;
}

export interface RegistryLink {
  id: number;
  name: string;
  url: string;
  icon: string;
}

export type WeddingPlanningView = "hub" | "vendors" | "budget" | "checklist" | "registry" | "calendar" | "invitations";

export const DEFAULT_BUDGET_ALLOCATIONS: BudgetAllocation[] = [
  { key: "catering", category: "Catering & Bar", percentage: 40, icon: ChefHat },
  { key: "venue", category: "Venue", percentage: 20, icon: MapPin },
  { key: "photography", category: "Photography", percentage: 12, icon: Camera },
  { key: "music", category: "Music & Entertainment", percentage: 8, icon: Music },
  { key: "flowers", category: "Flowers & Decor", percentage: 10, icon: Flower },
  { key: "other", category: "Other", percentage: 10, icon: Sparkles },
];

export const DEFAULT_PLANNING_TASKS: PlanningTask[] = [
  { id: "venue", label: "Venue", completed: false },
  { id: "catering", label: "Catering", completed: false },
  { id: "photo", label: "Photo", completed: false },
  { id: "music", label: "Music", completed: false },
  { id: "flowers", label: "Flowers", completed: false },
  { id: "planner", label: "Planner", completed: false },
  { id: "cake", label: "Cake", completed: false },
];

export const WEDDING_EVENT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "appointment", label: "Appointment / Meeting" },
  { value: "task", label: "Task / Deadline" },
  { value: "milestone", label: "Milestone" },
  { value: "payment", label: "Payment Due" },
  { value: "venue-tour", label: "Venue tour / walkthrough" },
  { value: "vendor-meeting", label: "Vendor meeting" },
  { value: "menu-tasting", label: "Menu tasting" },
  { value: "cake-tasting", label: "Cake tasting" },
  { value: "dress-fitting", label: "Dress fitting" },
  { value: "suit-fitting", label: "Suit fitting" },
  { value: "hair-makeup-trial", label: "Hair & makeup trial" },
  { value: "engagement-session", label: "Engagement photos" },
  { value: "final-walkthrough", label: "Final walkthrough" },
  { value: "rehearsal", label: "Ceremony rehearsal" },
  { value: "rehearsal-dinner", label: "Rehearsal dinner" },
  { value: "marriage-license", label: "Marriage license / legal" },
  { value: "shower", label: "Bridal shower" },
  { value: "bachelor-bachelorette", label: "Bachelor / bachelorette" },
  { value: "wedding-day", label: "Wedding day" },
  { value: "honeymoon", label: "Honeymoon" },
  { value: "deposit-due", label: "Deposit due" },
  { value: "final-payment", label: "Final payment" },
];

export const DEFAULT_REGISTRY_LINKS: RegistryLink[] = [
  { id: 1, name: "Amazon", url: "", icon: "🎁" },
  { id: 2, name: "Target", url: "", icon: "🎯" },
  { id: 3, name: "Zola", url: "", icon: "💑" },
];

export const budgetIconTone = (key: BudgetAllocation["key"]) => {
  switch (key) {
    case "catering":
      return "text-emerald-600";
    case "venue":
      return "text-rose-600";
    case "photography":
      return "text-indigo-600";
    case "music":
      return "text-amber-600";
    case "flowers":
      return "text-pink-600";
    case "other":
    default:
      return "text-purple-600";
  }
};

export const vendorIconTone = (value: string) => {
  switch (value) {
    case "caterer":
      return "text-emerald-600";
    case "venue":
      return "text-rose-600";
    case "photographer":
      return "text-indigo-600";
    case "dj":
      return "text-amber-600";
    case "florist":
      return "text-pink-600";
    case "planner":
      return "text-purple-600";
    case "all":
    default:
      return "text-slate-700";
  }
};

export const formatWeddingEventTypeLabel = (value: string): string => {
  const found = WEDDING_EVENT_TYPE_OPTIONS.find((t) => t.value === value);
  if (found) return found.label;
  if (!value) return "Event";
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(" ");
};

export const weddingEventTypeVariant = (value: string): "default" | "destructive" | "secondary" => {
  const v = (value || "").toLowerCase();
  if (v.includes("payment") || v.includes("deposit") || v.includes("invoice")) return "destructive";
  if (
    v.includes("appointment") ||
    v.includes("meeting") ||
    v.includes("tour") ||
    v.includes("tasting") ||
    v.includes("fitting") ||
    v.includes("trial") ||
    v.includes("rehearsal") ||
    v.includes("license") ||
    v.includes("wedding")
  )
    return "default";
  return "secondary";
};

export const inferBudgetKeyFromTask = (task: { id?: string; label?: string; budgetKey?: any }): BudgetAllocation["key"] => {
  const raw = `${task?.id ?? ""} ${task?.label ?? ""}`.toLowerCase();
  if (raw.includes("cater") || raw.includes("food") || raw.includes("bar") || raw.includes("dinner")) return "catering";
  if (raw.includes("venue") || raw.includes("hall") || raw.includes("banquet") || raw.includes("site")) return "venue";
  if (raw.includes("photo") || raw.includes("video") || raw.includes("camera")) return "photography";
  if (raw.includes("dj") || raw.includes("music") || raw.includes("band") || raw.includes("entertain")) return "music";
  if (raw.includes("flower") || raw.includes("flor") || raw.includes("decor") || raw.includes("bouquet")) return "flowers";
  return "other";
};

export const normalizeRegistryLinks = (input: any): RegistryLink[] => {
  if (!Array.isArray(input)) return DEFAULT_REGISTRY_LINKS;

  const normalized = input
    .filter((item: any) => item && typeof item === "object")
    .map((item: any, index: number) => ({
      id: Number.isFinite(Number(item.id)) ? Number(item.id) : Date.now() + index,
      name: typeof item.name === "string" && item.name.trim().length > 0 ? item.name.trim() : "Registry",
      url: typeof item.url === "string" ? item.url : "",
      icon: typeof item.icon === "string" && item.icon.trim().length > 0 ? item.icon : "🎁",
    }));

  return normalized;
};

export const normalizeBudgetAllocations = (input: any): BudgetAllocation[] => {
  if (!Array.isArray(input)) return DEFAULT_BUDGET_ALLOCATIONS;

  const allowed = new Set(DEFAULT_BUDGET_ALLOCATIONS.map((a) => a.key));
  const incomingByKey = new Map<string, { category: string; percentage: number }>();

  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const key = String(item.key || "");
    if (!allowed.has(key as BudgetAllocation["key"])) continue;

    const defaultItem = DEFAULT_BUDGET_ALLOCATIONS.find((a) => a.key === key);
    if (!defaultItem) continue;

    incomingByKey.set(key, {
      category: typeof item.category === "string" && item.category.trim().length > 0 ? item.category.trim() : defaultItem.category,
      percentage: Math.max(0, Math.min(100, Math.round(Number(item.percentage) || 0))),
    });
  }

  return DEFAULT_BUDGET_ALLOCATIONS.map((defaultItem) => {
    const incoming = incomingByKey.get(defaultItem.key);
    return incoming ? { ...defaultItem, category: incoming.category, percentage: incoming.percentage } : defaultItem;
  });
};
