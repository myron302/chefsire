import React, { useState, useEffect } from 'react';
import {
  Brain, Calendar, Refrigerator, ShoppingBag, Trophy, Users, TrendingUp, Star,
  Clock, AlertCircle, CheckCircle, ChefHat, Sparkles, Target, Award, Gift
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';

interface Recommendation {
  id: string;
  recipe?: any;
  recommendationType: string;
  reason: string;
  score: string;
  targetDate: string;
  mealType: string;
}

interface Leftover {
  id: string;
  recipeName: string;
  quantity: string;
  storedDate: string;
  expiryDate?: string;
  storageLocation: string;
  consumed: boolean;
}

interface MealPrepSchedule {
  id: string;
  prepDay: string;
  prepTime?: string;
  batchRecipes: any[];
  shoppingDay?: string;
  completed: boolean;
  reminderEnabled: boolean;
}

interface Achievement {
  id: string;
  userAchievement: any;
  achievement: {
    name: string;
    description: string;
    icon: string;
    category: string;
    points: number;
    tier: string;
  };
}

interface GroceryItem {
  id: string;
  ingredientName: string;
  quantity?: string;
  category?: string;
  estimatedPrice?: string;
  actualPrice?: string;
  purchased: boolean;
  isPantryItem: boolean;
  aisle?: string;
  priority: string;
}

export const AdvancedFeaturesPanel = () => {
  const { user } = useUser();
  const { toast } = useToast();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [leftovers, setLeftovers] = useState<Leftover[]>([]);
  const [mealPrepSchedules, setMealPrepSchedules] = useState<MealPrepSchedule[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [budgetSummary, setBudgetSummary] = useState({ estimated: 0, actual: 0, difference: 0 });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRecommendations(),
        fetchLeftovers(),
        fetchMealPrepSchedules(),
        fetchAchievements(),
        fetchGroceryList(),
      ]);
    } catch (error) {
      console.error('Error loading advanced features:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load advanced features',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const res = await fetch('/api/meal-planner/meal-recommendations', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const generateRecommendations = async () => {
    try {
      const res = await fetch('/api/meal-planner/meal-recommendations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetDate: new Date().toISOString(),
          mealType: 'lunch',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
        toast({
          title: 'Success',
          description: `Generated ${data.recommendations.length} personalized recommendations!`,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate recommendations',
      });
    }
  };

  const fetchLeftovers = async () => {
    try {
      const res = await fetch('/api/meal-planner/leftovers?consumed=false', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setLeftovers(data.leftovers || []);
      }
    } catch (error) {
      console.error('Error fetching leftovers:', error);
    }
  };

  const addLeftover = async (leftoverData: any) => {
    try {
      const res = await fetch('/api/meal-planner/leftovers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(leftoverData),
      });

      if (res.ok) {
        await fetchLeftovers();
        toast({
          title: 'Success',
          description: 'Leftover tracked successfully!',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add leftover',
      });
    }
  };

  const markLeftoverConsumed = async (id: string, wasted: boolean = false) => {
    try {
      const res = await fetch(`/api/meal-planner/leftovers/${id}/consume`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ wasted }),
      });

      if (res.ok) {
        await fetchLeftovers();
        toast({
          title: 'Success',
          description: wasted ? 'Leftover marked as wasted' : 'Leftover marked as consumed',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update leftover',
      });
    }
  };

  const fetchMealPrepSchedules = async () => {
    try {
      const res = await fetch('/api/meal-planner/meal-prep-schedules', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMealPrepSchedules(data.schedules || []);
      }
    } catch (error) {
      console.error('Error fetching meal prep schedules:', error);
    }
  };

  const createMealPrepSchedule = async (scheduleData: any) => {
    try {
      const res = await fetch('/api/meal-planner/meal-prep-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(scheduleData),
      });

      if (res.ok) {
        await fetchMealPrepSchedules();
        toast({
          title: 'Success',
          description: 'Meal prep schedule created!',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create meal prep schedule',
      });
    }
  };

  const fetchAchievements = async () => {
    try {
      const res = await fetch('/api/meal-planner/achievements', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAchievements(data.achievements || []);
        setTotalPoints(data.totalPoints || 0);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  };

  const initializeAchievements = async () => {
    try {
      const res = await fetch('/api/meal-planner/achievements/initialize', {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        await fetchAchievements();
        toast({
          title: 'Success',
          description: 'Achievements initialized!',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to initialize achievements',
      });
    }
  };

  const fetchGroceryList = async () => {
    try {
      const res = await fetch('/api/meal-planner/grocery-list?purchased=false', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setGroceryItems(data.items || []);
        setBudgetSummary(data.budget || { estimated: 0, actual: 0, difference: 0 });
      }
    } catch (error) {
      console.error('Error fetching grocery list:', error);
    }
  };

  const checkPantry = async () => {
    try {
      const res = await fetch('/api/meal-planner/grocery-list/check-pantry', {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        await fetchGroceryList();
        toast({
          title: 'Pantry Check Complete',
          description: `Found ${data.matched} items already in your pantry!`,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to check pantry',
      });
    }
  };

  const getOptimizedGroceryList = async () => {
    try {
      const res = await fetch('/api/meal-planner/grocery-list/optimized', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'List Optimized',
          description: `Organized ${data.totalItems} items by store layout!`,
        });
        return data.optimized;
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to optimize list',
      });
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'bg-purple-500';
      case 'gold': return 'bg-yellow-500';
      case 'silver': return 'bg-gray-400';
      case 'bronze': return 'bg-orange-600';
      default: return 'bg-gray-500';
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const days = Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="container mx-auto p-4">
      <Tabs defaultValue="recommendations" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="recommendations">
            <Brain className="w-4 h-4 mr-2" />
            AI Recommendations
          </TabsTrigger>
          <TabsTrigger value="mealprep">
            <Calendar className="w-4 h-4 mr-2" />
            Meal Prep
          </TabsTrigger>
          <TabsTrigger value="leftovers">
            <Refrigerator className="w-4 h-4 mr-2" />
            Leftovers
          </TabsTrigger>
          <TabsTrigger value="grocery">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Smart Grocery
          </TabsTrigger>
          <TabsTrigger value="achievements">
            <Trophy className="w-4 h-4 mr-2" />
            Achievements
          </TabsTrigger>
        </TabsList>

        {/* AI Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI-Powered Meal Recommendations
              </CardTitle>
              <CardDescription>
                Personalized suggestions based on your goals, preferences, and nutrition gaps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={generateRecommendations} className="w-full">
                <Brain className="w-4 h-4 mr-2" />
                Generate Recommendations
              </Button>

              <div className="space-y-3">
                {recommendations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No recommendations yet. Generate some to get started!</p>
                  </div>
                ) : (
                  recommendations.map((rec) => (
                    <Card key={rec.id} className="border-l-4 border-l-purple-500">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <ChefHat className="w-4 h-4 text-purple-500" />
                              <h4 className="font-semibold">
                                {rec.recipe?.title || 'Meal Suggestion'}
                              </h4>
                              <Badge variant="secondary">{rec.mealType}</Badge>
                              <Badge variant="outline">{(Number(rec.score) * 100).toFixed(0)}% match</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{rec.reason}</p>
                            <div className="flex gap-2">
                              {rec.recipe && (
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>{rec.recipe.calories} cal</span>
                                  <span>{rec.recipe.protein}g protein</span>
                                  <span>{rec.recipe.carbs}g carbs</span>
                                  <span>{rec.recipe.fat}g fat</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="default">
                              Add to Plan
                            </Button>
                            <Button size="sm" variant="ghost">
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meal Prep Tab */}
        <TabsContent value="mealprep" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Meal Prep Scheduling
              </CardTitle>
              <CardDescription>
                Plan your batch cooking sessions and save time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Create Prep Schedule
              </Button>

              <div className="space-y-3">
                {mealPrepSchedules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No meal prep schedules yet. Create one to get organized!</p>
                  </div>
                ) : (
                  mealPrepSchedules.map((schedule) => (
                    <Card key={schedule.id} className={schedule.completed ? 'opacity-60' : ''}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold capitalize">{schedule.prepDay}</h4>
                              {schedule.completed && <CheckCircle className="w-4 h-4 text-green-500" />}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Prep Time: {schedule.prepTime || 'Not set'}
                              {schedule.shoppingDay && ` • Shop: ${schedule.shoppingDay}`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {schedule.batchRecipes.length} recipes planned
                            </p>
                          </div>
                          {!schedule.completed && (
                            <Button size="sm" variant="default">
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leftovers Tab */}
        <TabsContent value="leftovers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Refrigerator className="w-5 h-5 text-green-500" />
                Leftover Tracking
              </CardTitle>
              <CardDescription>
                Reduce waste and get repurposing suggestions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Track New Leftover
              </Button>

              <div className="space-y-3">
                {leftovers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Refrigerator className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No leftovers tracked. Add them to reduce food waste!</p>
                  </div>
                ) : (
                  leftovers.map((leftover) => {
                    const daysLeft = leftover.expiryDate ? getDaysUntilExpiry(leftover.expiryDate) : null;
                    const isExpiring = daysLeft !== null && daysLeft <= 2;

                    return (
                      <Card key={leftover.id} className={isExpiring ? 'border-l-4 border-l-red-500' : ''}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">{leftover.recipeName}</h4>
                                {isExpiring && (
                                  <Badge variant="destructive">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    {daysLeft === 0 ? 'Expires today' : `${daysLeft} days left`}
                                  </Badge>
                                )}
                                <Badge variant="outline">{leftover.storageLocation}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Quantity: {leftover.quantity}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Stored: {new Date(leftover.storedDate).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => markLeftoverConsumed(leftover.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Consumed
                              </Button>
                              <Button size="sm" variant="outline">
                                Ideas
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Smart Grocery Tab */}
        <TabsContent value="grocery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-500" />
                Smart Grocery List
              </CardTitle>
              <CardDescription>
                Optimized shopping with budget tracking and pantry integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Estimated</p>
                      <p className="text-2xl font-bold">${budgetSummary.estimated.toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Actual</p>
                      <p className="text-2xl font-bold">${budgetSummary.actual.toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Difference</p>
                      <p className={`text-2xl font-bold ${budgetSummary.difference > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        ${Math.abs(budgetSummary.difference).toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-2">
                <Button onClick={checkPantry} variant="outline" className="flex-1">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Check Pantry
                </Button>
                <Button onClick={getOptimizedGroceryList} variant="outline" className="flex-1">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Optimize List
                </Button>
              </div>

              <div className="space-y-2">
                {groceryItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={item.purchased}
                        className="w-5 h-5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={item.purchased ? 'line-through text-muted-foreground' : ''}>
                            {item.ingredientName}
                          </span>
                          {item.isPantryItem && (
                            <Badge variant="secondary">In Pantry</Badge>
                          )}
                          {item.priority === 'high' && (
                            <Badge variant="destructive">Priority</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} {item.category && `• ${item.category}`}
                          {item.aisle && ` • Aisle ${item.aisle}`}
                        </p>
                      </div>
                      <div className="text-right">
                        {item.estimatedPrice && (
                          <p className="text-sm">${Number(item.estimatedPrice).toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Achievements & Progress
              </CardTitle>
              <CardDescription>
                Track your meal planning journey and earn rewards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <Trophy className="w-12 h-12 mx-auto mb-2" />
                    <h3 className="text-3xl font-bold">{totalPoints}</h3>
                    <p className="text-sm opacity-90">Total Points Earned</p>
                  </div>
                </CardContent>
              </Card>

              {achievements.length === 0 ? (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground mb-4">No achievements yet</p>
                  <Button onClick={initializeAchievements}>
                    <Gift className="w-4 h-4 mr-2" />
                    Initialize Achievements
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {achievements.map((ach) => (
                    <Card key={ach.id} className={ach.userAchievement.completed ? 'border-2 border-yellow-500' : 'opacity-70'}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <div className={`text-2xl ${ach.userAchievement.completed ? 'grayscale-0' : 'grayscale'}`}>
                            {ach.achievement.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">{ach.achievement.name}</h4>
                              <Badge className={getTierColor(ach.achievement.tier)}>
                                {ach.achievement.tier}
                              </Badge>
                              {ach.userAchievement.completed && (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {ach.achievement.description}
                            </p>
                            {!ach.userAchievement.completed && (
                              <Progress
                                value={(ach.userAchievement.progress / (ach.achievement.requirement as any).threshold) * 100}
                                className="h-2"
                              />
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-yellow-600">
                              +{ach.achievement.points}
                            </p>
                            <p className="text-xs text-muted-foreground">points</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedFeaturesPanel;
