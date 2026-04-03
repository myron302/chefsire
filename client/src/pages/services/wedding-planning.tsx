// client/src/pages/services/wedding-planning.tsx
import { useState, useMemo, useCallback, useEffect, useRef } from "react";

import {
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
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ToastAction } from "@/components/ui/toast";

import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import WeddingTrialSelector from "@/components/WeddingTrialSelector";
import { couplePlans } from "@/config/wedding-pricing";

import {
  DEFAULT_BUDGET_ALLOCATIONS,
  DEFAULT_PLANNING_TASKS,
  DEFAULT_REGISTRY_LINKS,
  VENDORS,
  BudgetAllocation,
  inferBudgetKeyFromTask,
  normalizeRegistryLinks,
  PlanningInsightAction,
  PlanningInsightTip,
  PlanningTask,
  RegistryLink,
  WeddingPlanningView,
} from "@/pages/services/lib/wedding-planning-core";
import {
  useBudgetSettingsPersistence,
  useInsightsPersistence,
  usePlanningTasksPersistence,
  useRegistryLinksPersistence,
} from "@/pages/services/wedding-planning/hooks/useWeddingPlanningPersistence";
import { WeddingPlanningBudgetSection } from "@/pages/services/wedding-planning/components/WeddingPlanningBudgetSection";
import { WeddingPlanningInsightsSection } from "@/pages/services/wedding-planning/components/WeddingPlanningInsightsSection";
import { WeddingPlanningRegistrySection } from "@/pages/services/wedding-planning/components/WeddingPlanningRegistrySection";
import { WeddingPlanningTasksSection } from "@/pages/services/wedding-planning/components/WeddingPlanningTasksSection";
import { WeddingPlanningVendorFilters } from "@/pages/services/wedding-planning/components/WeddingPlanningVendorFilters";
import { WeddingPlanningVendorGrid } from "@/pages/services/wedding-planning/components/WeddingPlanningVendorGrid";
import { WeddingPlanningBudgetReportDialog } from "@/pages/services/wedding-planning/components/WeddingPlanningBudgetReportDialog";
import { WeddingPlanningVendorQuoteDialog } from "@/pages/services/wedding-planning/components/WeddingPlanningVendorQuoteDialog";
import { WeddingPlanningCalendarSection } from "@/pages/services/wedding-planning/components/WeddingPlanningCalendarSection";

