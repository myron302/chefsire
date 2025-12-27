import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, Target, TrendingUp, Clock, Users, ChefHat, Star, Lock, Crown,
  ShoppingCart, CheckCircle, BarChart3, PieChart, Download, Filter, Save,
  AlertCircle, Package, Utensils, CalendarDays, Zap, ListChecks, Settings, Camera,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import BarcodeScanner from '@/components/BarcodeScanner';
import { exportCSV, exportText } from "@/lib/shoppingExport";

const NutritionMealPlanner = () => {
  const { user, updateUser } = useUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('planner');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [mealPlans, setMealPlans] = useState([]);
  const [groceryList, setGroceryList] = useState([]);
  const [dailyNutrition, setDailyNutrition] = useState(null);
  const [nutritionGoals, setNutritionGoals] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weeklyMeals, setWeeklyMeals] = useState({});
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [selectedMealSlot, setSelectedMealSlot] = useState<{day: string, type: string} | null>(null);
  const [showAIRecipeModal, setShowAIRecipeModal] = useState(false);
  const [showPantryModal, setShowPantryModal] = useState(false);
  const [showLoadTemplateModal, setShowLoadTemplateModal] = useState(false);
  const [savingsReport, setSavingsReport] = useState<any>(null);
  const [showAddGroceryModal, setShowAddGroceryModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    fetchUserData();
    fetchMealPlans();
    if (isPremium) {
      fetchDailyNutrition();
      fetchGroceryList();
      fetchSavingsReport();
    }
  }, [selectedDate, isPremium, user]);

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
      // Mock data for demo
      setWeeklyMeals({
        'Monday': {
          breakfast: { name: 'Protein Oatmeal', calories: 350, protein: 20, carbs: 45, fat: 8 },
          lunch: { name: 'Grilled Chicken Salad', calories: 450, protein: 35, carbs: 30, fat: 15 },
          dinner: { name: 'Salmon & Quinoa', calories: 550, protein: 40, carbs: 45, fat: 20 },
        },
        // More days...
      });
    } catch (error) {
      console.error('Error fetching meal plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyNutrition = async () => {
    try {
      setDailyNutrition({
        calories: 1850,
        protein: 145,
        carbs: 180,
        fat: 62,
        goal: nutritionGoals
      });
    } catch (error) {
      console.error('Error fetching daily nutrition:', error);
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
    setShowAddMealModal(true);
  };

  const saveMealToSlot = (mealData: any) => {
    if (selectedMealSlot) {
      setWeeklyMeals((prev: any) => ({
        ...prev,
        [selectedMealSlot.day]: {
          ...prev[selectedMealSlot.day],
          [selectedMealSlot.type]: mealData
        }
      }));

      toast({
        description: "✅ Meal added to your planner!",
      });
    }
    setShowAddMealModal(false);
    setSelectedMealSlot(null);
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
          <TabsList className="grid w-full grid-cols-5 mb-8 h-auto">
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
                        <span className="text-4xl font-bold">1,850</span>
                        <span className="text-white/80 text-lg">/ 2,000 kcal</span>
                      </div>
                      <Progress value={92.5} className="h-2 mt-3 bg-white/20" />
                    </div>
                    <div className="text-right">
                      <div className="bg-white/20 backdrop-blur rounded-lg px-4 py-3">
                        <p className="text-sm text-white/90">Remaining</p>
                        <p className="text-2xl font-bold">150</p>
                        <p className="text-xs text-white/80">calories</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="bg-white/15 backdrop-blur rounded-lg p-3 text-center">
                      <p className="text-xs text-white/80">Protein</p>
                      <p className="text-lg font-semibold">145g</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur rounded-lg p-3 text-center">
                      <p className="text-xs text-white/80">Carbs</p>
                      <p className="text-lg font-semibold">180g</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur rounded-lg p-3 text-center">
                      <p className="text-xs text-white/80">Fat</p>
                      <p className="text-lg font-semibold">62g</p>
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
                        {weekDays.map((day) => (
                          <div
                            key={`${day}-${mealType}`}
                            className="p-3 border-r last:border-r-0 hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleAddMeal(day, mealType)}
                          >
                            {weeklyMeals[day]?.[mealType] ? (
                              <div className="space-y-1">
                                <div className="text-sm font-medium text-gray-900">{weeklyMeals[day][mealType].name}</div>
                                <div className="text-xs text-gray-500">{weeklyMeals[day][mealType].calories} cal</div>
                                <div className="flex gap-1">
                                  <Badge variant="secondary" className="text-xs">P: {weeklyMeals[day][mealType].protein}g</Badge>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <Plus className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </div>
                        ))}
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
                            <div
                              key={`${day}-${mealType}`}
                              className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                              onClick={() => handleAddMeal(day, mealType)}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700 capitalize">{mealType}</span>
                                {!weeklyMeals[day]?.[mealType] && <Plus className="w-4 h-4 text-gray-400" />}
                              </div>
                              {weeklyMeals[day]?.[mealType] ? (
                                <div className="space-y-1">
                                  <div className="text-sm font-medium text-gray-900">{weeklyMeals[day][mealType].name}</div>
                                  <div className="text-xs text-gray-500">{weeklyMeals[day][mealType].calories} cal</div>
                                  <div className="flex gap-1">
                                    <Badge variant="secondary" className="text-xs">P: {weeklyMeals[day][mealType].protein}g</Badge>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">Tap to add meal</p>
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
                        <span className="text-sm text-gray-600">1,850 / 2,000</span>
                      </div>
                      <Progress value={92.5} className="h-2" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <MacroCard label="Protein" current={145} goal={150} unit="g" color="blue" />
                      <MacroCard label="Carbs" current={180} goal={200} unit="g" color="orange" />
                      <MacroCard label="Fat" current={62} goal={65} unit="g" color="purple" />
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
                        <p>Chart visualization would go here</p>
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
                      <span className="text-sm font-medium">2,000 kcal</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Protein</span>
                      <span className="text-sm font-medium">150g (30%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Carbs</span>
                      <span className="text-sm font-medium">200g (40%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Fat</span>
                      <span className="text-sm font-medium">65g (30%)</span>
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

                {savingsReport && (
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
                            ${savingsReport.summary.totalSaved}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {savingsReport.summary.savingsRate} savings rate
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-gray-600 mb-1">Pantry Savings</p>
                          <p className="text-2xl font-bold text-emerald-600">
                            ${savingsReport.pantry.savings}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {savingsReport.pantry.itemCount} items owned
                          </p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-green-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">Top Saving Categories:</p>
                        <div className="space-y-2">
                          {savingsReport.topSavingCategories.slice(0, 3).map((category: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{category.category}</span>
                              <span className="font-medium text-green-600">-${category.saved.toFixed(2)}</span>
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
                          You're spending {savingsReport.summary.savingsRate} less than estimated!
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
                    <Button variant="outline" className="w-full justify-start" size="sm">
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
        </Tabs>

        {/* Add Meal Modal */}
        {showAddMealModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4">
                Add Meal {selectedMealSlot && `- ${selectedMealSlot.day} ${selectedMealSlot.type}`}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Meal Name</label>
                  <input
                    id="mealName"
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    placeholder="e.g., Grilled Chicken Salad"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Calories</label>
                    <input
                      id="calories"
                      type="number"
                      className="w-full border rounded px-3 py-2"
                      placeholder="450"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Protein (g)</label>
                    <input
                      id="protein"
                      type="number"
                      className="w-full border rounded px-3 py-2"
                      placeholder="35"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Carbs (g)</label>
                    <input
                      id="carbs"
                      type="number"
                      className="w-full border rounded px-3 py-2"
                      placeholder="20"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      const name = (document.getElementById('mealName') as HTMLInputElement).value;
                      const calories = (document.getElementById('calories') as HTMLInputElement).value;
                      const protein = (document.getElementById('protein') as HTMLInputElement).value;
                      const carbs = (document.getElementById('carbs') as HTMLInputElement).value;

                      if (name && calories && protein) {
                        saveMealToSlot({
                          name,
                          calories: Number(calories),
                          protein: Number(protein),
                          carbs: Number(carbs),
                          fat: 0
                        });
                      } else {
                        toast({
                          variant: "destructive",
                          description: "Please fill in meal name, calories, and protein",
                        });
                      }
                    }}
                  >
                    Add Meal
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddMealModal(false);
                      setSelectedMealSlot(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Recipe Modal */}
        {showAIRecipeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Zap className="w-6 h-6 text-orange-500" />
                  AI Recipe Suggestions
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAIRecipeModal(false)}>✕</Button>
              </div>

              <p className="text-gray-600 mb-6">Based on your goals and preferences, here are some recipes for you:</p>

              <div className="space-y-4">
                {[
                  { name: 'High-Protein Chicken Bowl', calories: 520, protein: 45, carbs: 42, fat: 18, description: 'Grilled chicken with quinoa, roasted vegetables, and tahini dressing' },
                  { name: 'Mediterranean Salmon', calories: 480, protein: 38, carbs: 35, fat: 22, description: 'Baked salmon with Greek salad and whole grain pita' },
                  { name: 'Turkey & Sweet Potato', calories: 450, protein: 42, carbs: 48, fat: 12, description: 'Lean ground turkey with roasted sweet potato and green beans' },
                ].map((recipe, idx) => (
                  <Card key={idx} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-lg">{recipe.name}</h4>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (selectedMealSlot) {
                              saveMealToSlot({
                                name: recipe.name,
                                calories: recipe.calories,
                                protein: recipe.protein,
                                carbs: recipe.carbs,
                                fat: recipe.fat
                              });
                            } else {
                              toast({
                                description: `✅ ${recipe.name} saved!`,
                              });
                            }
                            setShowAIRecipeModal(false);
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
                      <div className="flex gap-3">
                        <Badge variant="secondary">{recipe.calories} cal</Badge>
                        <Badge variant="secondary">P: {recipe.protein}g</Badge>
                        <Badge variant="secondary">C: {recipe.carbs}g</Badge>
                        <Badge variant="secondary">F: {recipe.fat}g</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
