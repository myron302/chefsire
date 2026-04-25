import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Plus, Target, TrendingUp, Clock, ChefHat, Star, Lock, Crown,
  ShoppingCart, CheckCircle, BarChart3, Download, Filter, Save,
  AlertCircle, Package, Utensils, CalendarDays, Zap, ListChecks, Settings, Camera,
  DollarSign, Sparkles, Flame, Scale, Droplets, Ruler, Users, Globe, Copy, Share2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import BarcodeScanner from '@/components/BarcodeScanner';
import AdvancedFeaturesPanel from '@/components/meal-planner/AdvancedFeaturesPanel';
import PlannerTabSection from '@/components/meal-planner/sections/PlannerTabSection';
import GroceryTabSection from '@/components/meal-planner/sections/GroceryTabSection';
import PrepTabSection, { type PrepSessionState } from '@/components/meal-planner/sections/PrepTabSection';
import WeeklyReadinessChecklist from '@/components/meal-planner/WeeklyReadinessChecklist';
import GoalCalculatorDialog from '@/components/meal-planner/modals/GoalCalculatorDialog';
import PantryModal from '@/components/meal-planner/modals/PantryModal';
import LoadTemplateModal from '@/components/meal-planner/modals/LoadTemplateModal';
import AddGroceryItemModal from '@/components/meal-planner/modals/AddGroceryItemModal';
import ShareFamilyDialog from '@/components/meal-planner/modals/ShareFamilyDialog';
import AddMealModal from '@/components/meal-planner/modals/AddMealModal';
import AIRecipeModal from '@/components/meal-planner/modals/AIRecipeModal';
import CookingToolsReference from '@/components/meal-planner/CookingToolsReference';
import { exportCSV, exportText } from "@/lib/shoppingExport";
import { normalizeShoppingListItem } from '@/lib/shopping-list';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  DEFAULT_NUTRITION_GOALS,
  MEAL_TYPES,
  WEEK_DAYS,
  DAY_NAMES,
  formatLocalDate,
  parseDateOnly,
  getCurrentWeekAnchor as getWeekAnchorForDate,
  getDateForWeekday as getDateForWeekdayFromAnchor,
  getSlotItems as getMealSlotItems,
  getSlotTotals as getMealSlotTotals,
  calculateTodayNutritionTotals,
  getNutritionGrade,
  gradeClass,
  clientSideNutritionLookup,
  toGroceryExportItems,
  buildTemplateSlotDiff,
} from '@/components/meal-planner/nutritionMealPlannerUtils';

const INITIAL_MEAL_FORM = {
  name: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  servingSize: '',
  servingQty: 1,
};

const DEFAULT_PREP_SESSION_TASKS = [
  { id: 'review-plan', label: 'Review planned meals and serving counts', done: false },
  { id: 'portion-protein', label: 'Batch-cook and portion protein bases', done: false },
  { id: 'prep-produce', label: 'Prep vegetables, fruit, and grab-and-go snacks', done: false },
  { id: 'container-labels', label: 'Pack containers and label day/meal', done: false },
];

const DEFAULT_PREP_BLOCKERS = [
  { id: 'missing-ingredient', label: 'Missing ingredient', active: false },
  { id: 'missing-containers', label: 'Missing containers', active: false },
  { id: 'time-conflict', label: 'Time conflict', active: false },
  { id: 'waiting-on-grocery', label: 'Waiting on grocery', active: false },
  { id: 'kitchen-access', label: 'Kitchen access', active: false },
];
const GROCERY_LINKED_PREP_BLOCKER_IDS = ['missing-ingredient', 'waiting-on-grocery'];
const BLOCKER_SUGGESTION_CATEGORY_BY_ID: Record<string, string> = {
  'missing-ingredient': 'From Recipe',
  'waiting-on-grocery': 'Other',
};
const BLOCKER_SUGGESTION_SEEDS_BY_ID: Record<string, string[]> = {
  'missing-ingredient': ['Meal prep protein', 'Fresh vegetables', 'Breakfast staples'],
  'waiting-on-grocery': ['Weekly produce refill', 'Protein restock', 'Quick snack options'],
};
const BLOCKER_NOTE_STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'need', 'needs', 'needed', 'still', 'more', 'from', 'into', 'this', 'that',
  'prep', 'meal', 'meals', 'week', 'grocery', 'shopping', 'store', 'list', 'item', 'items', 'to', 'a', 'an',
]);

type BlockerSuggestionResolutionLink = {
  suggestionId: string;
  name: string;
  category: string;
  reason: string;
  addedAt: string;
};

const normalizePrepSession = (session: any): PrepSessionState => {
  const normalizedTasks = Array.isArray(session?.tasks)
    ? DEFAULT_PREP_SESSION_TASKS.map((task) => {
        const match = session.tasks.find((candidate: any) => candidate?.id === task.id);
        return { ...task, done: Boolean(match?.done) };
      })
    : DEFAULT_PREP_SESSION_TASKS.map((task) => ({ ...task }));

  const normalizedBlockers = Array.isArray(session?.blockers)
    ? DEFAULT_PREP_BLOCKERS.map((blocker) => {
        const match = session.blockers.find((candidate: any) => candidate?.id === blocker.id);
        return { ...blocker, active: Boolean(match?.active) };
      })
    : DEFAULT_PREP_BLOCKERS.map((blocker) => ({ ...blocker }));

  const normalizedCarryoverIds = Array.isArray(session?.carryoverTaskIds)
    ? session.carryoverTaskIds.filter((taskId: string) => normalizedTasks.some((task) => task.id === taskId))
    : [];
  const normalizedSuggestionLinks = Array.isArray(session?.blockerSuggestionLinks)
    ? session.blockerSuggestionLinks
        .map((link: any) => ({
          suggestionId: typeof link?.suggestionId === 'string' ? link.suggestionId : '',
          name: typeof link?.name === 'string' ? link.name : '',
          category: typeof link?.category === 'string' ? link.category : 'Other',
          reason: typeof link?.reason === 'string' ? link.reason : 'from prep blocker',
          addedAt: typeof link?.addedAt === 'string' ? link.addedAt : '',
        }))
        .filter((link: BlockerSuggestionResolutionLink) => link.suggestionId && link.name)
    : [];

  return {
    scheduledAt: typeof session?.scheduledAt === 'string' ? session.scheduledAt : '',
    notes: typeof session?.notes === 'string' ? session.notes : '',
    tasks: normalizedTasks,
    blockers: normalizedBlockers,
    blockerNote: typeof session?.blockerNote === 'string' ? session.blockerNote : '',
    blockerSuggestionLinks: normalizedSuggestionLinks,
    carryoverTaskIds: normalizedCarryoverIds,
    completedAt: typeof session?.completedAt === 'string' ? session.completedAt : null,
  };
};

const createDefaultPrepSession = (): PrepSessionState => normalizePrepSession({});

type BlockerItemSuggestion = {
  id: string;
  name: string;
  category: string;
  reason: string;
  alreadyOnList: boolean;
};

type MealPlanVisibility = 'private' | 'friends' | 'public';
type ShareMetadataSaveState = 'idle' | 'saving' | 'saved' | 'error';
type TemplateMergeMode = 'replace' | 'append';

type TemplateBridgePayload = {
  templateName: string;
  targetWeekStart?: string;
  source?: string;
  requestedAt?: string;
  mergeMode?: TemplateMergeMode;
};
type PendingTemplateBridgePreview = TemplateBridgePayload & {
  templateMeals: Record<string, any>;
  mergeMode: TemplateMergeMode;
};
type RecentPinnedTemplateUsage = {
  templateName: string;
  lastUsedAt: string;
  mergeMode: TemplateMergeMode;
  lastAppliedSummary?: string;
  appliedMealCount?: number;
  addedMealCount?: number;
  targetWeekStart?: string;
};
type TemplateMergePreferenceMap = Record<string, TemplateMergeMode>;
type RecentPinnedTemplateApplyResult = {
  appliedMealCount?: number;
  addedMealCount?: number;
  targetWeekStart?: string;
  lastAppliedSummary?: string;
};

const TEMPLATE_PINNED_STORAGE_KEY = 'meal-template-pinned-v1';
const RECENT_PINNED_TEMPLATE_STORAGE_KEY = 'meal-template-recent-pinned-v1';
const TEMPLATE_MERGE_PREFERENCES_STORAGE_KEY = 'meal-template-merge-preferences-v1';
const RECENT_PINNED_TEMPLATE_LIMIT = 3;

