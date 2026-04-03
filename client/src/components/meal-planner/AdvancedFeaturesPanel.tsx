import React, { useState, useEffect } from 'react';
import {
  Brain, Calendar, Refrigerator, ShoppingBag, Trophy, TrendingUp,
  Clock, AlertCircle, CheckCircle, ChefHat, Sparkles, Plus, X
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

// Shape returned by GET /api/achievements
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  unlocked: boolean;
  progress: number;
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

interface PanelEmptyStateProps {
  icon: React.ReactNode;
  message: string;
}

const PanelEmptyState = ({ icon, message }: PanelEmptyStateProps) => (
  <div className="text-center py-8 text-muted-foreground">
    {icon}
    <p>{message}</p>
  </div>
);

export const AdvancedFeaturesPanel = () => {
  const { user } = useUser();
  const { toast } = useToast();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [leftovers, setLeftovers] = useState<Leftover[]>([]);
  const [mealPrepSchedules, setMealPrepSchedules] = useState<MealPrepSchedule[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [budgetSummary, setBudgetSummary] = useState({ estimated: 0, actual: 0, difference: 0 });
  const [loading, setLoading] = useState(false);

  const [showLeftoverForm, setShowLeftoverForm] = useState(false);
  const [leftoverForm, setLeftoverForm] = useState({
    recipeName: '', quantity: '', storageLocation: 'fridge', expiryDate: '',
  });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRecommendations(), fetchLeftovers(), fetchMealPrepSchedules(),
        fetchAchievements(), fetchGroceryList(),
      ]);
    } catch (error) {
      console.error('Error loading advanced features:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Recommendations ──────────────────────────────────────────────────────

  const fetchRecommendations = async () => {
    try {
      const res = await fetch('/api/meal-planner/meal-recommendations', { credentials: 'include' });
      if (res.ok) setRecommendations((await res.json()).recommendations || []);
    } catch (e) { console.error(e); }
  };

  const generateRecommendations = async () => {
    try {
      const res = await fetch('/api/meal-planner/meal-recommendations/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ targetDate: new Date().toISOString(), mealType: 'lunch' }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
        toast({ title: 'Success', description: `Generated ${data.recommendations?.length || 0} recommendations!` });
      }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate recommendations' }); }
  };

  const acceptRecommendation = async (id: string) => {
    try {
      const res = await fetch(`/api/meal-planner/meal-recommendations/${id}/accept`, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) throw new Error();
      await fetchRecommendations();
      toast({ title: 'Added to plan' });
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Could not accept recommendation' }); }
  };

  const dismissRecommendation = async (id: string) => {
    try {
      const res = await fetch(`/api/meal-planner/meal-recommendations/${id}/dismiss`, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) throw new Error();
      await fetchRecommendations();
      toast({ title: 'Dismissed' });
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Could not dismiss recommendation' }); }
  };

  // ── Meal Prep  (route: /prep-schedules, NOT /meal-prep-schedules) ────────

  const fetchMealPrepSchedules = async () => {
    try {
      const res = await fetch('/api/meal-planner/prep-schedules', { credentials: 'include' });
      if (res.ok) setMealPrepSchedules((await res.json()).schedules || []);
    } catch (e) { console.error(e); }
  };

  const quickCreateMealPrepSchedule = async () => {
    try {
      const res = await fetch('/api/meal-planner/prep-schedules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ prepDay: 'sunday', prepTime: '14:00', shoppingDay: 'saturday', batchRecipes: [], reminderEnabled: true }),
      });
      if (res.ok) { await fetchMealPrepSchedules(); toast({ title: 'Schedule created!' }); }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to create prep schedule' }); }
  };

  const markPrepScheduleComplete = async (id: string) => {
    try {
      const res = await fetch(`/api/meal-planner/prep-schedules/${id}/complete`, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) throw new Error();
      await fetchMealPrepSchedules();
      toast({ title: 'Nice work!', description: 'Meal prep marked complete.' });
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Could not update prep schedule' }); }
  };

  // ── Leftovers ────────────────────────────────────────────────────────────

  const fetchLeftovers = async () => {
    try {
      const res = await fetch('/api/meal-planner/leftovers?consumed=false', { credentials: 'include' });
      if (res.ok) setLeftovers((await res.json()).leftovers || []);
    } catch (e) { console.error(e); }
  };

  const submitLeftover = async () => {
    if (!leftoverForm.recipeName || !leftoverForm.quantity) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Name and quantity are required.' });
      return;
    }
    try {
      const res = await fetch('/api/meal-planner/leftovers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...leftoverForm, storedDate: new Date().toISOString().split('T')[0], expiryDate: leftoverForm.expiryDate || undefined }),
      });
      if (res.ok) {
        await fetchLeftovers();
        setLeftoverForm({ recipeName: '', quantity: '', storageLocation: 'fridge', expiryDate: '' });
        setShowLeftoverForm(false);
        toast({ title: 'Tracked!', description: 'Leftover added.' });
      }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to add leftover' }); }
  };

  const markLeftoverConsumed = async (id: string, wasted = false) => {
    try {
      const res = await fetch(`/api/meal-planner/leftovers/${id}/consume`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ wasted }),
      });
      if (res.ok) { await fetchLeftovers(); toast({ title: wasted ? 'Marked as wasted' : 'Marked as consumed' }); }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to update leftover' }); }
  };

  // ── Achievements  (route: /api/achievements, NOT /api/meal-planner/achievements) ──

  const fetchAchievements = async () => {
    try {
      const res = await fetch('/api/achievements', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAchievements(data.achievements || []);
        setTotalPoints(data.stats?.totalPoints || 0);
      }
    } catch (e) { console.error(e); }
  };

  const checkAchievements = async () => {
    try {
      const res = await fetch('/api/achievements/check', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        await fetchAchievements();
        toast({ title: data.count > 0 ? `🎉 ${data.count} achievement${data.count > 1 ? 's' : ''} unlocked!` : 'Checked!', description: data.count > 0 ? 'Keep it up!' : 'No new achievements yet — keep going!' });
      }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to check achievements' }); }
  };

  // ── Smart Grocery ────────────────────────────────────────────────────────

  const fetchGroceryList = async () => {
    try {
      const res = await fetch('/api/meal-planner/grocery-list?purchased=false', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setGroceryItems(data.items || []);
        setBudgetSummary(data.budget || { estimated: 0, actual: 0, difference: 0 });
      }
    } catch (e) { console.error(e); }
  };

  const checkPantry = async () => {
    try {
      const res = await fetch('/api/meal-planner/grocery-list/check-pantry', { method: 'POST', credentials: 'include' });
      if (res.ok) { const data = await res.json(); await fetchGroceryList(); toast({ title: 'Pantry Check Complete', description: `Found ${data.matched} items already in your pantry!` }); }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to check pantry' }); }
  };

  const getOptimizedGroceryList = async () => {
    try {
      const res = await fetch('/api/meal-planner/grocery-list/optimized', { credentials: 'include' });
      if (res.ok) { const data = await res.json(); toast({ title: 'List Optimized', description: `Organized ${data.totalItems} items by store layout!` }); }
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to optimize list' }); }
  };

  const getDaysUntilExpiry = (expiryDate: string) =>
    Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-4">
      <Tabs defaultValue="recommendations" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="recommendations"><Brain className="w-4 h-4 mr-2" />AI Recommendations</TabsTrigger>
          <TabsTrigger value="mealprep"><Calendar className="w-4 h-4 mr-2" />Meal Prep</TabsTrigger>
          <TabsTrigger value="leftovers"><Refrigerator className="w-4 h-4 mr-2" />Leftovers</TabsTrigger>
          <TabsTrigger value="grocery"><ShoppingBag className="w-4 h-4 mr-2" />Smart Grocery</TabsTrigger>
          <TabsTrigger value="achievements"><Trophy className="w-4 h-4 mr-2" />Achievements</TabsTrigger>
        </TabsList>

        {/* AI Recommendations */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-500" />AI-Powered Meal Recommendations</CardTitle>
              <CardDescription>Personalized suggestions based on your goals, preferences, and nutrition gaps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={generateRecommendations} className="w-full"><Brain className="w-4 h-4 mr-2" />Generate Recommendations</Button>
              {recommendations.length === 0 ? (
                <PanelEmptyState
                  icon={<Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />}
                  message="No recommendations yet. Generate some to get started!"
                />
              ) : recommendations.map((rec) => (
                <Card key={rec.id} className="border-l-4 border-l-purple-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <ChefHat className="w-4 h-4 text-purple-500" />
                          <h4 className="font-semibold">{rec.recipe?.title || 'Meal Suggestion'}</h4>
                          <Badge variant="secondary">{rec.mealType}</Badge>
                          <Badge variant="outline">{(Number(rec.score) * 100).toFixed(0)}% match</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{rec.reason}</p>
                        {rec.recipe && (
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>{rec.recipe.calories} cal</span><span>{rec.recipe.protein}g protein</span>
                            <span>{rec.recipe.carbs}g carbs</span><span>{rec.recipe.fat}g fat</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-2">
                        <Button size="sm" onClick={() => acceptRecommendation(rec.id)}>Add to Plan</Button>
                        <Button size="sm" variant="ghost" onClick={() => dismissRecommendation(rec.id)}>Dismiss</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meal Prep */}
        <TabsContent value="mealprep" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" />Meal Prep Scheduling</CardTitle>
              <CardDescription>Plan your batch cooking sessions and save time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" onClick={quickCreateMealPrepSchedule}><Plus className="w-4 h-4 mr-2" />Create Prep Schedule</Button>
              {mealPrepSchedules.length === 0 ? (
                <PanelEmptyState
                  icon={<Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />}
                  message="No meal prep schedules yet. Create one to get organized!"
                />
              ) : mealPrepSchedules.map((schedule) => (
                <Card key={schedule.id} className={schedule.completed ? 'opacity-60' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold capitalize">{schedule.prepDay}</h4>
                          {schedule.completed && <CheckCircle className="w-4 h-4 text-green-500" />}
                        </div>
                        <p className="text-sm text-muted-foreground">Prep: {schedule.prepTime || 'Not set'}{schedule.shoppingDay && ` • Shop: ${schedule.shoppingDay}`}</p>
                        <p className="text-xs text-muted-foreground mt-1">{schedule.batchRecipes.length} recipes planned</p>
                      </div>
                      {!schedule.completed && <Button size="sm" onClick={() => markPrepScheduleComplete(schedule.id)}>Mark Complete</Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leftovers */}
        <TabsContent value="leftovers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Refrigerator className="w-5 h-5 text-green-500" />Leftover Tracking</CardTitle>
              <CardDescription>Reduce waste and get repurposing suggestions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" onClick={() => setShowLeftoverForm(true)}><Plus className="w-4 h-4 mr-2" />Track New Leftover</Button>

              {showLeftoverForm && (
                <Card className="border-2 border-green-200 bg-green-50">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">New Leftover</h4>
                      <button onClick={() => setShowLeftoverForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>
                    <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Dish name (e.g. Roasted Chicken)" value={leftoverForm.recipeName} onChange={(e) => setLeftoverForm((p) => ({ ...p, recipeName: e.target.value }))} />
                    <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Quantity (e.g. 2 portions)" value={leftoverForm.quantity} onChange={(e) => setLeftoverForm((p) => ({ ...p, quantity: e.target.value }))} />
                    <select className="w-full border rounded px-3 py-2 text-sm" value={leftoverForm.storageLocation} onChange={(e) => setLeftoverForm((p) => ({ ...p, storageLocation: e.target.value }))}>
                      <option value="fridge">Fridge</option>
                      <option value="freezer">Freezer</option>
                      <option value="pantry">Pantry</option>
                    </select>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Expiry date (optional)</label>
                      <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={leftoverForm.expiryDate} onChange={(e) => setLeftoverForm((p) => ({ ...p, expiryDate: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setShowLeftoverForm(false)}>Cancel</Button>
                      <Button className="flex-1" onClick={submitLeftover}>Save</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {leftovers.length === 0 ? (
                <PanelEmptyState
                  icon={<Refrigerator className="w-12 h-12 mx-auto mb-2 opacity-50" />}
                  message="No leftovers tracked. Add them to reduce food waste!"
                />
              ) : leftovers.map((leftover) => {
                const daysLeft = leftover.expiryDate ? getDaysUntilExpiry(leftover.expiryDate) : null;
                const isExpiring = daysLeft !== null && daysLeft <= 2;
                return (
                  <Card key={leftover.id} className={isExpiring ? 'border-l-4 border-l-red-500' : ''}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{leftover.recipeName}</h4>
                            {isExpiring && <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />{daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}</Badge>}
                            <Badge variant="outline">{leftover.storageLocation}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">Qty: {leftover.quantity}</p>
                          <p className="text-xs text-muted-foreground">Stored: {new Date(leftover.storedDate).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2 ml-2">
                          <Button size="sm" onClick={() => markLeftoverConsumed(leftover.id)}><CheckCircle className="w-4 h-4 mr-1" />Ate it</Button>
                          <Button size="sm" variant="outline" onClick={() => markLeftoverConsumed(leftover.id, true)}>Wasted</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Smart Grocery */}
        <TabsContent value="grocery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-orange-500" />Smart Grocery List</CardTitle>
              <CardDescription>Optimized shopping with budget tracking and pantry integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[['Estimated', budgetSummary.estimated, ''], ['Actual', budgetSummary.actual, ''], ['Difference', budgetSummary.difference, budgetSummary.difference > 0 ? 'text-red-500' : 'text-green-500']].map(([label, val, cls]) => (
                  <Card key={label as string}><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">{label}</p><p className={`text-2xl font-bold ${cls}`}>${Math.abs(Number(val)).toFixed(2)}</p></CardContent></Card>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={checkPantry} variant="outline" className="flex-1"><CheckCircle className="w-4 h-4 mr-2" />Check Pantry</Button>
                <Button onClick={getOptimizedGroceryList} variant="outline" className="flex-1"><TrendingUp className="w-4 h-4 mr-2" />Optimize List</Button>
              </div>
              {groceryItems.length === 0 ? (
                <PanelEmptyState
                  icon={<ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />}
                  message="No items in your grocery list yet."
                />
              ) : groceryItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <input type="checkbox" checked={item.purchased} readOnly className="w-5 h-5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={item.purchased ? 'line-through text-muted-foreground' : ''}>{item.ingredientName}</span>
                        {item.isPantryItem && <Badge variant="secondary">In Pantry</Badge>}
                        {item.priority === 'high' && <Badge variant="destructive">Priority</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.quantity}{item.category && ` • ${item.category}`}{item.aisle && ` • Aisle ${item.aisle}`}</p>
                    </div>
                    {item.estimatedPrice && <p className="text-sm">${Number(item.estimatedPrice).toFixed(2)}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievements */}
        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" />Achievements & Progress</CardTitle>
              <CardDescription>Track your ChefSire journey and earn XP</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div><h3 className="text-3xl font-bold">{totalPoints}</h3><p className="text-sm opacity-90">Total XP Earned</p></div>
                    <Trophy className="w-12 h-12 opacity-80" />
                  </div>
                </CardContent>
              </Card>
              <Button className="w-full" variant="outline" onClick={checkAchievements}>Check for New Achievements</Button>
              {achievements.length === 0 ? (
                <PanelEmptyState
                  icon={<Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />}
                  message="Loading achievements…"
                />
              ) : achievements.map((ach) => (
                <Card key={ach.id} className={ach.unlocked ? 'border-2 border-yellow-400' : 'opacity-70'}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl ${ach.unlocked ? '' : 'grayscale'}`}>{ach.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{ach.name}</h4>
                          <Badge variant="outline" className="capitalize">{ach.category}</Badge>
                          {ach.unlocked && <CheckCircle className="w-4 h-4 text-green-500" />}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{ach.description}</p>
                        {!ach.unlocked && <Progress value={ach.progress} className="h-2" />}
                      </div>
                      <div className="text-right"><p className="text-lg font-bold text-yellow-600">+{ach.xpReward}</p><p className="text-xs text-muted-foreground">XP</p></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedFeaturesPanel;
