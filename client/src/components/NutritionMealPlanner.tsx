import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, Target, TrendingUp, Clock, ChefHat, Star, Lock, Crown,
  ShoppingCart, CheckCircle, BarChart3, PieChart, Download, Filter, Save,
  AlertCircle, Package, Utensils, CalendarDays, Zap, ListChecks, Settings, Camera,
  DollarSign, Sparkles, Flame, Scale, Droplets
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
import GoalCalculatorDialog from '@/components/meal-planner/modals/GoalCalculatorDialog';
import PantryModal from '@/components/meal-planner/modals/PantryModal';
import LoadTemplateModal from '@/components/meal-planner/modals/LoadTemplateModal';
import AddGroceryItemModal from '@/components/meal-planner/modals/AddGroceryItemModal';
import ShareFamilyDialog from '@/components/meal-planner/modals/ShareFamilyDialog';
import { exportCSV, exportText } from "@/lib/shoppingExport";
import { normalizeShoppingListItem } from '@/lib/shopping-list';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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
} from '@/components/meal-planner/nutritionMealPlannerUtils';

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

  // Add Meal modal — controlled fields
  const [mealForm, setMealForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', servingSize: '', servingQty: 1 });
  const [baseNutrition, setBaseNutrition] = useState<{ calories: number; protein: number; carbs: number; fat: number; fiber: number; servingSize: string } | null>(null);
  const [isLookingUpNutrition, setIsLookingUpNutrition] = useState(false);

  // AI Recipe Suggestions modal
  const [aiRecipes, setAiRecipes] = useState<any[]>([]);
  const [isLoadingAiRecipes, setIsLoadingAiRecipes] = useState(false);

  const mealTypes = MEAL_TYPES;
  const weekDays = WEEK_DAYS;

  const getCurrentWeekAnchor = () => getWeekAnchorForDate(selectedDate);

  const getDateForWeekday = (weekday: string) => getDateForWeekdayFromAnchor(getCurrentWeekAnchor(), weekday);

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
    if (isPremium) {
      fetchDailyNutrition();
    }
  }, [weeklyMeals]);

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
              await fetch('/api/meal-planner/grocery-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  ingredientName: item.name,
                  quantity: item.quantity,
                  unit: item.unit,
                  category: item.category || 'From Recipe',
                  notes: item.note,
                }),
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
    setMealForm({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', servingSize: '', servingQty: 1 });
    setBaseNutrition(null);
    setShowAddMealModal(true);
    fetchMealHistory();
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

  const loadTemplate = (templateName: string) => {
    const saved = localStorage.getItem(`meal-template-${templateName}`);
    if (saved) {
      setWeeklyMeals(JSON.parse(saved));
      toast({
        description: `✅ Template "${templateName}" loaded successfully!`,
      });
      setShowLoadTemplateModal(false);
    }
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

      const response = await fetch('/api/meal-planner/grocery-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

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

        const response = await fetch('/api/meal-planner/grocery-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

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
          <TabsList className="grid w-full grid-cols-7 mb-8 h-auto">
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
          </TabsList>

          {/* Meal Planner Tab */}
          <TabsContent value="planner">
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
            />
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
            />
          </TabsContent>

          {/* Meal Prep Tab */}
          <TabsContent value="prep">
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
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center text-gray-500">
                      <PieChart className="w-12 h-12 mx-auto mb-2" />
                      <p>Macro distribution chart</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Progress Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center text-gray-500">
                      <TrendingUp className="w-12 h-12 mx-auto mb-2" />
                      <p>Progress trend chart</p>
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
                    <InsightCard
                      icon={<Star className="w-6 h-6 text-yellow-500" />}
                      title="Great Week!"
                      description="You hit your protein goal 6 out of 7 days"
                      trend="positive"
                    />
                    <InsightCard
                      icon={<TrendingUp className="w-6 h-6 text-green-500" />}
                      title="Consistent Progress"
                      description="Your meal prep adherence is up 15%"
                      trend="positive"
                    />
                    <InsightCard
                      icon={<AlertCircle className="w-6 h-6 text-orange-500" />}
                      title="Room for Improvement"
                      description="Try adding more vegetables at dinner"
                      trend="neutral"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="advanced">
            <AdvancedFeaturesPanel />
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

        {/* Add Meal Modal — AI-powered */}
        {showAddMealModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xl font-bold">
                  Add Meal {selectedMealSlot && `— ${selectedMealSlot.day} · ${selectedMealSlot.type}`}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => { setShowAddMealModal(false); setSelectedMealSlot(null); setMealForm({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', servingSize: '', servingQty: 1 }); setBaseNutrition(null); }}>✕</Button>
              </div>
              <p className="text-xs text-gray-500 mb-5">Type the meal name, then tap <span className="font-semibold text-orange-600">✨ AI Lookup</span> to auto-fill nutrition.</p>

              <div className="space-y-4">
                {/* Meal name + AI button */}
                <div>
                  <label className="block text-sm font-medium mb-2">Meal Name *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 border rounded px-3 py-2 text-sm"
                      placeholder="e.g., Grilled Chicken Salad"
                      value={mealForm.name}
                      onChange={e => setMealForm(p => ({ ...p, name: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') lookupNutritionWithAI(); }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-orange-300 text-orange-600 hover:bg-orange-50 hover:border-orange-400"
                      onClick={lookupNutritionWithAI}
                      disabled={isLookingUpNutrition || !mealForm.name.trim()}
                    >
                      {isLookingUpNutrition ? (
                        <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 animate-pulse" />Looking up…</span>
                      ) : (
                        <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />✨ AI Lookup</span>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <button className="text-sm font-medium flex items-center justify-between w-full" onClick={() => setShowRecentMeals((v) => !v)}>
                    <span>Recent & Favorites</span>
                    <span>{showRecentMeals ? '−' : '+'}</span>
                  </button>
                  {showRecentMeals && (
                    <div className="mt-3 overflow-x-auto">
                      <div className="flex gap-2 min-w-max">
                        {mealHistory.map((meal: any) => (
                          <div key={meal.id} className="flex items-center gap-1">
                            <button
                              className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-orange-100 text-xs"
                              onClick={() => setMealForm((p) => ({ ...p, name: meal.name, calories: String(meal.calories || ''), protein: String(meal.protein || ''), carbs: String(meal.carbs || ''), fat: String(meal.fat || ''), fiber: String(meal.fiber || '') }))}
                            >
                              {meal.isFavorite ? '⭐ ' : ''}{meal.name}
                            </button>
                            <button
                              className="text-yellow-500 text-xs"
                              onClick={async () => {
                                await fetch('/api/meal-planner/history/favorite', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ mealName: meal.name, isFavorite: !meal.isFavorite }),
                                });
                                fetchMealHistory();
                              }}
                            >
                              {meal.isFavorite ? '★' : '☆'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Serving size + Quantity — shown after lookup */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Serving Size</label>
                    <input
                      type="text"
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="e.g., 1 cup, 1 egg"
                      value={mealForm.servingSize}
                      onChange={e => setMealForm(p => ({ ...p, servingSize: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      How many servings?
                      {baseNutrition && (
                        <span className="ml-1 font-normal text-orange-600 text-xs">
                          (× {mealForm.servingQty})
                        </span>
                      )}
                    </label>
                    <select
                      className="w-full border rounded px-3 py-2 text-sm bg-white"
                      value={mealForm.servingQty}
                      onChange={e => changeServingQty(Number(e.target.value))}
                    >
                      {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(q => (
                        <option key={q} value={q}>
                          {q === 0.25 ? '¼ serving' : q === 0.5 ? '½ serving' : q === 0.75 ? '¾ serving' : q === 1 ? '1 serving' : q === 1.25 ? '1¼ servings' : q === 1.5 ? '1½ servings' : `${q} servings`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live scaled preview banner */}
                {baseNutrition && mealForm.servingQty !== 1 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <p className="text-xs font-medium text-orange-700">
                        {mealForm.servingQty} × {mealForm.servingSize || 'serving'} · macros scaled automatically
                      </p>
                    </div>
                    <div className="flex gap-3 text-xs text-orange-600">
                      <span>Base: {baseNutrition.calories} cal</span>
                      <span>→ Total: <strong>{mealForm.calories} cal</strong></span>
                    </div>
                  </div>
                )}

                {/* First lookup hint */}
                {!baseNutrition && (mealForm.calories || mealForm.protein) && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
                    <p className="text-xs text-orange-700">Nutrition filled in — change servings above to auto-scale, or edit any field manually.</p>
                  </div>
                )}

                {/* Macro grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Calories</label>
                    <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="450" value={mealForm.calories} onChange={e => setMealForm(p => ({ ...p, calories: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Protein (g)</label>
                    <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="35" value={mealForm.protein} onChange={e => setMealForm(p => ({ ...p, protein: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Carbs (g)</label>
                    <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="45" value={mealForm.carbs} onChange={e => setMealForm(p => ({ ...p, carbs: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fat (g)</label>
                    <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="15" value={mealForm.fat} onChange={e => setMealForm(p => ({ ...p, fat: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fiber (g) <span className="text-gray-400 font-normal">optional</span></label>
                    <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="4" value={mealForm.fiber} onChange={e => setMealForm(p => ({ ...p, fiber: e.target.value }))} />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={() => {
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
                      setMealForm({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', servingSize: '', servingQty: 1 }); setBaseNutrition(null);
                    }}
                  >
                    Add to Planner
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddMealModal(false);
                      setSelectedMealSlot(null);
                      setMealForm({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', servingSize: '', servingQty: 1 }); setBaseNutrition(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Recipe Modal — live AI suggestions */}
        {showAIRecipeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-orange-500" />
                  AI Recipe Suggestions
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAIRecipeSuggestions}
                    disabled={isLoadingAiRecipes}
                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  >
                    {isLoadingAiRecipes ? (
                      <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 animate-pulse" />Generating…</span>
                    ) : (
                      <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" />Refresh</span>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAIRecipeModal(false)}>✕</Button>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                Personalized recipes based on your calorie goal
                {selectedMealSlot ? ` for ${selectedMealSlot.type}` : ''}.
              </p>

              {isLoadingAiRecipes ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="animate-pulse rounded-lg border p-4">
                      <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-full mb-3" />
                      <div className="flex gap-2">
                        {[1,2,3,4].map(j => <div key={j} className="h-5 bg-gray-100 rounded w-16" />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {aiRecipes.map((recipe: any, idx: number) => (
                    <Card key={idx} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <h4 className="font-semibold text-base">{recipe.name}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              {recipe.prepTime && <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{recipe.prepTime}</span>}
                              {recipe.difficulty && <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${recipe.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : recipe.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{recipe.difficulty}</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 text-white shrink-0 ml-3"
                            onClick={() => {
                              if (selectedMealSlot) {
                                saveMealToSlot({ name: recipe.name, calories: recipe.calories, protein: recipe.protein, carbs: recipe.carbs, fat: recipe.fat });
                              } else {
                                toast({ description: `✅ ${recipe.name} saved!` });
                              }
                              setShowAIRecipeModal(false);
                            }}
                          >
                            Add
                          </Button>
                        </div>
                        <p className="text-sm text-gray-600 my-2">{recipe.description}</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">{recipe.calories} cal</Badge>
                          <Badge variant="secondary" className="text-xs">P: {recipe.protein}g</Badge>
                          <Badge variant="secondary" className="text-xs">C: {recipe.carbs}g</Badge>
                          <Badge variant="secondary" className="text-xs">F: {recipe.fat}g</Badge>
                        </div>
                        {recipe.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {recipe.tags.map((tag: string, ti: number) => (
                              <span key={ti} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">{tag}</span>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

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
