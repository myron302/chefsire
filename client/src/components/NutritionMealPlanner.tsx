import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Target, TrendingUp, Clock, Users, ChefHat, Star, Lock, Crown } from 'lucide-react';

const NutritionMealPlanner = () => {
  const [activeTab, setActiveTab] = useState('planner');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [mealPlans, setMealPlans] = useState([]);
  const [dailyNutrition, setDailyNutrition] = useState(null);
  const [nutritionGoals, setNutritionGoals] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  useEffect(() => {
    fetchUserData();
    fetchMealPlans();
    if (isPremium) {
      fetchDailyNutrition();
    }
  }, [selectedDate, isPremium]);

  const fetchUserData = async () => {
    try {
      // Mock user check - replace with actual user data
      setIsPremium(false); // Set based on actual user subscription
      setNutritionGoals({
        dailyCalorieGoal: 2000,
        macroGoals: { protein: 25, carbs: 45, fat: 30 }
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchMealPlans = async () => {
    setLoading(true);
    try {
      const userId = "user-123"; // Mock user ID
      const response = await fetch(`/api/users/${userId}/meal-plans`);
      if (response.ok) {
        const data = await response.json();
        setMealPlans(data.mealPlans || []);
      }
    } catch (error) {
      console.error('Error fetching meal plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyNutrition = async () => {
    try {
      const userId = "user-123";
      const response = await fetch(`/api/users/${userId}/nutrition/daily/${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setDailyNutrition(data);
      }
    } catch (error) {
      console.error('Error fetching daily nutrition:', error);
    }
  };

  const startNutritionTrial = async () => {
    try {
      const userId = "user-123";
      const response = await fetch(`/api/users/${userId}/nutrition/trial`, {
        method: 'POST'
      });
      if (response.ok) {
        setIsPremium(true);
        setShowUpgrade(false);
      }
    } catch (error) {
      console.error('Error starting trial:', error);
    }
  };

  const createMealPlan = async () => {
    try {
      const userId = "user-123";
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 7);

      const response = await fetch('/api/meal-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          name: `Meal Plan - Week of ${startDate.toLocaleDateString()}`,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          isTemplate: false
        })
      });

      if (response.ok) {
        fetchMealPlans();
      }
    } catch (error) {
      console.error('Error creating meal plan:', error);
    }
  };

  const PremiumUpgrade = () => (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-lg mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Crown className="w-8 h-8 mr-3" />
          <div>
            <h3 className="text-lg font-semibold">Unlock Nutrition Premium</h3>
            <p className="text-orange-100">Track nutrition, plan meals, and reach your health goals</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={startNutritionTrial}
            className="bg-white text-orange-600 px-4 py-2 rounded-lg font-medium hover:bg-orange-50 transition-colors"
          >
            Start 30-Day Free Trial
          </button>
          <button className="border border-white text-white px-4 py-2 rounded-lg font-medium hover:bg-white hover:bg-opacity-10 transition-colors">
            Learn More
          </button>
        </div>
      </div>
    </div>
  );

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Nutrition & Meal Planning</h1>
            <p className="text-gray-600">Plan your meals and track nutrition to achieve your health goals</p>
          </div>

          <PremiumUpgrade />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-orange-500" />
                Weekly Meal Planning
              </h3>
              <div className="space-y-3 mb-4">
                <div className="flex items-center text-gray-600">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
                  Plan meals for the entire week
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
                  Use recipes from your saved collection
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
                  Generate shopping lists automatically
                </div>
              </div>
              <div className="bg-gray-100 rounded-lg p-4 text-center">
                <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Upgrade to access meal planning</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-green-500" />
                Nutrition Tracking
              </h3>
              <div className="space-y-3 mb-4">
                <div className="flex items-center text-gray-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                  Track daily calories and macros
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                  Set personalized nutrition goals
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                  View detailed progress analytics
                </div>
              </div>
              <div className="bg-gray-100 rounded-lg p-4 text-center">
                <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Upgrade to track nutrition</p>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-white rounded-lg shadow-sm p-8 text-center">
            <Crown className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Premium Features</h3>
            <p className="text-gray-600 mb-6">Take control of your nutrition and meal planning</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-orange-600" />
                </div>
                <h4 className="font-medium mb-2">Meal Planning</h4>
                <p className="text-sm text-gray-600">Plan weekly menus with your favorite recipes</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Target className="w-6 h-6 text-green-600" />
                </div>
                <h4 className="font-medium mb-2">Nutrition Goals</h4>
                <p className="text-sm text-gray-600">Set and track personalized nutrition targets</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-medium mb-2">Progress Analytics</h4>
                <p className="text-sm text-gray-600">Detailed insights into your eating habits</p>
              </div>
            </div>
            <button
              onClick={startNutritionTrial}
              className="bg-orange-500 text-white px-8 py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              Start Free Trial - No Credit Card Required
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Nutrition & Meal Planning</h1>
              <p className="text-gray-600">Plan your meals and track nutrition goals</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                <Crown className="w-4 h-4 mr-1" />
                Premium Active
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('planner')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'planner'
                ? 'bg-orange-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            Meal Planner
          </button>
          <button
            onClick={() => setActiveTab('nutrition')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'nutrition'
                ? 'bg-orange-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Target className="w-4 h-4 inline mr-2" />
            Nutrition Tracking
          </button>
          <button
            onClick={() => setActiveTab('goals')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'goals'
                ? 'bg-orange-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Goals & Progress
          </button>
        </div>

        {/* Meal Planner Tab */}
        {activeTab === 'planner' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-gray-600">Week of {new Date(selectedDate).toLocaleDateString()}</span>
              </div>
              <button
                onClick={createMealPlan}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Meal Plan
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading meal plans...</p>
              </div>
            ) : mealPlans.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No meal plans yet</h3>
                <p className="text-gray-600 mb-4">Create your first meal plan to get started</p>
                <button
                  onClick={createMealPlan}
                  className="bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                >
                  Create Meal Plan
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* Week View Header */}
                <div className="grid grid-cols-8 border-b border-gray-200">
                  <div className="p-4 text-sm font-medium text-gray-700">Meal</div>
                  {weekDays.map((day) => (
                    <div key={day} className="p-4 text-sm font-medium text-gray-700 text-center border-l border-gray-200">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Meal Rows */}
                {mealTypes.map((mealType) => (
                  <div key={mealType} className="grid grid-cols-8 border-b border-gray-200 last:border-b-0">
                    <div className="p-4 bg-gray-50 border-r border-gray-200">
                      <div className="font-medium text-gray-900 capitalize">{mealType}</div>
                    </div>
                    {Array.from({ length: 7 }).map((_, dayIndex) => (
                      <div key={dayIndex} className="p-3 border-l border-gray-200 min-h-[100px]">
                        <div className="w-full h-full border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center hover:border-orange-300 transition-colors cursor-pointer group">
                          <Plus className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nutrition Tracking Tab */}
        {activeTab === 'nutrition' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Daily Summary */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Today's Nutrition</h3>
                {dailyNutrition ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{Math.round(dailyNutrition.summary?.totalCalories || 0)}</div>
                      <div className="text-sm text-gray-600">Calories</div>
                      <div className="text-xs text-gray-500">Goal: {nutritionGoals?.dailyCalorieGoal || 0}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{Math.round(dailyNutrition.summary?.totalProtein || 0)}g</div>
                      <div className="text-sm text-gray-600">Protein</div>
                      <div className="text-xs text-gray-500">{nutritionGoals?.macroGoals?.protein || 0}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{Math.round(dailyNutrition.summary?.totalCarbs || 0)}g</div>
                      <div className="text-sm text-gray-600">Carbs</div>
                      <div className="text-xs text-gray-500">{nutritionGoals?.macroGoals?.carbs || 0}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{Math.round(dailyNutrition.summary?.totalFat || 0)}g</div>
                      <div className="text-sm text-gray-600">Fat</div>
                      <div className="text-xs text-gray-500">{nutritionGoals?.macroGoals?.fat || 0}%</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Target className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">No nutrition data for today</p>
                    <button className="mt-2 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600">
                      Log First Meal
                    </button>
                  </div>
                )}
              </div>

              {/* Meal Log */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Today's Meals</h3>
                  <button className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 flex items-center">
                    <Plus className="w-4 h-4 mr-1" />
                    Log Food
                  </button>
                </div>
                <div className="space-y-4">
                  {mealTypes.map((mealType) => (
                    <div key={mealType} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium capitalize">{mealType}</h4>
                        <span className="text-sm text-gray-500">0 calories</span>
                      </div>
                      <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                        <Plus className="w-6 h-6 mx-auto mb-1" />
                        <p className="text-sm">Add food to {mealType}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Calories remaining</span>
                    <span className="font-medium">1,842</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Weekly average</span>
                    <span className="font-medium">1,650</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Streak</span>
                    <span className="font-medium">7 days</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Suggested from Pantry</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <ChefHat className="w-8 h-8 text-orange-500" />
                    <div className="flex-1">
                      <h4 className="font-medium">Chicken Stir Fry</h4>
                      <p className="text-sm text-gray-600">450 calories</p>
                    </div>
                    <Plus className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <ChefHat className="w-8 h-8 text-orange-500" />
                    <div className="flex-1">
                      <h4 className="font-medium">Vegetable Soup</h4>
                      <p className="text-sm text-gray-600">220 calories</p>
                    </div>
                    <Plus className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Goals & Progress Tab */}
        {activeTab === 'goals' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Nutrition Goals</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Daily Calorie Goal</label>
                  <input
                    type="number"
                    value={nutritionGoals?.dailyCalorieGoal || 2000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Macro Distribution</label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Protein</span>
                      <span className="text-sm font-medium">{nutritionGoals?.macroGoals?.protein || 25}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Carbohydrates</span>
                      <span className="text-sm font-medium">{nutritionGoals?.macroGoals?.carbs || 45}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Fat</span>
                      <span className="text-sm font-medium">{nutritionGoals?.macroGoals?.fat || 30}%</span>
                    </div>
                  </div>
                </div>
                <button className="w-full bg-orange-500 text-white py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors">
                  Update Goals
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Progress Overview</h3>
              <div className="space-y-4">
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Progress charts will appear here</p>
                  <p className="text-sm">Start logging meals to see your progress</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NutritionMealPlanner;