export function WeddingPlanningWorkspace({ mode = "hub" }: { mode?: WeddingPlanningView } = {}) {
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
  const [showTrialBanner, setShowTrialBanner] = useState(() => !isPremium);
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
  const [newPlanningTaskBudgetKey, setNewPlanningTaskBudgetKey] = useState<BudgetAllocation["key"]>("other");
  const [newPlanningTaskCost, setNewPlanningTaskCost] = useState<string>("");

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
  const [showTrialSelector, setShowTrialSelector] = useState(() => currentTier === "free");

  // Hide selector + trial banner if user already has premium/elite tier
  useEffect(() => {
    if (currentTier === "premium" || currentTier === "elite") {
      setShowTrialSelector(false);
      setShowTrialBanner(false);
    }
  }, [currentTier]);

  usePlanningTasksPersistence({
    userId: user?.id,
    planningTasks,
    hasLoadedPlanningTasks,
    setPlanningTasks,
    setHasLoadedPlanningTasks,
  });

  useBudgetSettingsPersistence({
    userId: user?.id,
    budgetRange,
    guestCount,
    budgetAllocations,
    hasLoadedBudgetSettings,
    setBudgetRange,
    setGuestCount,
    setBudgetAllocations,
    setHasLoadedBudgetSettings,
  });

  useRegistryLinksPersistence({
    userId: user?.id,
    registryLinks,
    hasLoadedRegistryLinks,
    isEditingRegistryLinks,
    setRegistryLinks,
    setRegistryDraft,
    setHasLoadedRegistryLinks,
  });

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
            setGuestList(sentGuests);
            return;
          }
        }
        setGuestList([]);
      } catch (error) {
        console.error("[Wedding Planning] Failed to fetch guest list:", error);
        setGuestList([]);
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
      const cost = Number((t as any).cost);
      if (!Number.isFinite(cost) || cost <= 0) continue;

      const explicitKey = (t as any).budgetKey as BudgetAllocation["key"] | undefined;
      const inferred = inferBudgetKeyFromTask(t);
      const key = explicitKey && out.has(explicitKey) ? explicitKey : inferred;

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


  // -------------------- Customizable Insights (saved per user) --------------------
const [customTips, setCustomTips] = useState<PlanningInsightTip[]>([]);
const [customActions, setCustomActions] = useState<PlanningInsightAction[]>([]);
const [hasLoadedInsights, setHasLoadedInsights] = useState(false);
const [isInsightsEditorOpen, setIsInsightsEditorOpen] = useState(false);

const [newCustomTipTitle, setNewCustomTipTitle] = useState("");
const [newCustomTipDetail, setNewCustomTipDetail] = useState("");
const [newCustomActionLabel, setNewCustomActionLabel] = useState("");

useInsightsPersistence({
  userId: user?.id,
  customTips,
  customActions,
  hasLoadedInsights,
  setCustomTips,
  setCustomActions,
  setHasLoadedInsights,
});

const addCustomAction = useCallback(() => {
  const label = newCustomActionLabel.trim();
  if (!label) return;

  setCustomActions((prev) => [
    ...prev,
    { id: `action-${Date.now()}`, label: label.slice(0, 120), done: false },
  ]);

  setNewCustomActionLabel("");
}, [newCustomActionLabel]);

const toggleCustomActionDone = useCallback((id: string) => {
  setCustomActions((prev) => prev.map((a) => (a.id === id ? { ...a, done: !a.done } : a)));
}, []);

const removeCustomAction = useCallback((id: string) => {
  setCustomActions((prev) => prev.filter((a) => a.id !== id));
}, []);

const addCustomTip = useCallback(() => {
  const title = newCustomTipTitle.trim();
  const detail = newCustomTipDetail.trim();
  if (!title && !detail) return;

  setCustomTips((prev) => [
    ...prev,
    {
      id: `tip-${Date.now()}`,
      title: (title || "Pinned tip").slice(0, 80),
      detail: detail.slice(0, 360),
    },
  ]);

  setNewCustomTipTitle("");
  setNewCustomTipDetail("");
}, [newCustomTipTitle, newCustomTipDetail]);

const removeCustomTip = useCallback((id: string) => {
  setCustomTips((prev) => prev.filter((t) => t.id !== id));
}, []);

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

const displayNextActions = useMemo(() => {
  const custom: { id: string; label: string; done: boolean; source: "custom" }[] = customActions.map((a) => ({
    id: a.id,
    label: a.label,
    done: !!a.done,
    source: "custom",
  }));

  const auto: { id: string; label: string; done: boolean; source: "auto" }[] = nextBestActions.map((a, idx) => ({
    id: `auto-${idx}`,
    label: a.label,
    done: a.done,
    source: "auto",
  }));

  return [...custom, ...auto].slice(0, 7);
}, [customActions, nextBestActions]);

const displaySmartTips = useMemo(() => {
  const custom: { id: string; title: string; detail: string; source: "custom" }[] = customTips.map((t) => ({
    id: t.id,
    title: t.title,
    detail: t.detail,
    source: "custom",
  }));

  const auto: { id: string; title: string; detail: string; source: "auto" }[] = smartTips.map((t, idx) => ({
    id: `auto-${idx}`,
    title: t.title,
    detail: t.detail,
    source: "auto",
  }));

  return [...custom, ...auto].slice(0, 8);
}, [customTips, smartTips]);


  const weddingDateForInsights = useMemo(() => {
    if (!selectedDate) return null;
    const d = new Date(`${selectedDate}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [selectedDate]);

  const daysUntilWedding = useMemo(() => {
    if (!weddingDateForInsights) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weddingDay = new Date(
      weddingDateForInsights.getFullYear(),
      weddingDateForInsights.getMonth(),
      weddingDateForInsights.getDate()
    );
    return Math.ceil((weddingDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [weddingDateForInsights]);

  const automatedRoadmap = useMemo(() => {
    const hasTaskDone = (ids: string[]) =>
      planningTasks.some((t) => ids.includes(String(t.id)) && !!t.completed);

    const hasTaskCostEntries = planningTasks.some((t) => typeof (t as any).cost === "number" && Number((t as any).cost) > 0);

    const hasTimelineEvent = calendarEvents.some((e) => {
      const raw = `${e?.type ?? ""} ${e?.title ?? ""}`.toLowerCase();
      return (
        raw.includes("tasting") ||
        raw.includes("fitting") ||
        raw.includes("trial") ||
        raw.includes("rehearsal") ||
        raw.includes("walkthrough") ||
        raw.includes("license") ||
        raw.includes("wedding")
      );
    });

    const hasEventDetails = Boolean(weddingLocation || weddingTime || partner1Name || partner2Name);

    const steps: Array<{
      id: string;
      label: string;
      done: boolean;
      source: string;
      reason: string;
      target: "checklist" | "budget" | "calendar" | "details" | "vendors" | null;
      dueLabel?: string;
      priority: number;
    }> = [
      {
        id: "date",
        label: "Confirm your wedding date",
        done: !!selectedDate,
        source: "Tracked from Event Details → Wedding date",
        reason: "Your date drives venue availability, vendor quotes, and timeline planning.",
        target: "details",
        dueLabel: !selectedDate ? "Start here" : undefined,
        priority: !selectedDate ? 1 : 99,
      },
      {
        id: "guests",
        label: "Lock your guest count range",
        done: guestCountNum > 0,
        source: "Tracked from Budget Planner → Guest count slider",
        reason: "Guest count affects venue size, catering, rentals, and invitation budget.",
        target: "budget",
        dueLabel: guestCountNum <= 0 ? "Core planning" : undefined,
        priority: guestCountNum <= 0 ? 2 : 99,
      },
      {
        id: "venue",
        label: "Shortlist / book your venue",
        done: hasTaskDone(["venue"]),
        source: "Marked done from Wedding Progress → Venue task",
        reason: "Venue usually unlocks your final date, catering, layout, and guest capacity decisions.",
        target: "checklist",
        dueLabel: "High impact",
        priority: hasTaskDone(["venue"]) ? 99 : 3,
      },
      {
        id: "quotes",
        label: "Request at least 2–3 vendor quotes",
        done: requestedQuotes.size >= 2,
        source: "Tracked from quote requests submitted on vendor cards",
        reason: "Real quotes help replace estimates with actual pricing before you overspend.",
        target: "vendors",
        dueLabel: requestedQuotes.size === 0 ? "Do this week" : undefined,
        priority: requestedQuotes.size >= 2 ? 99 : 4,
      },
      {
        id: "event-details",
        label: "Fill key ceremony details (time/location/couple names)",
        done: hasEventDetails,
        source: "Tracked from Wedding Details / invitations fields",
        reason: "These details are used in invites, previews, and wedding day scheduling.",
        target: "details",
        dueLabel: !hasEventDetails ? "Needed for invites" : undefined,
        priority: hasEventDetails ? 99 : 5,
      },
      {
        id: "task-costs",
        label: "Add estimated/actual costs to your checklist tasks",
        done: hasTaskCostEntries,
        source: "Tracked from Wedding Progress editor → task cost fields",
        reason: "Task costs roll into your budget categories and make Budget Watch useful.",
        target: "checklist",
        dueLabel: !hasTaskCostEntries ? "Improves budget tracking" : undefined,
        priority: hasTaskCostEntries ? 99 : 6,
      },
      {
        id: "timeline",
        label: "Add timeline events (tastings, fittings, rehearsal, walkthrough)",
        done: hasTimelineEvent,
        source: "Tracked from Planning Calendar → event type/title",
        reason: "Scheduling milestones early prevents last-minute congestion and missed deadlines.",
        target: "calendar",
        dueLabel: !hasTimelineEvent ? "Plan milestones" : undefined,
        priority: hasTimelineEvent ? 99 : 7,
      },
      {
        id: "major-vendors",
        label: "Complete core vendor tasks (catering / photo / music / flowers)",
        done: ["catering", "photo", "music", "flowers"].every((id) => hasTaskDone([id])),
        source: "Tracked from Wedding Progress checklist",
        reason: "These categories are the biggest coordination and budget drivers after venue.",
        target: "checklist",
        dueLabel: "Core vendors",
        priority: ["catering", "photo", "music", "flowers"].every((id) => hasTaskDone([id])) ? 99 : 8,
      },
    ];

    return steps.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.priority - b.priority;
    });
  }, [
    planningTasks,
    calendarEvents,
    guestCountNum,
    requestedQuotes.size,
    selectedDate,
    weddingLocation,
    weddingTime,
    partner1Name,
    partner2Name,
  ]);

  const nextAutomatedStep = useMemo(
    () => automatedRoadmap.find((s) => !s.done) ?? null,
    [automatedRoadmap]
  );

  const combinedInsightsTips = useMemo(() => {
    const tips: Array<{
      id: string;
      title: string;
      detail: string;
      source: string;
      severity?: "info" | "watch" | "warning";
      action?: "budget" | "checklist" | "calendar" | null;
    }> = [];

    if (typeof daysUntilWedding === "number") {
      if (daysUntilWedding > 365) {
        tips.push({
          id: "timeline-12plus",
          title: "Timeline view: plenty of runway",
          detail: "You have over 12 months. Focus on venue, rough budget, and guest count before fine details.",
          source: "Calculated from your wedding date",
          severity: "info",
          action: "checklist",
        });
      } else if (daysUntilWedding > 180) {
        tips.push({
          id: "timeline-6to12",
          title: "Timeline view: lock major vendors",
          detail: "You’re within 6–12 months. Prioritize venue, catering, photo/video, and music decisions now.",
          source: "Calculated from your wedding date",
          severity: "watch",
          action: "checklist",
        });
      } else if (daysUntilWedding > 90) {
        tips.push({
          id: "timeline-3to6",
          title: "Timeline view: schedule tastings, fittings, and invites",
          detail: "This is a great window to lock wedding-day details and confirm vendor timelines.",
          source: "Calculated from your wedding date",
          severity: "watch",
          action: "calendar",
        });
      } else if (daysUntilWedding >= 0) {
        tips.push({
          id: "timeline-final90",
          title: "Timeline view: final confirmation phase",
          detail: "Focus on final payments, walkthroughs, rehearsal timing, seating, and day-of logistics.",
          source: "Calculated from your wedding date",
          severity: "warning",
          action: "calendar",
        });
      }
    }

    for (const t of displaySmartTips) {
      tips.push({
        id: `existing-${t.id}`,
        title: t.title,
        detail: t.detail,
        source: t.source === "custom" ? "Pinned note (you added this)" : "Auto-generated from your wedding data",
        severity: /over target|over/i.test(`${t.title} ${t.detail}`) ? "warning" : "info",
        action: /budget/i.test(`${t.title} ${t.detail}`) ? "budget" : null,
      });
    }

    const deduped: typeof tips = [];
    const seen = new Set<string>();
    for (const t of tips) {
      const key = `${t.title}|${t.detail}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(t);
    }

    return deduped.slice(0, 8);
  }, [displaySmartTips, daysUntilWedding]);


  const openProgressEditor = useCallback(() => {
    // Ensure every task has a category so costs can roll up into the budget calculator.
    setProgressEditorTasks(
      planningTasks.map((t) => ({
        ...t,
        budgetKey: (t as any).budgetKey ? (t as any).budgetKey : inferBudgetKeyFromTask(t),
      }))
    );
    setNewPlanningTaskLabel("");
    setNewPlanningTaskBudgetKey("other");
    setNewPlanningTaskCost("");
    setIsProgressEditorOpen(true);
  }, [planningTasks]);

  const handleProgressEditorOpenChange = useCallback((open: boolean) => {
    setIsProgressEditorOpen(open);
    if (!open) {
      setProgressEditorTasks([]);
      setNewPlanningTaskLabel("");
      setNewPlanningTaskBudgetKey("other");
      setNewPlanningTaskCost("");
    }
  }, []);

  const toggleEditorTask = useCallback((taskId: string) => {
    setProgressEditorTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)));
  }, []);

  const updateEditorTaskLabel = useCallback((taskId: string, label: string) => {
    setProgressEditorTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, label } : task)));
  }, []);

  const updateEditorTaskBudgetKey = useCallback((taskId: string, budgetKey: BudgetAllocation["key"]) => {
    setProgressEditorTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, budgetKey } : task)));
  }, []);

  const updateEditorTaskCost = useCallback((taskId: string, raw: string) => {
    const cleaned = String(raw ?? "").trim();
    if (!cleaned) {
      setProgressEditorTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, cost: undefined } : task)));
      return;
    }

    const next = Number(cleaned);
    if (!Number.isFinite(next) || next <= 0) {
      setProgressEditorTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, cost: undefined } : task)));
      return;
    }

    const capped = Math.min(next, 100000000);
    setProgressEditorTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, cost: capped } : task)));
  }, []);

  const addEditorTask = useCallback(() => {
    const trimmedTask = newPlanningTaskLabel.trim();
    if (!trimmedTask) return;

    const costRaw = String(newPlanningTaskCost ?? "").trim();
    const parsed = costRaw ? Number(costRaw) : NaN;
    const cost = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100000000) : undefined;

    const budgetKey: BudgetAllocation["key"] = newPlanningTaskBudgetKey || "other";

    setProgressEditorTasks((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        label: trimmedTask,
        completed: false,
        budgetKey,
        ...(typeof cost === "number" ? { cost } : null),
      },
    ]);
    setNewPlanningTaskLabel("");
    setNewPlanningTaskBudgetKey("other");
    setNewPlanningTaskCost("");
  }, [newPlanningTaskLabel, newPlanningTaskBudgetKey, newPlanningTaskCost]);

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

      if (data.ok) {        setGuestList((prev) => prev.filter((g) => typeof g.id === "string"));

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

    // Update UI immediately (optimistic UI).
    setRegistryLinks(saved);
    setRegistryDraft(saved);
    setIsEditingRegistryLinks(false);

    // Guests: no persistence (in-memory only).
    if (!user?.id) {
      toast({
        title: "Saved",
        description: "Registry links updated for this session. Sign in to save across devices.",
      });
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
        throw new Error(msg);
      }

      // Server may normalize/overwrite; trust DB copy for cross-device consistency.
      if (Array.isArray(data.registryLinks)) {
        const fromServer = normalizeRegistryLinks(data.registryLinks);
        setRegistryLinks(fromServer);
        setRegistryDraft(fromServer);
      }

      toast({
        title: "Saved",
        description: "Your registry links were saved to your account (works on all devices).",
      });
    } catch (error: any) {
      console.error("[Wedding Planning] Failed to save registry links to DB:", error);
      toast({
        title: "Save Failed",
        description: "Couldn't save registry links to your account. Please try again.",
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

  const sectionTitleMap: Record<WeddingPlanningView, string> = {
    hub: "Wedding Planning Hub",
    vendors: "Vendors & Quotes",
    budget: "Budget Planner",
    checklist: "Checklist & Progress",
    registry: "Gift Registry",
    calendar: "Planning Calendar",
    invitations: "Guests & Invitations",
  };

  const showProgressSection = mode === "hub" || mode === "checklist";
  const showBudgetSection = mode === "budget";
  const showRoadmapSection = mode === "hub" || mode === "checklist";
  const showHubSummaryCards = mode === "hub";
  const showVendorsSection = mode === "vendors";
  const showRegistrySection = mode === "registry";
  const showCalendarSection = mode === "calendar";
  const showInvitationsSection = mode === "invitations";
  const showVendorCtaSection = mode === "hub" || mode === "vendors";
  return (
    <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8">
      <WeddingTrialSelector open={showTrialSelector} onSelect={handleTrialSelect} />

      <Card className="mb-4 md:mb-6 border-dashed">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Wedding Planner</p>
                <h2 className="text-lg md:text-xl font-semibold">{sectionTitleMap[mode]}</h2>
                {mode !== "hub" && (
                  <p className="text-xs md:text-sm text-muted-foreground">Focused workspace for this part of your wedding planning flow.</p>
                )}
              </div>
              {mode !== "hub" && (
                <Link href="/services/wedding-planning" className="w-full md:w-auto">
                  <Button variant="outline" className="w-full md:w-auto">Back to Hub</Button>
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                ["hub", "Hub", "/services/wedding-planning"],
                ["checklist", "Checklist", "/services/wedding-planning/checklist"],
                ["budget", "Budget", "/services/wedding-planning/budget"],
                ["vendors", "Vendors", "/services/wedding-planning/vendors"],
                ["calendar", "Calendar", "/services/wedding-planning/calendar"],
                ["invitations", "Guests", "/services/wedding-planning/invitations"],
              ].map(([key, label, href]) => (
                <Link key={String(key)} href={String(href)}>
                  <Button
                    variant={mode === key ? "default" : "outline"}
                    className={`w-full justify-center ${mode === key ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white" : ""}`}
                  >
                    {label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            {/* Title */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                Wedding Planning Hub
              </h1>
              <p className="text-muted-foreground mt-2 text-sm md:text-base">Find and book the perfect vendors for your special day</p>
            </div>

            {/* Vendor CTA */}
            <div className="w-full sm:w-[360px] md:w-[420px]">
              <Card className="border-2 border-pink-200/70 dark:border-pink-900/50 bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-pink-950/40 dark:via-background dark:to-purple-950/30 shadow-sm">
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-gradient-to-r from-pink-600 to-purple-600 text-white border-0 text-[10px] md:text-xs">
                          Vendors
                        </Badge>
                        <span className="text-[11px] md:text-xs text-muted-foreground">Get more bookings</span>
                      </div>

                      <h2 className="text-base md:text-lg font-extrabold leading-tight">
                        List your business where couples are actively planning
                      </h2>

                      <p className="text-sm md:text-[15px] text-muted-foreground mt-2 leading-relaxed">
                        Show up in search & on the vendor map, get direct leads, and respond faster with built-in messaging.
                      </p>
                    </div>

                    <div className="flex-shrink-0 rounded-xl p-2 bg-white/60 dark:bg-black/20 border border-pink-200/50 dark:border-pink-900/40">
                      <Building2 className="w-6 h-6 md:w-7 md:h-7 text-pink-700 dark:text-pink-300" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="rounded-lg border bg-background/70 p-2 text-center">
                      <p className="text-xs font-semibold">More leads</p>
                      <p className="text-[10px] text-muted-foreground">In search</p>
                    </div>
                    <div className="rounded-lg border bg-background/70 p-2 text-center">
                      <p className="text-xs font-semibold">Direct chat</p>
                      <p className="text-[10px] text-muted-foreground">Fast replies</p>
                    </div>
                    <div className="rounded-lg border bg-background/70 p-2 text-center">
                      <p className="text-xs font-semibold">Boosted</p>
                      <p className="text-[10px] text-muted-foreground">Feature options</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <Link href="/services/vendor-listing">
                        <Button size="lg" className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md hover:opacity-95">
                          <Building2 className="w-4 h-4 mr-2 text-white" />
                          List My Business
                          <ArrowRight className="w-4 h-4 ml-2 text-white/90" />
                        </Button>
                      </Link>
                    </div>
                    <div className="sm:w-[160px]">
                      <Link href="/services/vendor-listing">
                        <Button
                          variant="outline"
                          size="lg"
                          className="w-full border-pink-300 text-pink-700 hover:bg-pink-50 dark:border-pink-800 dark:text-pink-200 dark:hover:bg-pink-950/40"
                        >
                          Learn More
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] md:text-xs text-muted-foreground">
                    Free to start • Upgrade anytime for featured placement & a verified badge
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowBudgetCalculator(!showBudgetCalculator)} className="w-full sm:w-auto">
              <DollarSign className="w-4 h-4 mr-2 text-emerald-600" />
              <span className="hidden sm:inline">Budget Calculator</span>
              <span className="sm:hidden">Budget</span>
            </Button>
            <Link href="/catering/wedding-map" className="w-full sm:w-auto">
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
      </div>

        {showProgressSection && (
          <WeddingPlanningTasksSection
            completedTasks={completedTasks}
            planningTasks={planningTasks}
            planningProgress={planningProgress}
            openProgressEditor={openProgressEditor}
            isProgressEditorOpen={isProgressEditorOpen}
            handleProgressEditorOpenChange={handleProgressEditorOpenChange}
            newPlanningTaskLabel={newPlanningTaskLabel}
            setNewPlanningTaskLabel={setNewPlanningTaskLabel}
            newPlanningTaskBudgetKey={newPlanningTaskBudgetKey}
            setNewPlanningTaskBudgetKey={setNewPlanningTaskBudgetKey}
            newPlanningTaskCost={newPlanningTaskCost}
            setNewPlanningTaskCost={setNewPlanningTaskCost}
            addEditorTask={addEditorTask}
            budgetAllocations={budgetAllocations}
            progressEditorTasks={progressEditorTasks}
            toggleEditorTask={toggleEditorTask}
            updateEditorTaskLabel={updateEditorTaskLabel}
            updateEditorTaskBudgetKey={updateEditorTaskBudgetKey}
            updateEditorTaskCost={updateEditorTaskCost}
            removeEditorTask={removeEditorTask}
            savePlanningTasks={savePlanningTasks}
          />
        )}

        {showBudgetSection && (
          <WeddingPlanningBudgetSection
            showBudgetCalculator={showBudgetCalculator}
            budgetRange={budgetRange}
            handleBudgetRangeChange={handleBudgetRangeChange}
            budgetBreakdown={budgetBreakdown}
            spendByCategory={spendByCategory}
            updateBudgetAllocation={updateBudgetAllocation}
            guestCount={guestCount}
            isOverBudget={isOverBudget}
            budgetStatusLabel={budgetStatusLabel}
            budgetDelta={budgetDelta}
            budgetUsedPct={budgetUsedPct}
            totalSpent={totalSpent}
            isElite={isElite}
            dynamicSavings={dynamicSavings}
            handleViewBudgetReport={handleViewBudgetReport}
            handleGoPremium={handleGoPremium}
          />
        )}

        {showRoadmapSection && (
          <WeddingPlanningInsightsSection
            mode={mode}
            daysUntilWedding={daysUntilWedding}
            nextAutomatedStep={nextAutomatedStep}
            openProgressEditor={openProgressEditor}
            handleViewBudgetReport={handleViewBudgetReport}
            setIsCalendarAddOpen={setIsCalendarAddOpen}
            automatedRoadmap={automatedRoadmap}
            combinedInsightsTips={combinedInsightsTips}
            totalBudget={totalBudget}
            topBudgetItems={topBudgetItems}
            newCustomTipTitle={newCustomTipTitle}
            setNewCustomTipTitle={setNewCustomTipTitle}
            newCustomTipDetail={newCustomTipDetail}
            setNewCustomTipDetail={setNewCustomTipDetail}
            addCustomTip={addCustomTip}
            customTips={customTips}
            removeCustomTip={removeCustomTip}
            newCustomActionLabel={newCustomActionLabel}
            setNewCustomActionLabel={setNewCustomActionLabel}
            addCustomAction={addCustomAction}
            customActions={customActions}
            toggleCustomActionDone={toggleCustomActionDone}
            removeCustomAction={removeCustomAction}
          />
        )}

        {showHubSummaryCards && (
          <div className="mb-8">
            <div className="mb-3">
              <h3 className="text-base md:text-lg font-semibold">Open a focused workspace</h3>
              <p className="text-sm text-muted-foreground">Use the hub for overview, then jump into the tool you want to work on.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Checklist & Progress</CardTitle>
                  <CardDescription>{completedTasks}/{planningTasks.length} tasks complete</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/services/wedding-planning/checklist"><Button className="w-full">Open Checklist</Button></Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Budget Planner</CardTitle>
                  <CardDescription>Target: ${budgetRange[1].toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span>Planned spend</span><span className="font-medium">${Math.round(totalSpent).toLocaleString()}</span></div>
                  <div className="flex items-center justify-between"><span>Guests</span><span className="font-medium">{guestCountNum}</span></div>
                  <Link href="/services/wedding-planning/budget"><Button className="w-full mt-2">Open Budget</Button></Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Vendors & Quotes</CardTitle>
                  <CardDescription>{filteredVendors.length} vendor matches right now</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span>Quotes requested</span><span className="font-medium">{requestedQuotes.size}</span></div>
                  <div className="flex items-center justify-between"><span>Category</span><span className="font-medium capitalize">{selectedVendorType}</span></div>
                  <Link href="/services/wedding-planning/vendors"><Button className="w-full mt-2">Browse Vendors</Button></Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Gift Registry</CardTitle>
                  <CardDescription>{registryLinks.filter((l) => (l.url || "").trim()).length} active links</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/services/wedding-planning/registry"><Button className="w-full">Manage Registry</Button></Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Planning Calendar</CardTitle>
                  <CardDescription>{calendarEvents.length} events scheduled</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/services/wedding-planning/calendar"><Button className="w-full">Open Calendar</Button></Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Guests & Invitations</CardTitle>
                  <CardDescription>{guestList.length} guests • {rsvpStats.responded} responded</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/services/wedding-planning/invitations"><Button className="w-full">Manage Guests</Button></Link>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {showVendorsSection && (
        <>
      <WeddingPlanningVendorFilters
        selectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
        guestCount={guestCount[0]}
        onGuestCountChange={(nextCount) => setGuestCount([nextCount])}
        searchLocation={searchLocation}
        onSearchLocationChange={setSearchLocation}
        vendorLocationRef={vendorLocationRef}
        selectedVendorType={selectedVendorType}
        onSelectedVendorTypeChange={setSelectedVendorType}
        filteredVendorCount={filteredVendors.length}
      />

      <WeddingPlanningVendorQuoteDialog
        isOpen={isQuoteDialogOpen}
        onOpenChange={setIsQuoteDialogOpen}
        quoteVendor={quoteVendor}
        quoteForm={quoteForm}
        onQuoteFormChange={setQuoteForm}
        onSubmit={submitQuoteRequest}
      />

      


      {/* Budget Report dialog */}
      <WeddingPlanningBudgetReportDialog
        isOpen={isBudgetReportOpen}
        onOpenChange={setIsBudgetReportOpen}
        isPremium={isPremium}
        totalBudget={totalBudget}
        totalSpent={totalSpent}
        budgetDelta={budgetDelta}
        budgetStatusLabel={budgetStatusLabel}
        budgetUsedPct={budgetUsedPct}
        dynamicSavings={dynamicSavings}
        budgetReportRows={budgetReportRows}
        onClose={() => setIsBudgetReportOpen(false)}
        onGoPremium={handleGoPremium}
        onExportBudgetCsv={handleExportBudgetCsv}
      />

{/* Vendors grid */}
      <WeddingPlanningVendorGrid
        filteredVendors={filteredVendors}
        savedVendors={savedVendors}
        requestedQuotes={requestedQuotes}
        onToggleSave={toggleSaveVendor}
        onRequestQuote={requestQuote}
      />
        </>
        )}

        {showRegistrySection && (
          <WeddingPlanningRegistrySection
            isEditingRegistryLinks={isEditingRegistryLinks}
            registryLinks={registryLinks}
            registryDraft={registryDraft}
            onCancelRegistryEdit={handleCancelRegistryEdit}
            onSaveRegistryLinks={handleSaveRegistryLinks}
            onStartRegistryEdit={handleStartRegistryEdit}
            onRegistryUrlChange={(registryId, url) => {
              if (!isEditingRegistryLinks) return;
              setRegistryDraft((prev) => prev.map((r) => (r.id === registryId ? { ...r, url } : r)));
            }}
            onRemoveRegistry={handleRemoveRegistry}
            onAddRegistry={handleAddRegistry}
            onShareRegistry={handleShareRegistry}
            registrySlug={user?.username || user?.id || "my-registry"}
          />
        )}

        {showCalendarSection && (
          <WeddingPlanningCalendarSection
            calendarDate={calendarDate}
            setCalendarDate={setCalendarDate}
            calendarEventDates={calendarEventDates}
            sortedCalendarEvents={sortedCalendarEvents}
            parseCalendarDate={parseCalendarDate}
            buildGoogleCalendarUrl={buildGoogleCalendarUrl}
            handleRemoveCalendarEvent={handleRemoveCalendarEvent}
            normalizeCalendarDate={normalizeCalendarDate}
            calendarEventTime={calendarEventTime}
            setCalendarEventTime={setCalendarEventTime}
            calendarTitle={calendarTitle}
            setCalendarTitle={setCalendarTitle}
            calendarType={calendarType}
            setCalendarType={setCalendarType}
            calendarNotes={calendarNotes}
            setCalendarNotes={setCalendarNotes}
            calendarReminder={calendarReminder}
            setCalendarReminder={setCalendarReminder}
            handleAddCalendarEvent={handleAddCalendarEvent}
          />
        )}

        {showInvitationsSection && (
      <>
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
      </>
        )}

      {showVendorCtaSection && (
      <>
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
              <Link href="/services/vendor-listing" className="w-full">
                <Button size="lg" className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold shadow-lg shadow-pink-900/40">
                  <Building2 className="h-5 w-5 mr-2" />
                  List My Business
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/services/vendor-listing" className="w-full">
                <Button size="lg" className="w-full bg-white/15 border border-white/40 text-white hover:bg-white/25 hover:text-white">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

export default function WeddingPlanning() {
  return <WeddingPlanningWorkspace mode="hub" />;
}
