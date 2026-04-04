// client/src/pages/services/wedding-planning.tsx
import { useState, useMemo, useCallback, useEffect, useRef } from "react";

import {
  MapPin,
  Users,
  DollarSign,
  Clock,
  Heart,
  Camera,
  Music,
  Flower,
  Star,
  Mail,
  Bookmark,
  Gift,
  Link2,
  AlertCircle,
  Zap,
  Sparkles,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { WeddingPlanningInvitationsSection } from "@/pages/services/wedding-planning/components/WeddingPlanningInvitationsSection";
import { WeddingPlanningEventDetailsEditor } from "@/pages/services/wedding-planning/components/WeddingPlanningEventDetailsEditor";
import { WeddingPlanningInvitationPreview } from "@/pages/services/wedding-planning/components/WeddingPlanningInvitationPreview";
import { WeddingPlanningVendorPromoCard } from "@/pages/services/wedding-planning/components/WeddingPlanningVendorPromoCard";
import { WeddingPlanningVendorCtaSection } from "@/pages/services/wedding-planning/components/WeddingPlanningVendorCtaSection";

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

  const requestQuote = useCallback(
    (vendorId: number) => {
      setQuoteVendorId(vendorId);
      setQuoteForm((prev) => ({
        ...prev,
        eventDate: prev.eventDate || selectedDate || "",
        guestCount: prev.guestCount || guestCount[0] || 0,
        contactEmail: prev.contactEmail || user?.email || "",
      }));
      setIsQuoteDialogOpen(true);
    },
    [selectedDate, guestCount, user?.email]
  );


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
          // Keep legacy key and include active backend key for compatibility.
          eventDate: quoteForm.eventDate,
          weddingDate: quoteForm.eventDate,
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
      responded: acceptedBoth + ceremonyOnly + receptionOnly + declined,
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

  const setIsCalendarAddOpen = useCallback((open: boolean) => {
    if (!open) return;
    window.location.href = "/services/wedding-planning/calendar";
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
            <WeddingPlanningVendorPromoCard />
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
          <WeddingPlanningEventDetailsEditor
            isPremium={isPremium}
            isEditingEventDetails={isEditingEventDetails}
            onSaveEventDetails={handleSaveEventDetails}
            onStartEditing={() => setIsEditingEventDetails(true)}
            partner1Name={partner1Name}
            setPartner1Name={setPartner1Name}
            partner2Name={partner2Name}
            setPartner2Name={setPartner2Name}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            weddingTime={weddingTime}
            setWeddingTime={setWeddingTime}
            weddingLocation={weddingLocation}
            setWeddingLocation={setWeddingLocation}
            receptionDate={receptionDate}
            setReceptionDate={setReceptionDate}
            receptionTime={receptionTime}
            setReceptionTime={setReceptionTime}
            receptionLocation={receptionLocation}
            setReceptionLocation={setReceptionLocation}
            customMessage={customMessage}
            setCustomMessage={setCustomMessage}
            useSameLocation={useSameLocation}
            setUseSameLocation={setUseSameLocation}
            ceremonyRef={ceremonyRef}
            receptionRef={receptionRef}
          />

          <WeddingPlanningInvitationsSection
            isPremium={isPremium}
            rsvpStats={rsvpStats}
            respondedGuests={respondedGuests}
            rsvpBreakdownRows={rsvpBreakdownRows}
            onExportRsvpCsv={handleExportRsvpCsv}
            selectedTemplate={selectedTemplate}
            setSelectedTemplate={setSelectedTemplate}
            newGuestName={newGuestName}
            setNewGuestName={setNewGuestName}
            newGuestEmail={newGuestEmail}
            setNewGuestEmail={setNewGuestEmail}
            newGuestPartner={newGuestPartner}
            setNewGuestPartner={setNewGuestPartner}
            newGuestPlusOneAllowed={newGuestPlusOneAllowed}
            setNewGuestPlusOneAllowed={setNewGuestPlusOneAllowed}
            onAddGuest={addGuest}
            guestList={guestList}
            onRemoveGuest={removeGuest}
            onSendInvitations={sendInvitations}
            isPreviewOpen={isPreviewOpen}
            setIsPreviewOpen={setIsPreviewOpen}
            invitationPreview={
              <WeddingPlanningInvitationPreview
                selectedTemplate={selectedTemplate}
                partner1Name={partner1Name}
                partner2Name={partner2Name}
                customMessage={customMessage}
                selectedDate={selectedDate}
                weddingTime={weddingTime}
                weddingLocation={weddingLocation}
                useSameLocation={useSameLocation}
                receptionLocation={receptionLocation}
                receptionTime={receptionTime}
                onRenderError={(error) => {
                  console.error("[InvitationPreview] Error rendering:", error);
                  toast({ title: "Debug Error", description: `Preview error: ${String(error)}`, variant: "destructive" });
                }}
              />
            }
            onGoPremium={handleGoPremium}
          />
        </CardContent>
      </Card>
      </>
        )}

      {showVendorCtaSection && (
      <>
      {/* ── Vendor CTA ─────────────────────────────────────────────────────── */}
      <WeddingPlanningVendorCtaSection />
      </>
      )}

      <WeddingPlanningVendorQuoteDialog
        isOpen={isQuoteDialogOpen}
        onOpenChange={setIsQuoteDialogOpen}
        quoteVendor={quoteVendor}
        quoteForm={quoteForm}
        onQuoteFormChange={setQuoteForm}
        onSubmit={submitQuoteRequest}
      />

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
    </div>
  );
}

export default function WeddingPlanning() {
  return <WeddingPlanningWorkspace mode="hub" />;
}
