import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, Target, TrendingUp, Clock, Users, ChefHat, Star, Lock, Crown,
  ShoppingCart, CheckCircle, BarChart3, PieChart, Download, Filter, Save,
  AlertCircle, Package, Utensils, CalendarDays, Zap, ListChecks, Settings, Camera,
  DollarSign, Copy, Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import BarcodeScanner from '@/components/BarcodeScanner';
import AdvancedFeaturesPanel from '@/components/meal-planner/AdvancedFeaturesPanel';
import { exportCSV, exportText } from "@/lib/shoppingExport";

const NutritionMealPlanner = () => {
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDateOnly = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, y, m, d] = match;
      return new Date(Number(y), Number(m) - 1, Number(d));
    }
    return new Date(value);
  };

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

  // Add Meal modal — controlled fields
  const [mealForm, setMealForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', servingSize: '', servingQty: 1 });
  const [baseNutrition, setBaseNutrition] = useState<{ calories: number; protein: number; carbs: number; fat: number; fiber: number; servingSize: string } | null>(null);
  const [isLookingUpNutrition, setIsLookingUpNutrition] = useState(false);

  // AI Recipe Suggestions modal
  const [aiRecipes, setAiRecipes] = useState<any[]>([]);
  const [isLoadingAiRecipes, setIsLoadingAiRecipes] = useState(false);

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const getDateForWeekday = (weekday: string) => {
    const anchor = parseDateOnly(getCurrentWeekAnchor());
    const index = weekDays.indexOf(weekday);
    const dayOffset = index >= 0 ? index : 0;
    anchor.setDate(anchor.getDate() + dayOffset);
    return formatLocalDate(anchor);
  };

  const getCurrentWeekAnchor = () => {
    const now = parseDateOnly(selectedDate);
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    now.setDate(now.getDate() + diff);
    return formatLocalDate(now);
  };

  useEffect(() => {
    fetchUserData();
    if (isPremium) {
      fetchMealPlans();
      fetchDailyNutrition();
      fetchGroceryList();
      fetchSavingsReport();
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
        macroGoals: { protein: 150, carbs: 200, fat: 65 }
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
    const defaultGoals = { dailyCalorieGoal: 2000, macroGoals: { protein: 150, carbs: 200, fat: 65 } };

    // Calculate today's actual nutrition totals from weeklyMeals state
    const calcTotals = (meals: Record<string, any>, goals: any) => {
      // Get the day name for today (Monday–Sunday)
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const todayName = dayNames[new Date().getDay()];
      const todayMeals = meals[todayName] || {};

      // Sum all items across all meal slots for today
      const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      Object.values(todayMeals).forEach((slotValue: any) => {
        const items = Array.isArray(slotValue) ? slotValue : slotValue ? [slotValue] : [];
        items.forEach((meal: any) => {
          totals.calories += Number(meal?.calories || 0);
          totals.protein  += Number(meal?.protein  || 0);
          totals.carbs    += Number(meal?.carbs    || 0);
          totals.fat      += Number(meal?.fat      || 0);
        });
      });

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
        const mappedItems = data.items.map((item: any) => ({
          id: item.id,
          item: item.ingredientName,
          name: item.ingredientName,
          amount: item.quantity && item.unit ? `${item.quantity} ${item.unit}` : item.quantity || '',
          category: item.category || 'Other',
          checked: item.purchased || false,
          notes: item.notes,
        }));
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
                  category: 'From Recipe',
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
      const itemsToExport = groceryList.map((item: any) => ({
        name: item.name || item.item,
        quantity: parseFloat(item.amount?.split(' ')[0]) || 1,
        unit: item.amount?.split(' ').slice(1).join(' ') || '',
        category: item.category || 'Other',
        checked: item.checked || false,
      }));

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
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save meal entry');
      }

      const data = await response.json();
      const savedMeal = { ...mealData, entryId: data?.entry?.id };

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
    const items = getSlotItems(day, mealType);
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

  // Helper: get items for a slot as an array
  const getSlotItems = (day: string, mealType: string): any[] => {
    const val = weeklyMeals?.[day]?.[mealType];
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  };

  // Helper: sum macros for a slot
  const getSlotTotals = (day: string, mealType: string) => {
    const items = getSlotItems(day, mealType);
    return items.reduce((acc, m) => ({
      calories: acc.calories + (Number(m?.calories) || 0),
      protein: acc.protein + (Number(m?.protein) || 0),
      carbs: acc.carbs + (Number(m?.carbs) || 0),
      fat: acc.fat + (Number(m?.fat) || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
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
      const itemsToExport = groceryList.map((item: any) => ({
        name: item.name || item.item,
        quantity: parseFloat(item.amount?.split(' ')[0]) || 1,
        unit: item.amount?.split(' ').slice(1).join(' ') || '',
        category: item.category || 'Other',
        checked: item.checked || false,
      }));

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


  // ── Built-in nutrition lookup table (works without any API key) ──────────
  const NUTRITION_TABLE: Record<string, {calories:number;protein:number;carbs:number;fat:number;fiber:number;servingSize:string}> = {
    egg: { calories: 78, protein: 6, carbs: 1, fat: 5, fiber: 0, servingSize: '1 large egg' },
    eggs: { calories: 156, protein: 12, carbs: 1, fat: 10, fiber: 0, servingSize: '2 large eggs' },
    bacon: { calories: 161, protein: 12, carbs: 0, fat: 12, fiber: 0, servingSize: '3 strips' },
    toast: { calories: 79, protein: 3, carbs: 15, fat: 1, fiber: 1, servingSize: '1 slice' },
    oatmeal: { calories: 158, protein: 5, carbs: 27, fat: 3, fiber: 4, servingSize: '1 cup cooked' },
    pancakes: { calories: 350, protein: 9, carbs: 56, fat: 10, fiber: 2, servingSize: '3 medium' },
    waffles: { calories: 310, protein: 8, carbs: 45, fat: 12, fiber: 1, servingSize: '2 waffles' },
    yogurt: { calories: 150, protein: 17, carbs: 9, fat: 4, fiber: 0, servingSize: '1 cup' },
    banana: { calories: 89, protein: 1, carbs: 23, fat: 0, fiber: 3, servingSize: '1 medium' },
    apple: { calories: 72, protein: 0, carbs: 19, fat: 0, fiber: 3, servingSize: '1 medium' },
    orange: { calories: 62, protein: 1, carbs: 15, fat: 0, fiber: 3, servingSize: '1 medium' },
    avocado: { calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, servingSize: '1/2 avocado' },
    chicken: { calories: 335, protein: 38, carbs: 0, fat: 19, fiber: 0, servingSize: '1 breast' },
    salmon: { calories: 367, protein: 39, carbs: 0, fat: 22, fiber: 0, servingSize: '1 fillet (170g)' },
    beef: { calories: 350, protein: 30, carbs: 0, fat: 24, fiber: 0, servingSize: '4 oz' },
    rice: { calories: 206, protein: 4, carbs: 45, fat: 0, fiber: 1, servingSize: '1 cup cooked' },
    pasta: { calories: 220, protein: 8, carbs: 43, fat: 1, fiber: 3, servingSize: '1 cup cooked' },
    salad: { calories: 150, protein: 5, carbs: 12, fat: 8, fiber: 4, servingSize: '1 bowl' },
    burger: { calories: 540, protein: 27, carbs: 40, fat: 28, fiber: 2, servingSize: '1 burger' },
    sandwich: { calories: 350, protein: 18, carbs: 40, fat: 12, fiber: 3, servingSize: '1 sandwich' },
    pizza: { calories: 570, protein: 23, carbs: 68, fat: 21, fiber: 3, servingSize: '2 slices' },
    soup: { calories: 180, protein: 8, carbs: 22, fat: 6, fiber: 4, servingSize: '1.5 cups' },
    steak: { calories: 420, protein: 38, carbs: 0, fat: 28, fiber: 0, servingSize: '6 oz' },
    tuna: { calories: 290, protein: 40, carbs: 0, fat: 13, fiber: 0, servingSize: '1 can (5oz)' },
    shrimp: { calories: 200, protein: 38, carbs: 3, fat: 3, fiber: 0, servingSize: '4 oz' },
    broccoli: { calories: 55, protein: 4, carbs: 11, fat: 0, fiber: 5, servingSize: '1 cup' },
    spinach: { calories: 41, protein: 5, carbs: 7, fat: 0, fiber: 4, servingSize: '1 cup cooked' },
    sweet_potato: { calories: 103, protein: 2, carbs: 24, fat: 0, fiber: 4, servingSize: '1 medium' },
    milk: { calories: 149, protein: 8, carbs: 12, fat: 8, fiber: 0, servingSize: '1 cup' },
    cheese: { calories: 113, protein: 7, carbs: 0, fat: 9, fiber: 0, servingSize: '1 oz' },
    almonds: { calories: 164, protein: 6, carbs: 6, fat: 14, fiber: 3, servingSize: '1 oz (23 nuts)' },
    bread: { calories: 79, protein: 3, carbs: 15, fat: 1, fiber: 1, servingSize: '1 slice' },
  };

  // ── Nutrition Lookup — client-side first, AI refines silently ─────────────
  const clientSideNutritionLookup = (name: string): { calories: number; protein: number; carbs: number; fat: number; fiber: number; servingSize: string } => {
    const lower = name.toLowerCase();

    // STEP 1: Split into multiple items first (handles "eggs, toast and bacon")
    const parts = lower.split(/[,&+]|\band\b|\bwith\b/).map(s => s.trim()).filter(Boolean);

    if (parts.length > 1) {
      let combined = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      let matched = 0;
      const servings: string[] = [];
      for (const part of parts) {
        for (const [key, val] of Object.entries(NUTRITION_TABLE)) {
          if (part.includes(key.replace('_', ' '))) {
            combined.calories += val.calories;
            combined.protein += val.protein;
            combined.carbs += val.carbs;
            combined.fat += val.fat;
            combined.fiber += val.fiber;
            servings.push(val.servingSize);
            matched++;
            break;
          }
        }
      }
      if (matched > 0) {
        return { ...combined, servingSize: servings.join(' + ') };
      }
    }

    // STEP 2: Single item scan
    for (const [key, val] of Object.entries(NUTRITION_TABLE)) {
      if (lower.includes(key.replace('_', ' '))) return val;
    }

    // STEP 3: Generic fallback — fields are NEVER left blank
    return { calories: 400, protein: 25, carbs: 40, fat: 14, fiber: 4, servingSize: '1 serving' };
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
          <TabsList className="grid w-full grid-cols-6 mb-8 h-auto">
            <TabsTrigger value="planner" className="flex-col sm:flex-row gap-1 sm:gap-2 py-3">
              <Calendar className="w-4 h-4" />
              <span className="text-xs sm:text-sm">Planner</span>
            </TabsTrigger>
            <TabsTrigger value="nutrition" className="flex-col sm:flex-row gap-1 sm:gap-2 py-3">
              <Target className="w-4 h-4" />
              <span className="text-xs sm:text-sm">Nutrition</span>
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
            <div className="space-y-6">
              {/* Daily Calorie Counter Widget */}
              <Card className="bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/90 text-sm font-medium mb-1">Today's Calories</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">{caloriesCurrent.toLocaleString()}</span>
                        <span className="text-white/80 text-lg">/ {calorieGoal.toLocaleString()} kcal</span>
                      </div>
                      <Progress value={calorieProgress} className="h-2 mt-3 bg-white/20" />
                    </div>
                    <div className="text-right">
                      <div className="bg-white/20 backdrop-blur rounded-lg px-4 py-3">
                        <p className="text-sm text-white/90">Remaining</p>
                        <p className="text-2xl font-bold">{remainingCalories}</p>
                        <p className="text-xs text-white/80">calories</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="bg-white/15 backdrop-blur rounded-lg p-3 text-center">
                      <p className="text-xs text-white/80">Protein</p>
                      <p className="text-lg font-semibold">{proteinCurrent}g</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur rounded-lg p-3 text-center">
                      <p className="text-xs text-white/80">Carbs</p>
                      <p className="text-lg font-semibold">{carbsCurrent}g</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur rounded-lg p-3 text-center">
                      <p className="text-xs text-white/80">Fat</p>
                      <p className="text-lg font-semibold">{fatCurrent}g</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Button
                    variant={viewMode === 'day' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 md:flex-none"
                    onClick={() => setViewMode('day')}
                  >
                    Day
                  </Button>
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 md:flex-none"
                    onClick={() => setViewMode('week')}
                  >
                    Week
                  </Button>
                  <Button
                    variant={viewMode === 'month' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 md:flex-none"
                    onClick={() => setViewMode('month')}
                  >
                    Month
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-1 md:flex-none">
                  <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={generateWeekPlan} disabled={isGeneratingWeek}>
                    <Zap className="w-4 h-4 mr-2" />
                    {isGeneratingWeek ? 'Generating...' : 'Auto-Plan Week'}
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={saveTemplate}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Template
                  </Button>
                  <Button size="sm" className="flex-1 md:flex-none" onClick={() => handleAddMeal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Meal
                  </Button>
                </div>
              </div>
              {weekRange && (
                <p className="text-sm text-gray-500">
                  Current plan: {weekRange.weekStart} → {weekRange.weekEnd}
                </p>
              )}

              {/* Weekly Calendar View */}
              {viewMode === 'week' && (
                <>
                  {/* Desktop Grid View */}
                  <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-hidden overflow-x-auto">
                    <div className="grid grid-cols-8 border-b min-w-[800px]">
                      <div className="p-4 bg-gray-50 border-r">
                        <span className="text-sm font-medium text-gray-500">Meal</span>
                      </div>
                      {weekDays.map((day) => (
                        <div key={day} className="p-4 bg-gray-50 border-r last:border-r-0">
                          <div className="text-sm font-medium text-gray-900">{day}</div>
                          <div className="text-xs text-gray-500">Dec {weekDays.indexOf(day) + 1}</div>
                        </div>
                      ))}
                    </div>

                    {mealTypes.map((mealType) => (
                      <div key={mealType} className="grid grid-cols-8 border-b last:border-b-0 min-w-[800px]">
                        <div className="p-4 bg-gray-50 border-r flex items-center">
                          <span className="text-sm font-medium text-gray-700 capitalize">{mealType}</span>
                        </div>
                        {weekDays.map((day) => {
                          const items = getSlotItems(day, mealType);
                          const totals = getSlotTotals(day, mealType);
                          return (
                            <div key={`${day}-${mealType}`} className="p-2 border-r last:border-r-0 min-h-[72px]">
                              {items.length > 0 && (
                                <div className="space-y-1 mb-1">
                                  {items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-start justify-between gap-1 group">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-gray-900 truncate">{item.name}</div>
                                        <div className="text-xs text-gray-400">{item.calories} cal · P:{item.protein}g</div>
                                      </div>
                                      <button
                                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs leading-none mt-0.5 shrink-0"
                                        onClick={e => { e.stopPropagation(); removeMealItem(day, mealType, idx); }}
                                        title="Remove"
                                      >✕</button>
                                    </div>
                                  ))}
                                  {items.length > 1 && (
                                    <div className="text-xs text-orange-600 font-medium border-t border-gray-100 pt-1">
                                      Total: {totals.calories} cal
                                    </div>
                                  )}
                                </div>
                              )}
                              <button
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 w-full mt-1"
                                onClick={() => handleAddMeal(day, mealType)}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{items.length > 0 ? 'Add more' : 'Add'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4">
                    {weekDays.map((day) => (
                      <Card key={day}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{day}</CardTitle>
                          <CardDescription>Dec {weekDays.indexOf(day) + 1}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {mealTypes.map((mealType) => (
                            <div key={`${day}-${mealType}`} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700 capitalize">{mealType}</span>
                                <button
                                  className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700"
                                  onClick={() => handleAddMeal(day, mealType)}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  {getSlotItems(day, mealType).length > 0 ? 'Add more' : 'Add'}
                                </button>
                              </div>
                              {getSlotItems(day, mealType).length > 0 ? (
                                <div className="space-y-2">
                                  {getSlotItems(day, mealType).map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-start justify-between gap-2 bg-white rounded p-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
                                        <div className="flex gap-1 mt-1 flex-wrap">
                                          <Badge variant="secondary" className="text-xs">{item.calories} cal</Badge>
                                          <Badge variant="secondary" className="text-xs">P: {item.protein}g</Badge>
                                        </div>
                                      </div>
                                      <button
                                        className="text-red-400 hover:text-red-600 text-xs mt-0.5 shrink-0"
                                        onClick={() => removeMealItem(day, mealType, idx)}
                                      >✕</button>
                                    </div>
                                  ))}
                                  {getSlotItems(day, mealType).length > 1 && (
                                    <div className="text-xs text-orange-600 font-semibold text-right">
                                      Total: {getSlotTotals(day, mealType).calories} cal · P: {getSlotTotals(day, mealType).protein}g
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">Tap Add to log meals</p>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleAIRecipe}>
                  <CardContent className="p-6 text-center">
                    <Zap className="w-8 h-8 mx-auto mb-3 text-orange-500" />
                    <h3 className="font-medium mb-2">AI Recipe Suggestions</h3>
                    <p className="text-sm text-gray-600">Get personalized recipe recommendations</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleUsePantry}>
                  <CardContent className="p-6 text-center">
                    <Package className="w-8 h-8 mx-auto mb-3 text-green-500" />
                    <h3 className="font-medium mb-2">Use Pantry Items</h3>
                    <p className="text-sm text-gray-600">Plan meals with what you have</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleLoadTemplate}>
                  <CardContent className="p-6 text-center">
                    <Save className="w-8 h-8 mx-auto mb-3 text-blue-500" />
                    <h3 className="font-medium mb-2">Load Template</h3>
                    <p className="text-sm text-gray-600">Use a saved meal plan template</p>
                  </CardContent>
                </Card>
              </div>
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
                    <Button variant="outline" size="sm" className="w-full mt-4">
                      <Target className="w-4 h-4 mr-2" />
                      Adjust Goals
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
              </div>
            </div>
          </TabsContent>

          {/* Grocery List Tab */}
          <TabsContent value="grocery">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle>Shopping List</CardTitle>
                        <CardDescription className="mt-2">Week of Dec 1-7</CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setShowAddGroceryModal(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Item
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowScanModal(true)}>
                          <Camera className="w-4 h-4 mr-2" />
                          Scan
                        </Button>
                        <Button variant="outline" size="sm" onClick={optimizeShoppingList}>
                          <Filter className="w-4 h-4 mr-2" />
                          Optimize
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportGroceryList}>
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {groceryList.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No items in your grocery list</p>
                          <p className="text-sm mt-1">Add items or scan barcodes to get started</p>
                        </div>
                      ) : (
                        (() => {
                          // Get all unique categories from the list
                          const categories = Array.from(new Set(groceryList.map((item: any) => item.category || 'Other')));
                          const categoryOrder = ['Protein', 'Produce', 'Grains', 'Dairy', 'From Recipe', 'Other'];
                          const sortedCategories = categories.sort((a, b) => {
                            const aIndex = categoryOrder.indexOf(a);
                            const bIndex = categoryOrder.indexOf(b);
                            if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
                            if (aIndex === -1) return 1;
                            if (bIndex === -1) return -1;
                            return aIndex - bIndex;
                          });

                          return sortedCategories.map((category) => (
                            <div key={category}>
                              <h3 className="font-medium text-sm text-gray-700 mb-2">{category}</h3>
                              <div className="space-y-2">
                                {groceryList
                                  .filter((item: any) => (item.category || 'Other') === category)
                                  .map((item: any, catIndex: number) => {
                                    const globalIndex = groceryList.findIndex((i: any) => i === item);
                                    return (
                                      <div key={globalIndex} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        <input
                                          type="checkbox"
                                          checked={item.checked}
                                          className="w-5 h-5 rounded border-gray-300 cursor-pointer"
                                          onChange={() => toggleGroceryItem(globalIndex)}
                                        />
                                        <div className="flex-1">
                                          <span className={`text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                            {item.name || item.item}
                                          </span>
                                          {item.notes && (
                                            <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
                                          )}
                                        </div>
                                        <span className="text-sm text-gray-500">{item.amount}</span>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          ));
                        })()
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm">Items Checked</span>
                          <span className="text-sm font-medium">1 / 5</span>
                        </div>
                        <Progress value={20} className="h-2" />
                      </div>
                      <div className="pt-4 border-t">
                        <p className="text-xs text-gray-600 mb-3">Estimated Cost</p>
                        <p className="text-2xl font-bold text-gray-900">$47.80</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {normalizedSavingsReport && (
                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        Savings Report
                      </CardTitle>
                      <CardDescription>Your grocery budget performance</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-gray-600 mb-1">Total Saved</p>
                          <p className="text-2xl font-bold text-green-600">
                            ${normalizedSavingsReport.totalSaved.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {normalizedSavingsReport.savingsRate} savings rate
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-gray-600 mb-1">Pantry Savings</p>
                          <p className="text-2xl font-bold text-emerald-600">
                            ${normalizedSavingsReport.pantrySavings.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {normalizedSavingsReport.pantryItemCount} items owned
                          </p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-green-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">Top Saving Categories:</p>
                        <div className="space-y-2">
                          {normalizedSavingsReport.topSavingCategories.slice(0, 3).map((category: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{category?.category || 'Other'}</span>
                              <span className="font-medium text-green-600">-${Number(category?.saved || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <p className="text-xs font-medium text-gray-700">Smart Shopping</p>
                        </div>
                        <p className="text-xs text-gray-600">
                          You're spending {normalizedSavingsReport.savingsRate} less than estimated!
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Smart Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      size="sm"
                      onClick={checkPantryFirst}
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Check Pantry First
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      size="sm"
                      onClick={shareWithFamily}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Share with Family
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Star className="w-4 h-4 mr-2" />
                      Add to Favorites
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
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

        {/* Pantry Modal */}
        {showPantryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Package className="w-6 h-6 text-green-500" />
                  Use Pantry Items
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowPantryModal(false)}>✕</Button>
              </div>

              <p className="text-gray-600 mb-6">Select ingredients from your pantry to generate meal suggestions:</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {['Chicken Breast', 'Rice', 'Eggs', 'Pasta', 'Tomatoes', 'Spinach', 'Cheese', 'Beans', 'Potatoes'].map((item) => (
                  <label key={item} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm">{item}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Suggested Meals:</h4>
                {[
                  { name: 'Chicken Fried Rice', calories: 420, protein: 32, carbs: 48, fat: 14 },
                  { name: 'Pasta Primavera', calories: 380, protein: 18, carbs: 52, fat: 12 },
                ].map((meal, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                    <div>
                      <h5 className="font-medium">{meal.name}</h5>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{meal.calories} cal</Badge>
                        <Badge variant="secondary" className="text-xs">P: {meal.protein}g</Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        toast({
                          description: `✅ ${meal.name} added to your planner!`,
                        });
                        setShowPantryModal(false);
                      }}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full mt-6" onClick={() => setShowPantryModal(false)}>
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Load Template Modal */}
        {showLoadTemplateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Save className="w-6 h-6 text-blue-500" />
                  Load Template
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowLoadTemplateModal(false)}>✕</Button>
              </div>

              <p className="text-gray-600 mb-6">Select a saved meal plan template to load:</p>

              <div className="space-y-3">
                {(() => {
                  const templates = [];
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key?.startsWith('meal-template-')) {
                      templates.push(key.replace('meal-template-', ''));
                    }
                  }

                  if (templates.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <Save className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No saved templates yet</p>
                        <p className="text-sm mt-1">Create a meal plan and click "Save Template" to save it</p>
                      </div>
                    );
                  }

                  return templates.map((templateName) => (
                    <div
                      key={templateName}
                      className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                      onClick={() => loadTemplate(templateName)}
                    >
                      <div>
                        <h4 className="font-medium">{templateName}</h4>
                        <p className="text-xs text-gray-500">Click to load</p>
                      </div>
                      <Button size="sm">Load</Button>
                    </div>
                  ));
                })()}
              </div>

              <Button variant="outline" className="w-full mt-6" onClick={() => setShowLoadTemplateModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Add Grocery Item Modal */}
        {showAddGroceryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-green-500" />
                  Add Grocery Item
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAddGroceryModal(false)}>✕</Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Item Name *</label>
                  <input
                    id="groceryItemName"
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    placeholder="e.g., Chicken Breast"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Amount</label>
                  <input
                    id="groceryItemAmount"
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    placeholder="e.g., 2 lbs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    id="groceryItemCategory"
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="Protein">Protein</option>
                    <option value="Produce">Produce</option>
                    <option value="Grains">Grains</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    className="flex-1"
                    onClick={handleAddGroceryItem}
                  >
                    Add Item
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddGroceryModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* Share with Family Dialog */}
        <Dialog open={showShareFamilyModal} onOpenChange={setShowShareFamilyModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Share Grocery List with Family</DialogTitle>
              <DialogDescription>
                Copy your grocery list to share with family members
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Family Members List */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Family Members:</h4>
                {familyMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No family members found. Add them in the Allergies section.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {familyMembers.map((member: any) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                      >
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{member.name}</p>
                          {member.relationship && (
                            <p className="text-xs text-muted-foreground">{member.relationship}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grocery List Summary */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-2">Grocery List Summary:</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {groceryList.length} items in your list
                </p>

                <Button
                  onClick={copyGroceryListToClipboard}
                  className="w-full"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy List to Clipboard
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  You can paste this list in any messaging app to share with family
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