const NutritionMealPlanner = () => {
  const { user, updateUser } = useUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('planner');
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(new Date()));
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [mealPlans, setMealPlans] = useState<any[]>([]);
  const [groceryList, setGroceryList] = useState<any[]>([]);
  const [dailyNutrition, setDailyNutrition] = useState<any>(null);
  const [nutritionGoals, setNutritionGoals] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weeklyMeals, setWeeklyMeals] = useState<Record<string, any>>({});
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [selectedMealSlot, setSelectedMealSlot] = useState<{day: string, type: string} | null>(null);
  const [showAIRecipeModal, setShowAIRecipeModal] = useState(false);
  const [showPantryModal, setShowPantryModal] = useState(false);
  const [showLoadTemplateModal, setShowLoadTemplateModal] = useState(false);
  const [savingsReport, setSavingsReport] = useState<any>(null);
  const [showAddGroceryModal, setShowAddGroceryModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showShareFamilyModal, setShowShareFamilyModal] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [weekRange, setWeekRange] = useState<{ weekStart: string; weekEnd: string } | null>(null);
  const [isGeneratingWeek, setIsGeneratingWeek] = useState(false);
  const [streak, setStreak] = useState<{ currentStreak: number; longestStreak: number; lastLoggedDate: string | null }>({ currentStreak: 0, longestStreak: 0, lastLoggedDate: null });
  const [bodyMetricsLog, setBodyMetricsLog] = useState<any[]>([]);
  const [bodyForm, setBodyForm] = useState({ date: formatLocalDate(new Date()), weight: '', bodyFatPct: '', waistIn: '', hipIn: '', unit: 'lbs' as 'lbs' | 'kg' });
  const [water, setWater] = useState<{ date: string; glassesLogged: number; dailyTarget: number }>({ date: formatLocalDate(new Date()), glassesLogged: 0, dailyTarget: 8 });
  const [mealHistory, setMealHistory] = useState<any[]>([]);
  const [showRecentMeals, setShowRecentMeals] = useState(true);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [calcForm, setCalcForm] = useState({ age: 30, gender: 'male', heightUnit: 'ft', feet: 5, inches: 10, cm: 178, weightUnit: 'lbs', weight: 180, activity: 'moderately active', goal: 'maintain' });
  const [calcResult, setCalcResult] = useState<any>(null);
  const [prepSession, setPrepSession] = useState<PrepSessionState>(() => createDefaultPrepSession());
  const [shareVisibility, setShareVisibility] = useState<MealPlanVisibility>('private');
  const [sharePublicToken, setSharePublicToken] = useState<string | null>(null);
  const [shareMetadataLoaded, setShareMetadataLoaded] = useState(false);
  const [shareMetadataSaveState, setShareMetadataSaveState] = useState<ShareMetadataSaveState>('idle');
  const [templateBridgeRequest, setTemplateBridgeRequest] = useState<TemplateBridgePayload | null>(null);
  const [pendingTemplateBridgePreview, setPendingTemplateBridgePreview] = useState<PendingTemplateBridgePreview | null>(null);
  const [recentPinnedTemplates, setRecentPinnedTemplates] = useState<RecentPinnedTemplateUsage[]>([]);

  // Add Meal modal — controlled fields
  const [mealForm, setMealForm] = useState(INITIAL_MEAL_FORM);
  const [baseNutrition, setBaseNutrition] = useState<{ calories: number; protein: number; carbs: number; fat: number; fiber: number; servingSize: string } | null>(null);
  const [isLookingUpNutrition, setIsLookingUpNutrition] = useState(false);

  // AI Recipe Suggestions modal
  const [aiRecipes, setAiRecipes] = useState<any[]>([]);
  const [isLoadingAiRecipes, setIsLoadingAiRecipes] = useState(false);

  const mealTypes = MEAL_TYPES;
  const weekDays = WEEK_DAYS;

  const getCurrentWeekAnchor = () => getWeekAnchorForDate(selectedDate);

  const getDateForWeekday = (weekday: string) => getDateForWeekdayFromAnchor(getCurrentWeekAnchor(), weekday);
  const getPrepSessionStorageKey = () => `meal-planner-prep-session-v1:${user?.id || 'anon'}:${getCurrentWeekAnchor()}`;
  const getPrepSessionStorageKeyForAnchor = (anchorDate: string) => `meal-planner-prep-session-v1:${user?.id || 'anon'}:${anchorDate}`;
  const getShareVisibilityStorageKey = () => `meal-planner-share-visibility-v1:${user?.id || 'anon'}`;
  const countMealEntries = (weekMeals: Record<string, any> | null | undefined) => {
    if (!weekMeals || typeof weekMeals !== 'object') return 0;
    return Object.values(weekMeals).reduce((weekTotal, dayValue) => {
      if (!dayValue || typeof dayValue !== 'object') return weekTotal;
      const dayTotal = Object.values(dayValue as Record<string, any>).reduce((slotTotal, slotValue) => {
        if (Array.isArray(slotValue)) return slotTotal + slotValue.length;
        if (slotValue && typeof slotValue === 'object') return slotTotal + 1;
        return slotTotal;
      }, 0);
      return weekTotal + dayTotal;
    }, 0);
  };

  const toMealItems = (value: any): any[] => {
    if (!value) return [];
    return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
  };

  const loadPinnedTemplateNames = () => {
    try {
      const raw = localStorage.getItem(TEMPLATE_PINNED_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return Array.from(new Set(parsed
        .map((name) => (typeof name === 'string' ? name.trim() : ''))
        .filter((name) => Boolean(name))));
    } catch {
      return [];
    }
  };

  const loadTemplateMergePreferences = (): TemplateMergePreferenceMap => {
    try {
      const raw = localStorage.getItem(TEMPLATE_MERGE_PREFERENCES_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const normalizedEntries = Object.entries(parsed).flatMap(([templateName, mergeMode]) => {
        const normalizedName = typeof templateName === 'string' ? templateName.trim() : '';
        if (!normalizedName) return [];
        return [[normalizedName, mergeMode === 'append' ? 'append' : 'replace'] as const];
      });
      return Object.fromEntries(normalizedEntries);
    } catch {
      return {};
    }
  };

  const setTemplateMergePreference = (templateName: string, mergeMode: TemplateMergeMode) => {
    const normalizedName = templateName.trim();
    if (!normalizedName) return;
    try {
      const existing = loadTemplateMergePreferences();
      const next = { ...existing, [normalizedName]: mergeMode };
      localStorage.setItem(TEMPLATE_MERGE_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Error storing template merge preference:', error);
    }
  };

  const getTemplateMergePreference = (templateName: string): TemplateMergeMode => {
    const normalizedName = templateName.trim();
    if (!normalizedName) return 'replace';
    const preferences = loadTemplateMergePreferences();
    return preferences[normalizedName] === 'append' ? 'append' : 'replace';
  };

  const sanitizeRecentPinnedTemplates = (items: RecentPinnedTemplateUsage[]) => {
    const pinned = new Set(loadPinnedTemplateNames());
    return items
      .filter((item) => pinned.has(item.templateName) && Boolean(localStorage.getItem(`meal-template-${item.templateName}`)))
      .slice(0, RECENT_PINNED_TEMPLATE_LIMIT);
  };

  const buildLastAppliedSummary = (mergeMode: TemplateMergeMode, appliedMealCount: number, addedMealCount?: number) => {
    if (mergeMode === 'append') {
      return `Append, added ${addedMealCount || 0} meals`;
    }
    return `Replace, ${appliedMealCount} meals applied`;
  };

  const refreshRecentPinnedTemplates = () => {
    try {
      const raw = localStorage.getItem(RECENT_PINNED_TEMPLATE_STORAGE_KEY);
      if (!raw) {
        setRecentPinnedTemplates([]);
        return;
      }
      const mergePreferences = loadTemplateMergePreferences();
      const parsed = JSON.parse(raw);
      const normalized = Array.isArray(parsed)
        ? parsed
            .map((item) => ({
              templateName: typeof item?.templateName === 'string' ? item.templateName.trim() : '',
              lastUsedAt: typeof item?.lastUsedAt === 'string' ? item.lastUsedAt : '',
              mergeMode: mergePreferences[typeof item?.templateName === 'string' ? item.templateName.trim() : ''] === 'append'
                ? 'append'
                : item?.mergeMode === 'append'
                  ? 'append'
                  : 'replace',
              lastAppliedSummary: typeof item?.lastAppliedSummary === 'string' ? item.lastAppliedSummary : undefined,
              appliedMealCount: Number.isFinite(item?.appliedMealCount) ? Number(item.appliedMealCount) : undefined,
              addedMealCount: Number.isFinite(item?.addedMealCount) ? Number(item.addedMealCount) : undefined,
              targetWeekStart: typeof item?.targetWeekStart === 'string' ? item.targetWeekStart : undefined,
            }))
            .filter((item) => Boolean(item.templateName))
        : [];
      const sanitized = sanitizeRecentPinnedTemplates(normalized);
      localStorage.setItem(RECENT_PINNED_TEMPLATE_STORAGE_KEY, JSON.stringify(sanitized));
      setRecentPinnedTemplates(sanitized);
    } catch (error) {
      console.error('Error loading recent pinned templates:', error);
      setRecentPinnedTemplates([]);
    }
  };

  const recordRecentPinnedTemplateUse = (
    templateName: string,
    mergeMode: TemplateMergeMode,
    result: RecentPinnedTemplateApplyResult = {},
  ) => {
    const normalizedName = templateName.trim();
    if (!normalizedName) return;
    const pinned = new Set(loadPinnedTemplateNames());
    if (!pinned.has(normalizedName)) return;
    const appliedMealCount = Number.isFinite(result.appliedMealCount) ? Number(result.appliedMealCount) : 0;
    const normalizedAddedMealCount = Number.isFinite(result.addedMealCount) ? Number(result.addedMealCount) : undefined;
    const lastAppliedSummary = typeof result.lastAppliedSummary === 'string' && result.lastAppliedSummary.trim().length > 0
      ? result.lastAppliedSummary.trim()
      : buildLastAppliedSummary(mergeMode, appliedMealCount, normalizedAddedMealCount);

    try {
      const raw = localStorage.getItem(RECENT_PINNED_TEMPLATE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const existing = Array.isArray(parsed) ? parsed : [];
      const withoutCurrent = existing.filter((item) => item?.templateName !== normalizedName);
      const nextItems = sanitizeRecentPinnedTemplates([
        {
          templateName: normalizedName,
          lastUsedAt: new Date().toISOString(),
          mergeMode,
          lastAppliedSummary,
          appliedMealCount,
          addedMealCount: normalizedAddedMealCount,
          targetWeekStart: typeof result.targetWeekStart === 'string' ? result.targetWeekStart : undefined,
        },
        ...withoutCurrent,
      ]);
      localStorage.setItem(RECENT_PINNED_TEMPLATE_STORAGE_KEY, JSON.stringify(nextItems));
      setRecentPinnedTemplates(nextItems);
    } catch (error) {
      console.error('Error storing recent pinned template use:', error);
    }
  };

  const applyTemplateMeals = (
    currentWeek: Record<string, any>,
    templateWeek: Record<string, any>,
    mergeMode: TemplateMergeMode,
  ) => {
    if (mergeMode === 'replace') {
      return templateWeek && typeof templateWeek === 'object' ? templateWeek : currentWeek;
    }

    const mergedWeek: Record<string, any> = { ...currentWeek };
    for (const day of WEEK_DAYS) {
      const currentDayMeals = currentWeek?.[day] && typeof currentWeek[day] === 'object' ? currentWeek[day] : {};
      const nextDayMeals: Record<string, any> = { ...currentDayMeals };

      for (const mealType of MEAL_TYPES) {
        const currentItems = toMealItems(currentDayMeals?.[mealType]);
        if (currentItems.length > 0) continue;

        const templateItems = toMealItems(templateWeek?.[day]?.[mealType]);
        if (templateItems.length === 0) continue;

        nextDayMeals[mealType] = Array.isArray(templateWeek?.[day]?.[mealType])
          ? templateItems
          : templateItems[0];
      }

      if (Object.keys(nextDayMeals).length > 0) {
        mergedWeek[day] = nextDayMeals;
      }
    }

    return mergedWeek;
  };

  const estimateAppendAddedMeals = (currentWeek: Record<string, any>, templateWeek: Record<string, any>) => {
    let addedMeals = 0;
    for (const day of WEEK_DAYS) {
      for (const mealType of MEAL_TYPES) {
        const currentItems = toMealItems(currentWeek?.[day]?.[mealType]);
        if (currentItems.length > 0) continue;

        addedMeals += toMealItems(templateWeek?.[day]?.[mealType]).length;
      }
    }
    return addedMeals;
  };

  useEffect(() => {
    fetchUserData();
    if (isPremium) {
      fetchMealPlans();
      fetchDailyNutrition();
      fetchGroceryList();
      fetchSavingsReport();
      fetchStreak();
      fetchBodyMetrics();
      fetchWater();
    }
  }, [selectedDate, isPremium, user]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('meal-planner-template-bridge-v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.templateName !== 'string' || !parsed.templateName.trim()) {
        localStorage.removeItem('meal-planner-template-bridge-v1');
        return;
      }
      setTemplateBridgeRequest({
        templateName: parsed.templateName.trim(),
        targetWeekStart: typeof parsed.targetWeekStart === 'string' ? parsed.targetWeekStart : undefined,
        source: typeof parsed.source === 'string' ? parsed.source : undefined,
        requestedAt: typeof parsed.requestedAt === 'string' ? parsed.requestedAt : undefined,
        mergeMode: parsed.mergeMode === 'append' ? 'append' : 'replace',
      });
    } catch (error) {
      console.error('Error loading template bridge request:', error);
      localStorage.removeItem('meal-planner-template-bridge-v1');
    }
  }, []);

  useEffect(() => {
    refreshRecentPinnedTemplates();
  }, [showLoadTemplateModal]);

  useEffect(() => {
    if (isPremium) {
      fetchDailyNutrition();
    }
  }, [weeklyMeals]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(getPrepSessionStorageKey());
      if (!stored) {
        setPrepSession(createDefaultPrepSession());
        return;
      }
      const parsed = JSON.parse(stored);
      setPrepSession(normalizePrepSession(parsed));
    } catch (error) {
      console.error('Error loading prep session:', error);
      setPrepSession(createDefaultPrepSession());
    }
  }, [user?.id, selectedDate]);

  useEffect(() => {
    try {
      localStorage.setItem(getPrepSessionStorageKey(), JSON.stringify(prepSession));
    } catch (error) {
      console.error('Error saving prep session:', error);
    }
  }, [prepSession, user?.id, selectedDate]);

  useEffect(() => {
    const loadShareMetadata = async () => {
      setShareMetadataLoaded(false);
      try {
        const response = await fetch(`/api/meal-planner/week/share-metadata?date=${getCurrentWeekAnchor()}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const visibility = data?.visibility;
        if (visibility === 'private' || visibility === 'friends' || visibility === 'public') {
          setShareVisibility(visibility);
        } else {
          setShareVisibility('private');
        }
        setSharePublicToken(typeof data?.publicShareToken === 'string' ? data.publicShareToken : null);
        setShareMetadataSaveState('saved');
        setShareMetadataLoaded(true);
        return;
      } catch (error) {
        console.error('Error loading meal plan share metadata from backend, falling back to local:', error);
      }

      try {
        const stored = localStorage.getItem(getShareVisibilityStorageKey());
        if (stored === 'private' || stored === 'friends' || stored === 'public') {
          setShareVisibility(stored);
        } else {
          setShareVisibility('private');
        }
      } catch (error) {
        console.error('Error loading meal plan share visibility:', error);
        setShareVisibility('private');
      } finally {
        setSharePublicToken(null);
        setShareMetadataLoaded(true);
      }
    };

    loadShareMetadata();
  }, [user?.id, selectedDate]);

  useEffect(() => {
    try {
      localStorage.setItem(getShareVisibilityStorageKey(), shareVisibility);
    } catch (error) {
      console.error('Error saving meal plan share visibility:', error);
    }
  }, [shareVisibility, user?.id]);

  useEffect(() => {
    if (!shareMetadataLoaded) return;
    if (!user?.id) return;

    let cancelled = false;
    const persistShareMetadata = async () => {
      setShareMetadataSaveState('saving');
      try {
        const summaryFingerprint = [
          getCurrentWeekAnchor(),
          shareVisibility,
          Object.keys(weeklyMeals || {}).length,
          groceryList.length,
          prepSession.tasks.filter((task) => task.done).length,
          prepSession.blockers.filter((blocker) => blocker.active).length,
        ].join('|');

        const response = await fetch('/api/meal-planner/week/share-metadata', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: getCurrentWeekAnchor(),
            visibility: shareVisibility,
            summaryFingerprint,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!cancelled) {
          const token = typeof data?.publicShareToken === 'string' ? data.publicShareToken : null;
          setSharePublicToken(token);
          setShareMetadataSaveState('saved');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error saving meal plan share metadata to backend:', error);
          setShareMetadataSaveState('error');
        }
      }
    };

    persistShareMetadata();

    return () => {
      cancelled = true;
    };
  }, [
    shareMetadataLoaded,
    shareVisibility,
    user?.id,
    selectedDate,
    weeklyMeals,
    groceryList,
    prepSession.tasks,
    prepSession.blockers,
  ]);

  const fetchSavingsReport = async () => {
    try {
      const response = await fetch('/api/meal-planner/grocery-list/savings-report', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSavingsReport(data);
      }
    } catch (error) {
      console.error('Error fetching savings report:', error);
    }
  };

  const fetchUserData = async () => {
    try {
      // Check if user has nutrition premium (either through trial or paid subscription)
      const hasNutritionAccess = user?.nutritionPremium || false;

      // Check if trial is still valid
      if (hasNutritionAccess && user?.nutritionTrialEndsAt) {
        const trialEnd = new Date(user.nutritionTrialEndsAt);
        const now = new Date();
        if (now > trialEnd) {
          // Trial has expired
          setIsPremium(false);
          toast({
            variant: "destructive",
            title: "Trial Expired",
            description: "Your nutrition trial has ended. Upgrade to continue using premium features.",
          });
          return;
        }
      }

      setIsPremium(hasNutritionAccess);

      setNutritionGoals({
        dailyCalorieGoal: 2000,
        macroGoals: DEFAULT_NUTRITION_GOALS.macroGoals
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchMealPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/meal-planner/week?date=${getCurrentWeekAnchor()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setWeeklyMeals(data.weeklyMeals || {});
        setWeekRange({ weekStart: data.weekStart, weekEnd: data.weekEnd });
      }
    } catch (error) {
      console.error('Error fetching meal plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyNutrition = async () => {
    // Default goals used if the API call fails
    const defaultGoals = DEFAULT_NUTRITION_GOALS;

    const calcTotals = (meals: Record<string, any>, goals: any) => {
      const totals = calculateTodayNutritionTotals(meals);
      setDailyNutrition({ ...totals, goal: goals });
    };

    // Try to fetch saved goals from server; calculate regardless of outcome
    try {
      const response = await fetch(`/api/meal-planner/settings`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const goals = data.settings || defaultGoals;
        setNutritionGoals(goals);
        calcTotals(weeklyMeals, goals);
      } else {
        calcTotals(weeklyMeals, nutritionGoals || defaultGoals);
      }
    } catch (error) {
      console.error('Error fetching daily nutrition:', error);
      calcTotals(weeklyMeals, nutritionGoals || defaultGoals);
    }
  };

  const generateWeekPlan = async () => {
    try {
      setIsGeneratingWeek(true);
      const response = await fetch('/api/meal-planner/week/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: getCurrentWeekAnchor(),
          days: 7,
          mealTypes: ['breakfast', 'lunch', 'dinner'],
          servings: 2,
          replaceExisting: true,
          alsoCreateGroceryList: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate week plan');
      }

      const data = await response.json();
      setWeeklyMeals(data.weeklyMeals || {});
      setWeekRange({ weekStart: data.weekStart, weekEnd: data.weekEnd });
      toast({
        description: `✅ Week generated and ${data.groceryList?.created || 0} grocery items added.`,
      });
      fetchGroceryList();
      fetchDailyNutrition();
    } catch (error) {
      console.error('Error generating week plan:', error);
      toast({ variant: 'destructive', description: 'Could not generate your week plan.' });
    } finally {
      setIsGeneratingWeek(false);
    }
  };

  const fetchGroceryList = async () => {
    try {
      const response = await fetch('/api/meal-planner/grocery-list?purchased=false', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Grocery list API response:', data);
        // Map API response to component state format
        const mappedItems = data.items.map((item: any) => {
          const normalized = normalizeShoppingListItem({
            name: item.ingredientName,
            note: item.notes,
          });

          return ({
          id: item.id,
          item: normalized.name,
          name: normalized.name,
          amount: item.quantity && item.unit ? `${item.quantity} ${item.unit}` : item.quantity || '',
          category: item.category || 'Other',
          checked: item.purchased || false,
          notes: normalized.note,
          optional: normalized.optional,
          isPantryItem: item.isPantryItem || item.is_pantry_item || false,
          estimatedPrice: item.estimatedPrice || item.estimated_price || 0,
          });
        });
        console.log('Mapped grocery items:', mappedItems);
        setGroceryList(mappedItems);

        // Check for pending items from RecipeKit
        try {
          const pending = JSON.parse(localStorage.getItem('pendingShoppingListItems') || '[]');
          if (pending.length > 0) {
            // Add pending items to the database
            for (const item of pending) {
              await addGroceryListItem({
                ingredientName: item.name,
                quantity: item.quantity,
                unit: item.unit,
                category: item.category || 'From Recipe',
                notes: item.note,
              });
            }
            // Clear pending items and refetch
            localStorage.removeItem('pendingShoppingListItems');
            fetchGroceryList(); // Refetch to get the new items
          }
        } catch (err) {
          console.error('Error loading pending items:', err);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch grocery list:', response.status, errorText);
        toast({
          variant: "destructive",
          title: "Failed to load grocery list",
          description: `Server error: ${response.status}`,
        });
      }
    } catch (error) {
      console.error('Error fetching grocery list:', error);
      toast({
        variant: "destructive",
        description: "Failed to load grocery list",
      });
    }
  };

  const fetchStreak = async () => {
    try {
      const response = await fetch('/api/meal-planner/streak', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setStreak(data);
      }
    } catch (error) {
      console.error('Error fetching streak:', error);
    }
  };

  const fetchBodyMetrics = async () => {
    try {
      const response = await fetch('/api/meal-planner/body-metrics?limit=30', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setBodyMetricsLog((data.metrics || []).slice().reverse());
      }
    } catch (error) {
      console.error('Error fetching body metrics:', error);
    }
  };

  const saveBodyMetric = async () => {
    if (!bodyForm.weight) return;
    const weightLbs = bodyForm.unit === 'kg' ? Number(bodyForm.weight) * 2.20462 : Number(bodyForm.weight);
    try {
      const response = await fetch('/api/meal-planner/body-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: bodyForm.date,
          weightLbs,
          bodyFatPct: bodyForm.bodyFatPct ? Number(bodyForm.bodyFatPct) : null,
          waistIn: bodyForm.waistIn ? Number(bodyForm.waistIn) : null,
          hipIn: bodyForm.hipIn ? Number(bodyForm.hipIn) : null,
        }),
      });
      if (!response.ok) throw new Error('Failed to save metric');
      await fetchBodyMetrics();
      toast({ description: '✅ Body metrics logged' });
    } catch (error) {
      toast({ variant: 'destructive', description: 'Failed to save body metrics' });
    }
  };

  const fetchWater = async (date = formatLocalDate(new Date())) => {
    try {
      const response = await fetch(`/api/meal-planner/water?date=${date}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setWater(data);
      }
    } catch (error) {
      console.error('Error fetching water:', error);
    }
  };

  const saveWater = async (glassesLogged: number) => {
    const date = formatLocalDate(new Date());
    try {
      const response = await fetch('/api/meal-planner/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date, glassesLogged }),
      });
      if (response.ok) {
        const data = await response.json();
        setWater(data);
      }
    } catch (error) {
      console.error('Error saving water:', error);
    }
  };

  const updateWaterTarget = async () => {
    const next = Number(prompt('Daily water target (glasses):', String(water.dailyTarget || 8)));
    if (!Number.isFinite(next) || next <= 0) return;
    try {
      const response = await fetch('/api/meal-planner/water/target', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dailyTarget: next }),
      });
      if (response.ok) {
        const data = await response.json();
        setWater((prev) => ({ ...prev, dailyTarget: data.dailyTarget }));
      }
    } catch (error) {
      console.error('Error updating water target:', error);
    }
  };

  const fetchMealHistory = async () => {
    try {
      const response = await fetch('/api/meal-planner/history', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMealHistory(data.meals || []);
      }
    } catch (error) {
      console.error('Error fetching meal history:', error);
    }
  };

  const startNutritionTrial = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        description: "Please log in to start your trial",
      });
      return;
    }

    try {
      const response = await fetch(`/api/users/${user.id}/nutrition/trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();

        // Update user context with new trial data
        updateUser({
          nutritionPremium: true,
          nutritionTrialEndsAt: data.trialEndsAt
        });

        // Update local state
        setIsPremium(true);

        // Show confirmation toast
        toast({
          description: "🎉 30-day nutrition trial activated! Enjoy premium features.",
        });
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          description: error.message || "Failed to start trial",
        });
      }
    } catch (error) {
      console.error('Error starting trial:', error);
      toast({
        variant: "destructive",
        description: "An error occurred. Please try again.",
      });
    }
  };

  const exportGroceryList = async () => {
    if (groceryList.length === 0) {
      toast({
        variant: "destructive",
        description: "No items to export",
      });
      return;
    }

    try {
      // Convert grocery list to export format
      const itemsToExport = toGroceryExportItems(groceryList);

      // Export as CSV
      await exportCSV(itemsToExport, `shopping-list-${new Date().toISOString().split('T')[0]}.csv`);

      toast({
        description: "✅ Shopping list exported successfully!",
      });
    } catch (error) {
      console.error('Error exporting list:', error);
      toast({
        variant: "destructive",
        description: "Failed to export shopping list",
      });
    }
  };

  const optimizeShoppingList = async () => {
    try {
      const response = await fetch('/api/meal-planner/grocery-list/optimized', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to optimize list');
      }

      const data = await response.json();

      // Reorganize the grocery list based on optimized store layout
      const optimizedItems = data.optimized.flatMap((group: any) =>
        group.items.map((item: any) => ({
          id: item.id,
          item: item.ingredientName,
          name: item.ingredientName,
          amount: item.quantity && item.unit ? `${item.quantity} ${item.unit}` : item.quantity || '',
          category: item.category || 'Other',
          checked: item.purchased || false,
          notes: item.notes,
        }))
      );

      setGroceryList(optimizedItems);

      toast({
        description: "🛒 Shopping list optimized by store layout!",
      });
    } catch (error) {
      console.error('Error optimizing list:', error);
      toast({
        variant: "destructive",
        description: "Failed to optimize shopping list",
      });
    }
  };

  const handleAddMeal = (day?: string, type?: string) => {
    if (day && type) {
      setSelectedMealSlot({ day, type });
    }
    setMealForm(INITIAL_MEAL_FORM);
    setBaseNutrition(null);
    setShowAddMealModal(true);
    fetchMealHistory();
  };

  const resetAddMealModalState = () => {
    setMealForm(INITIAL_MEAL_FORM);
    setBaseNutrition(null);
  };

  const addGroceryListItem = async (payload: {
    ingredientName: string;
    quantity: string;
    unit: string;
    category: string;
    notes?: string;
  }) => {
    return fetch('/api/meal-planner/grocery-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
  };

  const addBlockerSuggestionToGrocery = async (suggestion: BlockerItemSuggestion) => {
    if (suggestion.alreadyOnList) {
      toast({
        description: `“${suggestion.name}” is already on your grocery list.`,
      });
      return;
    }

    try {
      const response = await addGroceryListItem({
        ingredientName: suggestion.name,
        quantity: '1',
        unit: '',
        category: suggestion.category,
        notes: `Prep blocker suggestion: ${suggestion.reason}`,
      });

      if (!response.ok) {
        throw new Error('Failed to add blocker suggestion item');
      }

      toast({
        description: `✅ Added "${suggestion.name}" from prep blocker suggestions.`,
      });
      setPrepSession((prev) => {
        const normalizedName = suggestion.name.trim().toLowerCase();
        const alreadyTracked = prev.blockerSuggestionLinks.some((link) => (
          link.suggestionId === suggestion.id
          || link.name.trim().toLowerCase() === normalizedName
        ));

        if (alreadyTracked) {
          return prev;
        }

        return {
          ...prev,
          blockerSuggestionLinks: [
            ...prev.blockerSuggestionLinks,
            {
              suggestionId: suggestion.id,
              name: suggestion.name,
              category: suggestion.category,
              reason: suggestion.reason,
              addedAt: formatLocalDate(new Date()),
            },
          ],
        };
      });
      await fetchGroceryList();
    } catch (error) {
      console.error('Error adding blocker suggestion:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to add suggested blocker item',
      });
    }
  };

  const closeAddMealModal = () => {
    setShowAddMealModal(false);
    setSelectedMealSlot(null);
    resetAddMealModalState();
  };

  const saveMealToSlot = async (mealData: any) => {
    if (!selectedMealSlot) {
      setShowAddMealModal(false);
      return;
    }

    try {
      const response = await fetch('/api/meal-planner/week/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: getDateForWeekday(selectedMealSlot.day),
          mealType: selectedMealSlot.type,
          name: mealData.name,
          calories: mealData.calories,
          protein: mealData.protein,
          carbs: mealData.carbs,
          fat: mealData.fat,
          fiber: mealData.fiber,
          source: mealData.source || null,
          recipeId: mealData.recipeId || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save meal entry');
      }

      const data = await response.json();
      await fetch('/api/meal-planner/streak/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date: getDateForWeekday(selectedMealSlot.day) }),
      });
      fetchStreak();
      const savedMeal = { ...mealData, entryId: data?.entry?.id, source: mealData.source || null };

      setWeeklyMeals((prev: any) => {
        const existing = prev[selectedMealSlot.day]?.[selectedMealSlot.type];
        // Always store as an array so multiple items per slot work
        const currentItems = Array.isArray(existing) ? existing : existing ? [existing] : [];
        return {
          ...prev,
          [selectedMealSlot.day]: {
            ...prev[selectedMealSlot.day],
            [selectedMealSlot.type]: [...currentItems, savedMeal]
          }
        };
      });
      toast({ description: "✅ Meal item added!" });
    } catch (error) {
      console.error('Error saving meal item:', error);
      toast({ variant: 'destructive', description: 'Failed to save meal item' });
    } finally {
      setShowAddMealModal(false);
      setSelectedMealSlot(null);
    }
  };

  const removeMealItem = async (day: string, mealType: string, itemIndex: number) => {
    const items = getMealSlotItems(weeklyMeals, day, mealType);
    const target = items[itemIndex];

    try {
      if (target?.entryId) {
        const response = await fetch(`/api/meal-planner/week/entry/${target.entryId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to delete meal entry');
        }
      }

      setWeeklyMeals((prev: any) => {
        const existing = prev[day]?.[mealType];
        const currentItems = Array.isArray(existing) ? existing : existing ? [existing] : [];
        const updated = currentItems.filter((_: any, i: number) => i !== itemIndex);
        return {
          ...prev,
          [day]: {
            ...prev[day],
            [mealType]: updated.length > 0 ? updated : undefined
          }
        };
      });
    } catch (error) {
      console.error('Error removing meal item:', error);
      toast({ variant: 'destructive', description: 'Failed to remove meal item' });
    }
  };


  const saveTemplate = () => {
    const templateName = prompt('Enter a name for this meal plan template:');
    if (templateName) {
      localStorage.setItem(`meal-template-${templateName}`, JSON.stringify(weeklyMeals));
      toast({
        description: `✅ Template "${templateName}" saved successfully!`,
      });
    }
  };

  const toggleGroceryItem = async (index: number) => {
    const item = groceryList[index];
    if (!item) return;

    try {
      // Toggle the purchased status via API
      const response = await fetch(`/api/meal-planner/grocery-list/${item.id}/purchase`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ toggle: true }),
      });

      if (response.ok) {
        const result = await response.json();
        // Update local state with the actual server response
        setGroceryList((prev: any) => prev.map((item: any, i: number) =>
          i === index ? { ...item, checked: result.item.purchased } : item
        ));
      } else {
        throw new Error('Failed to toggle item');
      }
    } catch (error) {
      console.error('Error toggling grocery item:', error);
      toast({
        variant: "destructive",
        description: "Failed to update item status",
      });
    }
  };

  const loadTemplate = (templateName: string, mergeMode: TemplateMergeMode = 'replace') => {
    const saved = localStorage.getItem(`meal-template-${templateName}`);
    if (saved) {
      try {
        const parsedTemplateMeals = JSON.parse(saved);
        if (!parsedTemplateMeals || typeof parsedTemplateMeals !== 'object') {
          throw new Error('Invalid template payload');
        }

        const appliedMealCount = countMealEntries(parsedTemplateMeals);
        const addedMealCount = mergeMode === 'append' ? estimateAppendAddedMeals(weeklyMeals, parsedTemplateMeals) : undefined;
        const nextWeeklyMeals = applyTemplateMeals(weeklyMeals, parsedTemplateMeals, mergeMode);
        setWeeklyMeals(nextWeeklyMeals);
        setTemplateMergePreference(templateName, mergeMode);
        recordRecentPinnedTemplateUse(templateName, mergeMode, {
          appliedMealCount,
          addedMealCount,
          targetWeekStart: getCurrentWeekAnchor(),
        });
        toast({
          description: mergeMode === 'append'
            ? `✅ Template "${templateName}" appended into open planner slots!`
            : `✅ Template "${templateName}" loaded successfully!`,
        });
        setShowLoadTemplateModal(false);
      } catch (error) {
        console.error('Error loading template from localStorage:', error);
        toast({
          variant: 'destructive',
          description: `Template "${templateName}" is invalid or outdated. Re-save it and try again.`,
        });
      }
    }
  };

  useEffect(() => {
    if (!templateBridgeRequest || loading || !isPremium) return;

    const targetWeek = templateBridgeRequest.targetWeekStart?.trim();
    if (targetWeek && targetWeek !== selectedDate) {
      setSelectedDate(targetWeek);
      return;
    }

    if (pendingTemplateBridgePreview?.templateName === templateBridgeRequest.templateName && pendingTemplateBridgePreview?.targetWeekStart === targetWeek) {
      return;
    }

    const saved = localStorage.getItem(`meal-template-${templateBridgeRequest.templateName}`);
    if (!saved) {
      toast({
        variant: 'destructive',
        description: `Template "${templateBridgeRequest.templateName}" was not found. Save it again and retry.`,
      });
      localStorage.removeItem('meal-planner-template-bridge-v1');
      setTemplateBridgeRequest(null);
      return;
    }

    try {
      const parsedTemplateMeals = JSON.parse(saved);
      if (!parsedTemplateMeals || typeof parsedTemplateMeals !== 'object') {
        throw new Error('Invalid template payload');
      }
      setPendingTemplateBridgePreview({
        ...templateBridgeRequest,
        targetWeekStart: targetWeek || selectedDate,
        mergeMode: templateBridgeRequest.mergeMode === 'append' ? 'append' : 'replace',
        templateMeals: parsedTemplateMeals,
      });
    } catch (error) {
      console.error('Error applying bridged template:', error);
      toast({
        variant: 'destructive',
        description: `Unable to apply "${templateBridgeRequest.templateName}".`,
      });
    } finally {
      localStorage.removeItem('meal-planner-template-bridge-v1');
      setTemplateBridgeRequest(null);
    }
  }, [templateBridgeRequest, loading, isPremium, selectedDate, pendingTemplateBridgePreview, toast]);

  const pendingTemplateCurrentWeekMealsCount = useMemo(
    () => countMealEntries(weeklyMeals),
    [weeklyMeals],
  );
  const pendingTemplateMealsCount = useMemo(
    () => countMealEntries(pendingTemplateBridgePreview?.templateMeals),
    [pendingTemplateBridgePreview],
  );
  const pendingTemplateAppendAddedMeals = useMemo(
    () => estimateAppendAddedMeals(weeklyMeals, pendingTemplateBridgePreview?.templateMeals || {}),
    [weeklyMeals, pendingTemplateBridgePreview],
  );
  const pendingTemplateSlotDiffPreview = useMemo(() => {
    if (!pendingTemplateBridgePreview) return [];
    return buildTemplateSlotDiff(
      weeklyMeals,
      pendingTemplateBridgePreview.templateMeals || {},
      pendingTemplateBridgePreview.mergeMode,
    );
  }, [weeklyMeals, pendingTemplateBridgePreview]);
  const pendingTemplateImpactBadge = useMemo(() => {
    if (!pendingTemplateBridgePreview) {
      return { label: '', className: '' };
    }
    if (pendingTemplateBridgePreview.mergeMode === 'replace') {
      return {
        label: `Will replace with ${pendingTemplateMealsCount} ${pendingTemplateMealsCount === 1 ? 'meal' : 'meals'}`,
        className: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    }
    if (pendingTemplateAppendAddedMeals > 0) {
      return {
        label: `Will add ${pendingTemplateAppendAddedMeals} ${pendingTemplateAppendAddedMeals === 1 ? 'meal' : 'meals'}`,
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
    }
    return {
      label: 'No empty slots to fill',
      className: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }, [pendingTemplateBridgePreview, pendingTemplateMealsCount, pendingTemplateAppendAddedMeals]);
  const pendingTemplateAppendParityLine = useMemo(() => {
    if (!pendingTemplateBridgePreview) return '';
    if (pendingTemplateMealsCount === 0) {
      return 'Append parity: this template currently has no meals to add.';
    }
    if (pendingTemplateAppendAddedMeals === 0) {
      return 'Append parity: append mode would add 0 meals because this week has no open template slots.';
    }
    const estimatedAppendSkippedMeals = Math.max(pendingTemplateMealsCount - pendingTemplateAppendAddedMeals, 0);
    return `Append parity: append mode would add ${pendingTemplateAppendAddedMeals} ${pendingTemplateAppendAddedMeals === 1 ? 'meal' : 'meals'} and skip ${estimatedAppendSkippedMeals} already-filled ${estimatedAppendSkippedMeals === 1 ? 'slot' : 'slots'}.`;
  }, [pendingTemplateBridgePreview, pendingTemplateMealsCount, pendingTemplateAppendAddedMeals]);

  const handleApplyPendingTemplateBridge = () => {
    if (!pendingTemplateBridgePreview) return;
    const nextWeeklyMeals = applyTemplateMeals(
      weeklyMeals,
      pendingTemplateBridgePreview.templateMeals,
      pendingTemplateBridgePreview.mergeMode,
    );
    setWeeklyMeals(nextWeeklyMeals);
    setTemplateMergePreference(pendingTemplateBridgePreview.templateName, pendingTemplateBridgePreview.mergeMode);
    recordRecentPinnedTemplateUse(pendingTemplateBridgePreview.templateName, pendingTemplateBridgePreview.mergeMode, {
      appliedMealCount: pendingTemplateMealsCount,
      addedMealCount: pendingTemplateBridgePreview.mergeMode === 'append' ? pendingTemplateAppendAddedMeals : undefined,
      targetWeekStart: pendingTemplateBridgePreview.targetWeekStart || selectedDate,
    });
    toast({
      title: 'Template applied',
      description: pendingTemplateBridgePreview.mergeMode === 'append'
        ? `Appended "${pendingTemplateBridgePreview.templateName}" into open slots for week ${pendingTemplateBridgePreview.targetWeekStart || selectedDate}.`
        : `Loaded "${pendingTemplateBridgePreview.templateName}" into week ${pendingTemplateBridgePreview.targetWeekStart || selectedDate}.`,
    });
    localStorage.removeItem('meal-planner-template-bridge-v1');
    setTemplateBridgeRequest(null);
    setPendingTemplateBridgePreview(null);
  };

  const handleCancelPendingTemplateBridge = () => {
    if (!pendingTemplateBridgePreview) return;
    toast({
      description: `Cancelled applying "${pendingTemplateBridgePreview.templateName}".`,
    });
    localStorage.removeItem('meal-planner-template-bridge-v1');
    setTemplateBridgeRequest(null);
    setPendingTemplateBridgePreview(null);
  };

  const handleUseRecentPinnedTemplate = (templateName: string) => {
    const saved = localStorage.getItem(`meal-template-${templateName}`);
    if (!saved) {
      toast({
        variant: 'destructive',
        description: `Template "${templateName}" is no longer available.`,
      });
      refreshRecentPinnedTemplates();
      return;
    }

    const request: TemplateBridgePayload = {
      templateName,
      targetWeekStart: getCurrentWeekAnchor(),
      source: 'planner-recent-pinned-strip',
      requestedAt: new Date().toISOString(),
      mergeMode: getTemplateMergePreference(templateName),
    };
    localStorage.setItem('meal-planner-template-bridge-v1', JSON.stringify(request));
    setTemplateBridgeRequest(request);
  };

  const handleChangeRecentPinnedTemplateMergePreference = (templateName: string, mergeMode: TemplateMergeMode) => {
    setTemplateMergePreference(templateName, mergeMode);
    setRecentPinnedTemplates((prev) => {
      const nextItems = prev.map((item) => (item.templateName === templateName ? { ...item, mergeMode } : item));
      localStorage.setItem(RECENT_PINNED_TEMPLATE_STORAGE_KEY, JSON.stringify(nextItems));
      return nextItems;
    });
  };

  const formatRecentTemplateDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'recently';
    return parsed.toLocaleDateString();
  };

  const handleAIRecipe = () => {
    setShowAIRecipeModal(true);
    loadAIRecipeSuggestions();
  };

  const handleUsePantry = () => {
    setShowPantryModal(true);
  };

  const checkPantryFirst = async () => {
    try {
      const response = await fetch('/api/meal-planner/grocery-list/check-pantry', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to check pantry');
      }

      const data = await response.json();

      toast({
        description: `✅ Checked pantry! Found ${data.matched} items you already have.`,
      });

      // Refresh the grocery list to show updated items
      await fetchGroceryList();
    } catch (error) {
      console.error('Error checking pantry:', error);
      toast({
        variant: "destructive",
        description: "Failed to check pantry",
      });
    }
  };

  const fetchFamilyMembers = async () => {
    try {
      const response = await fetch('/api/allergies/family-members', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch family members');
      }

      const data = await response.json();
      setFamilyMembers(data.members || []);
      return data.members || [];
    } catch (error) {
      console.error('Error fetching family members:', error);
      toast({
        variant: "destructive",
        description: "Failed to fetch family members",
      });
      return [];
    }
  };

  const shareWithFamily = async () => {
    try {
      if (groceryList.length === 0) {
        toast({
          variant: "destructive",
          description: "No items in grocery list to share",
        });
        return;
      }

      // Fetch family members
      const members = await fetchFamilyMembers();

      if (members.length === 0) {
        toast({
          title: "No family members found",
          description: "Add family members in the Allergies section first to share your grocery list.",
        });
        return;
      }

      // Show the share dialog
      setShowShareFamilyModal(true);
    } catch (error) {
      console.error('Error in shareWithFamily:', error);
      toast({
        variant: "destructive",
        description: "Failed to open share dialog",
      });
    }
  };

  const copyGroceryListToClipboard = async () => {
    try {
      const itemsToExport = toGroceryExportItems(groceryList);

      const textContent = await exportText(itemsToExport);
      await navigator.clipboard.writeText(textContent);

      toast({
        description: "✅ Grocery list copied to clipboard!",
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        variant: "destructive",
        description: "Failed to copy to clipboard",
      });
    }
  };

  const handleLoadTemplate = () => {
    setShowLoadTemplateModal(true);
  };

  const handleAddGroceryItem = async () => {
    const itemName = (document.getElementById('groceryItemName') as HTMLInputElement)?.value;
    const itemAmount = (document.getElementById('groceryItemAmount') as HTMLInputElement)?.value;
    const itemCategory = (document.getElementById('groceryItemCategory') as HTMLSelectElement)?.value;

    if (!itemName) {
      toast({
        variant: "destructive",
        description: "Please enter an item name",
      });
      return;
    }

    try {
      // Parse quantity and unit from amount (e.g., "2 lbs" -> quantity: 2, unit: "lbs")
      let quantity = itemAmount || '1';
      let unit = '';
      const match = itemAmount?.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
      if (match) {
        quantity = match[1];
        unit = match[2];
      }

      const payload = {
        ingredientName: itemName,
        quantity,
        unit,
        category: itemCategory || 'Other',
      };
      console.log('Adding grocery item:', payload);

      const response = await addGroceryListItem(payload);

      if (response.ok) {
        const result = await response.json();
        console.log('Item added successfully:', result);
        toast({
          description: `✅ ${itemName} added to grocery list!`,
        });
        setShowAddGroceryModal(false);
        // Refetch the list to get the new item
        await fetchGroceryList();
      } else {
        const errorText = await response.text();
        console.error('Failed to add item:', response.status, errorText);
        throw new Error('Failed to add item');
      }
    } catch (error) {
      console.error('Error adding grocery item:', error);
      toast({
        variant: "destructive",
        description: "Failed to add item to grocery list",
      });
    }
  };

  const handleScanBarcode = async (barcode: string) => {
    console.log('Barcode scanned:', barcode);

    toast({
      title: 'Barcode scanned',
      description: 'Looking up product...',
    });

    try {
      // Look up product from barcode
      const res = await fetch(`/api/lookup/${barcode}`);

      let productData = null;
      if (res.ok) {
        productData = await res.json();
      }

      if (productData && productData.name) {
        // Add to grocery list via API
        const payload = {
          ingredientName: productData.name,
          quantity: productData.quantity || '1',
          unit: productData.unit || '',
          category: productData.category || 'Other',
          notes: productData.brand ? `Brand: ${productData.brand}` : undefined,
        };
        console.log('Adding scanned product to grocery list:', payload);

        const response = await addGroceryListItem(payload);

        if (response.ok) {
          const result = await response.json();
          console.log('Scanned item added successfully:', result);
          setShowScanModal(false);
          toast({
            description: `📷 Scanned: ${productData.name} added to grocery list!`,
          });
          // Refetch the list to get the new item
          await fetchGroceryList();
        } else {
          const errorText = await response.text();
          console.error('Failed to add scanned item:', response.status, errorText);
          throw new Error('Failed to add item');
        }
      } else {
        setShowScanModal(false);
        toast({
          variant: "destructive",
          title: "Product not found",
          description: `Barcode ${barcode} not found in database`,
        });
      }
    } catch (error) {
      console.error('Error scanning barcode:', error);
      setShowScanModal(false);
      toast({
        variant: "destructive",
        description: "Failed to add scanned item to grocery list",
      });
    }
  };


  const applyNutrition = (nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number; servingSize: string }, qty?: number) => {
    const q = qty ?? 1;
    setBaseNutrition(nutrition);
    setMealForm(prev => ({
      ...prev,
      calories: String(Math.round(nutrition.calories * q)),
      protein: String(Math.round(nutrition.protein * q)),
      carbs: String(Math.round(nutrition.carbs * q)),
      fat: String(Math.round(nutrition.fat * q)),
      fiber: String(Math.round(nutrition.fiber * q)),
      servingSize: nutrition.servingSize || prev.servingSize,
      servingQty: q,
    }));
  };

  const changeServingQty = (qty: number) => {
    if (baseNutrition) {
      setMealForm(prev => ({
        ...prev,
        calories: String(Math.round(baseNutrition.calories * qty)),
        protein: String(Math.round(baseNutrition.protein * qty)),
        carbs: String(Math.round(baseNutrition.carbs * qty)),
        fat: String(Math.round(baseNutrition.fat * qty)),
        fiber: String(Math.round(baseNutrition.fiber * qty)),
        servingQty: qty,
      }));
    } else {
      // No base yet — just store the qty; user can still type macros manually
      setMealForm(prev => ({ ...prev, servingQty: qty }));
    }
  };

  // ── AI Nutrition Lookup ───────────────────────────────────────────────────
  // Fills fields IMMEDIATELY from built-in table (no network needed).
  // Then silently asks the server AI to refine if OpenAI key is configured.
  const lookupNutritionWithAI = async () => {
    if (!mealForm.name.trim()) {
      toast({ variant: 'destructive', description: 'Enter a meal name first.' });
      return;
    }
    setIsLookingUpNutrition(true);

    // Fill instantly from built-in database
    const clientResult = clientSideNutritionLookup(mealForm.name);
    applyNutrition(clientResult);
    toast({ description: '\u2728 Nutrition filled in \u2014 adjust any values as needed.' });
    setIsLookingUpNutrition(false);

    // Silently try the AI in background to refine accuracy (optional enhancement)
    try {
      const res = await fetch('/api/meal-planner/ai/nutrition-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mealName: mealForm.name, servingSize: mealForm.servingSize || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.calories === 'number' && data.calories > 0) {
          applyNutrition({ ...clientResult, ...data });
        }
      }
    } catch {
      // Silent fail — client-side data already showing, no action needed
    }
  };

  const loadAIRecipeSuggestions = async () => {
    setIsLoadingAiRecipes(true);
    setAiRecipes([]);
    try {
      const res = await fetch('/api/meal-planner/ai/recipe-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mealType: selectedMealSlot?.type,
          calorieGoal: nutritionGoals?.dailyCalorieGoal,
          count: 4,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setAiRecipes(data.recipes || []);
    } catch (err) {
      console.error(err);
      // Use fallback hardcoded recipes
      setAiRecipes([
        { name: 'High-Protein Chicken Bowl', calories: 520, protein: 45, carbs: 42, fat: 18, description: 'Grilled chicken with quinoa, roasted vegetables, and tahini dressing', prepTime: '25 min', difficulty: 'Easy', tags: ['High Protein'] },
        { name: 'Mediterranean Salmon', calories: 480, protein: 38, carbs: 35, fat: 22, description: 'Baked salmon with Greek salad and whole grain pita', prepTime: '20 min', difficulty: 'Medium', tags: ['Omega-3'] },
        { name: 'Turkey & Sweet Potato', calories: 450, protein: 42, carbs: 48, fat: 12, description: 'Lean ground turkey with roasted sweet potato and green beans', prepTime: '30 min', difficulty: 'Easy', tags: ['Low Fat'] },
      ]);
    } finally {
      setIsLoadingAiRecipes(false);
    }
  };

  const toggleMealHistoryFavorite = async (meal: any) => {
    await fetch('/api/meal-planner/history/favorite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mealName: meal.name, isFavorite: !meal.isFavorite }),
    });
    fetchMealHistory();
  };

  const handleAddMealFromModal = () => {
    if (!mealForm.name || !mealForm.calories || !mealForm.protein) {
      toast({ variant: 'destructive', description: 'Please fill in meal name, calories, and protein.' });
      return;
    }
    const qtyLabel = mealForm.servingQty !== 1 ? ` (×${mealForm.servingQty})` : '';
    saveMealToSlot({
      name: mealForm.name + qtyLabel,
      calories: Number(mealForm.calories),
      protein: Number(mealForm.protein),
      carbs: Number(mealForm.carbs) || 0,
      fat: Number(mealForm.fat) || 0,
      fiber: Number(mealForm.fiber) || 0,
      servingSize: `${mealForm.servingQty === 1 ? '' : mealForm.servingQty + ' × '}${mealForm.servingSize || '1 serving'}`.trim(),
    });
    resetAddMealModalState();
  };

  const handleAddAIRecipe = (recipe: any) => {
    if (selectedMealSlot) {
      saveMealToSlot({ name: recipe.name, calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs, fat: recipe.fat });
    } else {
      toast({ description: `✅ ${recipe.name} saved!` });
    }
    setShowAIRecipeModal(false);
  };

  const updatePrepSchedule = (value: string) => {
    setPrepSession((prev) => ({
      ...prev,
      scheduledAt: value,
      completedAt: value ? prev.completedAt : null,
    }));
  };

  const updatePrepNotes = (value: string) => {
    setPrepSession((prev) => ({
      ...prev,
      notes: value,
    }));
  };

  const togglePrepTask = (taskId: string) => {
    setPrepSession((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.id === taskId ? { ...task, done: !task.done } : task),
      carryoverTaskIds: prev.tasks.find((task) => task.id === taskId)?.done
        ? [...new Set([...prev.carryoverTaskIds, taskId])]
        : prev.carryoverTaskIds.filter((id) => id !== taskId),
      completedAt: prev.completedAt,
    }));
  };

  const togglePrepBlocker = (blockerId: string) => {
    setPrepSession((prev) => ({
      ...prev,
      blockers: prev.blockers.map((blocker) => blocker.id === blockerId ? { ...blocker, active: !blocker.active } : blocker),
      completedAt: null,
    }));
  };

  const updatePrepBlockerNote = (value: string) => {
    setPrepSession((prev) => ({
      ...prev,
      blockerNote: value,
    }));
  };

  const resolvePrepGroceryBlockers = () => {
    setPrepSession((prev) => ({
      ...prev,
      blockers: prev.blockers.map((blocker) => (
        GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id)
          ? { ...blocker, active: false }
          : blocker
      )),
      completedAt: null,
    }));
  };

  const resolvePrepBlockersFromTrackedSuggestions = () => {
    setPrepSession((prev) => {
      const hasActiveLinkedBlocker = prev.blockers.some(
        (blocker) => blocker.active && GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id),
      );

      if (!hasActiveLinkedBlocker) {
        return prev;
      }

      return {
        ...prev,
        blockers: prev.blockers.map((blocker) => (
          GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id)
            ? { ...blocker, active: false }
            : blocker
        )),
        completedAt: null,
      };
    });
    toast({
      description: 'Resolved grocery-linked prep blockers from completed blocker suggestions.',
    });
  };

  const carryForwardUnfinishedPrepTasks = () => {
    const unfinishedTaskIds = prepSession.tasks.filter((task) => !task.done).map((task) => task.id);

    if (unfinishedTaskIds.length === 0) {
      toast({
        description: 'No unfinished prep tasks to carry forward.',
      });
      return;
    }

    const nextWeekDate = parseDateOnly(getCurrentWeekAnchor());
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekAnchor = formatLocalDate(nextWeekDate);

    try {
      const nextWeekStorageKey = getPrepSessionStorageKeyForAnchor(nextWeekAnchor);
      const stored = localStorage.getItem(nextWeekStorageKey);
      const parsed = stored ? JSON.parse(stored) : {};
      const nextWeekSession = normalizePrepSession(parsed);
      const mergedCarryoverIds = [...new Set([...nextWeekSession.carryoverTaskIds, ...unfinishedTaskIds])];

      localStorage.setItem(nextWeekStorageKey, JSON.stringify({
        ...nextWeekSession,
        carryoverTaskIds: mergedCarryoverIds,
      }));

      setPrepSession((prev) => ({
        ...prev,
        carryoverTaskIds: [...new Set([...prev.carryoverTaskIds, ...unfinishedTaskIds])],
      }));

      toast({
        description: `Carried ${unfinishedTaskIds.length} unfinished prep tasks to next week.`,
      });
    } catch (error) {
      console.error('Error carrying prep tasks forward:', error);
      toast({
        variant: 'destructive',
        description: 'Unable to carry forward prep tasks right now.',
      });
    }
  };

  const markPrepComplete = () => {
    setPrepSession((prev) => ({
      ...prev,
      completedAt: formatLocalDate(new Date()),
    }));
    toast({
      description: 'Prep session marked complete. Your readiness checklist is now execution-aware.',
    });
  };

  const resetPrepCompletion = () => {
    setPrepSession((prev) => ({
      ...prev,
      completedAt: null,
    }));
  };

  const PremiumUpgrade = () => (
    <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white rounded-xl shadow-2xl overflow-hidden">
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center mb-2">
              <Crown className="w-8 h-8 mr-3" />
              <h2 className="text-3xl font-bold">Nutrition Premium</h2>
            </div>
            <p className="text-orange-100 text-lg">Unlock advanced meal planning & nutrition tracking</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">$9.99</div>
            <div className="text-sm text-orange-100">per month</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <FeatureItem icon={<CalendarDays />} text="Weekly & Monthly Meal Planning" />
          <FeatureItem icon={<ShoppingCart />} text="Auto-Generate Grocery Lists" />
          <FeatureItem icon={<BarChart3 />} text="Advanced Macro Tracking & Charts" />
          <FeatureItem icon={<Zap />} text="AI Recipe Suggestions" />
          <FeatureItem icon={<Clock />} text="Meal Prep Scheduling" />
          <FeatureItem icon={<Package />} text="Pantry Integration" />
          <FeatureItem icon={<ListChecks />} text="Shopping List by Aisle" />
          <FeatureItem icon={<Save />} text="Custom Meal Templates" />
          <FeatureItem icon={<TrendingUp />} text="Progress Analytics & Insights" />
          <FeatureItem icon={<Target />} text="Personalized Nutrition Goals" />
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <Button
            size="lg"
            className="flex-1 bg-white text-orange-600 hover:bg-orange-50 font-semibold text-lg h-14"
            onClick={startNutritionTrial}
          >
            Start 30-Day Free Trial
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1 border-2 border-white bg-white/20 text-white hover:bg-white hover:text-orange-600 font-semibold text-lg h-14"
          >
            Learn More
          </Button>
        </div>
        <p className="text-center text-sm text-orange-100 mt-4">No credit card required • Cancel anytime</p>
      </div>
    </div>
  );

  const FeatureItem = ({ icon, text }) => (
    <div className="flex items-center space-x-2 text-white">
      <div className="w-5 h-5">{icon}</div>
      <span className="text-sm font-medium">{text}</span>
    </div>
  );

  const calorieGoal = nutritionGoals?.dailyCalorieGoal || 2000;
  const macroGoals = nutritionGoals?.macroGoals || { protein: 150, carbs: 200, fat: 65 };
  const caloriesCurrent = dailyNutrition?.calories || 0;
  const proteinCurrent = dailyNutrition?.protein || 0;
  const carbsCurrent = dailyNutrition?.carbs || 0;
  const fatCurrent = dailyNutrition?.fat || 0;
  const calorieProgress = Math.min(100, Math.round((caloriesCurrent / calorieGoal) * 100));
  const remainingCalories = Math.max(0, calorieGoal - caloriesCurrent);
  const plannedSlots = weekDays.reduce((sum, day) => sum + mealTypes.filter((type) => {
    const val = weeklyMeals?.[day]?.[type];
    return Array.isArray(val) ? val.length > 0 : Boolean(val);
  }).length, 0);
  const totalSlots = weekDays.length * mealTypes.length;
  const unplannedDays = weekDays.filter((day) => !mealTypes.some((type) => {
    const val = weeklyMeals?.[day]?.[type];
    return Array.isArray(val) ? val.length > 0 : Boolean(val);
  }));
  const groceryPendingCount = groceryList.filter((item: any) => !item.checked && !item.isPantryItem).length;
  const groceryCompletedCount = groceryList.filter((item: any) => item.checked && !item.isPantryItem).length;
  const groceryBuyItemCount = groceryList.filter((item: any) => !item.isPantryItem).length;
  const groceryListCreated = groceryList.length > 0;
  const unplannedMealSlots = Math.max(0, totalSlots - plannedSlots);
  const prepSessionPlanned = Boolean(prepSession.scheduledAt);
  const prepSessionCompleted = Boolean(prepSession.completedAt);
  const prepProgress = Math.round((prepSession.tasks.filter((task) => task.done).length / Math.max(1, prepSession.tasks.length)) * 100);
  const prepRecommendationsAvailable = plannedSlots > 0;
  const prepPlanMissing = plannedSlots > 0 && !prepSessionPlanned && !prepSessionCompleted;
  const prepActiveBlockersCount = prepSession.blockers.filter((blocker) => blocker.active).length;
  const prepGroceryBlockersCount = prepSession.blockers.filter(
    (blocker) => blocker.active && GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id),
  ).length;
  const blockerItemSuggestions = useMemo<BlockerItemSuggestion[]>(() => {
    if (prepGroceryBlockersCount === 0) {
      return [];
    }

    const activeGroceryBlockers = prepSession.blockers.filter(
      (blocker) => blocker.active && GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id),
    );
    const existingItemNames = new Set(
      groceryList
        .map((item: any) => String(item?.name || item?.item || '').trim().toLowerCase())
        .filter(Boolean),
    );

    const noteCandidates = prepSession.blockerNote
      .split(/[\n,;|]/)
      .flatMap((part) => part.split(/\band\b/i))
      .map((part) => part.trim())
      .filter((part) => part.length > 1)
      .map((part) => part.replace(/^[\-\d.)\s]+/, '').replace(/\s{2,}/g, ' '))
      .filter((part) => {
        const normalized = part.toLowerCase();
        return normalized.length > 2 && !BLOCKER_NOTE_STOP_WORDS.has(normalized);
      });

    const suggestionRows: Array<{ name: string; category: string; reason: string }> = [];

    noteCandidates.forEach((candidate) => {
      suggestionRows.push({
        name: candidate,
        category: 'From Recipe',
        reason: 'from prep blocker note',
      });
    });

    activeGroceryBlockers.forEach((blocker) => {
      const seedItems = BLOCKER_SUGGESTION_SEEDS_BY_ID[blocker.id] || [];
      seedItems.forEach((seed) => {
        suggestionRows.push({
          name: seed,
          category: BLOCKER_SUGGESTION_CATEGORY_BY_ID[blocker.id] || 'Other',
          reason: blocker.label.toLowerCase(),
        });
      });
    });

    const uniqueByName = new Map<string, { name: string; category: string; reason: string }>();
    suggestionRows.forEach((row) => {
      const normalized = row.name.trim().toLowerCase();
      if (!normalized) return;
      if (!uniqueByName.has(normalized)) {
        uniqueByName.set(normalized, row);
      }
    });

    return Array.from(uniqueByName.values())
      .slice(0, 6)
      .map((row) => {
        const normalizedName = row.name.trim().toLowerCase();
        return {
          id: normalizedName.replace(/[^a-z0-9]+/g, '-'),
          name: row.name,
          category: row.category,
          reason: row.reason,
          alreadyOnList: existingItemNames.has(normalizedName),
        };
      });
  }, [groceryList, prepGroceryBlockersCount, prepSession.blockerNote, prepSession.blockers]);
  const blockerSuggestionResolution = useMemo(() => {
    const trackedByName = new Map<string, BlockerSuggestionResolutionLink>();
    prepSession.blockerSuggestionLinks.forEach((link) => {
      const normalized = link.name.trim().toLowerCase();
      if (!normalized || trackedByName.has(normalized)) {
        return;
      }
      trackedByName.set(normalized, link);
    });

    if (trackedByName.size === 0) {
      return {
        tracked: [] as Array<BlockerSuggestionResolutionLink & { resolved: boolean }>,
        trackedCount: 0,
        resolvedCount: 0,
        unresolvedNames: [] as string[],
      };
    }

    const groceryNameStatus = new Map<string, boolean>();
    groceryList.forEach((item: any) => {
      if (item?.isPantryItem) {
        return;
      }
      const normalized = String(item?.name || item?.item || '').trim().toLowerCase();
      if (!normalized) {
        return;
      }
      const existing = groceryNameStatus.get(normalized) || false;
      groceryNameStatus.set(normalized, existing || Boolean(item?.checked));
    });

    const tracked = Array.from(trackedByName.entries()).map(([normalizedName, link]) => ({
      ...link,
      resolved: Boolean(groceryNameStatus.get(normalizedName)),
    }));
    const resolvedCount = tracked.filter((link) => link.resolved).length;
    const unresolvedNames = tracked.filter((link) => !link.resolved).map((link) => link.name);

    return {
      tracked,
      trackedCount: tracked.length,
      resolvedCount,
      unresolvedNames,
    };
  }, [groceryList, prepSession.blockerSuggestionLinks]);
  const blockerSuggestionConfidenceLabel = blockerSuggestionResolution.trackedCount === 0
    ? 'Not started'
    : blockerSuggestionResolution.resolvedCount === blockerSuggestionResolution.trackedCount
      ? 'High'
      : blockerSuggestionResolution.resolvedCount > 0
        ? 'Medium'
        : 'Low';
  const resolvedTrackedSuggestionNames = blockerSuggestionResolution.tracked
    .filter((link) => link.resolved)
    .map((link) => link.name);
  const canResolvePrepGroceryBlockersFromSuggestions = prepGroceryBlockersCount > 0
    && blockerSuggestionResolution.trackedCount > 0
    && blockerSuggestionResolution.resolvedCount === blockerSuggestionResolution.trackedCount;
  const prepResolvedViaTrackedSuggestions = prepGroceryBlockersCount === 0
    && blockerSuggestionResolution.trackedCount > 0
    && blockerSuggestionResolution.resolvedCount === blockerSuggestionResolution.trackedCount;
  const prepCarryoverCount = prepSession.carryoverTaskIds.filter((taskId) => prepSession.tasks.some((task) => task.id === taskId && !task.done)).length;
  const prepExecutionState = !prepSessionPlanned
    ? 'not_planned'
    : prepSessionCompleted
      ? 'complete'
      : prepActiveBlockersCount > 0
        ? 'blocked'
        : prepProgress > 0
          ? 'in_progress'
          : 'in_progress';
  const prepReadyForWeek = prepSessionCompleted || (prepSessionPlanned && prepActiveBlockersCount === 0);
  const weekReadyNow = plannedSlots === totalSlots && (groceryBuyItemCount === 0 || groceryPendingCount === 0) && prepReadyForWeek;
  const canResolvePrepGroceryBlockers = prepGroceryBlockersCount > 0 && groceryListCreated && groceryPendingCount === 0;
  const rawSavingsSummary = savingsReport?.summary || {};
  const rawSavingsPantry = savingsReport?.pantry || {};
  const safeTopSavingCategories = Array.isArray(savingsReport?.topSavingCategories)
    ? savingsReport.topSavingCategories
    : [];
  const normalizedSavingsReport = savingsReport
    ? {
        totalSaved: Number(rawSavingsSummary.totalSaved || 0),
        savingsRate: rawSavingsSummary.savingsRate || '0%',
        pantrySavings: Number(rawSavingsPantry.savings || 0),
        pantryItemCount: Number(rawSavingsPantry.itemCount || 0),
        topSavingCategories: safeTopSavingCategories,
      }
    : null;

  useEffect(() => {
    if (!canResolvePrepGroceryBlockers && !canResolvePrepGroceryBlockersFromSuggestions) {
      return;
    }

    setPrepSession((prev) => {
      const hasActiveLinkedBlocker = prev.blockers.some(
        (blocker) => blocker.active && GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id),
      );

      if (!hasActiveLinkedBlocker) {
        return prev;
      }

      return {
        ...prev,
        blockers: prev.blockers.map((blocker) => (
          GROCERY_LINKED_PREP_BLOCKER_IDS.includes(blocker.id)
            ? { ...blocker, active: false }
            : blocker
        )),
      };
    });
  }, [canResolvePrepGroceryBlockers, canResolvePrepGroceryBlockersFromSuggestions]);

  const weeklyNutritionData = weekDays.map((day) => {
    const totals = mealTypes.reduce((acc, type) => {
      const slotTotals = getMealSlotTotals(weeklyMeals, day, type);
      const slotItems = getMealSlotItems(weeklyMeals, day, type);
      return {
        calories: acc.calories + slotTotals.calories,
        protein: acc.protein + slotTotals.protein,
        carbs: acc.carbs + slotTotals.carbs,
        fat: acc.fat + slotTotals.fat,
        mealsLogged: acc.mealsLogged + slotItems.length,
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, mealsLogged: 0 });

    return {
      day,
      shortDay: day.slice(0, 3),
      ...totals,
      calorieGoal,
      proteinGoal: macroGoals.protein,
      hydrationPct: Math.round(((water.glassesLogged || 0) / Math.max(1, water.dailyTarget || 8)) * 100),
    };
  });

  const hasWeeklyNutritionData = weeklyNutritionData.some((day) => day.mealsLogged > 0 || day.calories > 0);

  const weeklyMacroTotals = weeklyNutritionData.reduce((acc, day) => ({
    protein: acc.protein + day.protein,
    carbs: acc.carbs + day.carbs,
    fat: acc.fat + day.fat,
  }), { protein: 0, carbs: 0, fat: 0 });

  const proteinCals = weeklyMacroTotals.protein * 4;
  const carbCals = weeklyMacroTotals.carbs * 4;
  const fatCals = weeklyMacroTotals.fat * 9;
  const totalMacroCalories = proteinCals + carbCals + fatCals;

  const macroDistributionData = totalMacroCalories > 0 ? [
    { name: 'Protein', grams: weeklyMacroTotals.protein, calories: proteinCals, percent: Math.round((proteinCals / totalMacroCalories) * 100), color: '#3b82f6' },
    { name: 'Carbs', grams: weeklyMacroTotals.carbs, calories: carbCals, percent: Math.round((carbCals / totalMacroCalories) * 100), color: '#22c55e' },
    { name: 'Fat', grams: weeklyMacroTotals.fat, calories: fatCals, percent: Math.round((fatCals / totalMacroCalories) * 100), color: '#f59e0b' },
  ] : [];

  const metricsTrendData = weeklyNutritionData.map((day) => ({
    day: day.shortDay,
    calories: Math.round(day.calories),
    calorieGoal,
    protein: Math.round(day.protein),
    proteinGoal: macroGoals.protein,
  }));

  const weeklyTotals = weeklyNutritionData.reduce((acc, day) => ({
    calories: acc.calories + day.calories,
    protein: acc.protein + day.protein,
    mealsLogged: acc.mealsLogged + day.mealsLogged,
  }), { calories: 0, protein: 0, mealsLogged: 0 });
  const activeDays = weeklyNutritionData.filter((day) => day.mealsLogged > 0).length;
  const avgCalories = activeDays > 0 ? Math.round(weeklyTotals.calories / activeDays) : 0;
  const avgProtein = activeDays > 0 ? Math.round(weeklyTotals.protein / activeDays) : 0;
  const calorieGoalHitDays = weeklyNutritionData.filter((day) => day.calories >= calorieGoal * 0.9 && day.calories <= calorieGoal * 1.1).length;
  const proteinGoalHitDays = weeklyNutritionData.filter((day) => day.protein >= macroGoals.protein).length;
  const latestBodyMetric = bodyMetricsLog.length > 0 ? bodyMetricsLog[bodyMetricsLog.length - 1] : null;
  const firstBodyMetric = bodyMetricsLog.length > 0 ? bodyMetricsLog[0] : null;
  const bodyWeightDelta = latestBodyMetric && firstBodyMetric
    ? Number(latestBodyMetric.weightLbs || 0) - Number(firstBodyMetric.weightLbs || 0)
    : 0;
  const hydrationPct = Math.round(((water.glassesLogged || 0) / Math.max(1, water.dailyTarget || 8)) * 100);
  const weeklyMealsCount = weeklyNutritionData.reduce((sum, day) => sum + day.mealsLogged, 0);
  const visibilitySummaryLabel = shareVisibility === 'private'
    ? 'Private (only you)'
    : shareVisibility === 'friends'
      ? 'Friends'
      : 'Public';
  const weekLabel = weekRange?.weekStart && weekRange?.weekEnd
    ? `${weekRange.weekStart} to ${weekRange.weekEnd}`
    : `${getCurrentWeekAnchor()} week`;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicShareUrl = sharePublicToken
    ? `${origin}/meal-planner/shared/${sharePublicToken}`
    : '';
  const weeklyShareSummaryText = useMemo(() => {
    const lines = [
      `Chefsire Meal Plan • Week of ${weekLabel}`,
      `Visibility: ${visibilitySummaryLabel}`,
      '',
      `Planning coverage: ${plannedSlots}/${totalSlots} meal slots planned (${Math.round((plannedSlots / Math.max(1, totalSlots)) * 100)}%)`,
      `Meals planned: ${weeklyMealsCount}`,
      `Readiness: ${weekReadyNow ? 'Week ready ✅' : 'In progress'}`,
      `Grocery progress: ${groceryCompletedCount}/${Math.max(1, groceryBuyItemCount)} purchased`,
      `Prep progress: ${prepProgress}% (${prepSession.tasks.filter((task) => task.done).length}/${prepSession.tasks.length} tasks complete)`,
      `Prep blockers: ${prepActiveBlockersCount}`,
      '',
      'Nutrition highlights:',
      `• Avg calories/day: ${avgCalories} (goal: ${calorieGoal})`,
      `• Avg protein/day: ${avgProtein}g (goal: ${macroGoals.protein || 150}g)`,
      `• Protein goal hit days: ${proteinGoalHitDays}/7`,
      `• Hydration today: ${water.glassesLogged}/${water.dailyTarget} glasses (${hydrationPct}%)`,
    ];

    return lines.join('\n');
  }, [
    weekLabel,
    visibilitySummaryLabel,
    plannedSlots,
    totalSlots,
    weeklyMealsCount,
    weekReadyNow,
    groceryCompletedCount,
    groceryBuyItemCount,
    prepProgress,
    prepSession.tasks,
    prepActiveBlockersCount,
    avgCalories,
    calorieGoal,
    avgProtein,
    macroGoals.protein,
    proteinGoalHitDays,
    water.glassesLogged,
    water.dailyTarget,
    hydrationPct,
  ]);

  const computedInsights = [
    {
      icon: <Flame className="w-6 h-6 text-orange-500" />,
      title: calorieGoalHitDays > 0 ? `${calorieGoalHitDays} balanced day${calorieGoalHitDays === 1 ? '' : 's'}` : 'Calorie pacing in progress',
      description: calorieGoalHitDays > 0
        ? `You stayed within ±10% of your ${calorieGoal} kcal target on ${calorieGoalHitDays}/7 days.`
        : `Average intake is ${avgCalories || 0} kcal. Keep logging meals to dial in your weekly target.`,
      trend: calorieGoalHitDays >= 4 ? 'positive' : 'neutral',
    },
    {
      icon: <Target className="w-6 h-6 text-blue-500" />,
      title: proteinGoalHitDays > 0 ? `Protein target hit ${proteinGoalHitDays}/7 days` : 'Protein target opportunity',
      description: proteinGoalHitDays > 0
        ? `You're averaging ${avgProtein}g protein/day against a ${macroGoals.protein}g goal.`
        : `Average protein is ${avgProtein}g/day. Add lean protein to breakfast or snacks for an easier boost.`,
      trend: proteinGoalHitDays >= 4 ? 'positive' : 'neutral',
    },
    {
      icon: <Droplets className="w-6 h-6 text-cyan-500" />,
      title: hydrationPct >= 100 ? 'Hydration goal complete' : `${water.glassesLogged}/${water.dailyTarget} glasses today`,
      description: latestBodyMetric
        ? `Hydration is ${hydrationPct}% of target. Body weight trend: ${bodyWeightDelta > 0 ? '+' : ''}${bodyWeightDelta.toFixed(1)} lbs across your log history.`
        : `Hydration is ${hydrationPct}% of target. Add body metrics entries to unlock trend correlations.`,
      trend: hydrationPct >= 80 ? 'positive' : 'neutral',
    },
  ];

  const copyWeeklyShareSummary = async () => {
    try {
      await navigator.clipboard.writeText(weeklyShareSummaryText);
      toast({
        description: '✅ Weekly plan share summary copied to clipboard.',
      });
    } catch (error) {
      console.error('Error copying weekly share summary:', error);
      toast({
        variant: 'destructive',
        description: 'Unable to copy summary right now.',
      });
    }
  };

  const shareWeeklySummary = async () => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      await copyWeeklyShareSummary();
      return;
    }

    try {
      await navigator.share({
        title: `Meal plan summary • ${weekLabel}`,
        text: weeklyShareSummaryText,
      });
      toast({
        description: 'Shared weekly meal plan summary.',
      });
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error sharing weekly summary:', error);
        await copyWeeklyShareSummary();
      }
    }
  };

  const copyWeeklyPublicShareLink = async () => {
    if (!publicShareUrl) {
      toast({
        variant: 'destructive',
        description: 'Public share link is still preparing. Try again in a moment.',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(publicShareUrl);
      toast({
        description: '✅ Public weekly share link copied to clipboard.',
      });
    } catch (error) {
      console.error('Error copying weekly public share link:', error);
      toast({
        variant: 'destructive',
        description: 'Unable to copy the public share link right now.',
      });
    }
  };


  const calculateGoals = () => {
    const weightKg = calcForm.weightUnit === 'kg' ? Number(calcForm.weight) : Number(calcForm.weight) * 0.453592;
    const weightLbs = calcForm.weightUnit === 'lbs' ? Number(calcForm.weight) : Number(calcForm.weight) * 2.20462;
    const heightCm = calcForm.heightUnit === 'cm' ? Number(calcForm.cm) : (Number(calcForm.feet) * 12 + Number(calcForm.inches)) * 2.54;
    const age = Number(calcForm.age);

    const bmr = calcForm.gender === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

    const activityMap: Record<string, number> = {
      'sedentary': 1.2,
      'lightly active': 1.375,
      'moderately active': 1.55,
      'very active': 1.725,
      'extra active': 1.9,
    };

    const tdee = bmr * (activityMap[calcForm.activity] || 1.55);
    const targetCalories = calcForm.goal === 'lose weight' ? tdee - 500 : calcForm.goal === 'gain muscle' ? tdee + 300 : tdee;
    const protein = calcForm.goal === 'lose weight' ? weightLbs * 0.8 : weightLbs * 1;
    const carbs = (targetCalories * 0.4) / 4;
    const fat = (targetCalories * 0.3) / 9;

    setCalcResult({ dailyCalorieGoal: Math.round(targetCalories), macroGoals: { protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) } });
  };

  const saveCalculatedGoals = async () => {
    if (!calcResult) return;
    try {
      const response = await fetch('/api/meal-planner/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(calcResult),
      });
      if (!response.ok) throw new Error('failed');
      setNutritionGoals(calcResult);
      setShowCalcModal(false);
      toast({ description: '✅ Goals updated' });
    } catch {
      toast({ variant: 'destructive', description: 'Failed to save goals' });
    }
  };

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">Nutrition & Meal Planning</h1>
            <p className="text-xl text-gray-600">Take control of your health with intelligent meal planning</p>
          </div>

          <div className="mb-12">
            <PremiumUpgrade />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-orange-600" />
                </div>
                <CardTitle>Smart Meal Planning</CardTitle>
                <CardDescription>Plan your weekly meals with drag-and-drop simplicity</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Visual weekly/monthly calendar</li>
                  <li>• Recipe integration</li>
                  <li>• Meal templates</li>
                  <li>• Batch cooking planner</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle>Nutrition Tracking</CardTitle>
                <CardDescription>Track macros and hit your goals consistently</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Real-time macro tracking</li>
                  <li>• Visual progress charts</li>
                  <li>• Goal recommendations</li>
                  <li>• Weekly analytics</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle>Grocery Lists</CardTitle>
                <CardDescription>Auto-generate shopping lists from your meal plan</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• One-click generation</li>
                  <li>• Organized by aisle</li>
                  <li>• Pantry integration</li>
                  <li>• Share with family</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Still Not Sure?</CardTitle>
              <CardDescription className="text-base">See what our users are saying</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Testimonial
                  name="Sarah M."
                  text="Game changer for meal prep! Saved me hours every week."
                  rating={5}
                />
                <Testimonial
                  name="Mike R."
                  text="Hit my protein goals consistently for the first time ever."
                  rating={5}
                />
                <Testimonial
                  name="Jessica L."
                  text="The grocery list feature alone is worth the subscription."
                  rating={5}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Premium User View
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Nutrition & Meal Planning</h1>
            <p className="text-gray-600">Plan smarter, eat better, reach your goals</p>
            <p className="text-sm text-orange-600 mt-1 font-medium">
              <Flame className="w-4 h-4 inline mr-1" />
              {streak.currentStreak > 0 ? `🔥 ${streak.currentStreak} day streak` : 'Start your streak today.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 px-3 py-1">
              <Crown className="w-4 h-4 mr-1 inline" />
              Premium Active
            </Badge>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/settings'}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8 h-auto w-full flex flex-wrap gap-2">
            <TabsTrigger value="planner" className="flex-col sm:flex-row gap-1 sm:gap-2 py-3">
              <Calendar className="w-4 h-4" />
              <span className="text-xs sm:text-sm">Planner</span>
            </TabsTrigger>
            <TabsTrigger value="nutrition" className="flex-col sm:flex-row gap-1 sm:gap-2 py-3">
              <Target className="w-4 h-4" />
              <span className="text-xs sm:text-sm">Nutrition</span>
            </TabsTrigger>
            <TabsTrigger value="body" className="flex-col sm:flex-row gap-1 sm:gap-2 py-3">
              <Scale className="w-4 h-4" />
              <span className="text-xs sm:text-sm">Body</span>
            </TabsTrigger>
            <TabsTrigger value="grocery" className="flex-col sm:flex-row gap-1 sm:gap-2 py-3">
              <ShoppingCart className="w-4 h-4" />
              <span className="text-xs sm:text-sm">Grocery</span>
            </TabsTrigger>
            <TabsTrigger value="prep" className="flex-col sm:flex-row gap-1 sm:gap-2 py-3">
              <Clock className="w-4 h-4" />
              <span className="text-xs sm:text-sm hidden sm:inline">Meal Prep</span>
              <span className="text-xs sm:hidden">Prep</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-col sm:flex-row gap-1 sm:gap-2 py-3">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs sm:text-sm hidden sm:inline">Analytics</span>
              <span className="text-xs sm:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex-col sm:flex-row gap-1 sm:gap-2 py-3">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs sm:text-sm">Advanced</span>
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex-col sm:flex-row gap-1 sm:gap-2 py-3">
              <Ruler className="w-4 h-4" />
              <span className="text-xs sm:text-sm">Tools</span>
            </TabsTrigger>
          </TabsList>

          {/* Meal Planner Tab */}
          <TabsContent value="planner">
            <div className="space-y-6">
              {pendingTemplateBridgePreview ? (
                <Card className="border-orange-200 bg-orange-50/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-900">
                      <AlertCircle className="w-5 h-5" />
                      Confirm template apply
                    </CardTitle>
                    <CardDescription className="text-orange-900/80">
                      Review the impact before applying this bridged template to your planner week.
                    </CardDescription>
                    <div>
                      <Badge variant="outline" className={`mt-2 ${pendingTemplateImpactBadge.className}`}>
                        {pendingTemplateImpactBadge.label}
                      </Badge>
                      <p className="mt-1 text-xs text-orange-900/80">{pendingTemplateAppendParityLine}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-orange-200 bg-white p-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Target week</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          Week of {pendingTemplateBridgePreview.targetWeekStart || selectedDate}
                        </p>
                      </div>
                      <div className="rounded-lg border border-orange-200 bg-white p-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Current meals</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{pendingTemplateCurrentWeekMealsCount} planned meals</p>
                      </div>
                      <div className="rounded-lg border border-orange-200 bg-white p-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Template meals</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{pendingTemplateMealsCount} meals in template</p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-orange-200 bg-white p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Merge mode</p>
                      <div className="mt-2 inline-flex rounded-md border border-orange-200 bg-orange-100/50 p-1">
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs font-medium rounded ${pendingTemplateBridgePreview.mergeMode === 'replace' ? 'bg-white text-orange-800 shadow-sm' : 'text-orange-700/80'}`}
                          onClick={() => setPendingTemplateBridgePreview((prev) => (prev ? { ...prev, mergeMode: 'replace' } : prev))}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs font-medium rounded ${pendingTemplateBridgePreview.mergeMode === 'append' ? 'bg-white text-orange-800 shadow-sm' : 'text-orange-700/80'}`}
                          onClick={() => setPendingTemplateBridgePreview((prev) => (prev ? { ...prev, mergeMode: 'append' } : prev))}
                        >
                          Append
                        </button>
                      </div>
                    </div>
                    {pendingTemplateBridgePreview.mergeMode === 'append' ? (
                      <p className="text-sm text-gray-700">
                        Append mode keeps existing meals and only fills empty slots. Estimated meals added: <span className="font-semibold text-emerald-700">{pendingTemplateAppendAddedMeals}</span>.
                      </p>
                    ) : (
                      <p className="text-sm text-gray-700">
                        Applying <span className="font-medium">"{pendingTemplateBridgePreview.templateName}"</span> will replace meals currently planned for this week.
                      </p>
                    )}
                    {pendingTemplateSlotDiffPreview.length > 0 ? (
                      <div className="rounded-lg border border-orange-200 bg-white p-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Slot-level pre-apply diff</p>
                        <div className="space-y-1.5">
                          {pendingTemplateSlotDiffPreview.slice(0, 10).map((slot) => (
                            <div key={slot.key} className="flex items-center justify-between text-xs">
                              <span className="text-gray-700">
                                {slot.day} • {slot.mealType}
                              </span>
                              <span
                                className={`font-medium ${
                                  slot.status === 'replace'
                                    ? 'text-amber-700'
                                    : slot.status === 'add'
                                      ? 'text-emerald-700'
                                      : slot.status === 'skip-existing'
                                        ? 'text-sky-700'
                                        : 'text-gray-500'
                                }`}
                              >
                                {slot.status === 'replace'
                                  ? `Replace ${slot.currentCount} → ${slot.templateCount}`
                                  : slot.status === 'add'
                                    ? `Add ${slot.templateCount}`
                                    : slot.status === 'skip-existing'
                                      ? `Keep current (${slot.currentCount})`
                                      : 'No change'}
                              </span>
                            </div>
                          ))}
                        </div>
                        {pendingTemplateSlotDiffPreview.length > 10 ? (
                          <p className="mt-2 text-[11px] text-gray-500">Showing 10 of {pendingTemplateSlotDiffPreview.length} template-filled slots.</p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleApplyPendingTemplateBridge} className="bg-orange-600 hover:bg-orange-700">
                        Apply Template
                      </Button>
                      <Button variant="outline" onClick={handleCancelPendingTemplateBridge}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
              {recentPinnedTemplates.length > 0 ? (
                <Card className="border-indigo-200 bg-indigo-50/40">
                  <CardHeader>
                    <CardTitle className="text-base text-indigo-900">Recently used pinned templates</CardTitle>
                    <CardDescription className="text-indigo-900/80">
                      Reuse your latest pinned templates quickly. “Use” opens the same pre-apply preview before anything changes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {recentPinnedTemplates.map((template) => (
                      <div key={template.templateName} className="rounded-lg border border-indigo-200 bg-white p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{template.templateName}</p>
                          <p className="text-xs text-gray-500">
                            Last used {formatRecentTemplateDate(template.lastUsedAt)} • Default {template.mergeMode === 'append' ? 'Append' : 'Replace'} mode
                          </p>
                          <p className="mt-1 text-xs text-indigo-800/90">
                            Last result: {template.lastAppliedSummary || 'No recent apply result recorded yet'}
                          </p>
                          <div className="mt-2 inline-flex rounded-md border border-indigo-200 bg-indigo-50 p-1">
                            <button
                              type="button"
                              className={`px-2 py-1 text-[11px] font-medium rounded ${template.mergeMode === 'replace' ? 'bg-white text-indigo-800 shadow-sm' : 'text-indigo-700/80'}`}
                              onClick={() => handleChangeRecentPinnedTemplateMergePreference(template.templateName, 'replace')}
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              className={`px-2 py-1 text-[11px] font-medium rounded ${template.mergeMode === 'append' ? 'bg-white text-indigo-800 shadow-sm' : 'text-indigo-700/80'}`}
                              onClick={() => handleChangeRecentPinnedTemplateMergePreference(template.templateName, 'append')}
                            >
                              Append
                            </button>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleUseRecentPinnedTemplate(template.templateName)}>
                          Use
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
              <WeeklyReadinessChecklist
                unplannedMealSlots={unplannedMealSlots}
                unplannedDaysCount={unplannedDays.length}
                totalSlots={totalSlots}
                groceryListCreated={groceryListCreated}
                groceryPendingCount={groceryPendingCount}
                groceryCompletedCount={groceryCompletedCount}
                prepPlanMissing={prepPlanMissing}
                prepRecommendationsAvailable={prepRecommendationsAvailable}
                prepSessionPlanned={prepSessionPlanned}
                prepSessionCompleted={prepSessionCompleted}
                prepExecutionState={prepExecutionState}
                prepActiveBlockersCount={prepActiveBlockersCount}
                prepGroceryBlockersCount={prepGroceryBlockersCount}
                blockerSuggestionResolvedCount={blockerSuggestionResolution.resolvedCount}
                blockerSuggestionTrackedCount={blockerSuggestionResolution.trackedCount}
                blockerSuggestionConfidenceLabel={blockerSuggestionConfidenceLabel}
                prepCarryoverCount={prepCarryoverCount}
                weekReadyNow={weekReadyNow}
                onGoToPlanner={() => setActiveTab('planner')}
                onGoToGrocery={() => setActiveTab('grocery')}
                onGoToPrep={() => setActiveTab('prep')}
              />
              <PlannerTabSection
                caloriesCurrent={caloriesCurrent}
                calorieGoal={calorieGoal}
                calorieProgress={calorieProgress}
                remainingCalories={remainingCalories}
                proteinCurrent={proteinCurrent}
                carbsCurrent={carbsCurrent}
                fatCurrent={fatCurrent}
                viewMode={viewMode}
                setViewMode={setViewMode}
                generateWeekPlan={generateWeekPlan}
                isGeneratingWeek={isGeneratingWeek}
                saveTemplate={saveTemplate}
                handleAddMeal={handleAddMeal}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                weekRange={weekRange}
                getCurrentWeekAnchor={getCurrentWeekAnchor}
                parseDateOnly={parseDateOnly}
                formatLocalDate={formatLocalDate}
                weekDays={weekDays}
                getDateForWeekday={getDateForWeekday}
                mealTypes={mealTypes}
                weeklyMeals={weeklyMeals}
                getMealSlotItems={getMealSlotItems}
                getMealSlotTotals={getMealSlotTotals}
                gradeClass={gradeClass}
                getNutritionGrade={getNutritionGrade}
                removeMealItem={removeMealItem}
                dayNames={DAY_NAMES}
                handleAIRecipe={handleAIRecipe}
                handleUsePantry={handleUsePantry}
                handleLoadTemplate={handleLoadTemplate}
                plannedSlots={plannedSlots}
                totalSlots={totalSlots}
                unplannedDays={unplannedDays}
                groceryPendingCount={groceryPendingCount}
                groceryCompletedCount={groceryCompletedCount}
                switchToGroceryTab={() => setActiveTab('grocery')}
                switchToPrepTab={() => setActiveTab('prep')}
                switchToAnalyticsTab={() => setActiveTab('analytics')}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-orange-600" />
                    Share This Week
                  </CardTitle>
                  <CardDescription>
                    Prepare a lightweight weekly summary you can keep private now and publish later when friend/public flows are connected.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-2">Visibility</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {([
                        { value: 'private', label: 'Private', help: 'Only you can see this summary.', icon: <Lock className="w-4 h-4" /> },
                        { value: 'friends', label: 'Friends', help: 'Ready for friend-only sharing later.', icon: <Users className="w-4 h-4" /> },
                        { value: 'public', label: 'Public', help: 'Ready for public discovery later.', icon: <Globe className="w-4 h-4" /> },
                      ] as Array<{ value: MealPlanVisibility; label: string; help: string; icon: React.ReactNode }>).map((option) => {
                        const active = shareVisibility === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setShareVisibility(option.value)}
                            className={`text-left border rounded-lg p-3 transition ${active ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}
                          >
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                              {option.icon}
                              {option.label}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">{option.help}</p>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {shareMetadataSaveState === 'saving'
                        ? 'Saving visibility to your account...'
                        : shareMetadataSaveState === 'saved'
                          ? 'Visibility preference saved to your account with local fallback.'
                          : shareMetadataSaveState === 'error'
                            ? 'Could not reach backend; using local fallback on this device.'
                            : 'Visibility preference is currently saved locally for this account on this device.'}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900">Weekly Share Preview</p>
                      <Badge variant="outline">{visibilitySummaryLabel}</Badge>
                    </div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {weeklyShareSummaryText}
                    </pre>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={copyWeeklyShareSummary}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Summary
                    </Button>
                    <Button onClick={shareWeeklySummary}>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share / Export
                    </Button>
                    {shareVisibility === 'public' && (
                      <Button variant="outline" onClick={copyWeeklyPublicShareLink} disabled={!publicShareUrl}>
                        <Globe className="w-4 h-4 mr-2" />
                        Copy Public Link
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => window.location.assign('/meal-planner/shared')}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Browse Public Week Ideas
                    </Button>
                  </div>
                  {shareVisibility === 'public' && (
                    <p className="text-xs text-gray-500">
                      Public link foundation: {publicShareUrl || 'generating secure link token...'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Nutrition Tracking Tab */}
          <TabsContent value="nutrition">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Today's Nutrition</CardTitle>
                    <CardDescription>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Calories</span>
                        <span className="text-sm text-gray-600">{caloriesCurrent} / {calorieGoal}</span>
                      </div>
                      <Progress value={calorieProgress} className="h-2" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <MacroCard label="Protein" current={proteinCurrent} goal={macroGoals.protein || 150} unit="g" color="blue" />
                      <MacroCard label="Carbs" current={carbsCurrent} goal={macroGoals.carbs || 200} unit="g" color="orange" />
                      <MacroCard label="Fat" current={fatCurrent} goal={macroGoals.fat || 65} unit="g" color="purple" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Weekly Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                      <div className="text-center text-gray-500">
                        <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                        <p>{plannedSlots}/{totalSlots} weekly meal slots planned</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Nutrition Goals</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Daily Calories</span>
                      <span className="text-sm font-medium">{calorieGoal} kcal</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Protein</span>
                      <span className="text-sm font-medium">{macroGoals.protein || 150}g</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Carbs</span>
                      <span className="text-sm font-medium">{macroGoals.carbs || 200}g</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Fat</span>
                      <span className="text-sm font-medium">{macroGoals.fat || 65}g</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => setShowCalcModal(true)}>
                      <Target className="w-4 h-4 mr-2" />
                      Calculate My Goals
                    </Button>
                  </CardContent>
                </Card>

                {/* Food Scanner Card */}
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Camera className="w-5 h-5 text-purple-600" />
                      Food Scanner
                    </CardTitle>
                    <CardDescription>Scan food to track calories instantly</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-600">Point your camera at any food item to automatically detect and log nutrition info.</p>
                    <div className="flex flex-col gap-2">
                      <Button
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                        onClick={() => {
                          const input = document.getElementById('food-scanner-camera');
                          if (input) input.click();
                        }}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Scan Food Now
                      </Button>
                      <input
                        id="food-scanner-camera"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // In production, this would call an AI vision API
                            toast({
                              description: "Food scanning detected: Chicken Breast (200g) - 330 calories, 62g protein",
                            });
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          const input = document.getElementById('food-scanner-upload');
                          if (input) input.click();
                        }}
                      >
                        Upload Photo
                      </Button>
                      <input
                        id="food-scanner-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            toast({
                              description: "Food scanning detected: Mixed Salad - 150 calories, 8g protein",
                            });
                          }
                        }}
                      />
                    </div>
                    <div className="bg-white rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-gray-700">Recently Scanned:</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Grilled Chicken</span>
                        <span className="font-medium">330 cal</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Greek Yogurt</span>
                        <span className="font-medium">120 cal</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Tips</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Great protein intake!</p>
                        <p className="text-xs text-gray-600">You're hitting your targets consistently</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Low on vegetables</p>
                        <p className="text-xs text-gray-600">Try adding more greens to lunch</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>


                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Water Intake</CardTitle>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={updateWaterTarget}><Settings className="w-4 h-4" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {Array.from({ length: water.dailyTarget || 8 }).slice(0, 8).map((_, idx) => {
                        const filled = idx < water.glassesLogged;
                        return (
                          <button key={idx} onClick={() => saveWater(filled ? idx : idx + 1)} className={`p-2 rounded border ${filled ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200'}`}>
                            <Droplets className={`w-5 h-5 mx-auto ${filled ? 'text-blue-600 fill-blue-500' : 'text-gray-300'}`} />
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-sm text-gray-600">{water.glassesLogged} / {water.dailyTarget} glasses</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="body">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Weight Trend</CardTitle>
                  </CardHeader>
                  <CardContent className="h-72">
                    {bodyMetricsLog.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={bodyMetricsLog.map((m: any) => ({ date: m.date, weight: Number(m.weightLbs) }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="weight" stroke="#f97316" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-gray-500">No body metrics yet.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Log Body Metrics</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={bodyForm.date} onChange={(e) => setBodyForm((p) => ({ ...p, date: e.target.value }))} />
                    <div className="flex gap-2">
                      <input type="number" className="flex-1 border rounded px-3 py-2 text-sm" placeholder={`Weight (${bodyForm.unit})`} value={bodyForm.weight} onChange={(e) => setBodyForm((p) => ({ ...p, weight: e.target.value }))} />
                      <Button variant="outline" size="sm" onClick={() => setBodyForm((p) => ({ ...p, unit: p.unit === 'lbs' ? 'kg' : 'lbs' }))}>{bodyForm.unit.toUpperCase()}</Button>
                    </div>
                    <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="Body fat %" value={bodyForm.bodyFatPct} onChange={(e) => setBodyForm((p) => ({ ...p, bodyFatPct: e.target.value }))} />
                    <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="Waist (in)" value={bodyForm.waistIn} onChange={(e) => setBodyForm((p) => ({ ...p, waistIn: e.target.value }))} />
                    <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="Hips (in)" value={bodyForm.hipIn} onChange={(e) => setBodyForm((p) => ({ ...p, hipIn: e.target.value }))} />
                    <Button className="w-full" onClick={saveBodyMetric}>Save Metric</Button>
                  </CardContent>
                </Card>
                {bodyMetricsLog.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Latest Entry</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm">Weight: <span className="font-semibold">{Number(bodyMetricsLog[bodyMetricsLog.length - 1]?.weightLbs).toFixed(1)} lbs</span></p>
                      <p className="text-sm">Body Fat: <span className="font-semibold">{bodyMetricsLog[bodyMetricsLog.length - 1]?.bodyFatPct || '-'}%</span></p>
                      <p className="text-sm">Waist: <span className="font-semibold">{bodyMetricsLog[bodyMetricsLog.length - 1]?.waistIn || '-'} in</span></p>
                      <p className="text-sm">Hips: <span className="font-semibold">{bodyMetricsLog[bodyMetricsLog.length - 1]?.hipIn || '-'} in</span></p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Grocery List Tab */}
          <TabsContent value="grocery">
            <div className="space-y-6">
              <WeeklyReadinessChecklist
                unplannedMealSlots={unplannedMealSlots}
                unplannedDaysCount={unplannedDays.length}
                totalSlots={totalSlots}
                groceryListCreated={groceryListCreated}
                groceryPendingCount={groceryPendingCount}
                groceryCompletedCount={groceryCompletedCount}
                prepPlanMissing={prepPlanMissing}
                prepRecommendationsAvailable={prepRecommendationsAvailable}
                prepSessionPlanned={prepSessionPlanned}
                prepSessionCompleted={prepSessionCompleted}
                prepExecutionState={prepExecutionState}
                prepActiveBlockersCount={prepActiveBlockersCount}
                prepGroceryBlockersCount={prepGroceryBlockersCount}
                blockerSuggestionResolvedCount={blockerSuggestionResolution.resolvedCount}
                blockerSuggestionTrackedCount={blockerSuggestionResolution.trackedCount}
                blockerSuggestionConfidenceLabel={blockerSuggestionConfidenceLabel}
                prepCarryoverCount={prepCarryoverCount}
                weekReadyNow={weekReadyNow}
                onGoToPlanner={() => setActiveTab('planner')}
                onGoToGrocery={() => setActiveTab('grocery')}
                onGoToPrep={() => setActiveTab('prep')}
              />
              <GroceryTabSection
                groceryList={groceryList}
                weekRange={weekRange}
                getCurrentWeekAnchor={getCurrentWeekAnchor}
                setShowAddGroceryModal={setShowAddGroceryModal}
                setShowScanModal={setShowScanModal}
                optimizeShoppingList={optimizeShoppingList}
                exportGroceryList={exportGroceryList}
                toggleGroceryItem={toggleGroceryItem}
                normalizedSavingsReport={normalizedSavingsReport}
                checkPantryFirst={checkPantryFirst}
                shareWithFamily={shareWithFamily}
                onGoToPlanner={() => setActiveTab('planner')}
                onGenerateWeekPlan={generateWeekPlan}
                isGeneratingWeek={isGeneratingWeek}
                onGoToPrep={() => setActiveTab('prep')}
                prepGroceryBlockersCount={prepGroceryBlockersCount}
                canResolvePrepGroceryBlockers={canResolvePrepGroceryBlockers}
                onResolvePrepGroceryBlockers={resolvePrepGroceryBlockers}
                blockerItemSuggestions={blockerItemSuggestions}
                onAddBlockerSuggestion={addBlockerSuggestionToGrocery}
                blockerSuggestionResolvedCount={blockerSuggestionResolution.resolvedCount}
                blockerSuggestionTrackedCount={blockerSuggestionResolution.trackedCount}
                unresolvedBlockerSuggestionNames={blockerSuggestionResolution.unresolvedNames}
                resolvedBlockerSuggestionNames={resolvedTrackedSuggestionNames}
                canResolveTrackedSuggestionBlockers={canResolvePrepGroceryBlockersFromSuggestions}
                onResolveTrackedSuggestionBlockers={resolvePrepBlockersFromTrackedSuggestions}
              />
            </div>
          </TabsContent>

          {/* Meal Prep Tab */}
          <TabsContent value="prep">
            <div className="space-y-6">
              <WeeklyReadinessChecklist
                unplannedMealSlots={unplannedMealSlots}
                unplannedDaysCount={unplannedDays.length}
                totalSlots={totalSlots}
                groceryListCreated={groceryListCreated}
                groceryPendingCount={groceryPendingCount}
                groceryCompletedCount={groceryCompletedCount}
                prepPlanMissing={prepPlanMissing}
                prepRecommendationsAvailable={prepRecommendationsAvailable}
                prepSessionPlanned={prepSessionPlanned}
                prepSessionCompleted={prepSessionCompleted}
                prepExecutionState={prepExecutionState}
                prepActiveBlockersCount={prepActiveBlockersCount}
                prepGroceryBlockersCount={prepGroceryBlockersCount}
                blockerSuggestionResolvedCount={blockerSuggestionResolution.resolvedCount}
                blockerSuggestionTrackedCount={blockerSuggestionResolution.trackedCount}
                blockerSuggestionConfidenceLabel={blockerSuggestionConfidenceLabel}
                prepCarryoverCount={prepCarryoverCount}
                weekReadyNow={weekReadyNow}
                onGoToPlanner={() => setActiveTab('planner')}
                onGoToGrocery={() => setActiveTab('grocery')}
                onGoToPrep={() => setActiveTab('prep')}
              />
              <PrepTabSection
                prepSession={prepSession}
                prepProgress={prepProgress}
                prepSessionPlanned={prepSessionPlanned}
                prepSessionCompleted={prepSessionCompleted}
                prepRecommendationsAvailable={prepRecommendationsAvailable}
                onScheduleChange={updatePrepSchedule}
                onNotesChange={updatePrepNotes}
                onToggleTask={togglePrepTask}
                onToggleBlocker={togglePrepBlocker}
                onBlockerNoteChange={updatePrepBlockerNote}
                onCarryForwardUnfinished={carryForwardUnfinishedPrepTasks}
                onMarkPrepComplete={markPrepComplete}
                onResetPrepCompletion={resetPrepCompletion}
                onGoToChecklist={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                prepGroceryBlockersCount={prepGroceryBlockersCount}
                onResolveBlockersInGrocery={() => setActiveTab('grocery')}
                blockerItemSuggestions={blockerItemSuggestions}
                onAddBlockerSuggestion={addBlockerSuggestionToGrocery}
                onGoToGrocery={() => setActiveTab('grocery')}
                blockerSuggestionResolvedCount={blockerSuggestionResolution.resolvedCount}
                blockerSuggestionTrackedCount={blockerSuggestionResolution.trackedCount}
                unresolvedBlockerSuggestionNames={blockerSuggestionResolution.unresolvedNames}
                blockerSuggestionConfidenceLabel={blockerSuggestionConfidenceLabel}
                prepResolvedViaTrackedSuggestions={prepResolvedViaTrackedSuggestions}
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                <CardHeader>
                  <CardTitle>Batch Cooking Planner</CardTitle>
                  <CardDescription>Prepare multiple meals efficiently</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-blue-600 mt-1" />
                        <div className="flex-1">
                          <h4 className="font-medium mb-1">Sunday Meal Prep</h4>
                          <p className="text-sm text-gray-600 mb-3">Prepare 5 meals in 2 hours</p>
                          <ul className="space-y-1 text-sm text-gray-700">
                            <li>• Cook 2lbs chicken breast</li>
                            <li>• Roast vegetables (carrots, broccoli)</li>
                            <li>• Prepare 3 cups quinoa</li>
                            <li>• Portion into containers</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-green-600 mt-1" />
                        <div className="flex-1">
                          <h4 className="font-medium mb-1">Wednesday Prep</h4>
                          <p className="text-sm text-gray-600 mb-3">Quick 30-minute session</p>
                          <ul className="space-y-1 text-sm text-gray-700">
                            <li>• Hard boil 6 eggs</li>
                            <li>• Prep overnight oats</li>
                            <li>• Cut fruit for snacks</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <Button className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Prep Session
                    </Button>
                  </div>
                </CardContent>
                </Card>

                <Card>
                <CardHeader>
                  <CardTitle>Storage Tips</CardTitle>
                  <CardDescription>Keep your meals fresh</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <StorageTip
                      icon={<ChefHat className="w-5 h-5 text-orange-500" />}
                      title="Chicken & Rice"
                      tip="Refrigerate up to 4 days, freeze up to 3 months"
                    />
                    <StorageTip
                      icon={<Utensils className="w-5 h-5 text-green-500" />}
                      title="Chopped Vegetables"
                      tip="Store in airtight container, use within 3-5 days"
                    />
                    <StorageTip
                      icon={<Package className="w-5 h-5 text-blue-500" />}
                      title="Cooked Grains"
                      tip="Refrigerate up to 5 days, freeze up to 6 months"
                    />
                  </div>
                </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  {macroDistributionData.length > 0 ? (
                    <div className="h-64 bg-gray-50 rounded-lg p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={macroDistributionData}
                            dataKey="calories"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={78}
                            innerRadius={45}
                            paddingAngle={4}
                          >
                            {macroDistributionData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number, _name, payload: any) => [`${Math.round(Number(value))} kcal`, `${payload?.payload?.name || 'Macro'}`]} />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg text-sm text-gray-500">
                      Add meals to see your weekly macro distribution.
                    </div>
                  )}
                  {macroDistributionData.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {macroDistributionData.map((macro) => (
                        <div key={macro.name} className="rounded-lg border bg-white p-2">
                          <p className="text-xs text-gray-500">{macro.name}</p>
                          <p className="text-sm font-semibold">{macro.grams.toFixed(0)}g</p>
                          <p className="text-xs" style={{ color: macro.color }}>{macro.percent}% of kcal</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Progress Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  {hasWeeklyNutritionData ? (
                    <div className="h-64 bg-gray-50 rounded-lg p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metricsTrendData}>
                          <defs>
                            <linearGradient id="calorieFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#fb923c" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip />
                          <Area yAxisId="left" type="monotone" dataKey="calories" name="Calories" stroke="#ea580c" fill="url(#calorieFill)" strokeWidth={2} />
                          <Line yAxisId="left" type="monotone" dataKey="calorieGoal" name="Calorie Goal" stroke="#9ca3af" strokeDasharray="5 5" dot={false} />
                          <Bar yAxisId="right" dataKey="protein" name="Protein (g)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="proteinGoal" name="Protein Goal" stroke="#1d4ed8" strokeDasharray="3 4" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg text-sm text-gray-500">
                      Log meals this week to unlock calorie and protein trends.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Weekly Compliance Snapshot</CardTitle>
                </CardHeader>
                <CardContent>
                  {hasWeeklyNutritionData ? (
                    <div className="h-64 bg-gray-50 rounded-lg p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyNutritionData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="shortDay" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="calories" name="Calories" fill="#f97316" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="protein" name="Protein (g)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg text-sm text-gray-500">
                      Your weekly compliance snapshot appears once meal data is available.
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-gray-500">Meal Streak</p>
                      <p className="text-lg font-semibold">{streak.currentStreak} days</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-gray-500">Weekly Meals Logged</p>
                      <p className="text-lg font-semibold">{weeklyTotals.mealsLogged}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-gray-500">Calorie Goal Days</p>
                      <p className="text-lg font-semibold">{calorieGoalHitDays}/7</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-gray-500">Hydration</p>
                      <p className="text-lg font-semibold">{water.glassesLogged}/{water.dailyTarget}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Insights & Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {computedInsights.map((insight, idx) => (
                      <InsightCard
                        key={idx}
                        icon={insight.icon}
                        title={insight.title}
                        description={insight.description}
                        trend={insight.trend}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="advanced">
            <AdvancedFeaturesPanel />
          </TabsContent>

          <TabsContent value="tools">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cooking Tools & Measurement Conversions</CardTitle>
                  <CardDescription>
                    Quick kitchen conversion tables you can use while planning meals.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <a
                    href="/pantry?tab=tools"
                    className="text-sm font-medium text-orange-600 hover:text-orange-700 underline underline-offset-2"
                  >
                    Open in My Pantry →
                  </a>
                </CardContent>
              </Card>
              <CookingToolsReference />
            </div>
          </TabsContent>
        </Tabs>

        <GoalCalculatorDialog
          open={showCalcModal}
          onOpenChange={setShowCalcModal}
          calcForm={calcForm}
          setCalcForm={setCalcForm}
          calcResult={calcResult}
          onCalculate={calculateGoals}
          onSave={saveCalculatedGoals}
        />

        <AddMealModal
          open={showAddMealModal}
          selectedMealSlot={selectedMealSlot}
          mealForm={mealForm}
          baseNutrition={baseNutrition}
          isLookingUpNutrition={isLookingUpNutrition}
          showRecentMeals={showRecentMeals}
          mealHistory={mealHistory}
          onClose={closeAddMealModal}
          onLookupNutrition={lookupNutritionWithAI}
          onMealFormChange={setMealForm}
          onToggleRecentMeals={() => setShowRecentMeals((v) => !v)}
          onToggleFavorite={toggleMealHistoryFavorite}
          onServingQtyChange={changeServingQty}
          onAddToPlanner={handleAddMealFromModal}
        />

        <AIRecipeModal
          open={showAIRecipeModal}
          selectedMealSlot={selectedMealSlot}
          isLoadingAiRecipes={isLoadingAiRecipes}
          aiRecipes={aiRecipes}
          onClose={() => setShowAIRecipeModal(false)}
          onRefresh={loadAIRecipeSuggestions}
          onAddRecipe={handleAddAIRecipe}
        />

        <PantryModal
          open={showPantryModal}
          onClose={() => setShowPantryModal(false)}
          onAddMeal={(meal) => {
            toast({
              description: `✅ ${meal.name} added to your planner!`,
            });
            setShowPantryModal(false);
          }}
        />

        <LoadTemplateModal
          open={showLoadTemplateModal}
          onClose={() => setShowLoadTemplateModal(false)}
          onLoadTemplate={loadTemplate}
          currentWeeklyMeals={weeklyMeals}
        />

        <AddGroceryItemModal
          open={showAddGroceryModal}
          onClose={() => setShowAddGroceryModal(false)}
          onAddItem={handleAddGroceryItem}
        />

        {/* Scan Barcode Modal */}
        {showScanModal && (
          <BarcodeScanner
            onDetected={(barcode) => {
              handleScanBarcode(barcode);
              setShowScanModal(false);
            }}
            onClose={() => setShowScanModal(false)}
          />
        )}

        <ShareFamilyDialog
          open={showShareFamilyModal}
          onOpenChange={setShowShareFamilyModal}
          familyMembers={familyMembers}
          groceryCount={groceryList.length}
          onCopyToClipboard={copyGroceryListToClipboard}
        />
      </div>
    </div>
  );
};

// Helper Components
const MacroCard = ({ label, current, goal, unit, color }) => {
  const percentage = (current / goal) * 100;
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    orange: 'text-orange-600 bg-orange-50',
    purple: 'text-purple-600 bg-purple-50'
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
      <div className="text-sm font-medium mb-2">{label}</div>
      <div className="text-2xl font-bold mb-1">{current}{unit}</div>
      <div className="text-xs opacity-75">of {goal}{unit} ({Math.round(percentage)}%)</div>
    </div>
  );
};

const StorageTip = ({ icon, title, tip }) => (
  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
    {icon}
    <div>
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      <p className="text-xs text-gray-600">{tip}</p>
    </div>
  </div>
);

const InsightCard = ({ icon, title, description, trend }) => {
  const borderColor = trend === 'positive' ? 'border-green-200' : 'border-gray-200';

  return (
    <div className={`p-4 border-2 ${borderColor} rounded-lg`}>
      <div className="mb-2">{icon}</div>
      <h4 className="font-medium mb-1">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
};

const Testimonial = ({ name, text, rating }) => (
  <div className="bg-white p-4 rounded-lg border border-purple-200">
    <div className="flex gap-1 mb-2">
      {[...Array(rating)].map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
      ))}
    </div>
    <p className="text-sm text-gray-700 mb-2">"{text}"</p>
    <p className="text-xs font-medium text-gray-900">- {name}</p>
  </div>
);

export default NutritionMealPlanner;
