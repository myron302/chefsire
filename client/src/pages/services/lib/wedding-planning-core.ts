import { Camera, ChefHat, Flower, Heart, MapPin, Music, Sparkles } from "lucide-react";

export const VENDORS = [
  {
    id: 1,
    type: "caterer",
    name: "Bella Vista Catering",
    rating: 4.9,
    reviews: 127,
    priceRange: "$$$",
    image: "https://images.unsplash.com/photo-1555244162-803834f70033",
    specialty: "Farm-to-Table",
    verified: true,
    featured: true,
    sponsored: true,
    availability: "Available",
    minGuests: 50,
    maxGuests: 500,
    description: "Award-winning catering with locally sourced ingredients",
    amenities: ["Tastings", "Custom Menus", "Dietary Options", "Bar Service"],
    responseTime: "2 hours",
    viewsToday: 23,
  },
  {
    id: 2,
    type: "venue",
    name: "The Grand Ballroom",
    rating: 4.8,
    reviews: 89,
    priceRange: "$$$$",
    image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3",
    capacity: "50-300",
    verified: true,
    featured: false,
    availability: "Limited",
    description: "Elegant historic venue with stunning architecture",
    amenities: ["In-House Catering", "Parking", "Bridal Suite", "Dance Floor"],
    responseTime: "24 hours",
  },
  {
    id: 3,
    type: "photographer",
    name: "Moments Photography",
    rating: 5.0,
    reviews: 203,
    priceRange: "$$$",
    image: "https://images.unsplash.com/photo-1537633552985-df8429e8048b",
    style: "Documentary",
    verified: true,
    featured: false,
    availability: "Available",
    description: "Capturing authentic moments with artistic flair",
    packages: ["6 hours", "8 hours", "Full day"],
    responseTime: "1 hour",
  },
  {
    id: 4,
    type: "dj",
    name: "Elite Entertainment DJ",
    rating: 4.7,
    reviews: 156,
    priceRange: "$$",
    image: "https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf",
    specialty: "All Genres",
    verified: false,
    featured: false,
    availability: "Available",
    description: "Professional DJ services with premium sound systems",
    amenities: ["MC Services", "Lighting", "Dance Floor", "Wireless Mics"],
    responseTime: "3 hours",
  },
] as const;

export type Vendor = (typeof VENDORS)[number];

export const VENDOR_CATEGORIES = [
  { value: "all", label: "All", icon: Sparkles },
  { value: "caterer", label: "Catering", icon: ChefHat },
  { value: "venue", label: "Venues", icon: MapPin },
  { value: "photographer", label: "Photo", icon: Camera },
  { value: "dj", label: "DJ & Music", icon: Music },
  { value: "florist", label: "Florist", icon: Flower },
  { value: "planner", label: "Planner", icon: Heart },
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

  return normalized.length > 0 ? normalized : DEFAULT_REGISTRY_LINKS;
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
