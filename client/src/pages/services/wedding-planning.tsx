// client/src/pages/services/wedding-planning.tsx
import { useState, useMemo, memo, useCallback, useEffect, useRef } from "react";

import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Clock,
  Heart,
  ChefHat,
  Camera,
  Music,
  Flower,
  Sparkles,
  Star,
  Info,
  Mail,
  Send,
  Eye,
  TrendingUp,
  Shield,
  Bookmark,
  Share2,
  Gift,
  Calendar as CalendarIcon,
  Link2,
  Plus,
  X,
  BellRing,
  AlertCircle,
  Zap,
  Lock,
  Building2,
  ArrowRight,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ToastAction } from "@/components/ui/toast";
import { Calendar as CalendarUI } from "@/components/ui/calendar";

import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import WeddingTrialSelector from "@/components/WeddingTrialSelector";
import { couplePlans } from "@/config/wedding-pricing";

// =========================================================
// STATIC DATA
// =========================================================

const VENDORS = [
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

type Vendor = (typeof VENDORS)[number];

const VENDOR_CATEGORIES = [
  { value: "all", label: "All", icon: Sparkles },
  { value: "caterer", label: "Catering", icon: ChefHat },
  { value: "venue", label: "Venues", icon: MapPin },
  { value: "photographer", label: "Photo", icon: Camera },
  { value: "dj", label: "DJ & Music", icon: Music },
  { value: "florist", label: "Florist", icon: Flower },
  { value: "planner", label: "Planner", icon: Heart },
] as const;

interface BudgetAllocation {
  key: "catering" | "venue" | "photography" | "music" | "flowers" | "other";
  category: string;
  percentage: number;
  icon: any;
}

interface PlanningTask {
  id: string;
  label: string;
  completed: boolean;
  cost?: number;
  budgetKey?: BudgetAllocation["key"];
}

const DEFAULT_BUDGET_ALLOCATIONS: BudgetAllocation[] = [
  { key: "catering", category: "Catering & Bar", percentage: 40, icon: ChefHat },
  { key: "venue", category: "Venue", percentage: 20, icon: MapPin },
  { key: "photography", category: "Photography", percentage: 12, icon: Camera },
  { key: "music", category: "Music & Entertainment", percentage: 8, icon: Music },
  { key: "flowers", category: "Flowers & Decor", percentage: 10, icon: Flower },
  { key: "other", category: "Other", percentage: 10, icon: Sparkles },
];


const budgetIconTone = (key: BudgetAllocation["key"]) => {
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

const vendorIconTone = (value: string) => {
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


const DEFAULT_PLANNING_TASKS: PlanningTask[] = [
  { id: "venue", label: "Venue", completed: false },
  { id: "catering", label: "Catering", completed: false },
  { id: "photo", label: "Photo", completed: false },
  { id: "music", label: "Music", completed: false },
  { id: "flowers", label: "Flowers", completed: false },
  { id: "planner", label: "Planner", completed: false },
  { id: "cake", label: "Cake", completed: false },
];

interface RegistryLink {
  id: number;
  name: string;
  url: string;
  icon: string;
}

const DEFAULT_REGISTRY_LINKS: RegistryLink[] = [
  { id: 1, name: "Amazon", url: "", icon: "🎁" },
  { id: 2, name: "Target", url: "", icon: "🎯" },
  { id: 3, name: "Zola", url: "", icon: "💑" },
];

const normalizeRegistryLinks = (input: any): RegistryLink[] => {
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

const parsePlanningTasks = (rawValue: string | null): PlanningTask[] => {
  if (!rawValue) return DEFAULT_PLANNING_TASKS;

  try {
    const parsedTasks = JSON.parse(rawValue);
    if (!Array.isArray(parsedTasks)) return DEFAULT_PLANNING_TASKS;

    const normalizedTasks = parsedTasks
      .filter(
        (task: any): task is PlanningTask =>
          task && typeof task.id === "string" && typeof task.label === "string" && typeof task.completed === "boolean"
      )
      .map((task: any) => ({
        id: task.id,
        label: task.label,
        completed: task.completed,
        cost: Number.isFinite(Number(task.cost)) ? Number(task.cost) : undefined,
        budgetKey: task.budgetKey && typeof task.budgetKey === "string" ? task.budgetKey : undefined,
      }));

    return normalizedTasks.length > 0 ? normalizedTasks : DEFAULT_PLANNING_TASKS;
  } catch (error) {
    console.error("[Wedding Planning] Failed to parse saved planning tasks", error);
    return DEFAULT_PLANNING_TASKS;
  }
};

const getWeddingPlanningTasksStorageKey = (userId?: string | number) =>
  userId ? `weddingPlanningTasks:${userId}` : "weddingPlanningTasks:guest";

const getWeddingBudgetSettingsStorageKey = (userId?: string | number) =>
  userId ? `weddingBudgetSettings:${userId}` : "weddingBudgetSettings:guest";

const getWeddingRegistryLinksStorageKey = (userId?: string | number) =>
  userId ? `weddingRegistryLinks:${userId}` : "weddingRegistryLinks:guest";

const normalizeBudgetAllocations = (input: any): BudgetAllocation[] => {
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

// =========================================================
// MEMOIZED VENDOR CARD
// =========================================================

interface VendorCardProps {
  vendor: Vendor;
  isSaved: boolean;
  isQuoteRequested: boolean;
  onToggleSave: (id: number) => void;
  onRequestQuote: (id: number) => void;
}

const VendorCard = memo(
  ({ vendor, isSaved, isQuoteRequested, onToggleSave, onRequestQuote }: VendorCardProps) => {
    return (
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <div className="relative">
          <img
            src={vendor.image}
            alt={vendor.name}
            className="w-full h-40 md:h-48 object-cover"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            style={{ contentVisibility: "auto" }}
          />
          {(vendor as any).sponsored && (
            <Badge className="absolute top-2 left-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-xs">
              <TrendingUp className="w-3 h-3 mr-1 text-white" />
              <span className="hidden sm:inline">Sponsored</span>
            </Badge>
          )}
          {(vendor as any).featured && !(vendor as any).sponsored && (
            <Badge className="absolute top-2 left-2 bg-gradient-to-r from-pink-600 to-purple-600 text-xs">
              <Sparkles className="w-3 h-3 mr-1 text-white" />
              <span className="hidden sm:inline">Featured</span>
            </Badge>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 rounded-full p-1.5 md:p-2"
            onClick={() => onToggleSave(vendor.id)}
          >
            <Bookmark className={`w-3 h-3 md:w-4 md:h-4 ${isSaved ? "fill-current" : ""}`} />
          </Button>

          <Badge
            className={`absolute bottom-2 left-2 text-xs ${
              (vendor as any).availability === "Available"
                ? "bg-green-500"
                : (vendor as any).availability === "Limited"
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
          >
            {(vendor as any).availability}
          </Badge>
        </div>

        <CardContent className="p-3 md:p-4">
          <div className="mb-2">
            <h3 className="font-semibold text-base md:text-lg flex items-center gap-1">
              {vendor.name}
              {(vendor as any).verified && <Shield className="w-3 h-3 md:w-4 md:h-4 text-blue-500" />}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{(vendor as any).description}</p>
          </div>

          <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-3">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 md:w-4 md:h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-sm md:text-base">{vendor.rating}</span>
              <span className="text-xs md:text-sm text-muted-foreground">({vendor.reviews})</span>
            </div>
            <span className="text-xs md:text-sm font-medium">{vendor.priceRange}</span>
          </div>

          {(vendor as any).amenities && (
            <div className="flex flex-wrap gap-1 mb-2 md:mb-3">
              {(vendor as any).amenities.slice(0, 3).map((amenity: string) => (
                <Badge key={amenity} variant="secondary" className="text-[10px] md:text-xs">
                  {amenity}
                </Badge>
              ))}
              {(vendor as any).amenities.length > 3 && (
                <Badge variant="secondary" className="text-[10px] md:text-xs">
                  +{(vendor as any).amenities.length - 3}
                </Badge>
              )}
            </div>
          )}

          {(vendor as any).viewsToday && (
            <Alert className="mb-2 md:mb-3 p-2">
              <AlertCircle className="h-3 w-3" />
              <AlertDescription className="text-[10px] md:text-xs">{(vendor as any).viewsToday} couples viewed today</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3 border-t">
            <div className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground">
              <Clock className="w-3 h-3 text-amber-500" />
              <span className="hidden sm:inline">Responds in {(vendor as any).responseTime}</span>
              <span className="sm:hidden">{(vendor as any).responseTime}</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {isQuoteRequested ? (
                <Badge variant="secondary" className="text-[10px] md:text-xs">
                  Quote Requested
                </Badge>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => onRequestQuote(vendor.id)} className="flex-1 sm:flex-none text-xs">
                    <span className="hidden sm:inline">Get Quote</span>
                    <span className="sm:hidden">Quote</span>
                  </Button>
                  <Link href="/services/vendor-listing" className="flex-1 sm:flex-none">
                    <Button size="sm" className="bg-gradient-to-r from-pink-600 to-purple-600 w-full text-xs">
                      <span className="hidden sm:inline">View Map</span>
                      <span className="sm:hidden">Map</span>
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
  (prevProps, nextProps) =>
    prevProps.vendor.id === nextProps.vendor.id &&
    prevProps.isSaved === nextProps.isSaved &&
    prevProps.isQuoteRequested === nextProps.isQuoteRequested
);

VendorCard.displayName = "VendorCard";

export default function WeddingPlanning() {
  const { toast } = useToast();

  // Load Google Maps API
  const isGoogleMapsLoaded = useGoogleMaps();

  // Get user context and check subscription status
  const { user, updateUser } = useUser();
  const currentTier = user?.subscriptionTier || "free";
  const isPremium = currentTier === "premium" || currentTier === "elite";
  const isElite = currentTier === "elite";

  // Simulated dynamic savings data (replace with a real API call if needed)
  const dynamicSavings = 4200;

  const [selectedVendorType, setSelectedVendorType] = useState("all");
  const [budgetRange, setBudgetRange] = useState([5000, 50000]);
  const [budgetAllocations, setBudgetAllocations] = useState<BudgetAllocation[]>(DEFAULT_BUDGET_ALLOCATIONS);
  const [guestCount, setGuestCount] = useState([100]);
  const [searchLocation, setSearchLocation] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [savedVendors, setSavedVendors] = useState(new Set<number>());
  const [showBudgetCalculator, setShowBudgetCalculator] = useState(false);
  const [showTrialBanner, setShowTrialBanner] = useState(() => {
    return localStorage.getItem("weddingTrialBannerDismissed") !== "true";
  });
  const [requestedQuotes, setRequestedQuotes] = useState(new Set<number>());

  // Quote request dialog state (Get a Quote)
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [quoteVendorId, setQuoteVendorId] = useState<number | null>(null);
  const [quoteForm, setQuoteForm] = useState<{
    eventDate: string;
    guestCount: number;
    contactEmail: string;
    message: string;
  }>({
    eventDate: "",
    guestCount: 0,
    contactEmail: "",
    message: "",
  });


  // Budget report dialog
  const [isBudgetReportOpen, setIsBudgetReportOpen] = useState(false);


  const [planningTasks, setPlanningTasks] = useState<PlanningTask[]>(DEFAULT_PLANNING_TASKS);
  const [isProgressEditorOpen, setIsProgressEditorOpen] = useState(false);
  const [progressEditorTasks, setProgressEditorTasks] = useState<PlanningTask[]>([]);
  const [newPlanningTaskLabel, setNewPlanningTaskLabel] = useState("");
  const [hasLoadedPlanningTasks, setHasLoadedPlanningTasks] = useState(false);
  const [hasLoadedBudgetSettings, setHasLoadedBudgetSettings] = useState(false);

  const [registryLinks, setRegistryLinks] = useState<RegistryLink[]>(DEFAULT_REGISTRY_LINKS);
  const [hasLoadedRegistryLinks, setHasLoadedRegistryLinks] = useState(false);
  const [isEditingRegistryLinks, setIsEditingRegistryLinks] = useState(false);
  const [registryDraft, setRegistryDraft] = useState<RegistryLink[]>(DEFAULT_REGISTRY_LINKS);

  const [calendarEvents, setCalendarEvents] = useState<
    Array<{
      id: number;
      date: string;
      time?: string;
      title: string;
      type: string;
      reminder: boolean;
      notes?: string;
    }>
  >([]);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>();
  const [calendarEventTime, setCalendarEventTime] = useState<string>("");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [calendarType, setCalendarType] = useState("");
  const [calendarNotes, setCalendarNotes] = useState("");
  const [calendarReminder, setCalendarReminder] = useState(false);

  // Email Invitations State
  const [guestList, setGuestList] = useState<
    Array<{
      id: number | string;
      name: string;
      email: string;
      rsvp: string;
      plusOne: boolean;
      partnerName?: string;
      plusOneName?: string | null;
      respondedAt?: string | null;
    }>
  >([]);
  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestEmail, setNewGuestEmail] = useState("");
  const [newGuestPartner, setNewGuestPartner] = useState("");
  const [newGuestPlusOneAllowed, setNewGuestPlusOneAllowed] = useState(false);

  // Wedding Event Details State
  const [partner1Name, setPartner1Name] = useState("");
  const [partner2Name, setPartner2Name] = useState("");
  const [weddingTime, setWeddingTime] = useState("");
  const [weddingLocation, setWeddingLocation] = useState("");
  const [receptionDate, setReceptionDate] = useState("");
  const [receptionTime, setReceptionTime] = useState("");
  const [receptionLocation, setReceptionLocation] = useState("");
  const [customMessage, setCustomMessage] = useState("We would be honored to have you celebrate with us!");
  const [useSameLocation, setUseSameLocation] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("elegant");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Refs for Google Places Autocomplete
  const ceremonyRef = useRef<HTMLInputElement>(null);
  const receptionRef = useRef<HTMLInputElement>(null);
  const vendorLocationRef = useRef<HTMLInputElement>(null);
  const vendorLocationAutocompleteRef = useRef<any>(null);

  // Trial selector modal - only show once if user is on free tier
  const [showTrialSelector, setShowTrialSelector] = useState(() => {
    const hasSelected = localStorage.getItem("weddingTierSelected");
    if (hasSelected) return false;

    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        if (userData.subscriptionTier === "premium" || userData.subscriptionTier === "elite") {
          localStorage.setItem("weddingTierSelected", "true");
          return false;
        }
      } catch (e) {
        console.error("[Wedding Planning] Failed to parse user from localStorage:", e);
      }
    }

    return true;
  });

  // Hide selector if user already has premium/elite tier
  useEffect(() => {
    if (currentTier === "premium" || currentTier === "elite") {
      setShowTrialSelector(false);
      localStorage.setItem("weddingTierSelected", "true");
    }
  }, [currentTier]);

  // Load + persist wedding planning checklist (DB-first for signed-in users)
  const savePlanningTasksTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlanningTasks = async () => {
      setHasLoadedPlanningTasks(false);

      // Logged-out guests: keep using localStorage only.
      if (!user?.id) {
        const guestKey = getWeddingPlanningTasksStorageKey(undefined);
        const raw = localStorage.getItem(guestKey) ?? localStorage.getItem("weddingPlanningTasks");
        if (!cancelled) {
          setPlanningTasks(parsePlanningTasks(raw));
          setHasLoadedPlanningTasks(true);
        }
        return;
      }

      // Signed-in users: try DB first.
      try {
        const resp = await fetch("/api/wedding/planning-tasks", { credentials: "include" });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.ok && Array.isArray(data.tasks) && data.tasks.length > 0) {
            if (!cancelled) {
              setPlanningTasks(data.tasks);
              setHasLoadedPlanningTasks(true);
            }
            try {
              localStorage.removeItem("weddingPlanningTasks");
            } catch {}
            return;
          }
        }
      } catch (error) {
        console.error("[Wedding Planning] Failed to fetch planning tasks from DB:", error);
      }

      // Fallback: legacy local cache (one-time migration) and/or defaults.
      const legacy = localStorage.getItem("weddingPlanningTasks");
      const localTasks = parsePlanningTasks(legacy);

      if (!cancelled) {
        setPlanningTasks(localTasks);
        setHasLoadedPlanningTasks(true);
      }

      // Best-effort: seed DB so tasks follow the user across devices.
      try {
        await fetch("/api/wedding/planning-tasks", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: localTasks }),
        });
      } catch (error) {
        console.error("[Wedding Planning] Failed to seed planning tasks to DB:", error);
      }

      try {
        if (legacy) localStorage.removeItem("weddingPlanningTasks");
      } catch {}
    };

    loadPlanningTasks();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!hasLoadedPlanningTasks) return;

    // Guests (logged out) keep local storage only.
    if (!user?.id) {
      try {
        const storageKey = getWeddingPlanningTasksStorageKey(undefined);
        localStorage.setItem(storageKey, JSON.stringify(planningTasks));
      } catch {}
    }

    // If signed in, sync to DB (debounced).
    if (!user?.id) return;

    if (savePlanningTasksTimeoutRef.current) {
      window.clearTimeout(savePlanningTasksTimeoutRef.current);
    }

    savePlanningTasksTimeoutRef.current = window.setTimeout(async () => {
      try {
        await fetch("/api/wedding/planning-tasks", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: planningTasks }),
        });
      } catch (error) {
        console.error("[Wedding Planning] Failed to save planning tasks to DB:", error);
      }
    }, 400);
  }, [planningTasks, user?.id, hasLoadedPlanningTasks]);

  useEffect(() => {
    let cancelled = false;

    const loadBudgetSettings = async () => {
      setHasLoadedBudgetSettings(false);

      if (!user?.id) {
        const guestKey = getWeddingBudgetSettingsStorageKey(undefined);
        const raw = localStorage.getItem(guestKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (!cancelled) {
              setBudgetRange([
                Math.max(5000, Math.min(100000, Math.round(Number(parsed?.budgetMin) || 5000))),
                Math.max(5000, Math.min(100000, Math.round(Number(parsed?.budgetMax) || 50000))),
              ]);
              setGuestCount([Math.max(1, Math.min(2000, Math.round(Number(parsed?.guestCount) || 100)))]);
              setBudgetAllocations(normalizeBudgetAllocations(parsed?.allocations));
            }
          } catch (error) {
            console.error("[Wedding Planning] Failed to parse guest budget settings:", error);
          }
        }

        if (!cancelled) setHasLoadedBudgetSettings(true);
        return;
      }

      try {
        const response = await fetch("/api/wedding/budget-settings", { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          const settings = data?.settings;
          if (settings && !cancelled) {
            setBudgetRange([
              Math.max(5000, Math.min(100000, Math.round(Number(settings.budgetMin) || 5000))),
              Math.max(5000, Math.min(100000, Math.round(Number(settings.budgetMax) || 50000))),
            ]);
            setGuestCount([Math.max(1, Math.min(2000, Math.round(Number(settings.guestCount) || 100)))]);
            setBudgetAllocations(normalizeBudgetAllocations(settings.allocations));
          }
        }
      } catch (error) {
        console.error("[Wedding Planning] Failed to fetch budget settings:", error);
      }

      if (!cancelled) setHasLoadedBudgetSettings(true);
    };

    loadBudgetSettings();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!hasLoadedBudgetSettings) return;

    const [budgetMin, budgetMax] = budgetRange;
    const payload = {
      budgetMin,
      budgetMax,
      guestCount: guestCount[0],
      allocations: budgetAllocations.map((a) => ({ key: a.key, label: a.category, percentage: a.percentage })),
    };

    if (!user?.id) return;

    const timeout = window.setTimeout(async () => {
      try {
        await fetch("/api/wedding/budget-settings", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error("[Wedding Planning] Failed to save budget settings:", error);
      }
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [budgetRange, guestCount, budgetAllocations, user?.id, hasLoadedBudgetSettings]);

  useEffect(() => {
    let cancelled = false;

    const loadRegistryLinks = async () => {
      setHasLoadedRegistryLinks(false);

      if (!user?.id) {
        try {
          const guestRaw = localStorage.getItem(getWeddingRegistryLinksStorageKey(undefined));
          if (guestRaw) {
            const parsed = JSON.parse(guestRaw);
            if (!cancelled) {
              const normalized = normalizeRegistryLinks(parsed);
              setRegistryLinks(normalized);
              setRegistryDraft(normalized);
            }
          }
        } catch {}

        if (!cancelled) setHasLoadedRegistryLinks(true);
        return;
      }

      try {
        const response = await fetch("/api/wedding/registry-links", { credentials: "include" });
        let loadedFromServer = false;
        if (response.ok) {
          const data = await response.json();
          const fromServer =
            data?.ok && Array.isArray(data.registryLinks) ? normalizeRegistryLinks(data.registryLinks) : null;

          if (!cancelled) {
            if (fromServer && fromServer.length > 0) {
              setRegistryLinks(fromServer);
              setRegistryDraft(fromServer);
              loadedFromServer = true;
            }
          }
        }

        // Only use local fallback when DB data wasn't successfully loaded.
        if (!loadedFromServer && !cancelled) {
          try {
            const localRaw = localStorage.getItem(getWeddingRegistryLinksStorageKey(user.id));
            const guestRaw = localStorage.getItem(getWeddingRegistryLinksStorageKey(undefined));
            const raw = localRaw || guestRaw;
            if (raw) {
              const parsed = JSON.parse(raw);
              const normalized = normalizeRegistryLinks(parsed);
              setRegistryLinks(normalized);
              setRegistryDraft(normalized);
            } else {
              setRegistryLinks(DEFAULT_REGISTRY_LINKS);
              setRegistryDraft(DEFAULT_REGISTRY_LINKS);
            }
          } catch {
            setRegistryLinks(DEFAULT_REGISTRY_LINKS);
            setRegistryDraft(DEFAULT_REGISTRY_LINKS);
          }
        }
      } catch (error) {
        console.error("[Wedding Planning] Failed to load registry links:", error);
        if (!cancelled) {
          try {
            const localRaw = localStorage.getItem(getWeddingRegistryLinksStorageKey(user.id));
            const guestRaw = localStorage.getItem(getWeddingRegistryLinksStorageKey(undefined));
            const raw = localRaw || guestRaw;
            if (raw) {
              const parsed = JSON.parse(raw);
              const normalized = normalizeRegistryLinks(parsed);
              setRegistryLinks(normalized);
              setRegistryDraft(normalized);
            } else {
              setRegistryLinks(DEFAULT_REGISTRY_LINKS);
              setRegistryDraft(DEFAULT_REGISTRY_LINKS);
            }
          } catch {
            setRegistryLinks(DEFAULT_REGISTRY_LINKS);
            setRegistryDraft(DEFAULT_REGISTRY_LINKS);
          }
        }
      } finally {
        if (!cancelled) setHasLoadedRegistryLinks(true);
      }
    };

    loadRegistryLinks();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!hasLoadedRegistryLinks) return;
    try {
      const safe = registryLinks.map((link) => ({ id: link.id, name: link.name, url: link.url, icon: link.icon }));
      localStorage.setItem(getWeddingRegistryLinksStorageKey(user?.id), JSON.stringify(safe));
      localStorage.setItem(getWeddingRegistryLinksStorageKey(undefined), JSON.stringify(safe));
    } catch {}

    if (!isEditingRegistryLinks) {
      setRegistryDraft(registryLinks);
    }
  }, [registryLinks, user?.id, hasLoadedRegistryLinks, isEditingRegistryLinks]);

  // Load guest list and wedding details from backend on mount
  useEffect(() => {
    if (!user?.id) return;

    const fetchEventDetails = async () => {
      try {
        const response = await fetch("/api/wedding/event-details", { credentials: "include" });

        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.details) {
            const d = data.details;
            if (d.partner1Name) setPartner1Name(d.partner1Name);
            if (d.partner2Name) setPartner2Name(d.partner2Name);
            if (d.ceremonyDate) setSelectedDate(d.ceremonyDate);
            if (d.ceremonyTime) setWeddingTime(d.ceremonyTime);
            if (d.ceremonyLocation) setWeddingLocation(d.ceremonyLocation);
            if (d.receptionDate) setReceptionDate(d.receptionDate);
            if (d.receptionTime) setReceptionTime(d.receptionTime);
            if (d.receptionLocation) setReceptionLocation(d.receptionLocation);
            if (d.customMessage) setCustomMessage(d.customMessage);
            if (d.useSameLocation !== null && d.useSameLocation !== undefined) setUseSameLocation(Boolean(d.useSameLocation));
            if (d.selectedTemplate) setSelectedTemplate(d.selectedTemplate);
          }
        } else {
          let errMsg: string;
          try {
            const body = await response.json();
            errMsg = body?.error ?? response.statusText;
          } catch {
            errMsg = response.statusText;
          }
          console.error("[Wedding Planning] Fetch event details error:", errMsg);
          toast({
            title: "Load Failed",
            description: `Failed to load wedding details: ${errMsg}`,
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error("[Wedding Planning] Failed to fetch event details:", error);
        toast({
          title: "Load Failed",
          description: `Failed to load wedding details: ${error?.message ?? String(error)}`,
          variant: "destructive",
        });
      }
    };

    const fetchGuestList = async () => {
      try {
        const response = await fetch("/api/wedding/guest-list", { credentials: "include" });

        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.guests) {
            const sentGuests = data.guests.map((g: any) => ({
              id: g.id,
              name: g.name,
              email: g.email,
              rsvp: g.rsvp,
              plusOne: g.plusOne,
              plusOneName: g.plusOneName ?? null,
              respondedAt: g.respondedAt ?? null,
              partnerName: g.partnerName ?? undefined,
            }));

            const unsentGuestsKey = `wedding-unsent-guests-${user.id}`;
            const unsentGuests = JSON.parse(localStorage.getItem(unsentGuestsKey) || "[]");

            setGuestList([...sentGuests, ...unsentGuests]);
            return;
          }
        }

        const unsentGuestsKey = `wedding-unsent-guests-${user.id}`;
        const unsentGuests = JSON.parse(localStorage.getItem(unsentGuestsKey) || "[]");
        setGuestList(unsentGuests);
      } catch (error) {
        console.error("[Wedding Planning] Failed to fetch guest list:", error);
        const unsentGuestsKey = `wedding-unsent-guests-${user.id}`;
        const unsentGuests = JSON.parse(localStorage.getItem(unsentGuestsKey) || "[]");
        setGuestList(unsentGuests);
      }
    };

    const fetchCalendarEvents = async () => {
      try {
        const response = await fetch("/api/wedding/calendar-events", { credentials: "include" });

        if (response.ok) {
          const data = await response.json();
          if (data.ok && Array.isArray(data.events)) {
            const events = data.events
              .filter((event: any) => event?.eventDate)
              .map((event: any) => ({
                id: Number(event.id),
                date: event.eventDate,
                time: (event.eventTime as string | undefined) || "",
                title: event.title,
                type: event.type,
                reminder: Boolean(event.reminder),
                notes: event.notes || undefined,
              }));
            setCalendarEvents(events);
          }
        } else {
          const errMsg = await response.text();
          console.error("[Wedding Planning] Fetch calendar events error:", errMsg);
        }
      } catch (error) {
        console.error("[Wedding Planning] Failed to fetch calendar events:", error);
      }
    };

    fetchEventDetails();
    fetchGuestList();
    fetchCalendarEvents();
  }, [user?.id, toast]);

  // Google Places Autocomplete initialization
  useEffect(() => {
    if (!isGoogleMapsLoaded || !window.google?.maps?.places) return;

    // Vendor search/location input
    if (vendorLocationRef.current && !vendorLocationAutocompleteRef.current) {
      const vendorOptions: any = {
        types: ["(regions)"],
        componentRestrictions: { country: "us" },
        fields: ["name", "formatted_address"],
      };

      try {
        vendorLocationAutocompleteRef.current = new window.google.maps.places.Autocomplete(
          vendorLocationRef.current,
          vendorOptions
        );

        vendorLocationAutocompleteRef.current.addListener("place_changed", () => {
          const place = vendorLocationAutocompleteRef.current?.getPlace?.();
          const name = place?.name;
          const fullAddress = place?.formatted_address;
          const display =
            name && fullAddress && !String(fullAddress).startsWith(String(name))
              ? `${name}, ${fullAddress}`
              : fullAddress || name || "";

          if (display) setSearchLocation(display);
        });
      } catch (error) {
        console.error("[Wedding Planning] Vendor location autocomplete init failed:", error);
      }
    }

    // Ceremony + reception location autocomplete is a Premium feature.
    if (!isPremium) return;

    const options: any = {
      types: ["establishment", "geocode"],
      fields: ["name", "formatted_address", "geometry"],
    };

    if (ceremonyRef.current) {
      const ceremonyAutocomplete = new window.google.maps.places.Autocomplete(ceremonyRef.current, options);
      ceremonyAutocomplete.addListener("place_changed", () => {
        const place = ceremonyAutocomplete.getPlace();
        const venueName = place.name;
        const fullAddress = place.formatted_address;
        const displayString =
          venueName && fullAddress && !fullAddress.startsWith(venueName) ? `${venueName}, ${fullAddress}` : fullAddress || venueName || "";
        setWeddingLocation(displayString);
        if (useSameLocation) setReceptionLocation(displayString);
      });
    }

    if (receptionRef.current && !useSameLocation) {
      const receptionAutocomplete = new window.google.maps.places.Autocomplete(receptionRef.current, options);
      receptionAutocomplete.addListener("place_changed", () => {
        const place = receptionAutocomplete.getPlace();
        const venueName = place.name;
        const fullAddress = place.formatted_address;
        const displayString =
          venueName && fullAddress && !fullAddress.startsWith(venueName) ? `${venueName}, ${fullAddress}` : fullAddress || venueName || "";
        setReceptionLocation(displayString);
      });
    }
  }, [isGoogleMapsLoaded, isPremium, useSameLocation]);

  const handleStartTrial = () => {
    setShowTrialBanner(false);
    localStorage.setItem("weddingTrialBannerDismissed", "true");
    toast({
      description: "🎉 All wedding planning features are completely free! Enjoy unlimited access.",
    });
  };

  const budgetBreakdown = useMemo(
    () =>
      budgetAllocations.map((item) => ({
        ...item,
        amount: budgetRange[1] * (item.percentage / 100),
      })),
    [budgetAllocations, budgetRange]
  );

  const handleBudgetRangeChange = useCallback((nextRange: number[]) => {
    if (!Array.isArray(nextRange) || nextRange.length < 2) return;

    const rawMin = Number(nextRange[0]);
    const rawMax = Number(nextRange[1]);

    const normalizedMin = Math.max(5000, Math.min(100000, Math.round(Math.min(rawMin, rawMax))));
    const normalizedMax = Math.max(normalizedMin, Math.min(100000, Math.round(Math.max(rawMin, rawMax))));

    setBudgetRange([normalizedMin, normalizedMax]);
  }, []);

  const updateBudgetAllocation = useCallback((key: BudgetAllocation["key"], nextPercentage: number) => {
    setBudgetAllocations((prev) => {
      const base = prev.map((item) => ({ ...item }));
      const targetIndex = base.findIndex((item) => item.key === key);
      const otherIndex = base.findIndex((item) => item.key === "other");
      if (targetIndex < 0 || otherIndex < 0) return prev;

      const clamped = Math.max(0, Math.min(100, Math.round(nextPercentage)));
      const nonTargetNonOtherTotal = base
        .filter((item) => item.key !== key && item.key !== "other")
        .reduce((sum, item) => sum + item.percentage, 0);

      const maxForTarget = Math.max(0, 100 - nonTargetNonOtherTotal);
      const finalTarget = Math.min(clamped, maxForTarget);
      const nextOther = Math.max(0, 100 - (nonTargetNonOtherTotal + finalTarget));

      base[targetIndex].percentage = finalTarget;
      base[otherIndex].percentage = nextOther;

      return base;
    });
  }, []);

  const filteredVendors = useMemo(() => (selectedVendorType === "all" ? VENDORS : VENDORS.filter((v) => v.type === selectedVendorType)), [
    selectedVendorType,
  ]);

  const toggleSaveVendor = useCallback((vendorId: number) => {
    setSavedVendors((prev) => {
      const next = new Set(prev);
      next.has(vendorId) ? next.delete(vendorId) : next.add(vendorId);
      return next;
    });
  }, []);

  const requestQuote = useCallback((vendorId: number) => {
    setRequestedQuotes((prev) => new Set(prev).add(vendorId));
  }, []);


  const quoteVendor = useMemo(() => {
    if (!quoteVendorId) return null;
    return VENDORS.find((v) => v.id === quoteVendorId) || null;
  }, [quoteVendorId]);

  // Load existing quote requests so "Quote Requested" persists across refresh/devices
  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      try {
        const res = await fetch("/api/wedding/vendor-quotes", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);

        // Accept a few possible response shapes to be resilient:
        // { quotes: [{ vendorId: number }] } OR { vendorIds: number[] } OR [{ vendorId }]
        const vendorIds: number[] =
          (Array.isArray(data?.vendorIds) ? data.vendorIds : []) ||
          (Array.isArray(data?.quotes) ? data.quotes.map((q: any) => Number(q?.vendorId)).filter((n: any) => Number.isFinite(n)) : []) ||
          (Array.isArray(data) ? data.map((q: any) => Number(q?.vendorId)).filter((n: any) => Number.isFinite(n)) : []);

        if (vendorIds.length) {
          setRequestedQuotes(new Set<number>(vendorIds));
        }
      } catch {
        // ignore
      }
    })();
  }, [user?.id]);

  const submitQuoteRequest = useCallback(async () => {
    if (!quoteVendorId) return;

    // Basic validation
    if (!quoteForm.eventDate) {
      toast({ title: "Add a date", description: "Vendors need your wedding date to quote accurately.", variant: "destructive" });
      return;
    }
    if (!quoteForm.guestCount || quoteForm.guestCount < 1) {
      toast({ title: "Guest count needed", description: "Please enter an estimated guest count.", variant: "destructive" });
      return;
    }
    if (!quoteForm.contactEmail || !quoteForm.contactEmail.includes("@")) {
      toast({ title: "Email needed", description: "Please enter a valid email so the vendor can reply.", variant: "destructive" });
      return;
    }

    try {
      const res = await fetch("/api/wedding/vendor-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vendorId: quoteVendorId,
          eventDate: quoteForm.eventDate,
          guestCount: quoteForm.guestCount,
          contactEmail: quoteForm.contactEmail,
          message: quoteForm.message,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to request quote");
      }

      setRequestedQuotes((prev) => new Set<number>(prev).add(quoteVendorId));
      setIsQuoteDialogOpen(false);

      toast({
        title: "Quote requested",
        description: "We sent your request. The vendor will contact you soon.",
      });
    } catch (e: any) {
      toast({
        title: "Quote request failed",
        description: e?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    }
  }, [quoteVendorId, quoteForm, toast]);

  const completedTasks = useMemo(() => planningTasks.filter((task) => task.completed).length, [planningTasks]);
  const planningProgress = planningTasks.length === 0 ? 0 : Math.round((completedTasks / planningTasks.length) * 100);

  // --- Budget spend tracking (optional per-task costs) ---
  const spendByCategory = useMemo(() => {
    const out = new Map<BudgetAllocation["key"], number>();
    for (const key of DEFAULT_BUDGET_ALLOCATIONS.map((a) => a.key)) out.set(key, 0);

    for (const t of planningTasks) {
      if (!t?.completed) continue;
      const cost = Number((t as any).cost);
      if (!Number.isFinite(cost) || cost <= 0) continue;
      const key = (t as any).budgetKey as BudgetAllocation["key"] | undefined;
      const safeKey: BudgetAllocation["key"] = key && out.has(key) ? key : "other";
      out.set(safeKey, (out.get(safeKey) || 0) + cost);
    }
    return out;
  }, [planningTasks]);

  const totalSpent = useMemo(() => {
    let s = 0;
    for (const v of spendByCategory.values()) s += v;
    return s;
  }, [spendByCategory]);

  const budgetUsedPct = useMemo(() => {
    const total = Math.max(1, Number(budgetRange?.[1]) || 1);
    return Math.max(0, Math.min(100, Math.round((totalSpent / total) * 100)));
  }, [totalSpent, budgetRange]);

  const budgetDelta = useMemo(() => (Number(budgetRange?.[1]) || 0) - totalSpent, [budgetRange, totalSpent]);
  const isOverBudget = budgetDelta < 0;
  const budgetStatusLabel = isOverBudget ? "Over budget" : "Under budget";


  // -------------------- Smart Tips & Next Steps (dynamic) --------------------
  const totalBudget = Number(budgetRange?.[1] ?? 0);
  const guestCountNum = Number(guestCount?.[0] ?? 0);

  const topBudgetItems = useMemo(() => {
    const items = budgetAllocations.map((a) => {
      const target = Math.round((totalBudget * (a.percentage / 100)) || 0);
      const spent = Number(spendByCategory.get(a.key) || 0);
      const remaining = target - spent;
      return { ...a, target, spent, remaining };
    });

    return items
      .sort((x, y) => {
        const xOver = x.remaining < 0 ? 1 : 0;
        const yOver = y.remaining < 0 ? 1 : 0;
        if (xOver !== yOver) return yOver - xOver;
        return x.remaining - y.remaining;
      })
      .slice(0, 3);
  }, [budgetAllocations, totalBudget, spendByCategory]);


  const budgetReportRows = useMemo(() => {
    const total = Math.max(1, totalBudget);
    return budgetAllocations.map((a) => {
      const target = Math.round((total * (a.percentage / 100)) || 0);
      const spent = Number(spendByCategory.get(a.key) || 0);
      const remaining = target - spent;
      const pct = Math.min(100, Math.round((spent / Math.max(1, target)) * 100));
      return { ...a, target, spent, remaining, pct };
    });
  }, [budgetAllocations, totalBudget, spendByCategory]);

  const handleExportBudgetCsv = useCallback(() => {
    const rows = budgetReportRows.map((r) => ({
      key: r.key,
      category: r.category,
      percentage: r.percentage,
      target: r.target,
      spent: r.spent,
      remaining: r.remaining,
      percentUsed: r.pct,
    }));

    const escape = (v: any) => {
      const s = String(v ?? "");
      return `"${s.replace(/"/g, '""')}"`;
    };

    const headers = ["key", "category", "percentage", "target", "spent", "remaining", "percentUsed"];
    const csv = [headers.join(",")]
      .concat(rows.map((r) => headers.map((h) => escape((r as any)[h])).join(",")))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    toast({ title: "Exported CSV", description: "Your budget report was downloaded." });
  }, [budgetReportRows, toast]);

  const nextBestActions = useMemo(() => {
    const actions: { label: string; done: boolean }[] = [];

    actions.push({ label: "Confirm your wedding date", done: !!selectedDate });
    actions.push({ label: "Lock your guest count range", done: guestCountNum > 0 });

    const hasVenueTask = planningTasks.some((t) => t.id === "venue" && t.completed);
    const hasCateringTask = planningTasks.some((t) => t.id === "catering" && t.completed);

    actions.push({ label: "Shortlist 3 venues", done: hasVenueTask });
    actions.push({ label: "Request 2–3 catering quotes", done: hasCateringTask });
    actions.push({ label: "Request at least 2 vendor quotes", done: requestedQuotes.size >= 2 });

    return actions.slice(0, 5);
  }, [selectedDate, guestCountNum, planningTasks, requestedQuotes.size]);

  const smartTips = useMemo(() => {
    const tips: { title: string; detail: string }[] = [];

    if (!selectedDate) {
      tips.push({
        title: "Pick a date first",
        detail: "Vendors quote more accurately when they know the exact date and season.",
      });
    }

    if (guestCountNum >= 150) {
      tips.push({
        title: "Big guest list = book early",
        detail: "Venue + catering fill up first for 150+ guests. Lock those before smaller vendors.",
      });
    } else if (guestCountNum > 0 && guestCountNum <= 60) {
      tips.push({
        title: "Smaller wedding advantage",
        detail: "You can often upgrade photography or food quality without raising the total budget.",
      });
    }

    if (totalBudget > 0 && totalBudget < 20000) {
      tips.push({
        title: "Budget feels tight — protect the essentials",
        detail: "Venue + catering drive most costs. Cut guest count before cutting core vendor quality.",
      });
    } else if (totalBudget >= 50000) {
      tips.push({
        title: "Use your budget to reduce stress",
        detail: "Consider a planner/day-of coordinator and simplify logistics to protect your timeline.",
      });
    }

    if (requestedQuotes.size === 0) {
      tips.push({
        title: "Quotes unlock momentum",
        detail: "Request quotes from 2–3 vendors in each key category to compare real numbers.",
      });
    }

    const risk = topBudgetItems[0];
    if (risk) {
      if (risk.remaining < 0) {
        tips.push({
          title: `Budget watch: ${risk.category} is over target`,
          detail: `You're about $${Math.abs(risk.remaining).toLocaleString()} over the target for this category.`,
        });
      } else {
        tips.push({
          title: `Budget watch: ${risk.category}`,
          detail: `You have about $${risk.remaining.toLocaleString()} remaining in this category versus your target.`,
        });
      }
    }

    return tips.slice(0, 6);
  }, [selectedDate, guestCountNum, totalBudget, requestedQuotes.size, topBudgetItems]);


  const openProgressEditor = useCallback(() => {
    setProgressEditorTasks(planningTasks);
    setNewPlanningTaskLabel("");
    setIsProgressEditorOpen(true);
  }, [planningTasks]);

  const handleProgressEditorOpenChange = useCallback((open: boolean) => {
    setIsProgressEditorOpen(open);
    if (!open) {
      setProgressEditorTasks([]);
      setNewPlanningTaskLabel("");
    }
  }, []);

  const toggleEditorTask = useCallback((taskId: string) => {
    setProgressEditorTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)));
  }, []);

  const updateEditorTaskLabel = useCallback((taskId: string, label: string) => {
    setProgressEditorTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, label } : task)));
  }, []);

  const addEditorTask = useCallback(() => {
    const trimmedTask = newPlanningTaskLabel.trim();
    if (!trimmedTask) return;

    setProgressEditorTasks((prev) => [...prev, { id: `custom-${Date.now()}`, label: trimmedTask, completed: false }]);
    setNewPlanningTaskLabel("");
  }, [newPlanningTaskLabel]);

  const removeEditorTask = useCallback((taskId: string) => {
    setProgressEditorTasks((prev) => prev.filter((task) => task.id !== taskId));
  }, []);

  const savePlanningTasks = useCallback(() => {
    const sanitizedTasks = progressEditorTasks
      .map((task) => ({ ...task, label: task.label.trim() }))
      .filter((task) => task.label.length > 0);

    setPlanningTasks(sanitizedTasks.length > 0 ? sanitizedTasks : DEFAULT_PLANNING_TASKS);
    setIsProgressEditorOpen(false);
    setNewPlanningTaskLabel("");
    toast({
      title: "Progress Saved",
      description: "Your planning checklist has been updated.",
    });
  }, [progressEditorTasks, toast]);

  const addGuest = useCallback(async () => {
    if (newGuestName && newGuestEmail) {
      const plusOneAllowed = newGuestPlusOneAllowed || !!newGuestPartner;

      const tempGuest: {
        id: number;
        name: string;
        email: string;
        rsvp: string;
        plusOne: boolean;
        partnerName?: string;
        respondedAt: string | null;
        plusOneName?: string | null;
      } = {
        id: Date.now(),
        name: newGuestName,
        email: newGuestEmail,
        rsvp: "pending",
        plusOne: plusOneAllowed,
        partnerName: newGuestPartner || undefined,
        respondedAt: null,
      };

      setGuestList((prev) => {
        const updated = [...prev, tempGuest];

        if (user?.id) {
          const unsentGuestsKey = `wedding-unsent-guests-${user.id}`;
          const unsentGuests = updated.filter((g) => typeof g.id === "number");
          localStorage.setItem(unsentGuestsKey, JSON.stringify(unsentGuests));
        }

        return updated;
      });

      setNewGuestName("");
      setNewGuestEmail("");
      setNewGuestPartner("");
      setNewGuestPlusOneAllowed(false);

      const guestDisplayName = newGuestPartner ? `${newGuestName} & ${newGuestPartner}` : newGuestName;
      toast({
        title: "Guest Added",
        description: `${guestDisplayName} has been added to your guest list.`,
      });
    }
  }, [newGuestName, newGuestEmail, newGuestPartner, newGuestPlusOneAllowed, user?.id, toast]);

  const removeGuest = useCallback(
    async (guestId: number | string) => {
      const guest = guestList.find((g) => g.id === guestId);
      const isSentGuest = typeof guestId === "string";

      if (isSentGuest && user?.id) {
        try {
          const response = await fetch(`/api/wedding/guest/${guestId}`, {
            method: "DELETE",
            credentials: "include",
          });

          if (!response.ok) {
            toast({
              title: "Error",
              description: "Failed to remove guest from database.",
              variant: "destructive",
            });
            return;
          }
        } catch (error) {
          console.error("Failed to delete guest:", error);
          toast({
            title: "Error",
            description: "Failed to remove guest. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }

      setGuestList((prev) => {
        const updated = prev.filter((g) => g.id !== guestId);

        if (user?.id) {
          const unsentGuestsKey = `wedding-unsent-guests-${user.id}`;
          const unsentGuests = updated.filter((g) => typeof g.id === "number");
          localStorage.setItem(unsentGuestsKey, JSON.stringify(unsentGuests));
        }

        return updated;
      });

      toast({
        title: "Guest Removed",
        description: guest ? `${guest.name} has been removed from your guest list.` : "Guest removed successfully.",
      });
    },
    [user?.id, guestList, toast]
  );

  const sendInvitations = useCallback(async () => {
    if (!isPremium) {
      toast({
        title: "Premium Feature",
        description: "Email invitations are a Premium feature. Upgrade to send beautiful wedding invitations!",
        variant: "destructive",
      });
      return;
    }

    const unsentGuests = guestList.filter((g) => typeof g.id === "number");

    if (guestList.length === 0) {
      toast({
        title: "No Guests",
        description: "Please add guests to your list before sending invitations.",
        variant: "destructive",
      });
      return;
    }

    if (unsentGuests.length === 0) {
      toast({
        title: "No New Guests",
        description: "All guests have already been sent invitations. Add new guests to send more invitations.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/wedding/send-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          guests: unsentGuests.map((g) => ({
            name: g.name,
            email: g.email,
            plusOne: g.plusOne,
            partnerName: g.partnerName,
          })),
          eventDetails: {
            partner1Name: partner1Name || undefined,
            partner2Name: partner2Name || undefined,
            coupleName:
              partner1Name && partner2Name
                ? `${partner1Name} & ${partner2Name}`
                : (partner1Name || partner2Name || user?.displayName)
                ? `${partner1Name || partner2Name || user?.displayName}'s Wedding`
                : "Our Wedding",
            eventDate: selectedDate && weddingTime ? `${selectedDate}T${weddingTime}` : selectedDate || undefined,
            eventLocation: weddingLocation || undefined,
            receptionDate: receptionDate && receptionTime ? `${receptionDate}T${receptionTime}` : receptionDate || undefined,
            receptionLocation: receptionLocation || undefined,
            useSameLocation: useSameLocation,
            hasReception: !!(receptionDate || receptionTime || receptionLocation || useSameLocation),
            coupleEmail: user?.email || undefined,
            message: customMessage || "We would be honored to have you celebrate with us!",
            template: selectedTemplate,
          },
        }),
      });

      const data = await response.json();

      if (data.ok) {
        if (user?.id) {
          const unsentGuestsKey = `wedding-unsent-guests-${user.id}`;
          localStorage.removeItem(unsentGuestsKey);
        }

        setGuestList((prev) => prev.filter((g) => typeof g.id === "string"));

        if (data.errors && data.errors.length > 0) {
          const errorMessages = data.errors.map((err: any) => `${err.email}: ${err.error}`).join("\n");

          toast({
            title: data.sent > 0 ? "Partial Success" : "Failed to Send Invitations",
            description: `${data.sent} of ${data.total} invitations sent successfully.\n\nErrors:\n${errorMessages}`,
            variant: data.sent > 0 ? "default" : "destructive",
          });
        } else {
          toast({
            title: "Invitations Sent!",
            description: `${data.sent} of ${data.total} invitations sent successfully.`,
          });
        }

        const listResponse = await fetch("/api/wedding/guest-list", { credentials: "include" });

        if (listResponse.ok) {
          const listData = await listResponse.json();
          if (listData.ok) {
            setGuestList(
              listData.guests.map((g: any) => ({
                id: g.id,
                name: g.name,
                email: g.email,
                rsvp: g.rsvp,
                plusOne: g.plusOne,
                plusOneName: g.plusOneName ?? null,
                respondedAt: g.respondedAt ?? null,
                partnerName: g.partnerName ?? undefined,
              }))
            );
          }
        }
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to send invitations",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to send invitations:", error);
      toast({
        title: "Error",
        description: "Failed to send invitations. Please try again.",
        variant: "destructive",
      });
    }
  }, [
    isPremium,
    guestList,
    selectedDate,
    weddingTime,
    weddingLocation,
    receptionDate,
    receptionTime,
    receptionLocation,
    partner1Name,
    partner2Name,
    customMessage,
    selectedTemplate,
    user,
    toast,
    useSameLocation,
  ]);

  const [isEditingEventDetails, setIsEditingEventDetails] = useState(false);

  const handleSaveEventDetails = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await fetch("/api/wedding/event-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          partner1Name,
          partner2Name,
          ceremonyDate: selectedDate,
          ceremonyTime: weddingTime,
          ceremonyLocation: weddingLocation,
          receptionDate,
          receptionTime,
          receptionLocation,
          useSameLocation,
          customMessage,
          selectedTemplate,
        }),
      });

      if (response.ok) {
        setIsEditingEventDetails(false);
        toast({
          title: "Event Details Saved",
          description: "Your wedding details have been saved successfully.",
        });
      } else {
        let errorMsg: string;
        try {
          const data = await response.json();
          errorMsg = data && data.error ? String(data.error) : response.statusText;
        } catch {
          errorMsg = response.statusText;
        }
        console.error("[Wedding Planning] Save event details error:", errorMsg);
        toast({
          title: "Save Failed",
          description: `Failed to save wedding details: ${errorMsg}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("[Wedding Planning] Failed to save event details:", error);
      toast({
        title: "Save Failed",
        description: `Failed to save wedding details: ${error?.message ?? String(error)}`,
        variant: "destructive",
      });
    }
  }, [
    user?.id,
    partner1Name,
    partner2Name,
    selectedDate,
    weddingTime,
    weddingLocation,
    receptionDate,
    receptionTime,
    receptionLocation,
    useSameLocation,
    customMessage,
    selectedTemplate,
    toast,
  ]);

  const rsvpStats = useMemo(() => {
    let acceptedBoth = 0;
    let ceremonyOnly = 0;
    let receptionOnly = 0;
    let declined = 0;
    let pending = 0;

    let ceremonyExtras = 0;
    let receptionExtras = 0;

    guestList.forEach((g) => {
      const hasPlusOne = !!g.plusOneName;
      switch (g.rsvp) {
        case "accepted":
        case "accept-both":
          acceptedBoth++;
          if (hasPlusOne) {
            ceremonyExtras++;
            receptionExtras++;
          }
          break;
        case "ceremony-only":
          ceremonyOnly++;
          if (hasPlusOne) ceremonyExtras++;
          break;
        case "reception-only":
          receptionOnly++;
          if (hasPlusOne) receptionExtras++;
          break;
        case "declined":
          declined++;
          break;
        default:
          pending++;
          break;
      }
    });

    const ceremonyTotal = acceptedBoth + ceremonyOnly + ceremonyExtras;
    const receptionTotal = acceptedBoth + receptionOnly + receptionExtras;

    return {
      acceptedBoth,
      ceremonyOnly,
      receptionOnly,
      ceremonyTotal,
      receptionTotal,
      declined,
      pending,
      total: guestList.length,
    };
  }, [guestList]);

  const respondedGuests = useMemo(() => {
    return guestList
      .filter((guest) => guest.rsvp !== "pending")
      .slice()
      .sort((a, b) => {
        const aTime = a.respondedAt ? new Date(a.respondedAt).getTime() : 0;
        const bTime = b.respondedAt ? new Date(b.respondedAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [guestList]);

  const rsvpBreakdownRows = useMemo(() => {
    const total = Math.max(1, rsvpStats.total);

    const rows = [
      { key: "both", label: "Both Events", count: rsvpStats.acceptedBoth, tone: "green" as const },
      { key: "ceremony", label: "Ceremony Only", count: rsvpStats.ceremonyOnly, tone: "blue" as const },
      { key: "reception", label: "Reception Only", count: rsvpStats.receptionOnly, tone: "purple" as const },
      { key: "declined", label: "Declined", count: rsvpStats.declined, tone: "red" as const },
      { key: "pending", label: "Pending", count: rsvpStats.pending, tone: "slate" as const },
    ];

    return rows.map((r) => ({
      ...r,
      percent: Math.round((r.count / total) * 100),
    }));
  }, [rsvpStats]);

  const handleExportRsvpCsv = useCallback(() => {
    if (!guestList.length) {
      toast({
        title: "Nothing to export",
        description: "Your guest list is empty.",
        variant: "destructive",
      });
      return;
    }

    const escape = (v: any) => {
      const s = String(v ?? "");
      return `"${s.replace(/"/g, '""')}"`;
    };

    const rows = guestList.map((g) => {
      const status = typeof g.id === "string" ? "sent" : "unsent";
      const responded = g.rsvp && g.rsvp !== "pending" ? "yes" : "no";

      const event =
        g.rsvp === "accept-both" || g.rsvp === "accepted"
          ? "both"
          : g.rsvp === "ceremony-only"
          ? "ceremony"
          : g.rsvp === "reception-only"
          ? "reception"
          : "";

      return {
        id: g.id,
        status,
        name: g.name,
        partnerName: g.partnerName ?? "",
        email: g.email,
        rsvp: g.rsvp,
        event,
        plusOneAllowed: g.plusOne ? "yes" : "no",
        plusOneName: g.plusOneName ?? "",
        respondedAt: g.respondedAt ?? "",
        responded,
      };
    });

    const headers = [
      "id",
      "status",
      "name",
      "partnerName",
      "email",
      "rsvp",
      "event",
      "plusOneAllowed",
      "plusOneName",
      "respondedAt",
      "responded",
    ];

    const csv = [headers.join(",")]
      .concat(rows.map((r) => headers.map((h) => escape((r as any)[h])).join(",")))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `guest-list-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    toast({ title: "Exported CSV", description: "Your guest list was downloaded." });
  }, [guestList, toast]);

  const handleStartPlanning = useCallback(() => {
    toast({
      title: "Let's Start Planning!",
      description: "Scroll down to explore vendors, manage your budget, and track your calendar.",
    });
    window.scrollTo({ top: 600, behavior: "smooth" });
  }, [toast]);

  const handleViewBudgetReport = useCallback(() => {
    setIsBudgetReportOpen(true);
  }, []);

  const handleGoPremium = useCallback(() => {
    toast({
      title: "Upgrade to Premium",
      description: "Redirecting to subscription page...",
    });
    setTimeout(() => {
      toast({
        title: "Coming Soon",
        description: "Premium subscription checkout will be available soon!",
      });
    }, 1000);
  }, [toast]);

  // ===========================
  // REGISTRY LINKS (FIXED)
  // ===========================

  const beginEditRegistryLinks = useCallback(() => {
    setRegistryDraft(registryLinks);
    setIsEditingRegistryLinks(true);
  }, [registryLinks]);

  const cancelEditRegistryLinks = useCallback(() => {
    setRegistryDraft(registryLinks);
    setIsEditingRegistryLinks(false);
  }, [registryLinks]);

  const saveRegistryLinks = useCallback(async () => {
    const saved = normalizeRegistryLinks(registryDraft);

    // Always persist locally first so the user never loses work (offline-safe).
    try {
      localStorage.setItem(
        getWeddingRegistryLinksStorageKey(user?.id),
        JSON.stringify(saved.map((l) => ({ id: l.id, name: l.name, url: l.url, icon: l.icon })))
      );
      // Keep a guest copy too (handy if a user signs out / loses session)
      localStorage.setItem(getWeddingRegistryLinksStorageKey(undefined), JSON.stringify(saved));
    } catch {}

    // Update UI immediately (optimistic UI).
    setRegistryLinks(saved);
    setRegistryDraft(saved);
    setIsEditingRegistryLinks(false);

    // Guests: local-only.
    if (!user?.id) {
      toast({ title: "Saved", description: "Your registry links were saved on this device." });
      return;
    }

    // Signed-in users: save to DB so it works across devices.
    try {
      const response = await fetch("/api/wedding/registry-links", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registryLinks: saved.map((l) => ({ id: l.id, name: l.name, url: l.url, icon: l.icon })),
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {}

      if (!response.ok || !data?.ok) {
        const msg = data?.error || response.statusText || "Failed to save registry links";
        console.error("[Wedding Planning] Registry save failed:", msg, data);
        toast({
          title: "Saved locally, but not to your account",
          description:
            "We saved your registry links on this device, but couldn't save them to the database. " +
            "That’s why they don’t show on other devices. Check your server logs for /api/wedding/registry-links.",
          variant: "destructive",
        });
        return;
      }

      // Server may normalize/overwrite; trust DB copy for cross-device consistency.
      if (Array.isArray(data.registryLinks)) {
        const fromServer = normalizeRegistryLinks(data.registryLinks);
        setRegistryLinks(fromServer);
        setRegistryDraft(fromServer);
        try {
          localStorage.setItem(
            getWeddingRegistryLinksStorageKey(user?.id),
            JSON.stringify(fromServer.map((l) => ({ id: l.id, name: l.name, url: l.url, icon: l.icon })))
          );
        } catch {}
      }

      toast({
        title: "Saved",
        description: "Your registry links were saved to your account (works on all devices).",
      });
    } catch (error) {
      console.error("[Wedding Planning] Failed to save registry links to DB:", error);
      toast({
        title: "Saved locally, but not to your account",
        description:
          "We saved your registry links on this device, but couldn't reach the server to save them to the database. " +
          "That’s why they don’t show on other devices.",
        variant: "destructive",
      });
    }
  }, [registryDraft, user?.id, toast]);

  // Backwards-compatible handler names (older JSX referenced these)
  const handleStartRegistryEdit = beginEditRegistryLinks;
  const handleCancelRegistryEdit = cancelEditRegistryLinks;
  const handleSaveRegistryLinks = saveRegistryLinks;

  const handleAddRegistry = useCallback(() => {
    const newRegistry = { id: Date.now(), name: "Custom Registry", url: "", icon: "🎁" };
    if (!isEditingRegistryLinks) {
      setRegistryDraft([...registryLinks, newRegistry]);
      setIsEditingRegistryLinks(true);
    } else {
      setRegistryDraft((prev) => [...prev, newRegistry]);
    }
    toast({ title: "Registry Added", description: "Add your registry URL, then press Save." });
  }, [isEditingRegistryLinks, registryLinks, toast]);

  const handleRemoveRegistry = useCallback(
    (registryId: number) => {
      setRegistryDraft((prev) => prev.filter((r) => r.id !== registryId));
      toast({ title: "Registry Removed", description: "Registry removed (press Save to keep changes)." });
    },
    [toast]
  );

  const handleShareRegistry = useCallback(
    (platform: string) => {
      const registrySlug = user?.username || user?.id || "my-registry";
      const url = `https://chefsire.com/registry/${registrySlug}`;

      if (platform === "copy") {
        navigator.clipboard.writeText(url);
        toast({ title: "Link Copied!", description: "Registry link copied to clipboard." });
      } else if (platform === "Email") {
        const subject = encodeURIComponent("Check out our wedding registry!");
        const body = encodeURIComponent(
          `We've created a wedding registry to help us start our new life together.\n\nView our registry here: ${url}\n\nThank you for your love and support!`
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      } else if (platform === "Facebook") {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
      } else if (platform === "Instagram") {
        navigator.clipboard.writeText(url);
        toast({ title: "Link Copied!", description: "Paste this link in your Instagram bio or story." });
      }
    },
    [user, toast]
  );

  const normalizeCalendarDate = useCallback((date: Date) => date.toISOString().split("T")[0], []);
  const parseCalendarDate = useCallback((dateString: string) => new Date(`${dateString}T00:00:00`), []);

  const buildGoogleCalendarUrl = useCallback((event: { title: string; date: Date; time?: string; notes?: string }) => {
    const y = event.date.getFullYear();
    const m = String(event.date.getMonth() + 1).padStart(2, "0");
    const d = String(event.date.getDate()).padStart(2, "0");
    const ymd = `${y}${m}${d}`;

    const fmtDateTime = (dt: Date) => {
      const yy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const hh = String(dt.getHours()).padStart(2, "0");
      const mi = String(dt.getMinutes()).padStart(2, "0");
      return `${yy}${mm}${dd}T${hh}${mi}00`;
    };

    let datesParam: string;
    const time = (event.time || "").trim();

    if (time) {
      const [hhRaw, mmRaw] = time.split(":");
      const hh = Number(hhRaw);
      const mi = Number(mmRaw);

      const start = new Date(event.date);
      start.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mi) ? mi : 0, 0, 0);

      const end = new Date(start.getTime() + 60 * 60 * 1000);
      datesParam = `${fmtDateTime(start)}/${fmtDateTime(end)}`;
    } else {
      const endDate = new Date(event.date);
      endDate.setDate(endDate.getDate() + 1);
      const y2 = endDate.getFullYear();
      const m2 = String(endDate.getMonth() + 1).padStart(2, "0");
      const d2 = String(endDate.getDate()).padStart(2, "0");
      datesParam = `${ymd}/${y2}${m2}${d2}`;
    }

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: event.title,
      dates: datesParam,
      details: event.notes || "",
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }, []);

  const sortedCalendarEvents = useMemo(() => [...calendarEvents].sort((a, b) => a.date.localeCompare(b.date)), [calendarEvents]);
  const calendarEventDates = useMemo(() => calendarEvents.map((event) => parseCalendarDate(event.date)), [calendarEvents, parseCalendarDate]);

  const handleAddCalendarEvent = useCallback(async () => {
    if (!calendarDate || !calendarTitle.trim() || !calendarType) {
      toast({
        title: "Missing Details",
        description: "Select a date, title, and event type to add this to your calendar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/wedding/calendar-events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventDate: normalizeCalendarDate(calendarDate),
          title: calendarTitle.trim(),
          type: calendarType,
          notes: calendarNotes.trim() || undefined,
          reminder: calendarReminder,
          eventTime: calendarEventTime.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errMsg = await response.text();
        toast({
          title: "Save Failed",
          description: errMsg || "Unable to save this event.",
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();
      if (data.ok && data.event) {
        const savedEvent = {
          id: Number(data.event.id),
          date: data.event.eventDate,
          time: (data.event.eventTime as string | undefined) || "",
          title: data.event.title,
          type: data.event.type,
          reminder: Boolean(data.event.reminder),
          notes: data.event.notes || undefined,
        };

        setCalendarEvents((prev) => [...prev, savedEvent]);

        const googleCalendarUrl = buildGoogleCalendarUrl({
          title: savedEvent.title,
          date: parseCalendarDate(savedEvent.date),
          time: savedEvent.time,
          notes: savedEvent.notes,
        });

        toast({
          title: "Event Added",
          description: "Your event has been added to the calendar.",
          action: (
            <ToastAction altText="Add to Google Calendar" onClick={() => window.open(googleCalendarUrl, "_blank", "noopener,noreferrer")}>
              Add to Google Calendar
            </ToastAction>
          ),
        });
      } else {
        toast({
          title: "Event Added",
          description: "Your event has been added to the calendar.",
        });
      }

      setCalendarTitle("");
      setCalendarType("");
      setCalendarNotes("");
      setCalendarReminder(false);
      setCalendarEventTime("");
      setCalendarDate(undefined);
    } catch (error) {
      console.error("[Wedding Planning] Failed to save calendar event:", error);
      toast({
        title: "Save Failed",
        description: "Unable to save this event. Please try again.",
        variant: "destructive",
      });
    }
  }, [
    calendarDate,
    calendarNotes,
    calendarReminder,
    calendarTitle,
    calendarType,
    calendarEventTime,
    buildGoogleCalendarUrl,
    normalizeCalendarDate,
    parseCalendarDate,
    toast,
  ]);

  const handleRemoveCalendarEvent = useCallback(
    async (eventId: number) => {
      try {
        const response = await fetch(`/api/wedding/calendar-events/${eventId}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (!response.ok) {
          const errMsg = await response.text();
          toast({
            title: "Delete Failed",
            description: errMsg || "Unable to remove this event.",
            variant: "destructive",
          });
          return;
        }

        setCalendarEvents((prev) => prev.filter((event) => event.id !== eventId));
        toast({
          title: "Event Removed",
          description: "The event has been removed from your calendar.",
        });
      } catch (error) {
        console.error("[Wedding Planning] Failed to delete calendar event:", error);
        toast({
          title: "Delete Failed",
          description: "Unable to remove this event. Please try again.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const handleTrialSelect = useCallback(
    async (tier: "free" | "premium" | "elite") => {
      if (currentTier === "premium" || currentTier === "elite") {
        toast({ title: "Already Subscribed", description: "You already have an active subscription!" });
        setShowTrialSelector(false);
        return;
      }

      const plan = (couplePlans as any)[tier];

      try {
        let subscriptionEndsAt: string | null = null;
        if (tier !== "free" && plan?.trialDays) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + plan.trialDays);
          subscriptionEndsAt = endDate.toISOString();
        }

        await updateUser({
          subscriptionTier: tier,
          subscriptionStatus: "active" as any,
          subscriptionEndsAt: subscriptionEndsAt as any,
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        localStorage.setItem("weddingTierSelected", "true");
        setShowTrialSelector(false);

        if (tier === "free") {
          toast({
            title: "Free Plan Activated",
            description: "You can upgrade to Premium or Elite anytime to unlock more features!",
          });
        } else {
          toast({
            title: `${plan.trialDays}-Day ${plan.name} Trial Started!`,
            description: `Enjoy all ${plan.name} features for free. Features should unlock immediately!`,
          });
        }
      } catch (error) {
        console.error("[Wedding Planning] Failed to update tier:", error);
        toast({
          title: "Update Failed",
          description: "Failed to activate trial. Please try again or refresh the page.",
          variant: "destructive",
        });
      }
    },
    [updateUser, toast, currentTier]
  );


  const InvitationPreview = () => {
    try {
      const styleTemplates = {
        elegant: {
          container: "bg-white font-serif border-double border-pink-200",
          accent: "text-pink-500",
          title: "font-light tracking-widest uppercase text-3xl",
          button: "rounded-full border-pink-200",
        },
        rustic: {
          container: "bg-orange-50 font-sans border-dashed border-amber-300",
          accent: "text-amber-700",
          title: "font-bold text-4xl italic text-amber-900",
          button: "rounded-none border-amber-500 bg-amber-50",
        },
        modern: {
          container: "bg-slate-900 text-white font-sans border-solid border-white/20",
          accent: "text-cyan-400",
          title: "font-black tracking-tighter text-5xl uppercase italic",
          button: "rounded-md border-cyan-400 text-cyan-400 hover:bg-cyan-400/10",
        },
      };

      const styles = (styleTemplates as any)[selectedTemplate] || styleTemplates.elegant;

      return (
        <div className={`p-8 rounded-lg text-center space-y-6 border-4 shadow-xl transition-all duration-500 ${styles.container}`}>
          <div className="space-y-2">
            <Sparkles className={`w-6 h-6 mx-auto ${styles.accent}`} />
            <h2 className={styles.title}>
              {partner1Name || "Partner 1"} <span className="text-xl block md:inline">&</span> {partner2Name || "Partner 2"}
            </h2>
            <div className={`h-px w-24 mx-auto opacity-50 ${selectedTemplate === "modern" ? "bg-cyan-400" : "bg-current"}`} />
          </div>

          <p className={`text-lg px-4 ${selectedTemplate === "modern" ? "text-slate-300" : "italic text-muted-foreground"}`}>
            "{customMessage}"
          </p>

          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center">
              <CalendarIcon className={`w-5 h-5 mb-1 ${styles.accent}`} />
              <p className="font-semibold text-lg">{selectedDate || "Saturday, June 14th"}</p>
              <p className="text-sm opacity-80">{weddingTime || "4:00 PM"}</p>
            </div>

            <div className="flex flex-col items-center">
              <MapPin className={`w-5 h-5 mb-1 ${styles.accent}`} />
              <p className="font-bold uppercase tracking-widest text-xs mb-1">The Ceremony</p>
              <p className="text-sm max-w-xs">{weddingLocation || "The Grand Estate, Main Hall"}</p>
            </div>

            {!useSameLocation && receptionLocation ? (
              <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500 pt-4 border-t border-current/10">
                <ChefHat className={`w-5 h-5 mb-1 ${styles.accent}`} />
                <p className="font-bold uppercase tracking-widest text-xs mb-1">The Reception</p>
                <p className="text-sm max-w-xs">{receptionLocation}</p>
                {receptionTime && <p className="text-xs opacity-70 mt-1">Dinner served at {receptionTime}</p>}
              </div>
            ) : useSameLocation ? (
              <div className="pt-4 border-t border-current/10">
                <p className={`text-xs uppercase tracking-[0.2em] font-medium ${styles.accent}`}>Dinner & Dancing to follow at the same venue</p>
              </div>
            ) : null}
          </div>

          <Button variant="outline" className={`pointer-events-none px-10 ${styles.button}`}>
            RSVP Online
          </Button>
        </div>
      );
    } catch (error) {
      console.error("[InvitationPreview] Error rendering:", error);
      toast({ title: "Debug Error", description: `Preview error: ${String(error)}`, variant: "destructive" });
      return <div className="p-8 text-center text-red-500">Error rendering preview</div>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8">
      <WeddingTrialSelector open={showTrialSelector} onSelect={handleTrialSelect} />

      {showTrialBanner && (
        <Card className="mb-4 md:mb-6 border-2 border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2 md:gap-3 flex-1">
                <div className="relative flex-shrink-0">
                  <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
                  <Badge className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-green-500 text-white text-[10px] md:text-xs">
                    FREE
                  </Badge>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm md:text-lg">Start Your 14-Day Premium Trial</h3>
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                    Unlimited vendor messaging • Priority responses • Advanced planning tools
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowTrialBanner(false);
                    localStorage.setItem("weddingTrialBannerDismissed", "true");
                  }}
                  className="flex-shrink-0"
                >
                  <X className="w-3 h-3 md:w-4 md:h-4" />
                </Button>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white flex-1 sm:flex-none" size="sm" onClick={handleStartTrial}>
                  <Zap className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-white" />
                  <span className="text-xs md:text-sm">Start Free Trial</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="mb-6">
          <div className="mb-4">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Wedding Planning Hub
            </h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base">Find and book the perfect vendors for your special day</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowBudgetCalculator(!showBudgetCalculator)} className="w-full sm:w-auto">
              <DollarSign className="w-4 h-4 mr-2 text-emerald-600" />
              <span className="hidden sm:inline">Budget Calculator</span>
              <span className="sm:hidden">Budget</span>
            </Button>
            <Link href="/services/vendor-listing" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full">
                <MapPin className="w-4 h-4 mr-2 text-purple-600" />
                <span className="hidden sm:inline">Open Vendor Map</span>
                <span className="sm:hidden">Map</span>
              </Button>
            </Link>
            <Button className="bg-gradient-to-r from-pink-600 to-purple-600 text-white w-full sm:w-auto" onClick={handleStartPlanning}>
              <Heart className="w-4 h-4 mr-2 text-pink-200" />
              Start Planning
            </Button>
          </div>
        </div>



{/* Vendor CTA (Top) */}
<Card className="mb-6 overflow-hidden border-0 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white shadow-lg">
  <CardContent className="p-4 sm:p-6">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg sm:text-xl font-bold leading-tight">Are you a wedding vendor?</h2>
        <p className="text-white/90 text-sm sm:text-base">
          Get discovered by couples planning their big day.
        </p>
      </div>
      <div className="flex w-full md:w-auto gap-2">
        <Link href="/vendor-signup" className="flex-1 md:flex-none">
          <Button className="w-full bg-white text-purple-700 hover:bg-white/90 font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            List my business
          </Button>
        </Link>
        <Link href="/services/vendor-listing" className="flex-1 md:flex-none">
          <Button
            variant="outline"
            className="w-full border-white/60 text-white bg-transparent hover:bg-white/15"
          >
            Learn more
          </Button>
        </Link>
      </div>
    </div>
  </CardContent>
</Card>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h3 className="font-semibold text-sm md:text-base">Your Wedding Planning Progress</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm text-muted-foreground">
                  {completedTasks} of {planningTasks.length} items completed
                </span>
                <Button variant="outline" size="sm" onClick={openProgressEditor}>
                  Edit
                </Button>
              </div>
            </div>

            <Progress value={planningProgress} className="mb-4" />

            <div className="grid grid-cols-4 md:grid-cols-7 gap-2 md:gap-3">
              {planningTasks.map((task) => (
                <div key={task.id} className="text-center">
                  <div
                    className={`w-7 h-7 md:w-8 md:h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${
                      task.completed ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {task.completed && <span className="text-xs">✅</span>}
                  </div>
                  <span className="text-[10px] md:text-xs line-clamp-2">{task.label}</span>
                </div>
              ))}
            </div>

            <Dialog open={isProgressEditorOpen} onOpenChange={handleProgressEditorOpenChange}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Wedding Progress</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={newPlanningTaskLabel}
                      onChange={(event) => setNewPlanningTaskLabel(event.target.value)}
                      placeholder="Add a planning item (e.g. officiant, transportation)"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addEditorTask();
                        }
                      }}
                    />
                    <Button variant="outline" onClick={addEditorTask} className="sm:w-auto">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                    {progressEditorTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggleEditorTask(task.id)}>
                          {task.completed ? "✅" : "⚪️"}
                        </Button>
                        <Input value={task.label} onChange={(event) => updateEditorTaskLabel(task.id, event.target.value)} />
                        <Button variant="ghost" size="sm" onClick={() => removeEditorTask(task.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => handleProgressEditorOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button onClick={savePlanningTasks}>Save</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {showBudgetCalculator && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Smart Budget Calculator</CardTitle>
              <CardDescription>Optimize your wedding budget across all vendor categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Total Budget</label>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-2xl font-bold">${budgetRange[1].toLocaleString()}</span>
                    <Slider value={budgetRange} onValueChange={handleBudgetRangeChange} max={100000} min={5000} step={1000} className="flex-1" />
                  </div>
                </div>

                <div className="grid gap-3 mt-6">
                  {budgetBreakdown.map((item) => (
                    <div key={item.key} className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <item.icon className={`w-5 h-5 ${budgetIconTone(item.key)}`} />
                          <div>
                            <p className="font-medium">{item.category}</p>
                            <p className="text-xs text-muted-foreground">{item.percentage}% of budget</p>
                          </div>
                        </div>
                        <span className="font-semibold">${item.amount.toLocaleString()}</span>
                      </div>

                      {item.key !== "other" && (
                        <Slider value={[item.percentage]} onValueChange={(value) => updateBudgetAllocation(item.key, value[0] ?? item.percentage)} max={100} min={0} step={1} />
                      )}
                    </div>
                  ))}
                </div>

                <Alert>
                  <Info className="h-4 w-4 text-purple-600" />
                  <AlertDescription>
                    Based on {guestCount[0]} guests. Catering typically represents the largest portion of your wedding budget.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Premium Budget Tool Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Your Current Budget</CardTitle>
              <CardDescription>Target: ${budgetRange[1].toLocaleString()}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className={isOverBudget ? "border-red-300 bg-red-50 text-red-700" : "border-green-300 bg-green-50 text-green-700"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="font-medium">
                    {budgetStatusLabel}: ${Math.abs(budgetDelta).toLocaleString()}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Progress value={budgetUsedPct} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>${totalSpent.toLocaleString()} spent</span>
                    <span>{isOverBudget ? `${Math.abs(budgetDelta).toLocaleString()} over` : `${budgetDelta.toLocaleString()} remaining`}</span>
                  </div>
                </div>

                <Slider value={budgetRange} onValueChange={handleBudgetRangeChange} max={100000} min={5000} step={1000} className="flex-1" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>${budgetRange[0].toLocaleString()}</span>
                  <span>${budgetRange[1].toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={isElite ? "border-amber-500/50" : "border-gray-200"}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className={isElite ? "text-amber-700" : "text-gray-500"}>{isElite ? "AI-Powered Budget Optimizer" : "Budget Optimization (Elite)"}</CardTitle>
              {isElite ? <TrendingUp className="w-6 h-6 text-amber-600" /> : <Lock className="w-6 h-6 text-gray-400" />}
            </CardHeader>
            <CardContent>
              {isElite ? (
                <div className="space-y-3">
                  <p className="text-4xl font-bold text-green-600">
                    <DollarSign className="w-6 h-6 inline mr-1 text-green-600" />
                    {dynamicSavings.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Projected savings by optimizing your venue and catering budget against similar couples in your area.
                  </p>
                  <Button size="sm" onClick={handleViewBudgetReport}>
                    View Detailed Report
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-4xl font-bold text-gray-400">Locked</p>
                  <p className="text-sm text-muted-foreground">
                    Unlock the AI-Powered Budget Optimizer (Elite tier) to find an average of
                    <span className="font-bold text-amber-600"> $4,200</span> in hidden savings based on your criteria and AI recommendations.
                  </p>
                  <Button size="sm" variant="outline" className="bg-amber-100 border-amber-300" onClick={handleGoPremium}>
                    <TrendingUp className="w-4 h-4 mr-2 text-amber-600" />
                    Upgrade to Elite
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Smart Tips */}
        <Card className="mb-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden relative">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-28 -right-28 h-72 w-72 rounded-full bg-purple-200/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-pink-200/20 blur-3xl" />

          <CardHeader className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-sm">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl md:text-2xl font-bold">Smart Tips & Next Steps</CardTitle>
                  <CardDescription className="text-sm md:text-base">
                    Personalized guidance based on your date, guests, budget, and progress.
                  </CardDescription>
                </div>
              </div>

              <Badge className="mt-1">
                {nextBestActions.filter((a) => a.done).length}/{nextBestActions.length} done
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="relative">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Next Best Actions */}
              <div className="rounded-2xl border bg-white/70 backdrop-blur-sm p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <p className="font-semibold">Next best actions</p>
                  </div>
                  <Badge variant="secondary">Plan</Badge>
                </div>

                <div className="space-y-2">
                  {nextBestActions.map((a) => (
                    <div
                      key={a.label}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-white/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full flex-shrink-0",
                            a.done ? "bg-green-600" : "bg-slate-300",
                          ].join(" ")}
                        />
                        <p className="text-sm font-medium truncate">{a.label}</p>
                      </div>

                      {a.done ? (
                        <Badge>Done</Badge>
                      ) : (
                        <Badge variant="outline" className="whitespace-nowrap">
                          To do
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl bg-muted/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Momentum</p>
                    <p className="text-xs font-medium">
                      {Math.round((nextBestActions.filter((a) => a.done).length / Math.max(1, nextBestActions.length)) * 100)}%
                    </p>
                  </div>
                  <Progress
                    value={Math.round((nextBestActions.filter((a) => a.done).length / Math.max(1, nextBestActions.length)) * 100)}
                    className="mt-2 h-2"
                  />
                </div>
              </div>

              {/* Tips */}
              <div className="rounded-2xl border bg-white/70 backdrop-blur-sm p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    <p className="font-semibold">Tips that match your plan</p>
                  </div>
                  <Badge variant="secondary">Smart</Badge>
                </div>

                <div className="space-y-2">
                  {smartTips.map((t) => (
                    <div key={t.title} className="rounded-xl border bg-white/60 p-3">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{t.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {!selectedDate ? (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed bg-white/60 p-3">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <p className="text-xs text-muted-foreground">
                      Set your date to unlock tighter vendor availability + pricing tips.
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Budget Watch */}
              <div className="rounded-2xl border bg-white/70 backdrop-blur-sm p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                    <p className="font-semibold">Budget watch</p>
                  </div>
                  <Badge variant="secondary">Top 3</Badge>
                </div>

                <div className="space-y-3">
                  {topBudgetItems.map((b) => {
                    const pct = Math.min(100, Math.round((b.spent / Math.max(1, b.target)) * 100));
                    const isOver = b.remaining < 0;

                    return (
                      <div key={b.key} className="rounded-xl border bg-white/60 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <b.icon className={`h-4 w-4 ${budgetIconTone(b.key)} flex-shrink-0`} />
                            <p className="text-sm font-semibold truncate">{b.category}</p>
                          </div>

                          <Badge variant={isOver ? "destructive" : "outline"} className="whitespace-nowrap">
                            {isOver ? "Over" : "On track"}
                          </Badge>
                        </div>

                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Spent ${b.spent.toLocaleString()}</span>
                            <span>Target ${b.target.toLocaleString()}</span>
                          </div>
                          <Progress value={pct} className="mt-2 h-2" />
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {isOver ? "Over by" : "Remaining"}{" "}
                            <span className={isOver ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                              ${Math.abs(b.remaining).toLocaleString()}
                            </span>
                          </p>

                          <Button size="sm" className="h-8" onClick={handleViewBudgetReport}>
                            View report
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-xl bg-muted/60 p-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-pink-600" />
                    <p className="text-xs text-muted-foreground">
                      Pro tip: keep venue + catering aligned with guest count to avoid surprise jumps.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4 md:p-6">
            
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-sm">
                    <CalendarIcon className="h-4 w-4 text-white" />
                  </div>
                  <label className="text-xs md:text-sm font-medium block">Event Date</label>
                </div>
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full" />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-sm">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <label className="text-xs md:text-sm font-medium block">Guest Count</label>
                </div>
                <Input
                  type="number"
                  value={guestCount[0]}
                  onChange={(e) => setGuestCount([parseInt(e.target.value || "0", 10)])}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-sm">
                    <MapPin className="h-4 w-4 text-white" />
                  </div>
                  <label className="text-xs md:text-sm font-medium block">Location</label>
                </div>
                <Input
                  ref={vendorLocationRef}
                  placeholder="City, State (e.g., New York, NY)"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  className="w-full"
                />
                <p className="mt-1 text-[10px] md:text-xs text-muted-foreground">
                  Start typing any city/state in the US — this is no longer limited to a single state.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-pink-600 to-rose-500 flex items-center justify-center shadow-sm">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <label className="text-xs md:text-sm font-medium block">Style</label>
                </div>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Wedding style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Classic & Elegant</SelectItem>
                    <SelectItem value="rustic">Rustic & Barn</SelectItem>
                    <SelectItem value="modern">Modern & Chic</SelectItem>
                    <SelectItem value="beach">Beach & Outdoor</SelectItem>
                    <SelectItem value="vintage">Vintage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
</div>
          </CardContent>
        </Card>
      </div>

      {/* Category buttons */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
        {VENDOR_CATEGORIES.map((category) => {
          const Icon = category.icon as any;
          const isSelected = selectedVendorType === category.value;
          const count = category.value === "all" ? VENDORS.length : VENDORS.filter((v) => v.type === category.value).length;

          return (
            <Button
              key={category.value}
              variant={isSelected ? "default" : "outline"}
              onClick={() => setSelectedVendorType(category.value)}
              className="w-full flex items-center justify-center sm:justify-between px-2"
              size="sm"
            >
              <div className="flex items-center gap-1 min-w-0">
                <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-white" : vendorIconTone(category.value)}`} />
                <span className="text-xs sm:text-sm hidden sm:inline truncate">{category.label}</span>
              </div>
              <Badge variant="secondary" className="text-xs hidden sm:flex flex-shrink-0">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Vendors header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <h2 className="text-lg md:text-xl font-semibold">{filteredVendors.length} Vendors Available</h2>
          {selectedDate && (
            <Badge variant="secondary" className="w-fit">
              <Calendar className="w-3 h-3 mr-1 text-blue-600" />
              <span className="text-xs">
                {new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select defaultValue="featured">
            <SelectTrigger className="w-full sm:w-40 text-xs md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="availability">Available First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>


      {/* Get a Quote dialog */}
      <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request a Quote</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm font-medium">{quoteVendor?.name || "Vendor"}</p>
              <p className="text-xs text-muted-foreground">
                Fill this out and we&apos;ll send the vendor your request.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Event Date</label>
                <Input
                  type="date"
                  value={quoteForm.eventDate}
                  onChange={(e) => setQuoteForm((p) => ({ ...p, eventDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Guest Count</label>
                <Input
                  type="number"
                  min={1}
                  value={quoteForm.guestCount || ""}
                  onChange={(e) => setQuoteForm((p) => ({ ...p, guestCount: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Your Email</label>
              <Input
                type="email"
                value={quoteForm.contactEmail}
                onChange={(e) => setQuoteForm((p) => ({ ...p, contactEmail: e.target.value }))}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Message (optional)</label>
              <Textarea
                value={quoteForm.message}
                onChange={(e) => setQuoteForm((p) => ({ ...p, message: e.target.value }))}
                placeholder="Any details or questions for the vendor..."
                rows={4}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setIsQuoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitQuoteRequest}>
                Send Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      


      {/* Budget Report dialog */}
      <Dialog open={isBudgetReportOpen} onOpenChange={setIsBudgetReportOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>AI Budget Detail Report</DialogTitle>
          </DialogHeader>

          {!isPremium ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription className="flex items-start gap-2">
                  <Lock className="h-4 w-4 mt-0.5" />
                  <span>
                    Detailed budget insights are a Premium feature. You can preview your totals here, then upgrade to unlock the
                    full category breakdown and savings guidance.
                  </span>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Total budget</p>
                  <p className="text-lg font-bold">${totalBudget.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Total spent (tracked)</p>
                  <p className="text-lg font-bold">${totalSpent.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className={`text-lg font-bold ${budgetDelta < 0 ? "text-red-600" : "text-green-600"}`}>
                    {budgetStatusLabel}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border bg-white/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Budget used</p>
                  <Badge variant="secondary">{budgetUsedPct}%</Badge>
                </div>
                <Progress value={budgetUsedPct} className="mt-2 h-2" />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setIsBudgetReportOpen(false)}>
                  Close
                </Button>
                <Button onClick={handleGoPremium}>
                  <Sparkles className="h-4 w-4 mr-2 text-white" />
                  Upgrade to Premium
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Projected savings</p>
                  <p className="text-lg font-bold">${dynamicSavings.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Total budget</p>
                  <p className="text-lg font-bold">${totalBudget.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Total spent (tracked)</p>
                  <p className="text-lg font-bold">${totalSpent.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className={`text-lg font-bold ${budgetDelta < 0 ? "text-red-600" : "text-green-600"}`}>
                    ${Math.abs(budgetDelta).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border bg-white/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-semibold">Category breakdown</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleExportBudgetCsv}>
                      <Share2 className="h-4 w-4 mr-2 text-indigo-600" />
                      Export CSV
                    </Button>
                  </div>
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border">
                  <div className="grid grid-cols-12 bg-muted/60 px-3 py-2 text-xs font-medium">
                    <div className="col-span-5">Category</div>
                    <div className="col-span-2 text-right">Target</div>
                    <div className="col-span-2 text-right">Spent</div>
                    <div className="col-span-2 text-right">Remaining</div>
                    <div className="col-span-1 text-right">%</div>
                  </div>

                  <div className="divide-y bg-white/60">
                    {budgetReportRows.map((r) => (
                      <div key={r.key} className="grid grid-cols-12 items-center px-3 py-2">
                        <div className="col-span-5 flex items-center gap-2 min-w-0">
                          <r.icon className={`h-4 w-4 ${budgetIconTone(r.key)} flex-shrink-0`} />
                          <p className="text-sm font-medium truncate">{r.category}</p>
                          <Badge variant="secondary" className="ml-1 text-[10px]">
                            {r.percentage}%
                          </Badge>
                        </div>
                        <div className="col-span-2 text-right text-sm font-semibold">${r.target.toLocaleString()}</div>
                        <div className="col-span-2 text-right text-sm">${r.spent.toLocaleString()}</div>
                        <div className="col-span-2 text-right text-sm">
                          <span className={r.remaining < 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                            ${Math.abs(r.remaining).toLocaleString()}
                          </span>
                        </div>
                        <div className="col-span-1 text-right text-xs text-muted-foreground">{r.pct}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-muted/60 p-3">
                  <div className="flex items-start gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Tip: if you&apos;re over budget, adjust guest count or re-balance venue + catering first — that&apos;s where most
                      big swings happen.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

{/* Vendors grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
        {filteredVendors.map((vendor) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            isSaved={savedVendors.has(vendor.id)}
            isQuoteRequested={requestedQuotes.has(vendor.id)}
            onToggleSave={toggleSaveVendor}
            onRequestQuote={requestQuote}
          />
        ))}
      </div>

      {/* Gift Registry */}
      <Card className="mb-8">
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center shadow-sm"><Gift className="w-4 h-4 text-white" /></div>
                Gift Registry Hub
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Manage all your registries in one place and share with guests</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {isEditingRegistryLinks ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleCancelRegistryEdit}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveRegistryLinks}>
                    Save
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={handleStartRegistryEdit}>
                  Edit
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="space-y-3 md:space-y-4">
            {(isEditingRegistryLinks ? registryDraft : registryLinks).map((registry) => (
              <div key={registry.id} className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl flex-shrink-0">{registry.icon}</span>
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={`${registry.name} Registry URL`}
                    value={registry.url}
                    onChange={(e) => {
                      if (!isEditingRegistryLinks) return;
                      setRegistryDraft((prev) => prev.map((r) => (r.id === registry.id ? { ...r, url: e.target.value } : r)));
                    }}
                    className="w-full text-sm"
                    disabled={!isEditingRegistryLinks}
                  />
                </div>
                {isEditingRegistryLinks && (
                  <Button size="sm" variant="ghost" className="flex-shrink-0" onClick={() => handleRemoveRegistry(registry.id)} title="Remove">
                    <X className="w-3 h-3 md:w-4 md:h-4" />
                  </Button>
                )}
              </div>
            ))}

            <Button variant="outline" className="w-full text-sm" onClick={handleAddRegistry}>
              <Plus className="w-4 h-4 mr-2" />
              Add Another Registry
            </Button>

            {!isEditingRegistryLinks && (
              <p className="text-xs text-muted-foreground">
                Tap <span className="font-medium">Edit</span> to add or change registry links, then <span className="font-medium">Save</span>.
              </p>
            )}

            <div className="border-t pt-4 mt-4 md:mt-6">
              <h4 className="font-medium mb-3 text-sm md:text-base">Share Your Registries</h4>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => handleShareRegistry("Facebook")}>
                  <Share2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-blue-600" />
                  <span className="hidden sm:inline">Facebook</span>
                  <span className="sm:hidden">FB</span>
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => handleShareRegistry("Instagram")}>
                  <Share2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-pink-600" />
                  <span className="hidden sm:inline">Instagram</span>
                  <span className="sm:hidden">IG</span>
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => handleShareRegistry("Email")}>
                  <Mail className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-purple-600" />
                  Email
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => handleShareRegistry("copy")}>
                  <Link2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-slate-700" />
                  <span className="hidden sm:inline">Copy Link</span>
                  <span className="sm:hidden">Copy</span>
                </Button>
              </div>

              <Alert className="mt-4">
                <Info className="h-3 w-3 md:h-4 md:w-4 text-purple-600" />
                <AlertDescription className="text-xs md:text-sm break-all">
                  Your unique registry page: <strong>chefsire.com/registry/{user?.username || user?.id || "my-registry"}</strong>
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Planning Calendar */}
      <Card className="mb-8">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-sm"><CalendarIcon className="w-4 h-4 text-white" /></div>
            Planning Calendar
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Track important dates, appointments, and deadlines</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div>
              <div className="mb-4 md:mb-6">
                <CalendarUI
                  mode="single"
                  selected={calendarDate}
                  onSelect={(date) => setCalendarDate(date ?? undefined)}
                  modifiers={{ hasEvent: calendarEventDates }}
                  modifiersClassNames={{
                    hasEvent:
                      "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                  }}
                  className="rounded-md border"
                />
              </div>

              <h4 className="font-medium mb-3 text-sm md:text-base flex items-center gap-2"><div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-sm"><Calendar className="h-4 w-4 text-white" /></div>Upcoming Events<BellRing className="h-4 w-4 text-amber-500 ml-1" /></h4>

              <div className="space-y-2">
                {sortedCalendarEvents.length === 0 ? (
                  <div className="text-xs md:text-sm text-muted-foreground border border-dashed rounded-lg p-3">
                    No events yet. Pick a date on the calendar and add your first milestone.
                  </div>
                ) : (
                  sortedCalendarEvents.map((event) => {
                    const eventDate = parseCalendarDate(event.date);
                    return (
                      <div key={event.id} className="flex items-start gap-2 md:gap-3 p-2 md:p-3 bg-muted rounded-lg">
                        <div className="text-center min-w-[40px] md:min-w-[50px]">
                          <div className="text-[10px] md:text-xs text-muted-foreground">{eventDate.toLocaleDateString("en-US", { month: "short" })}</div>
                          <div className="text-base md:text-lg font-bold">{eventDate.getDate()}</div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs md:text-sm truncate">{event.title}</p>
                          {event.time && <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">🕒 {event.time}</p>}
                          {event.notes && <p className="text-[10px] md:text-xs text-muted-foreground mt-1 line-clamp-2">{event.notes}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={event.type === "payment" ? "destructive" : event.type === "appointment" ? "default" : "secondary"}
                              className="text-[10px] md:text-xs capitalize"
                            >
                              {event.type}
                            </Badge>
                            {event.reminder && <BellRing className="w-3 h-3 text-muted-foreground" />}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-1 md:p-2"
                            title="Add to Google Calendar"
                            onClick={() => {
                              const url = buildGoogleCalendarUrl({
                                title: event.title,
                                date: parseCalendarDate(event.date),
                                time: event.time,
                                notes: event.notes,
                              });
                              window.open(url, "_blank", "noopener,noreferrer");
                            }}
                          >
                            <Calendar className="w-3 h-3 text-blue-600" />
                          </Button>

                          <Button size="sm" variant="ghost" className="p-1 md:p-2" onClick={() => handleRemoveCalendarEvent(event.id)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3 text-sm md:text-base flex items-center gap-2"><div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-sm"><CalendarIcon className="h-4 w-4 text-white" /></div><div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm"><Clock className="h-4 w-4 text-white" /></div>Add Event</h4>

              <div className="space-y-2 md:space-y-3">
                <Input
                  type="date"
                  className="text-sm"
                  value={calendarDate ? normalizeCalendarDate(calendarDate) : ""}
                  onChange={(e) => setCalendarDate(e.target.value ? parseCalendarDate(e.target.value) : undefined)}
                />

                <Input type="time" className="text-sm" value={calendarEventTime} onChange={(e) => setCalendarEventTime(e.target.value)} />

                <Input placeholder="Event title" className="text-sm" value={calendarTitle} onChange={(e) => setCalendarTitle(e.target.value)} />

                <Select value={calendarType} onValueChange={setCalendarType}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem value="payment">Payment Due</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                  </SelectContent>
                </Select>

                <Textarea placeholder="Notes (optional)" className="h-16 md:h-20 text-sm" value={calendarNotes} onChange={(e) => setCalendarNotes(e.target.value)} />

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="reminder" className="rounded" checked={calendarReminder} onChange={(e) => setCalendarReminder(e.target.checked)} />
                  <label htmlFor="reminder" className="text-xs md:text-sm">
                    Set reminder
                  </label>
                </div>

                <Button className="w-full text-sm" onClick={handleAddCalendarEvent}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Calendar
                </Button>
              </div>
            </div>
          </div>

          <Alert className="mt-6">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              <strong>Pro tip:</strong> Most couples book venues 10-12 months before their wedding date.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Email Invitations Section */}
      <Card className={`mb-8 ${isPremium ? "border-purple-500/50" : "border-gray-300"}`}>
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
              <CardTitle className="text-base md:text-lg">Email Invitations</CardTitle>
              {!isPremium && <Badge className="bg-pink-500 text-white text-xs">Premium</Badge>}
            </div>
            {isPremium && (
              <Badge className="bg-green-500 text-white text-xs">
                <span className="mr-1">✅</span>
                Active
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs md:text-sm">Send beautiful wedding invitations and track RSVPs</CardDescription>
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          {/* Event Details Form */}
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-rose-600 to-pink-500 flex items-center justify-center shadow-sm"><Heart className="w-4 h-4 text-white" /></div>
                Wedding Details
              </h4>

              {isPremium &&
                (isEditingEventDetails ? (
                  <Button size="sm" onClick={handleSaveEventDetails}>
                    Save
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setIsEditingEventDetails(true)}>
                    Edit
                  </Button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Input
                placeholder="Partner 1 Name (e.g., Sarah)"
                value={partner1Name}
                onChange={(e) => setPartner1Name(e.target.value)}
                className="text-sm"
                disabled={!isPremium || !isEditingEventDetails}
              />
              <Input
                placeholder="Partner 2 Name (e.g., John)"
                value={partner2Name}
                onChange={(e) => setPartner2Name(e.target.value)}
                className="text-sm"
                disabled={!isPremium || !isEditingEventDetails}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Input
                type="date"
                placeholder="Wedding Date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm"
                disabled={!isPremium || !isEditingEventDetails}
              />
              <Input
                type="time"
                placeholder="Wedding Time"
                value={weddingTime}
                onChange={(e) => setWeddingTime(e.target.value)}
                className="text-sm"
                disabled={!isPremium || !isEditingEventDetails}
              />
            </div>

            <div className="space-y-2 mb-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-pink-500" /> Ceremony Location
              </label>
              <Input
                ref={ceremonyRef}
                placeholder="Search for ceremony venue..."
                value={weddingLocation}
                onChange={(e) => {
                  setWeddingLocation(e.target.value);
                  if (useSameLocation) setReceptionLocation(e.target.value);
                }}
                className="text-sm"
                disabled={!isPremium || !isEditingEventDetails}
              />
            </div>

            <div className="flex items-center space-x-2 py-2 mb-3">
              <input
                type="checkbox"
                id="sync-location"
                checked={useSameLocation}
                onChange={(e) => {
                  setUseSameLocation(e.target.checked);
                  if (e.target.checked) setReceptionLocation(weddingLocation);
                }}
                className="h-4 w-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                disabled={!isPremium || !isEditingEventDetails}
              />
              <label htmlFor="sync-location" className="text-sm text-muted-foreground cursor-pointer">
                Reception is at the same location
              </label>
            </div>

            {!useSameLocation && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <h5 className="font-medium text-sm mb-2 mt-2">Reception Details (Optional)</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    type="date"
                    placeholder="Reception Date"
                    value={receptionDate}
                    onChange={(e) => setReceptionDate(e.target.value)}
                    className="text-sm"
                    disabled={!isPremium || !isEditingEventDetails}
                  />
                  <Input
                    type="time"
                    placeholder="Reception Time"
                    value={receptionTime}
                    onChange={(e) => setReceptionTime(e.target.value)}
                    className="text-sm"
                    disabled={!isPremium || !isEditingEventDetails}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-purple-500" /> Reception Location
                  </label>
                  <Input
                    ref={receptionRef}
                    placeholder="Search for reception venue..."
                    value={receptionLocation}
                    onChange={(e) => setReceptionLocation(e.target.value)}
                    className="text-sm"
                    disabled={!isPremium || !isEditingEventDetails}
                  />
                </div>
              </div>
            )}

            <Textarea
              placeholder="Custom message for your guests..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full p-3 text-sm border rounded-md resize-none"
              rows={3}
              disabled={!isPremium || !isEditingEventDetails}
            />
          </div>

          {/* RSVP Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-xl md:text-2xl font-bold">{rsvpStats.total}</p>
              <p className="text-xs text-muted-foreground">Total Guests</p>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-xl md:text-2xl font-bold text-blue-600">{rsvpStats.ceremonyTotal}</p>
              <p className="text-xs text-muted-foreground">Ceremony</p>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <p className="text-xl md:text-2xl font-bold text-purple-600">{rsvpStats.receptionTotal}</p>
              <p className="text-xs text-muted-foreground">Reception</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <p className="text-xl md:text-2xl font-bold text-yellow-600">{rsvpStats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <p className="text-xl md:text-2xl font-bold text-red-600">{rsvpStats.declined}</p>
              <p className="text-xs text-muted-foreground">Declined</p>
            </div>
          </div>

          
          {/* RSVP Insights */}
          <Card className="mb-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden relative">
            <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-200/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-purple-200/20 blur-3xl" />

            <CardHeader className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-sm">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl md:text-2xl font-bold">RSVP Insights</CardTitle>
                    <CardDescription className="text-sm md:text-base">
                      Breakdown by response type + the latest replies.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="hidden sm:inline-flex">
                    {respondedGuests.length} responded
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportRsvpCsv}
                    disabled={guestList.length === 0}
                    className="h-9"
                  >
                    <Share2 className="h-4 w-4 mr-2 text-indigo-600" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Response Breakdown (rows/columns) */}
                <div className="rounded-2xl border bg-white/70 backdrop-blur-sm p-4 md:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold">Response Breakdown</p>
                    </div>
                    <Badge variant="outline">{rsvpStats.total} total</Badge>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-xl border">
                    <div className="grid grid-cols-12 bg-muted/60 px-3 py-2 text-xs font-medium">
                      <div className="col-span-6">Type</div>
                      <div className="col-span-2 text-right">Count</div>
                      <div className="col-span-2 text-right">Share</div>
                      <div className="col-span-2 text-right">Trend</div>
                    </div>

                    <div className="divide-y bg-white/60">
                      {rsvpBreakdownRows.map((r) => {
                        const bar =
                          r.tone === "green"
                            ? "bg-green-600"
                            : r.tone === "blue"
                            ? "bg-blue-600"
                            : r.tone === "purple"
                            ? "bg-purple-600"
                            : r.tone === "red"
                            ? "bg-red-600"
                            : "bg-slate-400";

                        return (
                          <div key={r.key} className="grid grid-cols-12 items-center px-3 py-2">
                            <div className="col-span-6 flex items-center gap-2 min-w-0">
                              <span className={`h-2.5 w-2.5 rounded-full ${bar}`} />
                              <p className="text-sm font-medium truncate">{r.label}</p>
                            </div>
                            <div className="col-span-2 text-right text-sm font-semibold">{r.count}</div>
                            <div className="col-span-2 text-right text-sm text-muted-foreground">{r.percent}%</div>
                            <div className="col-span-2">
                              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                <div className={`h-2 ${bar}`} style={{ width: `${Math.min(100, r.percent)}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="rounded-xl bg-muted/60 p-3">
                      <p className="text-xs text-muted-foreground">Accepted</p>
                      <p className="text-sm font-semibold">
                        {(rsvpStats.acceptedBoth + rsvpStats.ceremonyOnly + rsvpStats.receptionOnly).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/60 p-3">
                      <p className="text-xs text-muted-foreground">Declined</p>
                      <p className="text-sm font-semibold">{rsvpStats.declined.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl bg-muted/60 p-3">
                      <p className="text-xs text-muted-foreground">Pending</p>
                      <p className="text-sm font-semibold">{rsvpStats.pending.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Recent Responses (rows/columns) */}
                <div className="rounded-2xl border bg-white/70 backdrop-blur-sm p-4 md:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <p className="font-semibold">Recent Responses</p>
                    </div>
                    <Badge variant="secondary">Latest</Badge>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-xl border">
                    <div className="grid grid-cols-12 bg-muted/60 px-3 py-2 text-xs font-medium">
                      <div className="col-span-6">Guest</div>
                      <div className="col-span-3">RSVP</div>
                      <div className="col-span-3 text-right">When</div>
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y bg-white/60">
                      {respondedGuests.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">No responses yet.</div>
                      ) : (
                        respondedGuests.slice(0, 12).map((guest) => (
                          <div key={String(guest.id)} className="grid grid-cols-12 items-center px-3 py-2">
                            <div className="col-span-6 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {guest.partnerName
                                  ? `${guest.name} & ${guest.partnerName}`
                                  : guest.plusOneName
                                  ? `${guest.name} & ${guest.plusOneName}`
                                  : guest.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">{guest.email}</p>
                            </div>

                            <div className="col-span-3">
                              <Badge
                                variant={
                                  guest.rsvp === "accepted" || guest.rsvp === "accept-both"
                                    ? "default"
                                    : guest.rsvp === "declined"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-[10px] capitalize"
                              >
                                {guest.rsvp}
                              </Badge>
                            </div>

                            <div className="col-span-3 text-right text-[11px] text-muted-foreground">
                              {guest.respondedAt ? new Date(guest.respondedAt).toLocaleString() : "—"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-muted/60 p-3">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-sky-600" />
                      <p className="text-xs text-muted-foreground">
                        Export Guest CSV (includes pending + unsent guests) to share with your partner or planner.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
{/* Template Selection */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2"><div className="h-8 w-8 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-sm"><Mail className="h-4 w-4 text-white" /></div><label className="text-sm font-medium block">Invitation Template</label></div>
            <div className="grid grid-cols-3 gap-3">
              {["elegant", "rustic", "modern"].map((template) => (
                <button
                  key={template}
                  onClick={() => setSelectedTemplate(template)}
                  className={`p-4 border-2 rounded-lg text-center capitalize transition-all ${
                    selectedTemplate === template ? "border-pink-500 bg-pink-50 dark:bg-pink-950" : "border-gray-200 hover:border-gray-300"
                  } ${!isPremium ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  disabled={!isPremium}
                >
                  <Sparkles className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                  <p className="text-sm font-medium">{template}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Add Guest */}
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-3 text-sm">Add Guest</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Guest Name (e.g., John Smith)" value={newGuestName} onChange={(e) => setNewGuestName(e.target.value)} className="text-sm" />
                <Input type="email" placeholder="Email Address" value={newGuestEmail} onChange={(e) => setNewGuestEmail(e.target.value)} className="text-sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Partner/Plus-One Name (optional)" value={newGuestPartner} onChange={(e) => setNewGuestPartner(e.target.value)} className="text-sm" />
                <label className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                  <input type="checkbox" className="rounded" checked={newGuestPlusOneAllowed} onChange={(e) => setNewGuestPlusOneAllowed(e.target.checked)} />
                  Allow plus-one even if no name provided
                </label>
              </div>

              <Button onClick={addGuest} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Guest
              </Button>

              <p className="text-xs text-muted-foreground">
                💡 Tip: Add a partner/plus-one name to send one invitation to a couple (e.g., "John & Jane Smith")
              </p>
            </div>
          </div>

          {/* Guest List */}
          <div className="mb-6">
            <h4 className="font-medium mb-3 text-sm">Guest List ({guestList.length})</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {guestList.map((guest) => (
                <div key={String(guest.id)} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {guest.partnerName ? `${guest.name} & ${guest.partnerName}` : guest.plusOneName ? `${guest.name} & ${guest.plusOneName}` : guest.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground truncate">{guest.email}</p>
                      {guest.plusOne && !guest.partnerName && !guest.plusOneName && (
                        <Badge variant="secondary" className="text-[10px]">
                          Plus-one allowed
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        guest.rsvp === "accepted" || guest.rsvp === "accept-both"
                          ? "default"
                          : guest.rsvp === "declined"
                          ? "destructive"
                          : "secondary"
                      }
                      className={`text-xs ${
                        guest.rsvp === "ceremony-only"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : guest.rsvp === "reception-only"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-blue-200"
                          : ""
                      }`}
                    >
                      {guest.rsvp === "accept-both"
                        ? "Both Events"
                        : guest.rsvp === "ceremony-only"
                        ? "Ceremony Only"
                        : guest.rsvp === "reception-only"
                        ? "Reception Only"
                        : guest.rsvp === "accepted"
                        ? "Accepted"
                        : guest.rsvp === "declined"
                        ? "Declined"
                        : "Pending"}
                    </Badge>

                    <Button size="sm" variant="ghost" onClick={() => removeGuest(guest.id)} className="p-1">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Send + Preview */}
          <div className="flex flex-col sm:flex-row gap-3">
            {isPremium ? (
              <>
                <Button
                  className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 text-white"
                  onClick={sendInvitations}
                  disabled={guestList.filter((g) => typeof g.id === "number").length === 0}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Invitations ({guestList.filter((g) => typeof g.id === "number").length})
                </Button>

                <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1 border-pink-200 hover:bg-pink-50">
                      <Eye className="w-4 h-4 mr-2 text-pink-600" />
                      Preview Invitation
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg overflow-hidden">
                    <DialogHeader>
                      <DialogTitle>Invitation Preview</DialogTitle>
                      <p className="text-xs text-muted-foreground">This is exactly what your guests will see in their email.</p>
                    </DialogHeader>

                    <InvitationPreview />

                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="ghost" onClick={() => setIsPreviewOpen(false)}>
                        Close
                      </Button>
                      <Button
                        className="bg-pink-600"
                        onClick={() => {
                          setIsPreviewOpen(false);
                          sendInvitations();
                        }}
                        disabled={guestList.length === 0}
                      >
                        Confirm & Send
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <Button variant="outline" className="flex-1 border-pink-300 bg-pink-50" onClick={handleGoPremium}>
                <Heart className="w-4 h-4 mr-2 text-pink-200" />
                Upgrade to Premium
              </Button>
            )}
          </div>

          {!isPremium && (
            <Alert className="mt-4 border-pink-300 bg-pink-50/50">
              <Lock className="h-4 h-4 text-pink-600" />
              <AlertDescription className="text-sm">
                Upgrade to Premium to send unlimited email invitations with beautiful templates and automatic RSVP tracking.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ── Vendor CTA ─────────────────────────────────────────────────────── */}
      <div className="mt-12 mb-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-purple-950 to-pink-900 px-6 py-10 md:px-12 md:py-14 text-white">
          <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-lg">
              <Badge className="bg-pink-500/80 text-white text-xs px-3 py-1">For Wedding Vendors</Badge>
              <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                Are you a wedding vendor?
                <span className="block text-pink-300 mt-1">List your business with us.</span>
              </h2>
              <p className="text-slate-300 text-sm md:text-base">
                Reach thousands of couples actively planning weddings right now. Get discovered, accept bookings, and grow your business — all in one place.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto md:min-w-[200px]">
              <Link href="/vendor-signup" className="w-full">
                <Button size="lg" className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold shadow-lg shadow-pink-900/40">
                  <Building2 className="h-5 w-5 mr-2" />
                  List my business
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/services/vendor-listing" className="w-full">
                <Button size="lg" variant="outline" className="w-full border-white/60 text-white bg-transparent hover:bg-white/15">
                  Learn more
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
