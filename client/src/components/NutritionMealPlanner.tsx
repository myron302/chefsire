import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, Target, TrendingUp, Clock, Users, ChefHat, Star, Lock, Crown,
  ShoppingCart, CheckCircle, BarChart3, PieChart, Download, Filter, Save,
  AlertCircle, Package, Utensils, CalendarDays, Zap, ListChecks, Settings, Camera
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';

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

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    fetchUserData();
    fetchMealPlans();
    if (isPremium) {
      fetchDailyNutrition();
      fetchGroceryList();
    }
  }, [selectedDate, isPremium, user]);

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
      setGroceryList([
        { id: 1, item: 'Chicken Breast', amount: '2 lbs', category: 'Protein', checked: false },
        { id: 2, item: 'Quinoa', amount: '1 bag', category: 'Grains', checked: false },
        { id: 3, item: 'Mixed Greens', amount: '2 bags', category: 'Produce', checked: true },
        { id: 4, item: 'Salmon Fillets', amount: '4 pieces', category: 'Protein', checked: false },
        { id: 5, item: 'Greek Yogurt', amount: '32 oz', category: 'Dairy', checked: false },
      ]);
    } catch (error) {
      console.error('Error fetching grocery list:', error);
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

  const generateGroceryList = async () => {
    // Generate grocery list from weekly meals
    const items = [];
    Object.values(weeklyMeals).forEach((dayMeals: any) => {
      Object.values(dayMeals).forEach((meal: any) => {
        if (meal.ingredients) {
          meal.ingredients.forEach((ingredient: string) => {
            items.push({ name: ingredient, checked: false, category: 'Other' });
          });
        }
      });
    });

    setGroceryList(items.length > 0 ? items : [
      { name: 'Chicken breast (2 lbs)', checked: false, category: 'Protein' },
      { name: 'Brown rice (1 bag)', checked: false, category: 'Grains' },
      { name: 'Broccoli (2 heads)', checked: false, category: 'Vegetables' },
      { name: 'Sweet potatoes (5)', checked: false, category: 'Vegetables' },
      { name: 'Greek yogurt (32oz)', checked: false, category: 'Dairy' },
      { name: 'Eggs (dozen)', checked: false, category: 'Protein' },
    ]);

    toast({
      description: "✅ Grocery list generated from your meal plan!",
    });
  };

  const optimizeShoppingList = async () => {
    // Sort grocery list by category
    const sortedList = [...groceryList].sort((a: any, b: any) =>
      a.category.localeCompare(b.category)
    );
    setGroceryList(sortedList);

    toast({
      description: "🛒 Shopping list optimized by category!",
    });
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

  const toggleGroceryItem = (index: number) => {
    setGroceryList((prev: any) => prev.map((item: any, i: number) =>
      i === index ? { ...item, checked: !item.checked } : item
    ));
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

        <div className="flex gap-4">
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
            className="border-2 border-white text-white hover:bg-white/10"
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
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="planner">
              <Calendar className="w-4 h-4 mr-2" />
              Meal Planner
            </TabsTrigger>
            <TabsTrigger value="nutrition">
              <Target className="w-4 h-4 mr-2" />
              Nutrition
            </TabsTrigger>
            <TabsTrigger value="grocery">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Grocery List
            </TabsTrigger>
            <TabsTrigger value="prep">
              <Clock className="w-4 h-4 mr-2" />
              Meal Prep
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant={viewMode === 'day' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('day')}
                  >
                    Day
                  </Button>
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('week')}
                  >
                    Week
                  </Button>
                  <Button
                    variant={viewMode === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('month')}
                  >
                    Month
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={saveTemplate}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Template
                  </Button>
                  <Button size="sm" onClick={() => handleAddMeal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Meal
                  </Button>
                </div>
              </div>

              {/* Weekly Calendar View */}
              {viewMode === 'week' && (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="grid grid-cols-8 border-b">
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
                    <div key={mealType} className="grid grid-cols-8 border-b last:border-b-0">
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
              )}

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-6 text-center">
                    <Zap className="w-8 h-8 mx-auto mb-3 text-orange-500" />
                    <h3 className="font-medium mb-2">AI Recipe Suggestions</h3>
                    <p className="text-sm text-gray-600">Get personalized recipe recommendations</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-6 text-center">
                    <Package className="w-8 h-8 mx-auto mb-3 text-green-500" />
                    <h3 className="font-medium mb-2">Use Pantry Items</h3>
                    <p className="text-sm text-gray-600">Plan meals with what you have</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
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
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Shopping List</CardTitle>
                        <CardDescription>Week of Dec 1-7</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={optimizeShoppingList}>
                          <Filter className="w-4 h-4 mr-2" />
                          Optimize
                        </Button>
                        <Button size="sm" onClick={generateGroceryList}>
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {['Protein', 'Produce', 'Grains', 'Dairy'].map((category) => (
                        <div key={category}>
                          <h3 className="font-medium text-sm text-gray-700 mb-2">{category}</h3>
                          <div className="space-y-2">
                            {groceryList
                              .filter((item: any) => item.category === category)
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
                                    </div>
                                    <span className="text-sm text-gray-500">{item.amount}</span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ))}
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

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Smart Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button variant="outline" className="w-full justify-start" size="sm">
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
